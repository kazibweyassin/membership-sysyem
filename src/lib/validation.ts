import { z } from "zod";

export const registerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  memberNumber: z.string().min(1, "Member number is required"),
  categoryId: z.string().min(1, "Category is required"),
  startDate: z.string().min(1, "Start date is required"),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  contacts: z
    .array(
      z.object({
        fullName: z.string().min(2, "Full name is required"),
        jobTitle: z.string().optional(),
        phone: z.string().optional().or(z.literal("")),
        email: z.string().email("Valid email is required").optional().or(z.literal("")),
        isPrimary: z.boolean().optional(),
      })
    )
    .min(1, "At least one contact is required"),
});

export const updateMemberSchema = z.object({
  companyName: z.string().min(2).optional(),
  categoryId: z.string().min(1).optional(),
  startDate: z.string().optional(),
  status: z
    .enum(["PAID", "UNPAID", "ONBOARDING", "CANCELLED"])
    .optional(),
  address: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const contactSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  jobTitle: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Valid email is required").optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});

export const invoiceSchema = z.object({
  memberId: z.string().min(1),
  categoryId: z.string().min(1),
  dueDate: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive"),
  paymentDate: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export const onboardingTaskSchema = z.object({
  stage: z.coerce.number().int().min(1).max(6),
  name: z.string().min(1),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  completedDate: z.string().optional(),
  responsibleId: z.string().optional(),
  notes: z.string().optional(),
});

export const reminderSchema = z.object({
  memberId: z.string().min(1),
  recipientEmail: z.string().email(),
  reminderType: z.enum([
    "PAYMENT_DUE",
    "PAYMENT_OVERDUE",
    "MEMBERSHIP_EXPIRY",
    "RENEWAL",
    "MANUAL",
  ]),
  subject: z.string().min(1),
  notes: z.string().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(2),
  fee: z.coerce.number().nonnegative(),
  description: z.string().optional(),
});

export const settingsSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional(),
});

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["ADMINISTRATOR", "MEMBERSHIP_OFFICER", "FINANCE_OFFICER"]),
});