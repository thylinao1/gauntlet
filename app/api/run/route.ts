// app/api/run/route.ts
// Streams the Gauntlet run to the client as Server-Sent Events. Next.js 16 route handler:
// returns a Web Response wrapping a ReadableStream. POST so we can carry a target in the body.

import { runGauntlet } from "@/lib/engine";
import type { RunRequest } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runGauntlet(req)) {
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
