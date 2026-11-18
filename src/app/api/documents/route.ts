import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { recordAudit } from "@/lib/audit";
import { saveUpload, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/storage";
import { jsonOk } from "@/lib/serialize";

/**
 * POST /api/documents  (multipart/form-data)
 * fields: file, memberId?, invoiceId?
 *
 * Files are stored outside the web root under STORAGE_DIR (default ./storage)
 * and are only reachable through the authenticated download endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const user = requirePermission(req, "members");

    const form = await req.formData();
    const file = form.get("file");
    const memberId = (form.get("memberId") as string) || null;
    const invoiceId = (form.get("invoiceId") as string) || null;

    if (!file || typeof file === "string") {
      throw new ApiError(400, "A file is required");
    }

    if (file.size === 0) throw new ApiError(400, "File is empty");
    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        413,
        `File exceeds the maximum size of ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new ApiError(
        415,
        `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`
      );
    }

    if (memberId) {
      const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
      if (!member) throw new ApiError(404, "Member not found");
    }
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
      if (!invoice) throw new ApiError(404, "Invoice not found");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await saveUpload(buffer, file.name, file.type);

    const doc = await prisma.document.create({
      data: {
        memberId,
        invoiceId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        storagePath,
        uploadedById: user.userId,
      },
    });

    await recordAudit({
      userId: user.userId,
      memberId,
      action: "UPLOAD_DOCUMENT",
      entity: "Document",
      entityId: doc.id,
      newValue: { name: doc.name, size: doc.size },
    });

    return jsonOk({ document: doc }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
