# Folio — Book Management System

A full-stack library management system: catalogue, members, circulation (issue / return / renew / lost), automatic overdue detection and fines, reports and role-based access.

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Axios, Tailwind CSS, Recharts (Vite) |
| Backend | Node.js, Express 4, JWT, bcrypt, zod validation, Helmet, rate limiting |
| Database | MongoDB with Mongoose 8 (multi-document transactions on a replica set) |
| Tests | Jest + Supertest + real MongoDB (mongodb-memory-server), Vitest + React Testing Library |

```
React (Vite, :5173)  ──/api──▶  Express REST API (:5000)  ──Mongoose──▶  MongoDB (replica set)
```

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, folder structure, database design, roles & permissions, workflows, development plan |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Domain requirements, assumptions, business rules and edge cases (Stage 2) |

## Quick start

Prerequisites: **Node.js 18+** (tested on Node 24). MongoDB is optional — the project can run its own local MongoDB.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # then set JWT_SECRET (see the comment in the file)
```

Start a database — pick one:

* **No MongoDB installed:** `npm run db:memory` (keep this terminal open). It starts a local single-node replica set on port 27017 and stores data in `backend/.data/`. The first run downloads the MongoDB binary (~100 MB).
* **Your own MongoDB / Atlas:** set `MONGODB_URI` in `.env`. Use a replica set (Atlas always is) so issue/return run inside real transactions. A standalone `mongod` also works; see [Consistency without transactions](docs/ARCHITECTURE.md#consistency-without-transactions).

Load the demo data and start the API:

```bash
npm run seed          # first time; `npm run seed:reset` wipes and reloads
npm run dev           # http://localhost:5000/api
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev           # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no CORS setup is needed in development.

### Demo accounts (seed data)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin@1234` |
| Librarian | `librarian` | `Librarian@1234` |
| Member | `member` | `Member@1234` |

The login page has one-click buttons for these in development builds. **Change or remove them before any real deployment.**

The seed contains 9 categories, 38 titles (139 copies), 16 members and about 90 transactions over six months. Those include on-time and late returns, paid and unpaid fines, damaged returns, a lost book, and current overdue loans.

## Running the tests

```bash
cd backend && npm test        # 90 API, business-rule, concurrency and DB tests
cd frontend && npm test       # 35 component / page tests
```

Backend tests run against a real in-memory MongoDB replica set (and one suite against a standalone server), not mocks.

## Production build

```bash
cd frontend && npm run build          # static files in frontend/dist
cd backend && NODE_ENV=production npm start
```

Serve `frontend/dist` from any static host or CDN and point `VITE_API_URL` at the API (or reverse-proxy `/api`). Set `CORS_ORIGINS` to the frontend's origin and use a JWT secret of at least 32 characters (the server refuses to start in production otherwise).

## Environment variables

See [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (replica set recommended) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing secret and lifetime |
| `CORS_ORIGINS` | Comma-separated allowed browser origins |
| `TZ` | Timezone for due dates and monthly reports |
| `DEFAULT_FINE_PER_DAY`, `DEFAULT_LOAN_PERIOD_DAYS`, `DEFAULT_BORROWING_LIMIT` | Initial library policy (afterwards edited in **Settings → Circulation policy**) |
