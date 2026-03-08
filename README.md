# School Booking Platform

Multi-tenant SaaS platform for schools to manage parent-teacher appointment booking and event sign-ups. Parents scan a QR code, verify via OTP email, and book a time slot — no account required.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, Prisma ORM |
| Frontend | React 18 + Vite |
| Database | PostgreSQL 16 |
| Cache / OTP | Redis 7 |
| Auth | Keycloak 24 (admins) + OTP JWT (parents) |
| Email | Nodemailer → Mailhog (dev) |
| Reverse proxy (prod) | nginx |

---

## Project Structure

```
school-booking/
├── apps/
│   ├── backend/          # Express API (port 3000)
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── middleware/
│   │   │   ├── config/
│   │   │   └── lib/
│   │   └── prisma/
│   └── frontend/         # React + Vite (port 3001)
│       └── src/
│           ├── pages/
│           │   ├── admin/    # Admin portal
│           │   └── parent/   # Parent booking flow
│           └── components/
├── devops/
│   ├── keycloak/         # Realm config + setup scripts
│   ├── nginx/            # Reverse proxy config (prod)
│   └── postgres/         # DB init SQL
├── docker-compose.yml        # Dev infra (postgres, redis, keycloak, mailhog)
├── docker-compose.prod.yml   # Production (all services containerised)
└── package.json              # npm workspaces + root scripts
```

---

## Prerequisites

- **Node.js** v20+
- **npm** v10+
- **Docker Desktop** (with WSL integration enabled on Windows)

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> school-booking
cd school-booking
npm install
```

### 2. Start infrastructure

```bash
npm run infra:up
```

This starts PostgreSQL, Redis, Keycloak, and Mailhog via Docker Compose.

Wait ~30 seconds for Keycloak to finish importing the realm, then verify:

```bash
curl http://localhost:3000/health   # API health (after step 4)
curl http://localhost:8081          # Keycloak admin UI
```

### 3. Configure environment variables

```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env
```

Get the `KEYCLOAK_CLIENT_SECRET` for the `node-api` client:

1. Open [http://localhost:8081](http://localhost:8081) → login with `admin / admin`
2. Select realm **school_001**
3. Go to **Clients** → `node-api` → **Credentials** tab → copy the secret
4. Paste it into `apps/backend/.env` as `KEYCLOAK_CLIENT_SECRET`

Set `OTP_JWT_SECRET` to any random string (min 32 chars):

```bash
# Linux / macOS
openssl rand -hex 32
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start the apps

```bash
npm run dev
```

This starts both backend (`:3000`) and frontend (`:3001`) with colour-coded output.

Or start them individually:

```bash
npm run dev:backend    # API only
npm run dev:frontend   # React app only
```

---

## Services & Ports

| Service | URL | Purpose |
|---|---|---|
| Frontend | http://localhost:3001 | React admin portal + parent booking |
| Backend API | http://localhost:3000 | Express REST API |
| Keycloak | http://localhost:8081 | Auth server admin UI |
| Mailhog | http://localhost:8025 | View emails sent in dev |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | OTP cache |

---

## Test Accounts

These accounts exist in the `school_001` Keycloak realm after setup:

| Role | Username | Password |
|---|---|---|
| Platform Admin | `platform_admin` | `PlatformAdmin1234!` |
| School Admin | `school_admin_1` | `Admin1234!` |
| Teacher | `teacher_1` | `Teacher1234!` |

Log in at [http://localhost:3001/admin/events](http://localhost:3001/admin/events).

---

## User Roles

| Role | What they can do |
|---|---|
| `PLATFORM_ADMIN` | Full access — manage all schools, events, teachers, bookings |
| `SCHOOL_ADMIN` | Manage their school's events, slots, teachers, bookings |
| `TEACHER` | Read-only access to their school's events and slots |
| Parent | No account — authenticates via OTP email, books slots via QR code |

---

## Parent Booking Flow

1. School admin generates a QR code for an event
2. Parent scans QR → lands on `/book/:qrToken`
3. Enters email → receives OTP in inbox (check Mailhog in dev)
4. Verifies OTP → picks an available time slot
5. Receives booking confirmation email with a cancel link

---

## Useful Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend together |
| `npm run dev:backend` | Start API only |
| `npm run dev:frontend` | Start React app only |
| `npm run infra:up` | Start Docker services (postgres, redis, keycloak, mailhog) |
| `npm run infra:down` | Stop Docker services |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run build` | Build frontend for production |

---

## Keycloak Setup Scripts

If Keycloak loses its realm config (e.g. after `docker volume rm`), re-run the setup:

```bash
bash devops/keycloak/setup-keycloak.sh
```

To export the current realm state to JSON (commit this after manual Keycloak changes):

```bash
bash devops/keycloak/export-realm.sh
```

---

## Production Deployment

Copy and fill in the production env file:

```bash
cp .env.prod.example .env.prod
# edit .env.prod with real secrets, domain, SMTP, etc.
```

Build and start all services:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Run migrations inside the running container:

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

The nginx reverse proxy exposes port `80`:
- `/` → frontend (React static files)
- `/api/` → backend (Express API)

---

## Data Persistence

- **PostgreSQL data** is stored in the `postgres_data` Docker volume — survives `docker compose down`
- **Never run `docker compose down -v`** without first exporting the Keycloak realm:
  ```bash
  bash devops/keycloak/export-realm.sh
  git add devops/keycloak/school_001-realm.json && git commit -m "chore: update keycloak realm"
  ```
