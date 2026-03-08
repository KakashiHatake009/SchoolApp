import { Router } from 'express';
import { requireParentToken, requireRole } from '../middleware/auth.js';
import {
    createBooking,
    getBookingByCancelToken,
    cancelBooking,
    getBookings,
} from '../controllers/bookings.controller.js';

const router = Router();

// Admin — list bookings (optionally filtered by ?eventId=)
router.get('/', requireRole('SCHOOL_ADMIN', 'TEACHER'), getBookings);

// Parent — create a booking (requires OTP-issued JWT)
router.post('/', requireParentToken, createBooking);

// Public — view or cancel booking by cancel token (emailed to parent)
router.get('/:cancelToken', getBookingByCancelToken);
router.delete('/:cancelToken', cancelBooking);

export default router;
