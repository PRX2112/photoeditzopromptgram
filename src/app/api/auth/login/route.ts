import { NextRequest, NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma, checkDatabaseConnection } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@photographerprompthub.com";
    const defaultAdminPassword = process.env.ADMIN_PASSWORD || "PhotographerPromptAdmin2026!";

    // Check environment defaults first
    if (email === defaultAdminEmail && password === defaultAdminPassword) {
      await createSession({
        id: "admin-default",
        email: defaultAdminEmail,
        name: "Photography Director",
        role: "ADMIN",
      });

      return NextResponse.json({
        success: true,
        user: { email: defaultAdminEmail, name: "Photography Director", role: "ADMIN" },
      });
    }

    // Check database if reachable
    try {
      const dbCheck = await checkDatabaseConnection();
      if (dbCheck.ok) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          const isValid = await verifyPassword(password, user.passwordHash);
          if (isValid) {
            await createSession({
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            });

            return NextResponse.json({
              success: true,
              user: { email: user.email, name: user.name, role: user.role },
            });
          }
        }
      }
    } catch {
      // Continue to reject invalid credentials
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
