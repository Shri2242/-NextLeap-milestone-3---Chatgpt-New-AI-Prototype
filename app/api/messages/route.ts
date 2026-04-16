import { NextResponse } from "next/server";

import { fetchRecentMessages } from "@/lib/chat-store";

export async function GET() {
  const messages = await fetchRecentMessages(30);
  return NextResponse.json({ messages });
}
