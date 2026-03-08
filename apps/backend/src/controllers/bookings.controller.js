import prisma from '../config/prisma.js';
import { sendBookingConfirmation, sendCancellationEmail } from '../services/email.service.js';

// ── POST /api/bookings ───────────────────────────────────────────────────────
// Requires parent OTP token (req.parent = { email, eventId })
// Body: { slotId?, childName? }
// Uses a Prisma transaction to atomically increment slot.currentBookings

export const createBooking = async (req, res) => {
    try {
        const { email, eventId } = req.parent;
        const { slotId, childName } = req.body;

        // Validate event
        const event = await prisma.event.findUnique({
            where: { id: eventId, isActive: true },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Check for duplicate booking (same parent, same event)
        const existing = await prisma.booking.findFirst({
            where: { eventId, parentEmail: email, status: 'CONFIRMED' },
        });
        if (existing) {
            return res.status(409).json({ error: 'You already have a booking for this event' });
        }

        let booking;

        if (slotId) {
            // Slot booking — use transaction to prevent overbooking
            booking = await prisma.$transaction(async (tx) => {
                const slot = await tx.slot.findUnique({ where: { id: slotId, isActive: true } });

                if (!slot || slot.eventId !== eventId) {
                    throw Object.assign(new Error('Slot not found'), { status: 404 });
                }
                if (slot.currentBookings >= slot.maxBookings) {
                    throw Object.assign(new Error('Slot is fully booked'), { status: 409 });
                }

                await tx.slot.update({
                    where: { id: slotId },
                    data: { currentBookings: { increment: 1 } },
                });

                return tx.booking.create({
                    data: { eventId, slotId, parentEmail: email, childName },
                });
            });
        } else {
            // RSVP — check overall event capacity if set
            if (event.maxCapacity) {
                const count = await prisma.booking.count({
                    where: { eventId, status: 'CONFIRMED' },
                });
                if (count >= event.maxCapacity) {
                    return res.status(409).json({ error: 'Event is fully booked' });
                }
            }

            booking = await prisma.booking.create({
                data: { eventId, parentEmail: email, childName },
            });
        }

        // Send confirmation email (non-blocking — don't fail booking if email fails)
        const slotInfo = slotId
            ? await prisma.slot.findUnique({ where: { id: slotId } })
            : null;

        sendBookingConfirmation(email, {
            childName,
            eventTitle: event.title,
            slotTime: slotInfo
                ? `${slotInfo.startTime.toLocaleString()} – ${slotInfo.endTime.toLocaleTimeString()}`
                : null,
            cancelToken: booking.cancelToken,
        }).catch((e) => console.error('Booking email failed:', e.message));

        res.status(201).json(booking);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/bookings/:cancelToken ───────────────────────────────────────────
// Public — used by parent to view their booking (via cancel page)

export const getBookingByCancelToken = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: {
                event: { select: { id: true, title: true, startDate: true, location: true } },
                slot: { select: { id: true, startTime: true, endTime: true } },
            },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        res.json(booking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE /api/bookings/:cancelToken ────────────────────────────────────────
// Public — parent cancels their own booking via the cancel link in their email

export const cancelBooking = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: { event: { select: { title: true } } },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Booking is already cancelled' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.booking.update({
                where: { cancelToken: req.params.cancelToken },
                data: { status: 'CANCELLED', modifiedAt: new Date() },
            });

            // Release the slot capacity if applicable
            if (booking.slotId) {
                await tx.slot.update({
                    where: { id: booking.slotId },
                    data: { currentBookings: { decrement: 1 } },
                });
            }
        });

        sendCancellationEmail(booking.parentEmail, {
            eventTitle: booking.event.title,
        }).catch((e) => console.error('Cancellation email failed:', e.message));

        res.json({ message: 'Booking cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/bookings — admin view ───────────────────────────────────────────
// SCHOOL_ADMIN sees all bookings for their school's events

export const getBookings = async (req, res) => {
    try {
        const { eventId } = req.query;

        const where = {};
        if (eventId) {
            where.eventId = eventId;
        } else if (!req.user.isPlatformAdmin) {
            // Filter to events belonging to the admin's school
            const schoolEvents = await prisma.event.findMany({
                where: { schoolId: req.user.schoolId },
                select: { id: true },
            });
            where.eventId = { in: schoolEvents.map((e) => e.id) };
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                event: { select: { id: true, title: true } },
                slot: { select: { id: true, startTime: true, endTime: true } },
            },
            orderBy: { bookedAt: 'desc' },
        });

        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
