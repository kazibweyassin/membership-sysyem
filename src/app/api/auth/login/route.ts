import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken } from "@/lib/auth";
import { apiError, ApiError } from "@/lib/middleware";
import { jsonOk } from "@/lib/serialize";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.active) {
      throw new ApiError(401, "Invalid credentials");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return jsonOk({
      token,
      user: { userId: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    return apiError(error);
  }
}
