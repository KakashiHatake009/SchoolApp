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

export async function sendBookingConfirmation(email, { parentName, eventName, schoolName, slotDate, slotTime, teacherName, roomNo, cancelToken, appBaseUrl }) {
    const base = appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3001';
    const cancelUrl = `${base}/cancel/${cancelToken}`;

    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: `Terminbestätigung: ${eventName}`,
        text: `
${parentName ? `Sehr geehrte/r ${parentName},` : 'Sehr geehrte Damen und Herren,'}

Ihr Termin zum ${eventName}${schoolName ? ` der ${schoolName}` : ''} wurde bestätigt.

${teacherName ? `Lehrkraft: ${teacherName}` : ''}
${roomNo ? `Raum: ${roomNo}` : ''}
${slotDate ? `Datum: ${slotDate}` : ''}
${slotTime ? `Zeit: ${slotTime}` : ''}

Bitte seien Sie pünktlich. Sie können 5 Minuten vor Ihrem Termin das Schulgebäude betreten.

Termin absagen oder ändern: ${cancelUrl}
        `.trim(),
        html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
                <div style="background:#4a90b8;color:#fff;text-align:center;font-weight:bold;padding:16px 24px;border-radius:6px 6px 0 0;font-size:15px">
                    Ihr Termin zum ${eventName}${schoolName ? ` der ${schoolName}` : ''} wurde bestätigt.
                </div>
                <div style="background:#dde8ee;border-radius:0 0 6px 6px;padding:24px">
                    <p style="font-weight:bold;color:#333;margin:0 0 12px">Ihr Termin</p>
                    <table style="border-collapse:collapse;font-size:14px;color:#444">
                        ${teacherName ? `<tr><td style="padding:3px 16px 3px 0;color:#666">Lehrkraft</td><td>${teacherName}</td></tr>` : ''}
                        ${roomNo ? `<tr><td style="padding:3px 16px 3px 0;color:#666">Raum</td><td>${roomNo}</td></tr>` : ''}
                        ${slotDate ? `<tr><td style="padding:3px 16px 3px 0;color:#666">Datum</td><td>${slotDate}</td></tr>` : ''}
                        ${slotTime ? `<tr><td style="padding:3px 16px 3px 0;color:#666">Zeit</td><td>${slotTime}</td></tr>` : ''}
                    </table>
                </div>
                <div style="background:#dde8ee;border-radius:6px;padding:24px;margin-top:12px;font-size:14px;color:#444">
                    <p style="font-weight:bold;color:#4a90b8;margin:0 0 8px">Wichtig</p>
                    <p style="margin:0 0 10px">Bitte seien Sie pünktlich. Sie können 5 Minuten vor Ihrem Termin das Schulgebäude betreten.</p>
                    <p style="margin:0">Falls Sie Ihren Termin absagen oder ändern möchten, nutzen Sie bitte diesen Link:<br>
                        <a href="${cancelUrl}" style="color:#2d6a9f;word-break:break-all">${cancelUrl}</a>
                    </p>
                </div>
            </div>
        `,
    });
}

// ── Teacher notification email ────────────────────────────────────────────────

export async function sendTeacherNotification(email, { teacherName, eventName, days, code, appUrl }) {
    // Plain-text days list
    const daysText = days.map((d) => `  ${d.date}  ${d.startTime} – ${d.endTime}`).join('\n');

    // HTML rows — first row shows label "Date(s)", subsequent rows are continuation
    const dayRows = days.map((d, i) => `
        <tr>
            <td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${i === 0 ? (days.length > 1 ? 'Dates' : 'Date') : ''}</td>
            <td style="padding:4px 0">${d.date} &nbsp; ${d.startTime} – ${d.endTime}</td>
        </tr>`).join('');

    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: `Your appointment schedule: ${eventName}`,
        text: `
Dear ${teacherName},

You have been added to the parent-teacher conference "${eventName}".

${daysText}

Your access code: ${code}

View your booking schedule at: ${appUrl}

Please do not reply to this email.
        `.trim(),
        html: `
            <h2>Parent-Teacher Conference</h2>
            <p>Dear <strong>${teacherName}</strong>,</p>
            <p>You have been added to the following event:</p>
            <table style="border-collapse:collapse;margin:12px 0">
                <tr><td style="padding:4px 12px 4px 0;color:#555">Event</td><td><strong>${eventName}</strong></td></tr>
                ${dayRows}
            </table>
            <p style="margin:16px 0 4px">Your access code:</p>
            <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#1565c0">${code}</p>
            <p><a href="${appUrl}" style="color:#1565c0">View your booking schedule</a></p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
            <p style="font-size:12px;color:#999">Please do not reply to this email.</p>
        `,
    });
}

// ── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email, code) {
    await transporter.sendMail({
        from: FROM,
        to: email,
        subject: 'Password Reset Code',
        text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
        html: `
            <h2>Password Reset</h2>
            <p>You requested a password reset. Use the code below:</p>
            <p style="font-size: 32px; letter-spacing: 8px; font-weight: bold;">${code}</p>
            <p>This code expires in <strong>10 minutes</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
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
