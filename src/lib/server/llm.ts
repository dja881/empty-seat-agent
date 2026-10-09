import "server-only";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * One JSON-mode completion from Qwen on Cerebras (OpenAI-compatible API).
 * Returns the parsed object, or null if the call fails or the output isn't JSON,
 * so callers can fall back to a safe scripted reply.
 */
export async function llmJson<T>(messages: ChatMessage[], opts: { temperature?: number } = {}): Promise<T | null> {
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages,
        temperature: opts.temperature ?? 0.4,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error("llm error", res.status, await res.text());
      return null;
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content ?? "";
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T;
  } catch (err) {
    console.error("llm failed", err);
    return null;
  }
}
