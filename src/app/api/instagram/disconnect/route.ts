import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbService } from "@/lib/db-service";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbService.disconnectInstagramAccount();

  return NextResponse.json({
    success: true,
    message: "Instagram account disconnected successfully",
  });
}
