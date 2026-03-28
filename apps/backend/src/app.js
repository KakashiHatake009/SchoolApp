import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import swaggerUi from 'swagger-ui-express';
import swaggerDefinition from './swagger.js';
import { requireRole } from './middleware/auth.js';

import authRouter from './routes/auth.routes.js';
import schoolsRouter from './routes/schools.routes.js';
import teachersRouter from './routes/teachers.routes.js';
import eventsRouter from './routes/events.routes.js';
import slotsRouter, { slotsFlat } from './routes/slots.routes.js';
import otpRouter from './routes/otp.routes.js';
import bookingsRouter from './routes/bookings.routes.js';
import publicRouter from './routes/public.routes.js';
import { getEventQr } from './controllers/qr.controller.js';

const app = express();

// ── Core middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Auth ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/schools', schoolsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/events', eventsRouter);

// Slots: nested under events + flat for update/delete
app.use('/api/events/:eventId/slots', slotsRouter);
app.use('/api/slots', slotsFlat);

// Public — no auth (parent booking page looks up events by QR token)
app.use('/api/public', publicRouter);

// OTP (public — no auth)
app.use('/api/otp', otpRouter);

// Bookings
app.use('/api/bookings', bookingsRouter);

// QR code
app.get('/api/events/:id/qr', requireRole('school_admin'), getEventQr);

// ── Swagger UI ──────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
});
