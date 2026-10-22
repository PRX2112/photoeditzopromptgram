import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualString } from "@/lib/crypto";
import { queueService } from "@/lib/queue";

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const customHeader = request.headers.get("x-cron-secret");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");

    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured on the server" },
        { status: 500 }
      );
    }

    let tokenProvided = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      tokenProvided = authHeader.substring(7).trim();
    } else if (customHeader) {
      tokenProvided = customHeader.trim();
    } else if (querySecret) {
      tokenProvided = querySecret.trim();
    }

    // Secure timing-safe secret comparison
    if (!timingSafeEqualString(tokenProvided, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }

    // Process due jobs
    const results = await queueService.processDueJobs("cron-worker");

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
