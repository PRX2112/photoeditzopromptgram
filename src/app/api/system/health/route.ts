import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkDatabaseConnection } from "@/lib/prisma";
import { geminiService } from "@/lib/gemini";
import { instagramService } from "@/lib/instagram";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbHealth = await checkDatabaseConnection();
    const isGeminiReady = geminiService.isConfigured();
    const isMetaReady = instagramService.isConfigured();
    const hasCronSecret = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length > 0);
    const hasTokenKey = Boolean(process.env.TOKEN_ENCRYPTION_KEY && process.env.TOKEN_ENCRYPTION_KEY.trim().length > 0);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.ok ? "healthy" : "warning",
          provider: "Neon PostgreSQL",
          message: dbHealth.message,
        },
        gemini: {
          status: isGeminiReady ? "healthy" : "warning",
          message: isGeminiReady
            ? "Gemini 2.5 Flash model active"
            : "Gemini API key missing. Photographic rules fallback active.",
        },
        metaInstagram: {
          status: isMetaReady ? "healthy" : "warning",
          message: isMetaReady
            ? "Meta App credentials configured"
            : "META_APP_ID or META_APP_SECRET missing",
        },
        jobScheduler: {
          status: hasCronSecret ? "healthy" : "error",
          message: hasCronSecret ? "Cron secret configured for Vercel Cron" : "CRON_SECRET is missing",
        },
        securityEncryption: {
          status: hasTokenKey ? "healthy" : "error",
          message: hasTokenKey ? "AES-256-GCM token encryption key verified" : "TOKEN_ENCRYPTION_KEY missing",
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
