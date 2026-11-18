import nodemailer, { Transporter } from "nodemailer";

/**
 * Email delivery for membership reminders.
 *
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * When SMTP is not configured the message is not sent and the caller
 * records deliveryStatus PENDING/FAILED so an administrator can resend.
 */

let transporter: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transporter;
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const tx = getTransporter();
  if (!tx) {
    return {
      sent: false,
      error: "SMTP is not configured. Set SMTP_HOST and SMTP_FROM to enable email delivery.",
    };
  }

  try {
    await tx.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err?.message ?? "Unknown email error" };
  }
}

const ORG_NAME = process.env.ORG_NAME || "FITSPA";

function wrap(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
    <h2 style="color:#1d4ed8">${ORG_NAME}</h2>
    <h3>${title}</h3>
    <p style="line-height:1.6;color:#333">${body}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="font-size:12px;color:#888">This is an automated message from the ${ORG_NAME} membership system.</p>
  </div>`;
}

export const REMINDER_TEMPLATES = {
  PAYMENT_DUE: (company: string, invoiceNumber: string, dueDate: string, amount: string) => ({
    subject: `${ORG_NAME} - Invoice ${invoiceNumber} due on ${dueDate}`,
    text: `Dear ${company},\n\nThis is a reminder that invoice ${invoiceNumber} for ${amount} is due on ${dueDate}.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n${ORG_NAME}`,
    html: wrap(
      "Payment Reminder",
      `Dear ${company},<br><br>This is a reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> is due on <strong>${dueDate}</strong>.<br><br>Please arrange payment at your earliest convenience.<br><br>Regards,<br>${ORG_NAME}`
    ),
  }),

  PAYMENT_OVERDUE: (company: string, invoiceNumber: string, amount: string, months: number) => ({
    subject: `${ORG_NAME} - Overdue invoice ${invoiceNumber}`,
    text: `Dear ${company},\n\nInvoice ${invoiceNumber} with an outstanding balance of ${amount} is now ${months} month(s) overdue.\n\nPlease settle this balance as soon as possible to keep your membership in good standing.\n\nRegards,\n${ORG_NAME}`,
    html: wrap(
      "Overdue Payment",
      `Dear ${company},<br><br>Invoice <strong>${invoiceNumber}</strong> with an outstanding balance of <strong>${amount}</strong> is now <strong>${months} month(s) overdue</strong>.<br><br>Please settle this balance as soon as possible to keep your membership in good standing.<br><br>Regards,<br>${ORG_NAME}`
    ),
  }),

  MEMBERSHIP_EXPIRY: (company: string, expiryDate: string, days: number) => ({
    subject: `${ORG_NAME} - Membership renewal due in ${days} day(s)`,
    text: `Dear ${company},\n\nYour ${ORG_NAME} membership expires on ${expiryDate} (in ${days} day(s)).\n\nPlease contact us to arrange renewal and continue enjoying your membership benefits.\n\nRegards,\n${ORG_NAME}`,
    html: wrap(
      "Membership Renewal",
      `Dear ${company},<br><br>Your ${ORG_NAME} membership expires on <strong>${expiryDate}</strong> (in ${days} day(s)).<br><br>Please contact us to arrange renewal and continue enjoying your membership benefits.<br><br>Regards,<br>${ORG_NAME}`
    ),
  }),

  RENEWAL: (company: string, expiryDate: string) => ({
    subject: `${ORG_NAME} - Membership expired`,
    text: `Dear ${company},\n\nYour ${ORG_NAME} membership expired on ${expiryDate}.\n\nPlease contact us to renew your membership.\n\nRegards,\n${ORG_NAME}`,
    html: wrap(
      "Membership Expired",
      `Dear ${company},<br><br>Your ${ORG_NAME} membership expired on <strong>${expiryDate}</strong>.<br><br>Please contact us to renew your membership.<br><br>Regards,<br>${ORG_NAME}`
    ),
  }),

  MANUAL: (company: string, subject: string, body: string) => ({
    subject: `${ORG_NAME} - ${subject}`,
    text: `Dear ${company},\n\n${body}\n\nRegards,\n${ORG_NAME}`,
    html: wrap(subject, `${company},<br><br>${body}<br><br>Regards,<br>${ORG_NAME}`),
  }),
};