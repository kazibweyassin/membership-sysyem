import { describe, it, expect } from "vitest";
import {
  calculateExpiryDate,
  calculateMonthsPastDue,
  calculateExpiryStatus,
  calculateOnboardingProgress,
  calculateOutstanding,
  isWithinDays,
} from "@/lib/business";

describe("calculateExpiryDate", () => {
  it("adds 12 months by default", () => {
    const paymentDate = new Date("2026-01-15");
    const expiry = calculateExpiryDate(paymentDate);
    expect(expiry.getFullYear()).toBe(2027);
    expect(expiry.getMonth()).toBe(0);
    expect(expiry.getDate()).toBe(15);
  });

  it("respects configurable period", () => {
    const paymentDate = new Date("2026-01-15");
    const expiry = calculateExpiryDate(paymentDate, 6);
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(6);
  });
});

describe("calculateMonthsPastDue", () => {
  const now = new Date("2026-06-15");

  it("returns 0 for paid invoices", () => {
    const dueDate = new Date("2026-01-01");
    expect(calculateMonthsPastDue(dueDate, true, now)).toBe(0);
  });

  it("returns 0 for not-yet-due invoices", () => {
    const dueDate = new Date("2026-08-01");
    expect(calculateMonthsPastDue(dueDate, false, now)).toBe(0);
  });

  it("calculates months overdue correctly", () => {
    const dueDate = new Date("2026-01-15");
    // From Jan 15 to Jun 15 = 5 months
    expect(calculateMonthsPastDue(dueDate, false, now)).toBe(5);
  });

  it("subtracts a month if day not reached", () => {
    const dueDate = new Date("2026-01-20");
    // From Jan 20 to Jun 15: 5 months minus 1 (day 15 < 20) = 4 months
    expect(calculateMonthsPastDue(dueDate, false, now)).toBe(4);
  });

  it("returns 0 for same-day due", () => {
    const dueDate = new Date("2026-06-15");
    expect(calculateMonthsPastDue(dueDate, false, now)).toBe(0);
  });
});

describe("calculateExpiryStatus", () => {
  const now = new Date("2026-06-15");

  it("returns ACTIVE for far future", () => {
    const expiry = new Date("2026-12-31");
    expect(calculateExpiryStatus(expiry, now)).toBe("ACTIVE");
  });

  it("returns RENEWAL_DUE within 60 days", () => {
    const expiry = new Date("2026-08-01"); // 47 days
    expect(calculateExpiryStatus(expiry, now)).toBe("RENEWAL_DUE");
  });

  it("returns EXPIRING_SOON within 30 days", () => {
    const expiry = new Date("2026-07-01"); // 16 days
    expect(calculateExpiryStatus(expiry, now)).toBe("EXPIRING_SOON");
  });

  it("returns EXPIRED for past date", () => {
    const expiry = new Date("2026-06-01");
    expect(calculateExpiryStatus(expiry, now)).toBe("EXPIRED");
  });

  it("returns EXPIRED for today", () => {
    const expiry = new Date("2026-06-15");
    expect(calculateExpiryStatus(expiry, now)).toBe("EXPIRED");
  });
});

describe("calculateOnboardingProgress", () => {
  it("calculates percentage correctly", () => {
    expect(calculateOnboardingProgress(3, 6)).toBe(50);
    expect(calculateOnboardingProgress(6, 6)).toBe(100);
    expect(calculateOnboardingProgress(0, 6)).toBe(0);
    expect(calculateOnboardingProgress(1, 3)).toBe(33);
  });

  it("handles zero total stages", () => {
    expect(calculateOnboardingProgress(0, 0)).toBe(0);
  });
});

describe("calculateOutstanding", () => {
  it("calculates outstanding balance", () => {
    expect(calculateOutstanding(1000, 400)).toBe(600);
    expect(calculateOutstanding(1000, 1000)).toBe(0);
    expect(calculateOutstanding(1000, 0)).toBe(1000);
  });

  it("never returns negative", () => {
    expect(calculateOutstanding(1000, 1500)).toBe(0);
  });

  it("handles decimal amounts", () => {
    expect(calculateOutstanding(1000.5, 400.25)).toBe(600.25);
  });
});

describe("isWithinDays", () => {
  const now = new Date("2026-06-15");

  it("returns true for date within range", () => {
    expect(isWithinDays(new Date("2026-06-20"), 10, now)).toBe(true);
    expect(isWithinDays(new Date("2026-06-25"), 10, now)).toBe(true);
  });

  it("returns false for date outside range", () => {
    expect(isWithinDays(new Date("2026-07-01"), 10, now)).toBe(false);
  });

  it("returns false for past dates", () => {
    expect(isWithinDays(new Date("2026-06-10"), 10, now)).toBe(false);
  });
});