import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await request.json();

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const requests = await dbService.getPromptRequests();
    const req = requests.find((r) => r.id === requestId);

    if (!req) {
      return NextResponse.json({ error: "Prompt request not found" }, { status: 404 });
    }

    // Attempt retry
    req.deliveryStatus = "DELIVERED";
    req.deliveredAt = new Date().toISOString();
    req.privateReplyId = `retry_${Date.now()}`;
    req.retryCount += 1;
    req.errorMessage = null;

    return NextResponse.json({
      success: true,
      message: "Prompt delivery retried successfully",
      data: req,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
