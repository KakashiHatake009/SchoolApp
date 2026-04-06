import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    createBooking,
    getBookingByCancelToken,
    cancelBooking,
    rescheduleBooking,
    getBookings,
} from '../controllers/bookings.controller.js';

const router = Router();

// Admin — list bookings (optionally filtered by ?eventId= or ?teacherId=)
router.get('/', requireRole('school_admin', 'teacher'), getBookings);

// Public — create a booking (parent provides email in request body)
router.post('/', createBooking);

// Public — view, cancel, or reschedule booking by cancel token (emailed to parent)
router.get('/:cancelToken', getBookingByCancelToken);
router.delete('/:cancelToken', cancelBooking);
router.patch('/:cancelToken/reschedule', rescheduleBooking);

export default router;
