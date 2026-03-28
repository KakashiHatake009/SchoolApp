import prisma from '../config/prisma.js';
import { sendBookingConfirmation, sendCancellationEmail } from '../services/email.service.js';

// POST /api/bookings — parent creates a booking (requires OTP JWT)
export const createBooking = async (req, res) => {
    try {
        const { email, eventId } = req.parent;
        const {
            slotId, childName, childClass,
            salutation, parentFirstName, parentSurname,
            phone, numberOfPersons, note,
            secondPersonSalutation, secondPersonFirstName, secondPersonSurname,
        } = req.body;

        if (!parentSurname) return res.status(400).json({ error: 'parentSurname is required' });

        const event = await prisma.event.findUnique({ where: { id: eventId, isActive: true } });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const existing = await prisma.booking.findFirst({
            where: { eventId, parentEmail: email, status: 'CONFIRMED' },
        });
        if (existing) return res.status(409).json({ error: 'You already have a booking for this event' });

        let booking;

        if (slotId) {
            booking = await prisma.$transaction(async (tx) => {
                const slot = await tx.slot.findUnique({ where: { id: slotId, isActive: true } });
                if (!slot || slot.eventId !== eventId) throw Object.assign(new Error('Slot not found'), { status: 404 });
                if (slot.currentBookings >= slot.maxBookings) throw Object.assign(new Error('Slot is fully booked'), { status: 409 });

                await tx.slot.update({ where: { id: slotId }, data: { currentBookings: { increment: 1 } } });

                return tx.booking.create({
                    data: {
                        eventId, slotId,
                        salutation, parentFirstName,
                        parentSurname: parentSurname ?? 'Unknown',
                        parentEmail: email,
                        phone, childName, childClass,
                        numberOfPersons: numberOfPersons ?? 1,
                        note,
                        secondPersonSalutation, secondPersonFirstName, secondPersonSurname,
                    },
                });
            });
        } else {
            if (event.maxCapacity) {
                const count = await prisma.booking.count({ where: { eventId, status: 'CONFIRMED' } });
                if (count >= event.maxCapacity) return res.status(409).json({ error: 'Event is fully booked' });
            }

            booking = await prisma.booking.create({
                data: {
                    eventId,
                    salutation, parentFirstName,
                    parentSurname: parentSurname ?? 'Unknown',
                    parentEmail: email,
                    phone, childName, childClass,
                    numberOfPersons: numberOfPersons ?? 1,
                    note,
                    secondPersonSalutation, secondPersonFirstName, secondPersonSurname,
                },
            });
        }

        const slotInfo = slotId ? await prisma.slot.findUnique({ where: { id: slotId } }) : null;

        sendBookingConfirmation(email, {
            childName,
            eventTitle: event.name,
            slotTime: slotInfo ? `${slotInfo.date} ${slotInfo.time}` : null,
            cancelToken: booking.cancelToken,
        }).catch((e) => console.error('Booking email failed:', e.message));

        res.status(201).json(booking);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
};

// GET /api/bookings/:cancelToken — public
export const getBookingByCancelToken = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: {
                event: { select: { id: true, name: true, date: true, startTime: true, location: true } },
                slot: { select: { id: true, date: true, time: true } },
            },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json(booking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// DELETE /api/bookings/:cancelToken — public cancel
export const cancelBooking = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: { event: { select: { name: true } } },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status === 'CANCELLED') return res.status(409).json({ error: 'Booking already cancelled' });

        await prisma.$transaction(async (tx) => {
            await tx.booking.update({
                where: { cancelToken: req.params.cancelToken },
                data: { status: 'CANCELLED', modifiedAt: new Date() },
            });

            if (booking.slotId) {
                await tx.slot.update({
                    where: { id: booking.slotId },
                    data: { currentBookings: { decrement: 1 } },
                });
            }
        });

        sendCancellationEmail(booking.parentEmail, {
            eventTitle: booking.event.name,
        }).catch((e) => console.error('Cancellation email failed:', e.message));

        res.json({ message: 'Booking cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/bookings?eventId=&teacherId= — admin view
export const getBookings = async (req, res) => {
    try {
        const { eventId, teacherId } = req.query;

        const where = {};

        if (eventId) {
            where.eventId = eventId;
        } else if (!req.user.role === 'platform_admin') {
            const schoolEvents = await prisma.event.findMany({
                where: { schoolId: req.user.schoolId },
                select: { id: true },
            });
            where.eventId = { in: schoolEvents.map((e) => e.id) };
        }

        if (teacherId) {
            // Filter bookings to slots belonging to this teacher
            const teacherSlots = await prisma.slot.findMany({
                where: { teacherId },
                select: { id: true },
            });
            where.slotId = { in: teacherSlots.map((s) => s.id) };
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                event: { select: { id: true, name: true } },
                slot: { select: { id: true, date: true, time: true } },
            },
            orderBy: { bookedAt: 'desc' },
        });

        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
