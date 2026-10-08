# Architecture

## 1. System overview

```
┌──────────────────────────┐   HTTPS / JSON    ┌───────────────────────────────┐   Mongoose   ┌──────────────────┐
│ React SPA (Vite)         │ ───────────────▶  │ Express REST API              │ ───────────▶ │ MongoDB          │
│ - React Router (guards)  │  Bearer JWT       │ helmet · cors · rate-limit    │  sessions /  │ replica set      │
│ - Axios (interceptors)   │ ◀───────────────  │ sanitize · zod validation     │  transactions│ (or standalone)  │
│ - Context: auth/settings │  {success,data}   │ auth → authorize → controller │              │                  │
└──────────────────────────┘                   │ → service → model             │              └──────────────────┘
                                               └───────────────────────────────┘
```

Request lifecycle in the API:

```
helmet → cors → json(100kb) → sanitize($/. keys) → morgan → rate limiter
  → router → authenticate (JWT + live user check) → authorize(roles)
  → validate(zod: params/query/body) → controller (HTTP only) → service (business rules)
  → Mongoose models → errorHandler (uniform JSON errors)
```

## 2. Folder structure

```
book-management-system/
├── backend/
│   ├── scripts/devDb.js            local MongoDB replica set for development
│   ├── src/
│   │   ├── config/                 env.js (typed config), db.js (connection, transaction detection)
│   │   ├── models/                 User, Book, Member, Category, Transaction, Setting, Counter
│   │   ├── middleware/             auth, validate, sanitize, rateLimiter, errorHandler
│   │   ├── validators/             zod schemas per resource
│   │   ├── services/               business logic (book, member, category, transaction, report,
│   │   │                           auth, user, setting, sequence, unitOfWork)
│   │   ├── controllers/            thin HTTP adapters
│   │   ├── routes/                 one router per resource + /issues alias
│   │   ├── utils/                  ApiError, apiResponse, fine, dates, isbn, query, logger, constants
│   │   ├── seed/                   demo data + seed script
│   │   ├── app.js                  express app factory (used by server and tests)
│   │   └── server.js               start-up, graceful shutdown
│   └── tests/                      Jest + Supertest suites, helpers, global replica set
└── frontend/
    └── src/
        ├── components/ui/          Button, FormField, Badge, Card, StatCard, Modal, ConfirmDialog,
        │                           DataTable, Pagination, SearchInput, Tabs, EntityPicker,
        │                           InventoryBar, Feedback (alerts, loading/empty/error states)
        ├── components/{books,members,transactions,charts}/   domain components
        ├── pages/                  Dashboard, Books, BookDetails, Members, MemberDetails,
        │                           Circulation, Categories, Transactions, Reports, Settings, Login
        ├── layouts/                AppLayout (sidebar / mobile drawer), Sidebar, navigation
        ├── routes/                 AppRoutes (lazy pages), ProtectedRoute (role guard)
        ├── context/                AuthContext, SettingsContext, ToastContext
        ├── hooks/                  useAuth, useAsync, useForm, useUrlFilters, useDebounce, ...
        ├── services/               axios instance + one service object per API resource
        ├── utils/                  format, validation, permissions, csv, constants
        └── test/                   Vitest suites and render helpers
```

## 3. Database design

All references use `ObjectId` + Mongoose `ref`. Nothing that has history is ever hard-deleted: books, members, categories and users are **deactivated** (soft delete), so every transaction keeps valid references.

### users
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| username | String | **unique**, lowercase, `[a-z0-9._-]{3,30}` |
| passwordHash | String | bcrypt, `select: false`, never serialised |
| role | `ADMIN` \| `LIBRARIAN` \| `MEMBER` | |
| status | `ACTIVE` \| `INACTIVE` | |
| member | ref Member | set for MEMBER accounts |
| tokenVersion | Number | bumped on logout / password change / deactivation → revokes JWTs |
| lastLoginAt, createdAt, updatedAt | Date | |

### books
One document per title (ISBN). Physical copies are counters:

```
totalCopies = availableCopies + issuedCopies + damagedCopies + lostCopies
```

| Field | Type | Notes |
|---|---|---|
| bookId | String | **unique**, generated `BK-00001`, immutable |
| title, subtitle | String | title required, indexed |
| isbn | String | **unique**, normalised (no hyphens), ISBN-10/13 checksum validated |
| authors | [String] | ≥ 1, indexed |
| publisher, publishedYear, edition, language, pages | | |
| category | ref Category | required, indexed with status |
| description, shelfLocation | String | |
| price | Number | replacement cost charged when lost |
| totalCopies, availableCopies, issuedCopies, damagedCopies, lostCopies | Number ≥ 0 | invariant enforced on save; changed only via atomic `$inc` |
| status | `ACTIVE` \| `INACTIVE` | |
| createdBy | ref User | |

### members
| Field | Type | Notes |
|---|---|---|
| memberId | String | **unique**, generated `MEM-00001` |
| name, phone (required), email (unique when present), address | String | |
| membershipType | `STUDENT` \| `FACULTY` \| `PUBLIC` \| `STAFF` | |
| membershipDate, membershipExpiry | Date | expiry must be after start |
| membershipStatus | `ACTIVE` \| `SUSPENDED` \| `INACTIVE` | |
| borrowingLimit | Number 1–50 | default from settings |
| currentBorrowedCount | Number ≥ 0 | equals the number of open loans |
| user | ref User | optional online account |

### categories
`name` (unique, **case-insensitive** collation index), `description`, `status`.

### transactions
| Field | Type | Notes |
|---|---|---|
| transactionId | String | **unique**, `TXN-000001` |
| book, member, issuedBy, returnedTo | refs | |
| issueDate, dueDate, returnDate, lostReportedAt | Date | dueDate stored as end of day |
| status | `ISSUED` \| `RETURNED` \| `LOST` | **OVERDUE is derived** (`ISSUED` and `dueDate < now`), never stored, so it can't go stale |
| renewCount | Number | |
| finePerDay | Number | rate snapshot at issue time |
| overdueDays, fine, fineBreakdown {overdue, damage, lost} | Number | |
| fineStatus | `NONE` \| `PENDING` \| `PAID` \| `WAIVED` | fineAssessedAt, fineSettledAt, fineSettledBy |
| returnCondition | `GOOD` \| `DAMAGED` | |
| remarks | String | |

Indexes: `{member, status}`, `{book, status}`, `{status, dueDate}` (overdue queries), `{issueDate: -1}`, `{fineStatus}`, plus a **partial unique index** `{book, member}` where `status = ISSUED`. That index stops one member holding two open loans of the same title, even when two requests race.

Virtuals returned by the API: `isOverdue`, `displayStatus`, `currentOverdueDays`, `accruedFine`.

### settings (single document) and counters
`settings` holds library policy: fine per day, loan period, max loan period, default borrowing limit, max renewals, lost/damaged fees, unpaid-fine limit, overdue-blocks-borrowing flag, currency, library name. `counters` holds the sequences for human-readable IDs.

## 4. Roles and permissions

| Capability | ADMIN | LIBRARIAN | MEMBER |
|---|:-:|:-:|:-:|
| Browse / search catalogue | ✔ | ✔ | ✔ (active books only) |
| Add / edit / deactivate books, adjust inventory | ✔ | ✔ | |
| Manage members | ✔ | ✔ | |
| Manage categories | ✔ | view | view |
| Issue / return / renew / mark lost | ✔ | ✔ | |
| View all transactions | ✔ | ✔ | own only |
| Record fine payment | ✔ | ✔ | |
| Waive fines | ✔ | | |
| Reports & dashboard analytics | ✔ | ✔ | own dashboard |
| Edit circulation policy (fine rate, limits...) | ✔ | view | |
| Manage user accounts | ✔ | | |

Enforced on the server by `authorize(...roles)` per route and by scoping in services (members' transaction queries are always filtered to their own member id). The frontend mirrors this (`utils/permissions.js`, `ProtectedRoute`) but only to hide controls; the API is the authority.

The requirements list "issue/return" only under LIBRARIAN. We treat ADMIN as a superset of LIBRARIAN, as libraries do in practice.

## 5. Main workflows

**Issue** (`POST /api/transactions/issue`)
1. Read settings (fine rate, loan period), work out the due date, reserve a `TXN-` id.
2. In one transaction: load member and book, then check member exists → active → not expired → under limit → no overdue loans → unpaid fines ≤ limit → no open loan of this title. Then check book exists → active → `availableCopies > 0`.
3. Conditional atomic writes: member `$inc currentBorrowedCount` only if `count < limit`; book `$inc available -1, issued +1` only if `available > 0`; then insert the transaction (snapshotting `finePerDay`).

**Return** (`POST /api/transactions/return`)
1. Find the open loan (by id, or book + member). Validate the optional return date (not in the future, not before issue).
2. `overdueDays = ceil((returnDate − dueDate) / 1 day)`; `fine = overdueDays × finePerDay (+ damage fee)`.
3. Close the transaction only if it is still `ISSUED`; book `issued −1`, `available +1` (or `damaged +1`); member count `−1`.

**Lost**: the loan is closed as `LOST`, the copy moves from issued to lost, and the charge is replacement cost (book price, or the lost-book fee) plus any accrued overdue fine.
**Renew**: allowed if not overdue, the member is active, and renewals are below the limit. The due date moves forward by one loan period.
**Fine settlement**: `PAY` (staff) or `WAIVE` (admin). Members with unpaid fines over the limit can't borrow.

### Consistency without transactions

`services/unitOfWork.js` checks at runtime whether MongoDB supports transactions:

* **Replica set / Atlas:** every issue/return/lost runs in `session.withTransaction()`. Write conflicts from concurrent requests are retried automatically.
* **Standalone mongod:** each write is still an atomic *conditional* update (`availableCopies: {$gt: 0}` etc.), so stock can never go negative and copies are never oversold. Each step registers an undo, and if a later step fails, the undos run in reverse.

Both modes are tested under concurrent load (`tests/concurrency.test.js`, `tests/standalone.test.js`).

## 6. Security

* Passwords hashed with bcrypt (`bcryptjs`, same algorithm; no native build step on Windows). Hashes are never selected or serialised.
* JWT (HS256, issuer-checked, 8h default). On every request the user is reloaded, so deactivated accounts and revoked sessions (logout, password change) stop working immediately.
* Login: per-IP rate limit on failed attempts; the same error for unknown user and wrong password, with constant-time comparison against a dummy hash.
* Input: a sanitiser strips `$`/`.` keys (NoSQL injection), the query parser is flat (`?a[$ne]=` can't nest), `strictQuery` is on, and zod validates every param/query/body and strips unknown fields (no mass assignment of inventory counters). Search text is regex-escaped.
* Helmet headers, a CORS allow-list, a 100 kB body limit, a global API rate limit.
* Errors: uniform shape, no stack traces or internals in production.
* Secrets only from environment variables. The server refuses to start in production with a short JWT secret.
* Frontend: the token is kept in `localStorage`. That's simple and works with the CORS setup, but it's readable by XSS, which is mitigated by React's escaping and no `dangerouslySetInnerHTML`. For higher assurance, move to an httpOnly cookie plus CSRF token. CSV exports neutralise spreadsheet formula injection.

## 7. Development plan (as executed)

1. Domain analysis → business rules ([BUSINESS_RULES.md](BUSINESS_RULES.md)).
2. Data model, indexes and invariants.
3. API skeleton: config, error handling, response format, auth/authorization, validation.
4. Catalogue: categories, books (ISBN rules, inventory moves), members.
5. Circulation: issue/return/renew/lost/fines with transactions and atomic guards.
6. Reports and dashboard aggregations.
7. API tests per stage (auth → catalogue → circulation → concurrency → reports), plus a standalone-MongoDB suite.
8. Seed data reflecting real usage.
9. React app: design system and reusable components → layout and routing → pages per role.
10. Frontend tests; manual end-to-end runs in the browser at desktop, tablet and mobile widths.
11. Documentation and demo script.
