// app/api/run/route.ts
// Streams the Gauntlet run to the client as Server-Sent Events. Guards the public endpoint with
// a per-IP rate limit and an hourly cap on live (paid) runs. When the endpoint is busy or the
// live budget is spent, a run quietly uses the seeded corpus instead of erroring or spending.

import { runGauntlet } from "@/lib/engine";
import { hasLlmKey } from "@/lib/llm";
import {
  checkRateLimit,
  liveBudgetAvailable,
  recordLiveRun,
} from "@/lib/ratelimit";
import type { RunRequest } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: "Too many runs in a row. Give it a moment." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfter),
        },
      },
    );
  }

  let body: Partial<RunRequest> = {};
  try {
    body = (await request.json()) as Partial<RunRequest>;
  } catch {
    body = {};
  }

  const req: RunRequest = {
    targetId: typeof body.targetId === "string" ? body.targetId : "support-bot",
    applyGuard: body.applyGuard === true,
    systemPrompt:
      typeof body.systemPrompt === "string" ? body.systemPrompt : undefined,
  };

  // Live mode calls a real model and costs money. Allow it only when it is configured and the
  // hourly budget still has room; otherwise the run falls back to the seeded corpus.
  let allowLive = false;
  if (
    process.env.GAUNTLET_LIVE === "true" &&
    hasLlmKey() &&
    liveBudgetAvailable()
  ) {
    allowLive = true;
    recordLiveRun();
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runGauntlet(req, allowLive)) {
          send(event);
        }
      } catch (err) {
        send({
          type: "error",
          ts: Date.now(),
          message: err instanceof Error ? err.message : "Run failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
