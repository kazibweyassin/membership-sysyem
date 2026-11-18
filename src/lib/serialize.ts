import { Prisma } from "@prisma/client";

/**
 * Converts Prisma Decimal instances to plain numbers so API responses and
 * client components never receive Decimal objects.
 *
 * Prisma's default JSON serialisation turns Decimal columns into strings,
 * which breaks arithmetic in the browser. Serialising at the boundary keeps
 * the wire format numeric while server-side code keeps full Decimal precision.
 */
export function serialize<T>(value: T): T {
  return convert(value) as T;
}

function convert(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) return value;

  if (Prisma.Decimal.isDecimal(value)) {
    return value.toNumber();
  }

  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;

  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((v) => convert(v, seen));
  }

  if (Buffer.isBuffer(value)) return value;

  const out: Record<string, any> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = convert(inner, seen);
  }
  return out;
}

/**
 * Response.json that also converts Prisma Decimals to numbers.
 *
 * Accepts either a bare status code or a full ResponseInit, matching both
 * `Response.json(data, { status })` and `Response.json(data, status)` styles.
 */
export function jsonOk(
  data: unknown,
  init?: number | ResponseInit
): Response {
  const responseInit: ResponseInit =
    typeof init === "number" ? { status: init } : init ?? {};
  return Response.json(serialize(data), responseInit);
}