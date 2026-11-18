import { prisma } from "./prisma";

/**
 * Generate a unique membership number.
 * Format: MBR-YYYY-NNNN (e.g. MBR-2026-0001)
 */
export async function generateMemberNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `MBR-${year}-`;

  // Find the highest number for this year
  const lastMember = await prisma.member.findFirst({
    where: { memberNumber: { startsWith: prefix } },
    orderBy: { memberNumber: "desc" },
    select: { memberNumber: true },
  });

  let nextNum = 1;
  if (lastMember) {
    const numPart = lastMember.memberNumber.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

/**
 * Generate a unique invoice number.
 * Format: INV-YYYY-NNNN
 */
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (last) {
    const numPart = last.invoiceNumber.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

/**
 * Generate internal ID.
 * Format: INT-NNNNNN
 */
export async function generateInternalId(): Promise<string> {
  const prefix = "INT-";
  const last = await prisma.member.findFirst({
    where: { internalId: { startsWith: prefix } },
    orderBy: { internalId: "desc" },
    select: { internalId: true },
  });

  let nextNum = 1;
  if (last) {
    const numPart = last.internalId.replace(prefix, "");
    nextNum = parseInt(numPart, 10) + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}