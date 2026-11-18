import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { verifyToken, JWTPayload } from "./auth";
import { PERMISSIONS } from "./audit";

export function getUserFromRequest(
  req: NextRequest
): JWTPayload | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  return verifyToken(token);
}

export function requireAuth(req: NextRequest): JWTPayload {
  const user = getUserFromRequest(req);
  if (!user) {
    throw new ApiError(401, "Unauthorized");
  }
  return user;
}

/**
 * Authenticate and enforce one of the permission areas from the RBAC matrix
 * (spec section 12). Areas: members, onboarding, invoices, payments, users,
 * settings, reports.
 */
export function requirePermission(
  req: NextRequest,
  area: keyof (typeof PERMISSIONS)["ADMINISTRATOR"]
): JWTPayload {
  const user = requireAuth(req);
  const permissions = PERMISSIONS[user.role];
  if (!permissions || !permissions[area]) {
    throw new ApiError(
      403,
      `Your role (${user.role}) is not permitted to perform this action`
    );
  }
  return user;
}

/**
 * Authenticate and require one of the given roles.
 */
export function requireRole(
  req: NextRequest,
  roles: Role[]
): JWTPayload {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new ApiError(
      403,
      `Your role (${user.role}) is not permitted to perform this action`
    );
  }
  return user;
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  console.error("API Error:", error);
  return Response.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}