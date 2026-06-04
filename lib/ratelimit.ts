// lib/ratelimit.ts
// Two guards for the public /api/run endpoint:
//   1. A per-IP sliding window (in-memory) to stop casual hammering.
//   2. A GLOBAL lifetime budget on live (paid) runs, so the owner's API key can never be
//      overcharged on a public demo. This is backed by Redis (Upstash or Vercel KV) when its env
//      is present, so the cap holds across all serverless instances. Without Redis it falls back to
//      a per-instance in-memory counter (still bounded, just not global). The owner resets the
//      budget via /api/admin/reset.

const WINDOW_MS = 60_000; // per-IP window
const MAX_PER_WINDOW = 8; // requests per IP per minute
const MAX_TRACKED_IPS = 5_000; // crude memory ceiling

const ipHits = new Map<string, number[]>();

export interface RateResult {
  ok: boolean;
  retryAfter: number; // seconds until the caller may try again
}

export function checkRateLimit(ip: string): RateResult {
  const now = Date.now();
  if (ipHits.size > MAX_TRACKED_IPS) ipHits.clear();
  const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    ipHits.set(ip, recent);
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    return { ok: false, retryAfter: Math.max(retryAfter, 1) };
  }
  recent.push(now);
  ipHits.set(ip, recent);
  return { ok: true, retryAfter: 0 };
}

// ---- Global live-run budget (the spending cap) ----

// Number of live (paid) runs allowed before the cap trips. Each run is roughly a couple of cents
// on Claude Haiku, so the default of 40 keeps total spend around or under two dollars.
export const LIVE_BUDGET = Math.max(1, Number(process.env.GAUNTLET_LIVE_BUDGET) || 40);
const COUNTER_KEY = "gauntlet:live:count";

let memLiveCount = 0; // per-instance fallback when Redis is not configured

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

// Upstash / Vercel-KV REST: GET {base}/{cmd}/{key...} with a Bearer token, returns { result }.
async function redisCmd(...segments: string[]): Promise<string | null> {
  const env = redisEnv();
  if (!env) return null;
  const path = segments.map((s) => encodeURIComponent(s)).join("/");
  const res = await fetch(`${env.url}/${path}`, {
    headers: { Authorization: `Bearer ${env.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result == null ? null : String(data.result);
}

export interface BudgetStatus {
  used: number;
  limit: number;
  available: boolean;
  global: boolean; // true when backed by Redis (holds across instances)
}

export async function liveBudgetStatus(): Promise<BudgetStatus> {
  if (redisEnv()) {
    try {
      const used = Number(await redisCmd("get", COUNTER_KEY)) || 0;
      return { used, limit: LIVE_BUDGET, available: used < LIVE_BUDGET, global: true };
    } catch {
      /* Redis unreachable — fall back to the in-memory counter */
    }
  }
  return {
    used: memLiveCount,
    limit: LIVE_BUDGET,
    available: memLiveCount < LIVE_BUDGET,
    global: false,
  };
}

export async function recordLiveRun(): Promise<void> {
  if (redisEnv()) {
    try {
      await redisCmd("incr", COUNTER_KEY);
      return;
    } catch {
      /* fall back */
    }
  }
  memLiveCount += 1;
}

export async function resetLiveBudget(): Promise<void> {
  if (redisEnv()) {
    try {
      await redisCmd("del", COUNTER_KEY);
      return;
    } catch {
      /* fall back */
    }
  }
  memLiveCount = 0;
}
