# School Event & Appointment Booking Platform
### Project Overview Document

---

## What We Are Building

A web platform that allows schools to manage events and parent appointments digitally. Parents receive a QR code, scan it, and book a slot — no app download, no account creation needed.

---

## The Problem

Schools today manage parent-teacher meetings and events through:
- Paper sign-up sheets
- Manual phone calls
- WhatsApp groups
- Email chains

This leads to double bookings, no-shows, lost confirmations, and significant administrative overhead for school staff.

---

## The Solution

A multi-tenant SaaS platform where:
- **Schools** create events and time slots
- **Teachers** manage their own appointment slots
- **Parents** scan a printed QR code → enter email → get OTP → book a slot → receive confirmation

Everything is digital, automated, and requires zero app installation for parents.

---

## Who Uses It

| User | What They Do |
|------|-------------|
| **Platform Admin** | Manages all schools, subscriptions, and platform settings |
| **School Admin** | Creates events, manages teachers, generates QR codes |
| **Teacher** | Views and manages their own appointment slots |
| **Parent** | Scans QR code, books a slot, receives email confirmation |

---

## How It Works

### For Schools
```
1. School subscribes to the platform
2. Admin creates an event (e.g. Parent-Teacher Meeting)
3. Admin adds time slots (e.g. 9:00am, 9:15am, 9:30am...)
4. System generates a QR code for the event
5. School prints the QR code and sends it home with students
```

### For Parents
```
1. Parent scans the QR code with their phone camera
2. Landing page opens — parent enters their email
3. A 6-digit OTP code is sent to their email
4. Parent enters the code — identity verified
5. Parent sees available time slots and picks one
6. Confirmation email sent with booking details
7. Parent can cancel or modify from the email link — no login needed
```

---

## Key Features

### Multi-Tenant Architecture

Each school operates as a completely independent tenant. School A cannot see School B's data, teachers, events, or bookings. Each school has its own isolated authentication realm.

### Two Event Types

| Type | Description | Example |
|------|-------------|---------|
| **Slot Booking** | Parent picks a specific time slot | Parent-Teacher Meeting |
| **RSVP Signup** | Parent registers to attend an event | Annual Day, Sports Day |

### QR Code Flow
- Each event gets a unique, digitally signed QR code
- QR codes can be printed and distributed physically
- Scanning opens a mobile-friendly booking page instantly
- No app download required for parents

### Email Notifications
- OTP verification code
- Booking confirmation with all details
- Cancellation confirmation
- Event reminder (24 hours before)
- Cancel / modify link in every email

---

## Technical Overview

### Architecture

#### High-level Overview
```
Parents (QR Scan)          Schools & Admin
       │                          │
       │ OTP Flow                 │ Login (Keycloak)
       ▼                          ▼
  Booking Page            React Web Portal
       │                          │
       └──────────┬───────────────┘
                  │
            Node.js API
                  │
       ┌──────────┼──────────┐
       │          │          │
  PostgreSQL    Redis    Keycloak
  (App Data)   (OTP +   (Auth per
               Cache)    school)
```

#### Detailed Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                 │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐ │
│  │ Admin Portal │   │School Portal │   │   Parent Portal     │ │
│  │              │   │              │   │                     │ │
│  │ Manages all  │   │ Manages own  │   │ Scans QR code       │ │
│  │ schools      │   │ events       │   │ Books slots         │ │
│  │              │   │ slots        │   │ No login needed     │ │
│  │              │   │ teachers     │   │ Email + OTP only    │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬──────────┘ │
│         └─────────────────┘                        │           │
│                   │                                │           │
│           React (role-based)               Parent Booking      │
│           Single app                       Page (standalone)   │
└───────────────────┬────────────────────────────────┬───────────┘
                    │ Keycloak JWT                    │ OTP JWT
                    ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AUTH LAYER                               │
│                                                                 │
│  ┌───────────────────────────┐   ┌───────────────────────────┐  │
│  │        Keycloak           │   │       OTP Service         │  │
│  │                           │   │       (Node.js)           │  │
│  │  master realm             │   │                           │  │
│  │  └── superadmin           │   │  1. Parent scans QR       │  │
│  │                           │   │  2. Enters email          │  │
│  │  school_001 realm         │   │  3. Gets 6-digit OTP      │  │
│  │  └── school admin         │   │  4. OTP stored in Redis   │  │
│  │  └── teacher 1            │   │     (expires 10 mins)     │  │
│  │  └── teacher 2            │   │  5. Verified → JWT issued │  │
│  │                           │   │                           │  │
│  │  school_002 realm         │   │  Dev:  Mailhog            │  │
│  │  └── school admin         │   │  Prod: SendGrid           │  │
│  │  └── teacher 1            │   │                           │  │
│  │                           │   └───────────────────────────┘  │
│  │  Each school completely   │                                   │
│  │  isolated                 │                                   │
│  └───────────────────────────┘                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API LAYER                                │
│                    Node.js + Express                            │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌─────────────┐   │
│  │  /schools  │ │  /events   │ │  /slots   │ │  /bookings  │   │
│  │            │ │            │ │           │ │             │   │
│  │ CRUD       │ │ CRUD       │ │ CRUD      │ │ CRUD        │   │
│  │ Admin only │ │ School +   │ │ School +  │ │ Parent JWT  │   │
│  │            │ │ Admin      │ │ Teacher   │ │ cancel token│   │
│  └────────────┘ └────────────┘ └───────────┘ └─────────────┘   │
│                                                                 │
│  ┌────────────────────────┐  ┌──────────────────────────────┐   │
│  │       /qr              │  │     Keycloak Admin API       │   │
│  │                        │  │                              │   │
│  │  Generate QR image     │  │  Auto-creates realm when     │   │
│  │  HMAC sign the URL     │  │  school subscribes           │   │
│  │  Store in DO Spaces    │  │  Creates users, roles,       │   │
│  │                        │  │  clients automatically       │   │
│  └────────────────────────┘  └──────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│  ┌─────────────────────┐      ┌────────────────────────────┐   │
│  │     PostgreSQL      │      │          Redis             │   │
│  │                     │      │                            │   │
│  │  schoolapp_dev      │      │  OTP codes (10 min TTL)    │   │
│  │  ┌───────────────┐  │      │  Parent sessions           │   │
│  │  │ schools       │  │      │  Slot locks                │   │
│  │  │ teachers      │  │      │  (prevent double booking)  │   │
│  │  │ events        │  │      │                            │   │
│  │  │ slots         │  │      └────────────────────────────┘   │
│  │  │ bookings      │  │                                        │
│  │  └───────────────┘  │      ┌────────────────────────────┐   │
│  │                     │      │       DO Spaces            │   │
│  │  keycloak_dev       │      │       (Prod only)          │   │
│  │  ┌───────────────┐  │      │                            │   │
│  │  │ realms        │  │      │  QR code images            │   │
│  │  │ users         │  │      │  Served via CDN            │   │
│  │  │ roles         │  │      │                            │   │
│  │  │ clients       │  │      └────────────────────────────┘   │
│  │  └───────────────┘  │                                        │
│  └─────────────────────┘                                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION LAYER                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Email Service                         │   │
│  │                                                          │   │
│  │   Dev: Mailhog              Prod: SendGrid               │   │
│  │                                                          │   │
│  │   → OTP code                → Booking confirmed          │   │
│  │   → Booking confirmed       → Booking cancelled          │   │
│  │   → Booking cancelled       → Event reminder (24hr)      │   │
│  │   → Cancel / modify link    → Cancel / modify link       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React | Admin, School, Teacher portals |
| Backend | Node.js + Express | REST API |
| Database | PostgreSQL | All application data |
| Cache | Redis | OTP storage, session cache |
| Authentication | Keycloak | Admin, school, teacher logins |
| Parent Auth | Custom OTP | Email-based, no account needed |
| Email | SendGrid | Transactional emails |
| QR Codes | Generated server-side | Event booking links |
| Hosting | Digital Ocean | Droplets + Managed DB |

### Database Tables

| Table | Purpose |
|-------|---------|
| `schools` | School records and subscription info |
| `teachers` | Teacher profiles linked to schools |
| `events` | Events created by schools |
| `slots` | Time slots within events |
| `bookings` | Parent bookings with cancel tokens |

---

## Security

- Each school has a completely isolated authentication realm
- Parents are verified via email OTP — no passwords stored
- QR codes are HMAC signed — cannot be tampered with
- All tokens expire — OTP in 10 minutes, sessions in 2 hours
- School admins can only access their own school's data
- Cancel/modify links use one-time UUIDs — no login required

---

## Deployment

### Local Development
```
Docker Compose
├── PostgreSQL (app + auth databases)
├── Redis (OTP + cache)
├── Keycloak (authentication server)
└── Mailhog (catches all emails for testing)
```

### Production (Digital Ocean)
```
├── 2x App Droplets (Node API + React frontend)
├── 1x Keycloak Droplet
├── DO Managed PostgreSQL
├── DO Managed Redis
├── DO Load Balancer
└── DO Spaces (QR code image storage)
```

Estimated production cost: **~$120/month**

---

## Project Roadmap

### Phase 1 — Core Platform *(In Progress)*
- [ ] Infrastructure setup (Docker, Postgres, Redis, Keycloak)
- [ ] Multi-tenant authentication (one realm per school)
- [ ] Schools management API
- [ ] Events and slots API
- [ ] Bookings API with double-booking prevention
- [ ] QR code generation
- [ ] OTP service for parents
- [ ] Email notifications

### Phase 2 — Frontend
- [ ] Admin portal (React)
- [ ] School portal (React)
- [ ] Teacher portal (React)
- [ ] Parent booking page (mobile-friendly)

### Phase 3 — Production Ready
- [ ] Automated school onboarding (realm auto-creation)
- [ ] Subscription management
- [ ] Analytics dashboard
- [ ] Digital Ocean deployment
- [ ] Custom domain per school (optional)

---

## What Makes This Different

| Feature | Traditional Methods | This Platform |
|---------|-------------------|---------------|
| Booking method | Phone / paper | QR code scan |
| Parent account needed | Sometimes | Never |
| Double bookings | Common | Impossible (Redis locks) |
| Confirmation | Manual | Instant email |
| Cancellation | Phone call | Email link |
| Multi-school | Not possible | Built-in |
| Setup time | Hours | Minutes |

---
