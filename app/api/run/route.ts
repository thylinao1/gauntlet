// app/api/run/route.ts
// Streams the Gauntlet run to the client as Server-Sent Events. Guards the public endpoint with
// a per-IP rate limit and an hourly cap on live (paid) runs. When the endpoint is busy or the
// live budget is spent, a run quietly uses the seeded corpus instead of erroring or spending.

import { runGauntlet } from "@/lib/engine";
import { hasLlmKey } from "@/lib/llm";
import {
  checkRateLimit,
  liveBudgetStatus,
  recordLiveRun,
} from "@/lib/ratelimit";
import type { RunRequest } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Friendly, non-error message shown when the global live-spend cap is reached.
function budgetNotice(): string {
  const contact = process.env.GAUNTLET_OWNER_CONTACT?.trim();
  const base =
    "Live mode is paused for now. The site owner set a spending cap on the API key so this public demo can never run up a bill, and that cap has been reached. The scan below still runs on the deterministic seeded attack corpus.";
  return contact
    ? `${base} Want to try the live attacker yourself? Message the owner at ${contact} and they'll reset the limit for you.`
    : `${base} Want to try the live attacker yourself? Message the site owner and they'll reset the limit for you.`;
}

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
    endpointUrl:
      typeof body.endpointUrl === "string" ? body.endpointUrl : undefined,
    watchSecret:
      typeof body.watchSecret === "string" ? body.watchSecret : undefined,
  };

  // Live mode calls a real model and costs money. Allow it only when it is configured and the
  // global spending budget still has room; otherwise fall back to the seeded corpus and tell the
  // user why with a friendly notice (not an error).
  let allowLive = false;
  let notice: string | undefined;
  if (process.env.GAUNTLET_LIVE === "true" && hasLlmKey()) {
    const status = await liveBudgetStatus();
    if (status.available) {
      allowLive = true;
      await recordLiveRun();
    } else {
      notice = budgetNotice();
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runGauntlet(req, allowLive, notice)) {
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
