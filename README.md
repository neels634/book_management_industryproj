# Book Management System

- **Frontend:** React Native (Expo): runs on mobile, web and desktop browsers
- **Backend:** Python FastAPI
- **Database:** SQL (SQLite locally, AWS RDS in production)

Features: books, members, issue / return, overdue fines, and a dashboard.

## Run the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python seed.py                  # optional sample data
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Run the frontend

```bash
cd frontend
npm install
npm run web        # browser / desktop
npm start          # scan the QR code with Expo Go on a phone
```

On a phone, `localhost` means the phone itself. Start Expo with your computer's LAN address:
`EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npm start`, and run uvicorn with `--host 0.0.0.0`.

## Production (AWS RDS)

Set `DATABASE_URL` to the RDS database and install its driver, e.g. for PostgreSQL:

```bash
pip install psycopg2-binary
DATABASE_URL=postgresql://user:password@your-db.xxxxx.rds.amazonaws.com:5432/library
```

Tables are created automatically on start-up.

| Setting | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./library.db` | Database connection |
| `LOAN_DAYS` | `14` | Loan period |
| `FINE_PER_DAY` | `5` | Fine per overdue day (₹) |
| `CORS_ORIGINS` | `*` | Allowed frontend origins (comma-separated) |

## Rules

- A book can only be issued if a copy is available.
- A member can't borrow more than their borrowing limit (default 3).
- Fine = overdue days × fine per day, charged on return.
- A book or member with books on loan can't be removed. Removal is a soft delete, so loan history is kept.
- ISBNs must be valid and unique; member e-mails must be unique.
