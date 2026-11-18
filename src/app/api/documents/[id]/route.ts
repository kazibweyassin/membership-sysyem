import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, apiError, ApiError } from "@/lib/middleware";
import { readStoredFile } from "@/lib/storage";
import { jsonOk } from "@/lib/serialize";

// GET /api/documents/[id] - authenticated download
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requirePermission(req, "members");

    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) throw new ApiError(404, "Document not found");

    const buffer = await readStoredFile(doc.storagePath);

    // Inline for browser-viewable types, attachment otherwise.
    const inline = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(
      doc.mimeType
    );
    const safeName = doc.name.replace(/["\\\r\n]/g, "_");

    return new Response(new Uint8Array(buffer) as any, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

// DELETE /api/documents/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requirePermission(req, "members");
    const { deleteStoredFile } = await import("@/lib/storage");

    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) throw new ApiError(404, "Document not found");

    await prisma.document.delete({ where: { id: params.id } });
    await deleteStoredFile(doc.storagePath);

    return jsonOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
