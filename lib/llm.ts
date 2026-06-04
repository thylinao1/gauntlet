// lib/llm.ts
// Shared LLM client (Anthropic preferred, OpenAI fallback) used by the attacker (to generate
// probes) and by the live target (a real model under test). No SDK dependency — fetch only.
// Empty/whitespace keys are treated as absent (some shells export an empty ANTHROPIC_API_KEY).

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

function key(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function hasLlmKey(): boolean {
  return Boolean(key("ANTHROPIC_API_KEY") || key("OPENAI_API_KEY"));
}

export async function chatComplete(
  system: string,
  messages: LlmMessage[],
  maxTokens = 1500,
): Promise<string> {
  const anthropicKey = key("ANTHROPIC_API_KEY");
  const openaiKey = key("OPENAI_API_KEY");

  if (anthropicKey) {
    const model = key("GAUNTLET_MODEL") || "claude-haiku-4-5-20251001";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = (data.content ?? []).map((b) => b?.text ?? "").join("");
    if (!text) throw new Error("Empty Anthropic response");
    return text;
  }

  if (openaiKey) {
    const model = key("GAUNTLET_MODEL") || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Empty OpenAI response");
    return text;
  }

  throw new Error("No ANTHROPIC_API_KEY or OPENAI_API_KEY set");
}
