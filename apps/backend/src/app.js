import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { requireRole } from './middleware/auth.js';

import authRouter from './routes/auth.routes.js';
import schoolsRouter from './routes/schools.routes.js';
import teachersRouter from './routes/teachers.routes.js';
import eventsRouter from './routes/events.routes.js';
import slotsRouter, { slotsFlat } from './routes/slots.routes.js';
import otpRouter from './routes/otp.routes.js';
import bookingsRouter from './routes/bookings.routes.js';
import publicRouter from './routes/public.routes.js';

const app = express();

// ── Core middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.APP_BASE_URL || 'http://localhost:3001', credentials: true }));
app.use(cookieParser());
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Auth (public — no token required) ───────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Public — no auth (parent booking page) ──────────────────────────────────
app.use('/api/public', publicRouter);

// ── OTP (public — no auth) ───────────────────────────────────────────────────
app.use('/api/otp', otpRouter);

// ── Protected API routes ─────────────────────────────────────────────────────
app.use('/api/schools', schoolsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/events', eventsRouter);

// Slots: nested under events + flat for update/delete
app.use('/api/events/:eventId/slots', slotsRouter);
app.use('/api/slots', slotsFlat);

// Bookings
app.use('/api/bookings', bookingsRouter);

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
