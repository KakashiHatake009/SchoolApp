import nodemailer from 'nodemailer';

const isProd = process.env.NODE_ENV === 'production';

let transporter;

if (isProd && process.env.RESEND_API_KEY) {
    // Use Resend HTTP API via nodemailer transport
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    transporter = {
        sendMail: async ({ from, to, subject, text, html }) => {
            await resend.emails.send({
                from: from || process.env.EMAIL_FROM || 'onboarding@resend.dev',
                to: Array.isArray(to) ? to : [to],
                subject,
                text,
                html,
            });
        },
    };
} else if (isProd && process.env.SMTP_USER) {
    // Fallback: SMTP with auth
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
} else {
    // Dev: Mailhog (no auth, no TLS)
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: Number(process.env.SMTP_PORT) || 1025,
        secure: false,
        ignoreTLS: true,
    });
}

export default transporter;
