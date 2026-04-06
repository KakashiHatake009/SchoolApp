import nodemailer from 'nodemailer';

const isProd = process.env.NODE_ENV === 'production';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: isProd,
    ...(isProd && process.env.SMTP_USER && {
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    }),
    ...(!isProd && { ignoreTLS: true }),
});

export default transporter;
