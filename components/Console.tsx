"use client";

import { useRef, useState } from "react";
import type {
  AttemptEvent,
  RunEvent,
  Scorecard,
  Severity,
  Verdict,
} from "@/lib/contract";

// Inlined target descriptors — we never ship canaries/system prompts to the client bundle.
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
] as const;

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
  const feedRef = useRef<HTMLDivElement>(null);

  async function run(applyGuard: boolean) {
    if (running) return;
    setRunning(true);
    setPhase("connecting…");
    setAttempts([]);
    if (applyGuard) {
      setGuardScore(null);
    } else {
      setBaseScore(null);
      setGuardScore(null);
    }
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, applyGuard }),
      });
      await readStream(res, (e) => {
        if (e.type === "phase") setPhase(e.detail ?? e.phase);
        else if (e.type === "attempt") {
          setAttempts((prev) => [...prev, e]);
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
      <div className="grid gap-3 sm:grid-cols-3">
        {TARGETS.map((t) => {
          const selected = t.id === targetId;
          return (
            <button
              key={t.id}
              type="button"
              disabled={running}
              onClick={() => setTargetId(t.id)}
              className={`rounded-lg border p-4 text-left transition-colors disabled:opacity-50 ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-edge bg-surface hover:border-muted"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run(false)}
          disabled={running}
          className="rounded-md bg-accent px-5 py-2.5 font-mono text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running && !guardScore ? "Running Gauntlet…" : "▶ Run Gauntlet"}
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={running || !baseScore}
          className="rounded-md border border-signal/50 bg-signal/10 px-5 py-2.5 font-mono text-sm font-semibold text-signal transition-colors hover:bg-signal/20 disabled:opacity-40"
          title={baseScore ? "Apply runtime guard and re-test" : "Run a scan first"}
        >
          ⛨ Apply Guard &amp; Re-run
        </button>
        <span className="font-mono text-xs text-muted">
          {phase ? (
            <>
              <span className="text-accent">status:</span> {phase}
              {running && <span className="cursor-blink"> ▋</span>}
            </>
          ) : (
            "idle — select a target and run"
          )}
        </span>
      </div>

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
                : "—"}
            </span>
          </div>
          <div
            ref={feedRef}
            className="scanlines h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed"
          >
            {attempts.length === 0 && !running && (
              <p className="text-muted">
                No run yet. Hit <span className="text-accent">Run Gauntlet</span>{" "}
                to launch an autonomous adversarial scan.
              </p>
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
        <ScorePanel base={baseScore} guard={guardScore} active={activeScore} />
      </div>
    </div>
  );
}

function AttemptRow({ a }: { a: AttemptEvent }) {
  return (
    <div className="mb-3 border-l-2 border-edge pl-3">
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
      <p className="mt-1 text-muted">
        <span className="text-text">↳ attack:</span> {a.payload}
      </p>
      <p className="mt-0.5 text-muted">
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
}: {
  base: Scorecard | null;
  guard: Scorecard | null;
  active: Scorecard | null;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold tracking-wide text-muted">
          OWASP LLM TOP 10 — SCORECARD
        </span>
      </div>

      {!active ? (
        <p className="mt-6 font-mono text-xs text-muted">
          Awaiting scan results…
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-4">
            <div
              className={`font-mono text-6xl font-bold leading-none ${
                GRADE_COLOR[active.grade] ?? "text-text"
              }`}
            >
              {active.grade}
            </div>
            <div className="pb-1 text-xs text-muted">
              <div>
                <span className="text-alert font-semibold">
                  {active.compromised}
                </span>{" "}
                of {active.totalAttempts} probes compromised the target
              </div>
              {base && guard && (
                <div className="mt-1 font-mono">
                  before guard:{" "}
                  <span className={GRADE_COLOR[base.grade]}>{base.grade}</span>{" "}
                  → after:{" "}
                  <span className={GRADE_COLOR[guard.grade]}>{guard.grade}</span>
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
                  className={`font-mono font-semibold uppercase ${SEVERITY_COLOR[c.worst]}`}
                >
                  {c.worst === "none" ? "pass" : c.worst}
                </span>
              </li>
            ))}
          </ul>

          {active.findings.length > 0 && (
            <div className="mt-5 border-t border-edge pt-4">
              <p className="mb-2 font-mono text-[11px] font-semibold text-muted">
                FINDINGS
              </p>
              <ul className="space-y-2">
                {active.findings.map((f, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-mono text-alert">{f.owaspId}</span>{" "}
                    <span className="text-text">{f.title}</span>
                    <span className="text-muted"> — {f.family}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
