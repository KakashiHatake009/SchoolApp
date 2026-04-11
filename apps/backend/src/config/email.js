import nodemailer from 'nodemailer';

let transporter;

if (process.env.SMTP_USER) {
    // Authenticated SMTP (Gmail, AWS SES, Resend, etc.)
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
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
