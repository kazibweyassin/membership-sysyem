/**
 * Format a monetary amount in Ugandan Shillings (UGX).
 * Uses the organisation's configured currency (defaults to UGX).
 */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
