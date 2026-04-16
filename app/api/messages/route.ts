import { NextResponse } from "next/server";

import { fetchRecentMessages } from "@/lib/chat-store";

async function verifyAuth(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return null;
  }

  const { firebaseAdminAuth } = await import("@/lib/firebase-admin");
  return firebaseAdminAuth.verifyIdToken(token);
}

export async function GET(request: Request) {
  try {
    await verifyAuth(request);
    const messages = await fetchRecentMessages(30);
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch messages.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
