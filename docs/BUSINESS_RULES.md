# Domain Requirements, Assumptions and Business Rules

This is written as a reviewer from a real library would expect it. Each rule names where it is enforced and which test proves it.

## 1. Assumptions

| # | Assumption | Why |
|---|---|---|
| A1 | A **book** record is a *title* (one ISBN). Physical copies are tracked as counts, not as individual barcoded items. | Matches the specified schema (`totalCopies`, `availableCopies`, `issuedCopies`). Per-copy barcodes are a natural extension (a `copies` collection). |
| A2 | Copy counts satisfy `total = available + issued + damaged + lost`. | Every copy is always somewhere; audits reconcile. |
| A3 | Due dates are the **end of the due day** in the library's timezone (`TZ`). A book returned any time on the due date is on time. | Matches how desks work ("due on the 10th"). |
| A4 | Each started day after the due date counts as one overdue day. | Example in the spec: due 10 Oct, returned 13 Oct → 3 days. |
| A5 | The fine rate in force **when a book is issued** applies to that loan, even if an admin changes the rate later. | Members are charged the terms they borrowed under. |
| A6 | `OVERDUE` is a derived state, not stored. | A nightly job could fail; a derived state can't go stale. |
| A7 | Registration of users is an **ADMIN** action (`POST /api/auth/register`). There is no public sign-up. | Library memberships are issued at the desk with ID checks. Members get an optional online login when registered. |
| A8 | ADMIN can do everything a LIBRARIAN can. | Administrators cover the desk in practice. |
| A9 | Lost-book charge = book's replacement price if recorded, otherwise the configured lost-book fee, plus overdue fine accrued until reported. | Common library policy. |
| A10 | IDs shown to people (`BK-`, `MEM-`, `TXN-`) are sequential. Gaps are acceptable (e.g. a refused issue). | Readable on receipts. Gap-free numbering isn't required for loans. |
| A11 | Currency defaults to INR with ₹5/day. Everything is configurable in Settings. | Spec requires the rate to be configurable. |

## 2. Core requirements → rules

| Requirement | Rule(s) | Enforced in | Tested in |
|---|---|---|---|
| Book availability | Issue only if `availableCopies > 0`, via a conditional atomic update | `transaction.service.issueBook` | circulation: *Scenario 4*; concurrency |
| Multiple copies | Copies are counters. Multiple members can each hold one copy. | Book model, issue/return | circulation: *Scenario 3* |
| Unique book IDs | `bookId` generated, unique index, immutable | Book model, sequence service | catalog: *Scenario 1* |
| ISBN | ISBN-10/13 check digit validated; normalised; **unique** | book.validator, unique index | catalog: ISBN test |
| Authors / publishers / categories | ≥ 1 author; category must exist and be active | book.service | catalog |
| Quantity / available / issued | Stock changes only through atomic `$inc`. Reducing total copies is refused if it would take away issued/damaged/lost copies. | book.service.updateBook | catalog: total-copies test |
| Borrowing limits | `currentBorrowedCount < borrowingLimit`, atomic `$expr` guard | issueBook | *Scenario 8*; concurrency |
| Due dates | Default = issue + loan period. Custom due date must be ≥ today and ≤ max loan period. | resolveDueDate | circulation: custom due dates |
| Overdue | Derived: `ISSUED && dueDate < now`. Filterable as `status=OVERDUE`. | Transaction virtuals, list filter | *Scenario 6* |
| Return dates | Optional back-dating; not in the future, not before the issue date | resolveReturnDate | circulation: return dates |
| Transaction history | Transactions are never deleted. Books, members and categories are soft-deleted. | all services | *Scenario 9* |
| Lost books | Loan closed as LOST, copy → lost, replacement + overdue charged | markLost | *Scenario 7* |
| Damaged books | Return with condition DAMAGED → copy to damaged stock, damage fee. Repair / write-off via inventory adjustments. | returnBook, adjustCopies | circulation, catalog |
| Fines | Automatic on return/lost. PAY by staff, WAIVE by admin only. | returnBook, settleFine | circulation |
| Member status | ACTIVE can borrow. SUSPENDED can't borrow but can log in. INACTIVE is closed and the login is disabled. | issueBook, updateMember | circulation, catalog |
| Book status | INACTIVE books are hidden from members and can't be issued | listBooks, issueBook | *Scenario 9* |

## 3. Validation rules (from the spec)

| Rule | Where |
|---|---|
| A book cannot be issued if no copy is available | conditional update `availableCopies: {$gt: 0}` → `409 NO_COPIES_AVAILABLE` |
| A member cannot exceed the borrowing limit | `$expr: {$lt: [count, limit]}` → `409 BORROWING_LIMIT_REACHED` |
| A return increases available copies | returnBook `$inc available +1, issued −1` |
| An issue decreases available copies | issueBook `$inc available −1, issued +1` |
| History is not destroyed when a book is deactivated | soft delete. Deactivation is refused while copies are on loan (`409 BOOK_HAS_ACTIVE_LOANS`). |
| ISBN unique | pre-check + unique index → `409 DUPLICATE_ISBN` |
| Member ID unique | generated + unique index |
| Required fields validated | zod schemas → `400 VALIDATION_ERROR` with per-field details |
| Invalid dates rejected | zod date refinement; due/return/expiry ordering checks |
| Fines calculated automatically | `utils/fine.js` on return / lost |
| Only authorised roles perform admin operations | `authorize()` per route → `403 FORBIDDEN` |

## 4. Additional rules from domain review

These came out of thinking through how a real circulation desk operates:

1. **One open loan per title per member.** Prevents hoarding and double-click duplicates. There is a pre-check plus a partial unique index (`409 DUPLICATE_LOAN`).
2. **Overdue books block new loans** (setting `blockBorrowingWhenOverdue`, default on).
3. **Unpaid fines above a threshold block new loans** (`maxOutstandingFine`, default ₹200).
4. **Expired memberships cannot borrow** (`MEMBERSHIP_EXPIRED`).
5. **Renewals**: at most `maxRenewals` (default 2), never for overdue loans, each extends by one loan period.
6. **A membership cannot be closed while books are out** (`MEMBER_HAS_ACTIVE_LOANS`). Closing it also disables the member's login.
7. **A category cannot be deactivated while it has active books** (`CATEGORY_IN_USE`). Names are unique ignoring case ("Fiction" = "fiction").
8. **Inventory corrections are explicit actions** (add copies, mark damaged, repaired, write off, lost copy found). Every move is atomic and bounded by the source bucket.
9. **The last active admin cannot be demoted or deactivated**, and admins cannot deactivate themselves or change their own role.
10. **Double return protection**: a loan returned concurrently by two librarians is counted once (`TRANSACTION_CLOSED`).

## 5. Edge cases handled

| Edge case | Behaviour |
|---|---|
| Two librarians issue the last copy at the same instant | One succeeds, the other gets `NO_COPIES_AVAILABLE`; counters stay correct |
| Same member double-clicks "Issue" | Exactly one loan |
| Returned at 23:30 on the due date | 0 days overdue |
| Returned 00:05 the next day | 1 day overdue |
| Fine rate changed while books are out | Existing loans keep their rate |
| Return date typed in the future / before issue | `400 INVALID_RETURN_DATE` |
| Edit form saved after a copy was issued in the meantime | The conditional update refuses an impossible copy reduction |
| Book with no price is lost | Configured lost-book fee is charged |
| Member e-mail left blank | Allowed for many members (partial unique index) |
| Malformed ids, malformed JSON, unknown routes | `400 INVALID_ID`, `400 INVALID_JSON`, `404 ROUTE_NOT_FOUND` |
| `{"username": {"$ne": null}}` login payload | Operators stripped; rejected by validation |
| Regex metacharacters in search (`(a+)+$`) | Escaped, matched literally |
| Deactivated user still holding a token | Rejected on the next request |
