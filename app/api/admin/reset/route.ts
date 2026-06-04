// app/api/admin/reset/route.ts
// Owner-only: reset the global live-spend budget so live mode is enabled again. Protected by a
// shared secret (GAUNTLET_ADMIN_SECRET). Returns 404 when no secret is configured, so the endpoint
// is invisible unless the owner has set one up.
//   curl -X POST https://<site>/api/admin/reset -H "x-admin-secret: <secret>"

import { resetLiveBudget, liveBudgetStatus } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.GAUNTLET_ADMIN_SECRET;
  if (!secret) return json({ error: "Reset endpoint is not configured." }, 404);

  const provided =
    request.headers.get("x-admin-secret") ||
    new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return json({ error: "Unauthorized." }, 401);

  await resetLiveBudget();
  const status = await liveBudgetStatus();
  return json({ ok: true, status }, 200);
}
