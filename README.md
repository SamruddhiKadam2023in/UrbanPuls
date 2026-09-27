# 🅿 TPMS — Traffic & Parking Management System

Parking reservations with **pay at the gate**, a gate screen for Parking Partners with QR check-in, citizen complaints with reward points, traffic insights and emergency calling. Built for Mumbai.

## How parking works

1. **Reserve.** The user picks a zone, a time window and a free slot. Nothing is paid online. The user gets a booking code and QR code.
2. **Arrive.** Check-in opens 30 minutes before the start time. If the car hasn't arrived 15 minutes after the start time, the booking becomes a **no-show** and the slot is released.
3. **Check in at the gate.** The Parking Partner scans the QR code, or types the code or vehicle number, on the **Gate** screen.
4. **Check out and pay.** The fare is worked out from the actual time parked (minimum 1 hour, then 30-minute steps), minus any reward points the user chose to spend. The customer pays cash or scans the zone's UPI QR code. The Parking Partner records the payment and a PDF receipt is created.

Walk-in cars without a booking can be checked in straight from the Gate screen.

**Limits:** at most 2 active bookings per user. After 3 no-shows in 30 days, online booking is paused (walk-ins still work).

## Roles

Parking lot owners and operators are called **Parking Partners** in the app. In the code and database the role is still named `vendor`.


| Role | Can do | Pages |
|------|--------|-------|
| User | Reserve, extend and cancel bookings; rate visits; report complaints; earn points | Map, Bookings, Complaints, Notifications |
| Parking Partner | Owns or runs parking lots. Everything a user can, plus manage their own lots and slots, check cars in and out, record payments, see reports. Sign-ups need admin approval | + Gate, Zones, Analytics, Dashboard |
| Police | Resolve verified complaints on a map, download fines, use violation detection | + Enforcement, Detection |
| Admin | Everything: manage users and roles, approve Parking Partners, create staff accounts, verify complaints | + Admin |

## Live updates and notifications

The browser keeps one WebSocket open (`/api/live/ws`). Through it:
- users get notifications (booking confirmed, checked in, receipt, reminder 30 minutes before start, no-show, complaint updates)
- maps, the Gate screen and the Zones page refresh when availability changes
- Parking Partners, police and admins get violation alerts

Notifications are also stored (bell icon) and the important ones are emailed. They are written in each user's chosen language.

Nobody can make themselves an admin at sign-up. Staff accounts are created by an admin (`POST /api/admin/users`), and the first admin with `create_admin.py`.

## Project structure

```
traffic-parking-ps/
├── backend/
│   ├── core/          config, database, security (JWT), rate limiting, time helpers
│   ├── models/        SQLAlchemy models
│   ├── routes/        auth, admin, zones, bookings, gate, complaints, detection, traffic, vendors, alerts
│   ├── services/      booking rules, email, file storage, PDFs, SMS
│   ├── migrations/    Alembic database migrations
│   ├── tests/         pytest suite
│   ├── yolo/          detector + training script
│   ├── seed.py        demo data (development only)
│   └── create_admin.py
├── frontend/          React + Vite + Redux
└── docker-compose.yml PostgreSQL, Redis, backend, nginx frontend
```

## Local development (Windows)

Needs Python 3.11+ and Node.js 20+.

```
setup_windows.bat     (installs everything, creates the database, loads demo data)
start.bat             (starts backend and frontend, opens http://localhost:5173)
```

Manual steps:

```bash
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
alembic upgrade head
python seed.py
uvicorn main:app --reload --port 8000

cd frontend
npm install
npm run dev
```

Development uses SQLite by default. Emails (verification and password reset links) are printed in the backend console until `SMTP_HOST` is set.

**Demo logins** (development only, created by `seed.py`):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tpms.com | admin123 |
| Parking Partner | vendor@tpms.com | vendor123 |
| User | user@tpms.com | user123 |
| Police | police@tpms.com | police123 |

## Languages

The app is available in English, Hindi and Marathi. Text lives in `frontend/src/locales/*.json`; the English wording is written in the code as `t('key', 'English text')`.

```bash
cd frontend
npm run i18n:sync     # after changing text in the code: updates en.json
npm run i18n:check    # fails if Hindi or Marathi is missing a key or a {{placeholder}}
```

Server notifications and emails are in `backend/services/messages.py`.

## Tests

```bash
cd backend
pytest
```

To run them against PostgreSQL, set `TEST_DATABASE_URL=postgresql://...` first.

## Database changes

The schema is managed with Alembic. After changing a model:

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

`tests/test_migrations.py` fails if a model changes without a migration.

## Configuration

All settings are environment variables. See `backend/.env.example` for the full list. The important ones:

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | `production` enforces a strong `SECRET_KEY` and PostgreSQL, hides API docs and disables demo detections |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` in production |
| `SECRET_KEY` | Random string of at least 32 characters |
| `FRONTEND_URL`, `CORS_ORIGINS` | Public site address, used in email links and CORS |
| `SMTP_*` | Email delivery for verification and password reset |
| `RATE_LIMIT_STORAGE_URI` | `redis://...` when running several workers |
| `BOOKING_GRACE_MINUTES`, `MAX_ACTIVE_RESERVATIONS`, `NO_SHOW_LIMIT` | Booking rules |
| `CLOUDINARY_*` | Optional cloud storage for complaint photos (local disk otherwise) |
| `TWILIO_*` | Optional SMS to police (skipped when empty) |

Each parking zone can have a `upi_id` (e.g. `parking@okicici`). At checkout the Gate screen shows a UPI QR code for the exact amount, which pays the Parking Partner directly.

## Docker

```bash
docker compose up --build
docker compose exec backend python create_admin.py --email you@example.com --name "Your Name"
```

Opens at http://localhost:5173. Migrations run automatically when the backend starts.

## Violation detection (YOLO)

Detection stays switched off in production until a trained model exists at `backend/yolo/model.onnx`. In development it returns fixed sample results. Only the `illegal_parking` label counts as a violation. To train a model, see `backend/yolo/train_yolo.py`.

## API docs

http://localhost:8000/docs (not available when `ENVIRONMENT=production`).
