# SchoolBook — Backend API

Multi-tenant SaaS platform for schools to manage parent-teacher appointment booking and event sign-ups. Parents scan a QR code, verify via OTP email, and book a time slot — no account required.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18+ + Express.js (ESM modules) |
| Frontend | React 19 + TypeScript + Vite (see `booking-platform` repo) |
| Database | PostgreSQL 15/16 |
| ORM | Prisma 5 |
| Cache / OTP | Redis 7 |
| Auth | Simple JWT (admins) + OTP JWT (parents) |
| API Docs | Swagger UI |

---

## Project Structure

```
SchoolApp/
├── apps/
│   ├── backend/              # Express REST API (port 3000)
│   │   ├── src/
│   │   │   ├── controllers/  # Request handlers
│   │   │   ├── routes/       # Express routers
│   │   │   └── middleware/   # JWT auth + role guards
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Database models
│   │   │   └── seed.js       # Seed script (creates admin user)
│   │   └── .env              # Environment variables (not committed)
│   └── frontend/             # Legacy JSX frontend (not actively used)
└── package.json              # npm workspaces
```

> The actively maintained frontend is in the separate `booking-platform` repository (React + TypeScript).

---

## Prerequisites

- **Node.js** v18+
- **PostgreSQL** 15 or 16 — running on port **2022** (non-standard, configured in `postgresql.conf`)
- **Redis** 7 (for OTP storage)

---

## Local Development Setup

### 1. Install dependencies

```bash
cd SchoolApp
npm install
```

### 2. Configure environment variables

Create `apps/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:2022/schoolbook"
JWT_SECRET="dev-jwt-secret-change-in-production"
OTP_JWT_SECRET="dev-otp-secret-change-in-production"
PORT=3000
```

> PostgreSQL runs on port **2022** (not the default 5432). Check your `postgresql.conf` if you're unsure.

### 3. Run database migrations

```bash
cd apps/backend
npx prisma migrate dev
```

### 4. Seed the database

Creates the default platform admin account:

```bash
npm run seed
```

### 5. Start the backend

```bash
npm run dev
```

API runs on **http://localhost:3000**

Swagger docs available at **http://localhost:3000/api-docs**

---

## Default Login Credentials

| Role | Email | Password |
|---|---|---|
| Platform Admin | admin@schoolbook.de | admin123 |

> Change this password after first login in production.

---

## Services & Ports

| Service | URL | Notes |
|---|---|---|
| Backend API | http://localhost:3000 | Express REST API |
| API Docs | http://localhost:3000/api-docs | Swagger UI |
| PostgreSQL | localhost:2022 | Non-standard port |
| Redis | localhost:6379 | OTP cache |

---

## User Roles

| Role | What they can do |
|---|---|
| `platform_admin` | Full access — manage all schools, events, teachers, bookings |
| `school_admin` | Manage their school's events, slots, teachers, bookings |
| `teacher` | View and toggle their own appointment slots |
| Parent | No account — authenticates via OTP email, books slots via QR code |

Role names are **lowercase** throughout the codebase, JWT payload, and database.

---

## Authentication

### Admin / Teacher Login

```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "user": {...}, "token": "JWT" }
```

Include the token in all subsequent requests:
```
Authorization: Bearer <token>
```

### Parent OTP Flow

Parents have no account. They authenticate per-event:

1. `POST /api/otp/send` — sends 6-digit code to parent email
2. `POST /api/otp/verify` — verifies code, returns short-lived `parentToken`
3. `POST /api/bookings` — uses `parentToken` as Bearer token

### JWT Payload

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "platform_admin | school_admin | teacher",
  "schoolId": "school-id-or-null"
}
```

---

## API Reference

Full interactive docs: **http://localhost:3000/api-docs**

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login, returns JWT |

### Schools
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/schools` | platform_admin | List all schools |
| POST | `/api/schools` | platform_admin | Create school |
| GET | `/api/schools/:id` | admin | Get school by ID |
| PATCH | `/api/schools/:id` | platform_admin | Update school |
| DELETE | `/api/schools/:id` | platform_admin | Delete school |

### Events
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/events` | admin | List events (scoped by school for school_admin) |
| POST | `/api/events` | school_admin | Create event |
| GET | `/api/events/:id` | admin | Get event by ID |
| PATCH | `/api/events/:id` | school_admin | Update event |
| DELETE | `/api/events/:id` | school_admin | Delete event |
| POST | `/api/events/:id/duplicate` | school_admin | Duplicate event |
| POST | `/api/events/:id/publish` | school_admin | Publish event |
| POST | `/api/events/:id/unpublish` | school_admin | Unpublish event |

### Teachers
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/teachers` | admin | List teachers (`?eventId=` or `?schoolId=`) |
| POST | `/api/teachers` | school_admin | Create teacher |
| GET | `/api/teachers/:id` | admin | Get teacher by ID |
| PATCH | `/api/teachers/:id` | school_admin | Update teacher |
| DELETE | `/api/teachers/:id` | school_admin | Delete teacher |
| POST | `/api/teachers/import` | school_admin | Bulk import from Excel |

### Appointment Slots
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/slots` | - | Get slots (`?teacherId=` or `?eventId=`) |
| PATCH | `/api/slots/:id` | teacher | Toggle slot active/inactive |

### Bookings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/bookings` | school_admin | List bookings (`?eventId=`) |
| POST | `/api/bookings` | parent token | Create booking |
| GET | `/api/bookings/:cancelToken` | None | Get booking by cancel token |
| DELETE | `/api/bookings/:cancelToken` | None | Cancel booking |

### OTP
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/otp/send` | None | Send OTP to parent email |
| POST | `/api/otp/verify` | None | Verify OTP, get parent token |

### QR Code
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/qr/:eventId` | school_admin | Generate QR code for event |

---

## Database Schema

Key models (`prisma/schema.prisma`):

**User** — system accounts
```
id, email, password (bcrypt), role, name, schoolId?, teacherId?
```

**School**
```
id, name, address, contactEmail, isActive, createdAt
```

**SchoolEvent**
```
id, schoolId, name, description, type (slot_booking | rsvp_signup),
date, startTime, endTime, slotDuration, status (draft | published),
qrCode, createdAt, duplicatedFrom?
```

**Teacher** — supports two teachers per row (Elternsprechtag format)
```
id, eventId, schoolId, klasse, roomNo,
salutation, titel, firstName, surname, email,
salutation2, titel2, firstName2, surname2, email2,
bookingStatus, isActive, createdAt
```

**AppointmentSlot**
```
id, eventId, teacherId, startTime, endTime,
status (available | booked | disabled), createdAt
```

**Booking**
```
id, eventId, teacherId, slotId, schoolId,
parentFirstName, parentLastName, parentEmail, childName, childClass,
status (CONFIRMED | CANCELLED), cancelToken, bookedAt
```

---

## Useful Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start backend with nodemon |
| `npm run seed` | Seed database with admin user |
| `npx prisma migrate dev` | Apply and generate new migration |
| `npx prisma migrate deploy` | Apply migrations in production |
| `npx prisma studio` | Open visual database browser |
| `npx prisma generate` | Regenerate Prisma client |

---

## Production Deployment

### Recommended (Free Tier, EU/GDPR Compliant)

| Service | Provider | Region |
|---|---|---|
| Backend (Express) | [Render](https://render.com) | Frankfurt |
| PostgreSQL | [Neon](https://neon.tech) | Frankfurt |
| Redis | [Upstash](https://upstash.com) | Frankfurt |

> **GDPR Note**: This app handles school and child data. Use EU (Frankfurt) region for all services to comply with German DSGVO requirements.

### Render Deployment Steps

1. Push code to GitHub
2. Create a **Web Service** on Render pointing to `apps/backend`
3. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
4. Start command: `node src/app.js`
5. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `OTP_JWT_SECRET`, `PORT`

### Before Going Live

- [ ] Change `JWT_SECRET` and `OTP_JWT_SECRET` to strong random values (`openssl rand -hex 32`)
- [ ] Set up real SMTP for email (Mailtrap for staging, production SMTP for live)
- [ ] Rotate the default `admin@schoolbook.de` password
- [ ] Review CORS allowed origins in `src/app.js`
- [ ] Enable HTTPS (automatic on Render)
