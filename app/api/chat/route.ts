import { NextResponse } from "next/server";

import { saveChatMessage } from "@/lib/chat-store";

type RapidApiResponse = {
  result?: string;
  message?: string;
  response?: string;
  data?: { content?: string };
  choices?: Array<{ message?: { content?: string } }>;
};

function parseAssistantText(payload: RapidApiResponse): string {
  return (
    payload.result ||
    payload.response ||
    payload.message ||
    payload.data?.content ||
    payload.choices?.[0]?.message?.content ||
    "I could not generate a response right now. Please try again."
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body?.message ?? "").trim();
    const source = body?.source === "voice" ? "voice" : "text";

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      return NextResponse.json(
        { error: "RAPIDAPI_KEY is missing in server environment." },
        { status: 500 }
      );
    }

    await saveChatMessage("user", message, source);

    const response = await fetch(
      "https://chatgpt-42.p.rapidapi.com/conversationgpt4-2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "chatgpt-42.p.rapidapi.com",
          "x-rapidapi-key": rapidApiKey,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
          system_prompt: "You are a fast, concise, helpful career assistant.",
          temperature: 0.6,
          top_k: 5,
          top_p: 0.9,
          max_tokens: 420,
          web_access: false,
        }),
      }
    );

    if (!response.ok) {
      const rawError = await response.text();
      return NextResponse.json(
        { error: `RapidAPI request failed: ${rawError}` },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as RapidApiResponse;
    const assistantMessage = parseAssistantText(payload).trim();

    await saveChatMessage("assistant", assistantMessage, "assistant");

    return NextResponse.json({ reply: assistantMessage });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error while processing chat." },
      { status: 500 }
    );
  }
}
