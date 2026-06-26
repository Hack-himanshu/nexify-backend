const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

/**
 * Sends an email. Failures are logged but never thrown to the caller as a
 * blocking error — e.g. a password reset request should still succeed from
 * the user's perspective even if the SMTP provider has a transient issue,
 * since we don't want to leak whether an email send failed for an enumerated
 * account (security) and don't want to fail business logic over email infra.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'no-reply@platform.com',
      to,
      subject,
      html,
      text: text || undefined,
    });
    return info;
  } catch (err) {
    console.error('[EMAIL] Failed to send:', err.message);
    return null;
  }
};

const sendPasswordResetEmail = async (to, resetUrl) => {
  return sendEmail({
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendWelcomeEmail = async (to, name) => {
  return sendEmail({
    to,
    subject: 'Welcome!',
    html: `<div style="font-family: Arial, sans-serif;"><h2>Welcome, ${name}!</h2><p>Your account has been created successfully.</p></div>`,
  });
};

module.exports = { sendEmail, sendPasswordResetEmail, sendWelcomeEmail };
