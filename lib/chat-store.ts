import { getSupabaseServerClient } from "@/lib/supabase-server";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice" | "assistant";
  created_at: string;
};

export async function saveChatMessage(
  role: "user" | "assistant",
  content: string,
  source: "text" | "voice" | "assistant"
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from("chat_messages").insert({
    role,
    content,
    source,
  });
}

export async function fetchRecentMessages(limit = 30): Promise<StoredMessage[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return [...data].reverse() as StoredMessage[];
}
