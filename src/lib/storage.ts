import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Secure-ish file storage for membership documents.
 *
 * Files live outside the Next.js public/ directory so they cannot be fetched
 * without passing through the authenticated download route. Names are replaced
 * with a UUID on disk to avoid path traversal and collisions; the original name
 * is kept in the database.
 */

export const STORAGE_DIR =
  process.env.STORAGE_DIR || path.join(process.cwd(), "storage", "documents");

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

function safeExtension(name: string, mimeType: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext && ext.length <= 10 && /^\.[a-z0-9]+$/.test(ext)) return ext;

  const map: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "text/plain": ".txt",
    "text/csv": ".csv",
  };
  return map[mimeType] || ".bin";
}

export async function saveUpload(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const filename = `${randomUUID()}${safeExtension(originalName, mimeType)}`;
  const fullPath = path.join(STORAGE_DIR, filename);
  await fs.writeFile(fullPath, buffer, { flag: "wx" });
  return filename;
}

export async function readStoredFile(storedName: string): Promise<Buffer> {
  // Reject any attempt to escape the storage directory.
  const base = path.basename(storedName);
  if (base !== storedName) {
    throw new Error("Invalid storage path");
  }
  return fs.readFile(path.join(STORAGE_DIR, base));
}

export async function deleteStoredFile(storedName: string): Promise<void> {
  const base = path.basename(storedName);
  if (base !== storedName) return;
  try {
    await fs.unlink(path.join(STORAGE_DIR, base));
  } catch {
    // already gone
  }
}