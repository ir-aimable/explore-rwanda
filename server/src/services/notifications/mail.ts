import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

let transport: Transporter | null = null;
function getTransport() {
  if (!env.smtpHost) return null;
  transport ??= nodemailer.createTransport({
    host: env.smtpHost, port: env.smtpPort, secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  return transport;
}

/** Sends an email via SMTP. Without SMTP configured (development), the message is logged instead. */
export async function sendMail(to: string, subject: string, text: string, html?: string) {
  const t = getTransport();
  if (!t) {
    console.log(`[mail] SMTP not configured. Would send to ${to}:\n  Subject: ${subject}\n  ${text.replace(/\n/g, '\n  ')}`);
    return;
  }
  await t.sendMail({ from: env.mailFrom, to, subject, text, html });
}
