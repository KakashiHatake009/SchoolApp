import prisma from '../config/prisma.js';
import { sendBookingConfirmation, sendCancellationEmail } from '../services/email.service.js';

// ── POST /api/bookings ───────────────────────────────────────────────────────
// Public — parent provides email in request body
export const createBooking = async (req, res) => {
    try {
        const { slotId, eventId, parentEmail, parentSurname, parentFirstName, salutation, phone,
                childName, childClass, numberOfPersons,
                secondPersonSalutation, secondPersonFirstName, secondPersonSurname, note } = req.body;
        const email = parentEmail;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { school: { select: { name: true } } },
        });
        if (!event) return res.status(404).json({ error: 'Event not found' });

        // Duplicate booking guard
        const existing = await prisma.booking.findFirst({
            where: { eventId, parentEmail: email, status: 'confirmed' },
        });
        if (existing) {
            return res.status(409).json({ error: 'You already have a booking for this event' });
        }

        let booking;

        if (slotId) {
            booking = await prisma.$transaction(async (tx) => {
                const slot = await tx.slot.findUnique({ where: { id: slotId } });
                if (!slot || slot.eventId !== eventId) {
                    throw Object.assign(new Error('Slot not found'), { status: 404 });
                }
                if (slot.status !== 'available') {
                    throw Object.assign(new Error('Slot is not available'), { status: 409 });
                }

                await tx.slot.update({ where: { id: slotId }, data: { status: 'booked' } });

                return tx.booking.create({
                    data: {
                        eventId, slotId, parentEmail: email,
                        salutation, parentFirstName, parentSurname, phone,
                        childName, childClass, numberOfPersons: numberOfPersons ?? 1,
                        secondPersonSalutation, secondPersonFirstName, secondPersonSurname, note,
                    },
                });
            });
        } else {
            booking = await prisma.booking.create({
                data: {
                    eventId, parentEmail: email,
                    salutation, parentFirstName, parentSurname, phone,
                    childName, childClass, numberOfPersons: numberOfPersons ?? 1,
                    secondPersonSalutation, secondPersonFirstName, secondPersonSurname, note,
                },
            });
        }

        // Fire-and-forget confirmation email — fetch slot+teacher for full details
        (async () => {
            try {
                let slotDate, slotTime, teacherName, roomNo;
                if (booking.slotId) {
                    const slot = await prisma.slot.findUnique({
                        where: { id: booking.slotId },
                        include: { teacher: { select: { salutation: true, firstName: true, surname: true, roomNo: true } } },
                    });
                    if (slot) {
                        slotDate = slot.date;
                        slotTime = slot.time;
                        teacherName = [slot.teacher?.salutation, slot.teacher?.firstName, slot.teacher?.surname].filter(Boolean).join(' ');
                        roomNo = slot.teacher?.roomNo;
                    }
                }
                await sendBookingConfirmation(email, {
                    parentName: `${salutation ?? ''} ${parentSurname ?? ''}`.trim(),
                    eventName: event.name,
                    schoolName: event.school?.name,
                    slotDate,
                    slotTime,
                    teacherName,
                    roomNo,
                    cancelToken: booking.cancelToken,
                    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
                });
            } catch (e) {
                console.error('Booking email failed:', e.message);
            }
        })();

        res.status(201).json(booking);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/bookings — admin view ───────────────────────────────────────────
export const getBookings = async (req, res) => {
    try {
        const { eventId, teacherId } = req.query;

        let where = {};
        if (eventId) {
            where.eventId = eventId;
        } else if (teacherId) {
            // Filter bookings for slots belonging to the teacher
            where.slot = { teacherId };
        } else if (!req.user.isPlatformAdmin) {
            const schoolEvents = await prisma.event.findMany({
                where: { schoolId: req.user.schoolId },
                select: { id: true },
            });
            where.eventId = { in: schoolEvents.map((e) => e.id) };
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                event: { select: { id: true, name: true } },
                slot: {
                    select: {
                        id: true, time: true, date: true,
                        teacher: { select: { id: true, salutation: true, firstName: true, surname: true } },
                    },
                },
            },
            orderBy: { bookedAt: 'desc' },
        });

        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── PATCH /api/bookings/:cancelToken/reschedule ──────────────────────────────
// Public — parent changes their booked slot via the cancel token
export const rescheduleBooking = async (req, res) => {
    try {
        const { slotId } = req.body;
        if (!slotId) return res.status(400).json({ error: 'slotId is required' });

        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
        });
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status === 'CANCELLED') return res.status(409).json({ error: 'Booking is cancelled' });

        const newSlot = await prisma.slot.findUnique({ where: { id: slotId } });
        if (!newSlot || newSlot.eventId !== booking.eventId) {
            return res.status(404).json({ error: 'Slot not found for this event' });
        }
        if (newSlot.status !== 'available') {
            return res.status(409).json({ error: 'Slot is not available' });
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (booking.slotId && booking.slotId !== slotId) {
                await tx.slot.update({ where: { id: booking.slotId }, data: { status: 'available' } });
            }
            await tx.slot.update({ where: { id: slotId }, data: { status: 'booked' } });
            return tx.booking.update({
                where: { cancelToken: req.params.cancelToken },
                data: { slotId },
            });
        });

        // Fire-and-forget reschedule confirmation email
        (async () => {
            try {
                const slot = await prisma.slot.findUnique({
                    where: { id: slotId },
                    include: {
                        teacher: { select: { salutation: true, firstName: true, surname: true, roomNo: true } },
                        event: { include: { school: { select: { name: true } } } },
                    },
                });
                if (slot) {
                    await sendBookingConfirmation(booking.parentEmail, {
                        parentName: `${booking.salutation ?? ''} ${booking.parentSurname ?? ''}`.trim(),
                        eventName: slot.event.name,
                        schoolName: slot.event.school?.name,
                        slotDate: slot.date,
                        slotTime: slot.time,
                        teacherName: [slot.teacher?.salutation, slot.teacher?.firstName, slot.teacher?.surname].filter(Boolean).join(' '),
                        roomNo: slot.teacher?.roomNo,
                        cancelToken: booking.cancelToken,
                        appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3001',
                    });
                }
            } catch (e) {
                console.error('Reschedule email failed:', e.message);
            }
        })();

        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── GET /api/bookings/:cancelToken ───────────────────────────────────────────
// Public — parent views their booking via cancel page
export const getBookingByCancelToken = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: {
                event: { select: { id: true, name: true, date: true, startTime: true } },
                slot: {
                    select: {
                        id: true, time: true, date: true,
                        teacher: { select: { id: true, salutation: true, firstName: true, surname: true, roomNo: true } },
                    },
                },
            },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        res.json(booking);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ── DELETE /api/bookings/:cancelToken ────────────────────────────────────────
// Public — parent cancels via link in confirmation email
export const cancelBooking = async (req, res) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { cancelToken: req.params.cancelToken },
            include: { event: { select: { name: true } } },
        });

        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (booking.status === 'CANCELLED') {
            return res.status(409).json({ error: 'Booking is already cancelled' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.booking.update({
                where: { cancelToken: req.params.cancelToken },
                data: { status: 'CANCELLED' },
            });

            if (booking.slotId) {
                await tx.slot.update({ where: { id: booking.slotId }, data: { status: 'available' } });
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
