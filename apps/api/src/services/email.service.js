import transporter from '../config/email.js';

const FROM = process.env.EMAIL_FROM || 'noreply@schoolbooking.dev';

// ── OTP email ────────────────────────────────────────────────────────────────

export async function sendOtpEmail(email, code, eventTitle) {
    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: `Your booking code for ${eventTitle}`,
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        html: `
            <h2>Your Booking Verification Code</h2>
            <p>Event: <strong>${eventTitle}</strong></p>
            <p style="font-size: 32px; letter-spacing: 8px; font-weight: bold;">${code}</p>
            <p>This code expires in <strong>10 minutes</strong>.</p>
        `,
    });
}

// ── Booking confirmation email ────────────────────────────────────────────────

export async function sendBookingConfirmation(email, { childName, eventTitle, slotTime, cancelToken }) {
    const cancelUrl = `${process.env.APP_BASE_URL}/cancel/${cancelToken}`;

    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: `Booking confirmed: ${eventTitle}`,
        text: `
Your booking is confirmed!

Event: ${eventTitle}
${slotTime ? `Time: ${slotTime}` : ''}
${childName ? `Child: ${childName}` : ''}

To cancel your booking, visit: ${cancelUrl}
        `.trim(),
        html: `
            <h2>Booking Confirmed</h2>
            <p><strong>Event:</strong> ${eventTitle}</p>
            ${slotTime ? `<p><strong>Time:</strong> ${slotTime}</p>` : ''}
            ${childName ? `<p><strong>Child:</strong> ${childName}</p>` : ''}
            <hr>
            <p><a href="${cancelUrl}">Cancel this booking</a></p>
        `,
    });
}

// ── Booking cancellation email ────────────────────────────────────────────────

export async function sendCancellationEmail(email, { eventTitle }) {
    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: `Booking cancelled: ${eventTitle}`,
        text: `Your booking for ${eventTitle} has been cancelled.`,
        html: `<p>Your booking for <strong>${eventTitle}</strong> has been cancelled.</p>`,
    });
}
