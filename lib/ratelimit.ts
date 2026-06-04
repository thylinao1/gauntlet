// lib/ratelimit.ts
// Best-effort, dependency-free guards for the public /api/run endpoint. The state lives in
// memory, so it is per serverless instance rather than global. That is enough to stop casual
// abuse and to bound the live attacker's API cost for a demo. A production deployment would
// back this with Vercel KV or Upstash Redis so the counters are shared across instances.

const WINDOW_MS = 60_000; // per-IP window
const MAX_PER_WINDOW = 8; // requests per IP per minute
const LIVE_WINDOW_MS = 60 * 60_000; // live-run window (1 hour)
const MAX_LIVE_PER_WINDOW = 40; // live (paid) runs per hour, all callers combined
const MAX_TRACKED_IPS = 5_000; // crude memory ceiling

const ipHits = new Map<string, number[]>();
const liveHits: number[] = [];

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

// Is there room in the hourly live-run budget? This is the cost cap for the paid attacker.
export function liveBudgetAvailable(): boolean {
  const now = Date.now();
  while (liveHits.length && now - liveHits[0] > LIVE_WINDOW_MS) liveHits.shift();
  return liveHits.length < MAX_LIVE_PER_WINDOW;
}

export function recordLiveRun(): void {
  liveHits.push(Date.now());
}
