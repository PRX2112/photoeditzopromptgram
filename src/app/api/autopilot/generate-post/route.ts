import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { geminiAutopilotService } from "@/lib/gemini-autopilot";
import { dbService } from "@/lib/db-service";
import { z } from "zod";

const AutopilotInputSchema = z.object({
  theme: z.string().optional(),
  category: z.string().optional(),
  commentKeyword: z.string().optional(),
  autoPublish: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed for quick 1-click generation
    }

    const parsed = AutopilotInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Resolve connected Instagram handle if available
    let instagramHandle = "@prx_dev";
    try {
      const account = await dbService.getConnectedInstagramAccount();
      if (account?.username) {
        instagramHandle = `@${account.username}`;
      }
    } catch {
      // Keep default
    }

    const result = await geminiAutopilotService.executeOneClickAutopilot({
      theme: parsed.data.theme,
      category: parsed.data.category,
      commentKeyword: parsed.data.commentKeyword,
      autoPublish: parsed.data.autoPublish,
      instagramHandle,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute autopilot";
    console.error("Autopilot API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
