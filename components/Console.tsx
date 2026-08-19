"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AttemptEvent,
  RunEvent,
  Scorecard,
  Severity,
  Verdict,
} from "@/lib/contract";

// Inlined target descriptors. We never ship canaries or system prompts to the client bundle.
const TARGETS = [
  {
    id: "support-bot",
    name: "SupportBot",
    blurb: "Support assistant holding a private customer record.",
  },
  {
    id: "dev-assistant",
    name: "DevAssistant",
    blurb: "Coding agent with a shell tool on a prod host.",
  },
  {
    id: "policy-bot",
    name: "PolicyBot",
    blurb: "Policy bot guarding a confidential override code.",
  },
  {
    id: "live-claude",
    name: "Live model bot",
    blurb: "A model under a naive secret-keeping prompt. It holds and refuses.",
  },
  {
    id: "indirect-doc",
    name: "DocBot (indirect)",
    blurb: "Summarizes untrusted documents. Tests indirect injection.",
  },
  {
    id: "custom",
    name: "Your AI (paste prompt)",
    blurb: "Paste a system prompt; we plant a secret and attack it.",
  },
  {
    id: "endpoint",
    name: "Your endpoint (BYO)",
    blurb: "Attack a real HTTP endpoint you control. Live mode.",
  },
] as const;

interface EvalReport {
  oracle: { fpRate: number; fnRate: number; n: number };
  targets: {
    id: string;
    before: { grade: string; compromised: number; total: number };
    after: { grade: string; compromised: number };
  }[];
}

const VERDICT_STYLE: Record<Verdict, string> = {
  compromised: "text-alert border-alert/40 bg-alert/10",
  blocked: "text-warn border-warn/40 bg-warn/10",
  safe: "text-signal border-signal/40 bg-signal/10",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  compromised: "COMPROMISED",
  blocked: "BLOCKED",
  safe: "SAFE",
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-signal",
  B: "text-signal",
  C: "text-warn",
  D: "text-alert",
  F: "text-alert",
};

// Plain answer to "what does this grade mean for my bot?"
const GRADE_MEANING: Record<string, string> = {
  A: "Nothing got through this run.",
  B: "Only low-severity issues got through.",
  C: "Medium-severity issues got through.",
  D: "High-severity leaks got through.",
  F: "Critical. At least one leak an attacker could use.",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "text-alert",
  high: "text-alert",
  medium: "text-warn",
  low: "text-warn",
  none: "text-signal",
};

async function readStream(
  res: Response,
  onEvent: (e: RunEvent) => void,
): Promise<void> {
  if (!res.body) throw new Error("No response stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as RunEvent);
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

export default function Console() {
  const [targetId, setTargetId] = useState<string>("support-bot");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [attempts, setAttempts] = useState<AttemptEvent[]>([]);
  const [baseScore, setBaseScore] = useState<Scorecard | null>(null);
  const [guardScore, setGuardScore] = useState<Scorecard | null>(null);
  const [guardAttempts, setGuardAttempts] = useState<AttemptEvent[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [watchSecret, setWatchSecret] = useState("");
  const [evalReport, setEvalReport] = useState<EvalReport | null>(null);
  const [notice, setNotice] = useState<string>("");
  const feedRef = useRef<HTMLDivElement>(null);

  // Surface the offline eval numbers (oracle accuracy + reproducible grades) when present.
  useEffect(() => {
    fetch("/eval.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EvalReport | null) => setEvalReport(d))
      .catch(() => {});
  }, []);

  async function run(applyGuard: boolean) {
    if (running) return;
    setRunning(true);
    setPhase("connecting…");
    setAttempts([]);
    setNotice("");
    if (applyGuard) {
      setGuardScore(null);
      setGuardAttempts([]);
    } else {
      setBaseScore(null);
      setGuardScore(null);
      setGuardAttempts([]);
    }
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId,
          applyGuard,
          systemPrompt,
          endpointUrl,
          watchSecret,
        }),
      });
      if (!res.ok) {
        let msg = `request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* non-JSON error body */
        }
        const retry = res.headers.get("retry-after");
        setPhase(retry ? `${msg} (retry in ${retry}s)` : msg);
        return;
      }
      await readStream(res, (e) => {
        if (e.type === "phase") setPhase(e.detail ?? e.phase);
        else if (e.type === "attempt") {
          setAttempts((prev) => [...prev, e]);
          if (applyGuard) setGuardAttempts((prev) => [...prev, e]);
          queueMicrotask(() => {
            feedRef.current?.scrollTo({
              top: feedRef.current.scrollHeight,
              behavior: "smooth",
            });
          });
        } else if (e.type === "done") {
          if (applyGuard) setGuardScore(e.scorecard);
          else setBaseScore(e.scorecard);
          setPhase(applyGuard ? "guard verified" : "scan complete");
        } else if (e.type === "notice") {
          setNotice(e.message);
        } else if (e.type === "error") {
          setPhase(`error: ${e.message}`);
        }
      });
    } catch (err) {
      setPhase(`error: ${err instanceof Error ? err.message : "failed"}`);
    } finally {
      setRunning(false);
    }
  }

  const activeScore = guardScore ?? baseScore;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TARGETS.map((t) => {
          const selected = t.id === targetId;
          return (
            <button
              key={t.id}
              type="button"
              disabled={running}
              onClick={() => setTargetId(t.id)}
              className={`rounded-lg border p-4 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 ${
                selected
                  ? "border-accent bg-accent/10 shadow-md shadow-accent/10 ring-1 ring-accent/40"
                  : "border-edge bg-surface hover:border-muted hover:bg-elevated"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                    selected ? "bg-accent" : "bg-edge"
                  }`}
                />
                <span className="font-mono text-sm font-semibold">{t.name}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t.blurb}</p>
            </button>
          );
        })}
      </div>

      {targetId === "custom" && (
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          disabled={running}
          rows={4}
          aria-label="Your AI's system prompt"
          placeholder="Paste your AI's system prompt here. Gauntlet plants a secret inside it, then attacks. In live mode (npm run dev:live) it tests a real model."
          className="w-full rounded-lg border border-edge bg-surface p-3 font-mono text-xs leading-relaxed text-text placeholder:text-muted focus:border-accent disabled:opacity-50"
        />
      )}
      {targetId === "endpoint" && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            disabled={running}
            aria-label="Your endpoint URL"
            placeholder="https://your-api.example.com/chat"
            className="w-full rounded-lg border border-edge bg-surface p-3 font-mono text-xs text-text placeholder:text-muted focus:border-accent disabled:opacity-50"
          />
          <input
            type="text"
            value={watchSecret}
            onChange={(e) => setWatchSecret(e.target.value)}
            disabled={running}
            aria-label="Watch string that should never leak"
            placeholder="A string that should never leak (e.g. a line from your system prompt)"
            className="w-full rounded-lg border border-edge bg-surface p-3 font-mono text-xs text-text placeholder:text-muted focus:border-accent disabled:opacity-50"
          />
          <p className="text-xs text-muted">
            Black-box: Gauntlet POSTs attack messages to your endpoint and flags a leak
            if the watch string ever comes back. Runs only in live mode, and only against
            public HTTPS URLs.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(false)}
          disabled={running}
          className="rounded-md bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-ink shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-accent/20 active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
        >
          {running && !guardScore ? "Running Gauntlet…" : "▶ Run Gauntlet"}
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={running || !baseScore}
          className="rounded-md border border-signal/50 bg-signal/10 px-5 py-2.5 font-mono text-sm font-semibold text-signal transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-signal/20 active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-40"
          title={baseScore ? "Apply runtime guard and re-test" : "Run a scan first"}
        >
          ⛨ Apply Guard &amp; Re-run
        </button>
        <span className="font-mono text-xs text-muted" aria-live="polite">
          {phase ? (
            <>
              <span className="text-accent">status:</span> {phase}
              {running && <span className="cursor-blink"> ▋</span>}
            </>
          ) : (
            "idle. select a target and run"
          )}
        </span>
      </div>

      <p className="rounded-lg border border-edge bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        This public demo runs{" "}
        <span className="text-text">deterministically</span>, with a seeded attacker and a
        reproduced model run, so it is free and calls no paid API. The before-and-after is the same
        every time and reproducible with <span className="text-text">npm run eval</span>. To run it
        live against a real model, clone the repo and run{" "}
        <span className="text-text">npm run dev:live</span>, or email{" "}
        <a
          className="text-accent underline underline-offset-2"
          href="mailto:mthylinao@gmail.com"
        >
          mthylinao@gmail.com
        </a>
        .
      </p>

      {evalReport && (
        <p className="-mt-2 font-mono text-[11px] leading-relaxed text-muted">
          <span className="text-accent">measured</span> ·{" "}
          {evalReport.targets
            .map((t) => `${t.id} ${t.before.grade}→${t.after.grade}`)
            .join(" · ")}{" "}
          · reproducible via <span className="text-text">npm run eval</span>
        </p>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm leading-relaxed text-warn"
        >
          <span className="font-semibold">Live budget reached.</span> {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Live attack console */}
        <div className="overflow-hidden rounded-xl border border-edge bg-surface">
          <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
            <span className="font-mono text-xs font-semibold tracking-wide text-muted">
              ATTACK CONSOLE
            </span>
            <span className="font-mono text-xs text-muted">
              {attempts.length > 0
                ? `${attempts.length}/${attempts[0].total} probes`
                : "idle"}
            </span>
          </div>
          <div
            ref={feedRef}
            role="log"
            aria-live="polite"
            aria-label="Live attack console"
            className="scanlines feed-scroll h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed"
          >
            {attempts.length === 0 && !running && (
              <div className="text-muted">
                <p>
                  Nothing has run yet. Pick a target above and press{" "}
                  <span className="text-accent">Run Gauntlet</span>.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed">
                  An attacker fires OWASP-mapped probes, each streams here with a
                  verdict, the scorecard lands a grade, then{" "}
                  <span className="text-signal">Apply Guard</span> re-tests and the
                  grade climbs.
                </p>
              </div>
            )}
            {attempts.map((a) => (
              <AttemptRow key={`${a.attemptId}-${a.index}`} a={a} />
            ))}
            {running && (
              <p className="mt-2 text-accent">
                <span className="cursor-blink">▋</span> attacking…
              </p>
            )}
          </div>
        </div>

        {/* Scorecard */}
        <ScorePanel
          base={baseScore}
          guard={guardScore}
          active={activeScore}
          guardAttempts={guardAttempts}
        />
      </div>
    </div>
  );
}

function AttemptRow({ a }: { a: AttemptEvent }) {
  return (
    <div className="animate-row mb-3 border-l-2 border-edge pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">[{String(a.index).padStart(2, "0")}]</span>
        <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
          {a.owaspId}
        </span>
        <span className="text-text">{a.family}</span>
        <span
          className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-bold ${VERDICT_STYLE[a.verdict]}`}
        >
          {VERDICT_LABEL[a.verdict]}
        </span>
      </div>
      <p className="mt-1 text-muted [overflow-wrap:anywhere]">
        <span className="text-text">↳ attack:</span> {a.payload}
      </p>
      <p className="mt-0.5 text-muted [overflow-wrap:anywhere]">
        <span className="text-text">↳ response:</span> {a.response}
        {a.canaryHit && (
          <span className="ml-1 font-bold text-alert">⚠ canary leaked</span>
        )}
      </p>
    </div>
  );
}

function ScorePanel({
  base,
  guard,
  active,
  guardAttempts,
}: {
  base: Scorecard | null;
  guard: Scorecard | null;
  active: Scorecard | null;
  guardAttempts: AttemptEvent[];
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold tracking-wide text-muted">
          OWASP LLM TOP 10 · SCORECARD
        </span>
      </div>

      {!active ? (
        <p className="mt-6 font-mono text-xs text-muted">
          Awaiting scan results…
        </p>
      ) : (
        <div
          key={(active.guarded ? "g" : "b") + active.totalAttempts}
          className="animate-panel"
        >
          <div className="mt-4 flex items-end gap-4">
            <div
              key={active.grade + String(active.guarded)}
              data-testid="grade"
              className={`animate-pop font-mono text-6xl font-bold leading-none ${
                GRADE_COLOR[active.grade] ?? "text-text"
              }`}
            >
              {active.grade}
            </div>
            <div className="pb-1 text-xs text-muted">
              <div className="text-text">{GRADE_MEANING[active.grade] ?? ""}</div>
              {base && guard ? (
                <div className="mt-1 font-mono">
                  <span className="font-semibold text-alert">
                    {base.compromised} broke in
                  </span>
                  {" → "}
                  <span className="font-semibold text-signal">
                    {guard.compromised} after the guard
                  </span>
                </div>
              ) : (
                <div className="mt-1">
                  <span className="font-semibold text-alert">
                    {active.compromised}
                  </span>{" "}
                  of {active.totalAttempts} attacks got through
                </div>
              )}
            </div>
          </div>

          <ul className="mt-5 space-y-1.5">
            {active.categories.map((c) => (
              <li
                key={c.owaspId}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-muted">
                  <span className="font-mono text-accent">{c.owaspId}</span>{" "}
                  {c.title}
                </span>
                <span
                  className={`font-mono font-semibold uppercase ${c.tested ? SEVERITY_COLOR[c.worst] : "text-muted"}`}
                  title={c.tested ? undefined : "not tested in this run"}
                >
                  {!c.tested ? "n/a" : c.worst === "none" ? "pass" : c.worst}
                </span>
              </li>
            ))}
          </ul>

          {guard && base && base.findings.length > 0 ? (
            <div className="mt-5 border-t border-edge pt-4">
              <p className="mb-2 font-mono text-[11px] font-semibold text-muted">
                WHAT THE GUARD CHANGED
              </p>
              <ul className="space-y-2">
                {base.findings.map((f, i) => {
                  const after = guardAttempts.find(
                    (a) => a.attemptId === f.attemptId,
                  );
                  const stillBroken = after?.verdict === "compromised";
                  return (
                    <li key={i} className="text-xs">
                      <span className="font-mono text-accent">{f.owaspId}</span>{" "}
                      <span className="text-text">{f.family}</span>
                      <div className="mt-0.5 text-muted">
                        <span className="text-alert">leaked before</span>
                        {" → "}
                        {stillBroken ? (
                          <span className="text-alert">still leaking</span>
                        ) : (
                          <span className="text-signal">
                            {after ? `now ${after.verdict}` : "now blocked"}
                            {after?.guardReason ? ` · ${after.guardReason}` : ""}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : active.findings.length > 0 ? (
            <div className="mt-5 border-t border-edge pt-4">
              <p className="mb-2 font-mono text-[11px] font-semibold text-muted">
                FINDINGS
              </p>
              <ul className="space-y-2">
                {active.findings.map((f, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-mono text-alert">{f.owaspId}</span>{" "}
                    <span className="text-text">{f.title}</span>
                    <span className="text-muted"> · {f.family}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
