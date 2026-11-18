/**
 * Business logic helpers for date and financial calculations.
 * See spec.md sections 6.3, 7.1 for requirements.
 */

/**
 * Calculate membership expiry date from a payment date.
 * Default: payment date + 1 year. Configurable period in months.
 */
export function calculateExpiryDate(
  paymentDate: Date,
  periodMonths: number = 12
): Date {
  const expiry = new Date(paymentDate);
  expiry.setMonth(expiry.getMonth() + periodMonths);
  return expiry;
}

/**
 * Calculate the next renewal date (same as expiry date by default).
 */
export function calculateRenewalDate(expiryDate: Date): Date {
  return new Date(expiryDate);
}

/**
 * Calculate months past due based on a due date and the current date.
 * Returns 0 if not yet due.
 * Stops accumulating for paid invoices (caller passes paid=true).
 */
export function calculateMonthsPastDue(
  dueDate: Date,
  paid: boolean,
  now: Date = new Date()
): number {
  if (paid) return 0;
  if (now <= dueDate) return 0;

  let months =
    (now.getFullYear() - dueDate.getFullYear()) * 12 +
    (now.getMonth() - dueDate.getMonth());

  // If the day of month hasn't been reached yet, subtract one month
  if (now.getDate() < dueDate.getDate()) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Determine expiry status based on expiry date and current date.
 * Returns the ExpiryStatus enum value as a string.
 */
export function calculateExpiryStatus(
  expiryDate: Date,
  now: Date = new Date()
): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "RENEWAL_DUE" {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / msPerDay);

  if (diffDays < 0) return "EXPIRED";
  if (diffDays === 0) return "EXPIRED"; // expires today = expired
  if (diffDays <= 30) return "EXPIRING_SOON";
  if (diffDays <= 60) return "RENEWAL_DUE";
  return "ACTIVE";
}

/**
 * Calculate onboarding completion percentage.
 */
export function calculateOnboardingProgress(
  completedStages: number,
  totalStages: number
): number {
  if (totalStages === 0) return 0;
  return Math.round((completedStages / totalStages) * 100);
}

/**
 * Calculate outstanding balance for an invoice.
 */
export function calculateOutstanding(
  amount: number,
  amountPaid: number
): number {
  return Math.max(0, Math.round((amount - amountPaid) * 100) / 100);
}

/**
 * Determine if a date is within N days from now (for renewal alerts).
 */
export function isWithinDays(
  targetDate: Date,
  days: number,
  now: Date = new Date()
): boolean {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / msPerDay);
  return diffDays >= 0 && diffDays <= days;
}