import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Transactional mail (email confirmation, password reset) over plain SMTP —
// Aliyun DirectMail or any other provider. Configured through SMTP_HOST,
// SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM. When SMTP_HOST is unset the
// app still works: mail-dependent flows are disabled and sendMail() logs
// instead of throwing.

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  if (!isMailConfigured()) {
    console.warn(`[mail] SMTP not configured; dropping "${message.subject}" to ${message.to}`);
    return false;
  }
  await getTransporter().sendMail({ from: process.env.SMTP_FROM, ...message });
  return true;
}
