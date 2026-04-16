import { NextResponse } from "next/server";

import { fetchRecentMessages } from "@/lib/chat-store";
import { firebaseAdminAuth } from "@/lib/firebase-admin";

async function verifyAuth(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    throw new Error("Unauthorized");
  }

  return firebaseAdminAuth.verifyIdToken(token);
}

export async function GET(request: Request) {
  try {
    await verifyAuth(request);
    const messages = await fetchRecentMessages(30);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unauthorized request.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
