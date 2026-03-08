import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,  // Mailhog dev / SendGrid prod uses STARTTLS
    ignoreTLS: true,
});

export default transporter;
