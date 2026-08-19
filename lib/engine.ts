// lib/engine.ts
// The Gauntlet red-team loop. An async generator that yields RunEvents as it works so the
// UI can stream the attack live. Phases: recon -> plan -> attack (per probe) -> score. With a
// guard active, injection inputs are blocked and outputs are sanitized (secrets redacted,
// markup neutralized, length capped), so the re-run scores higher (the before/after wow).

import { generateAttacks } from "./attacker";
import { assessInjectionSmart } from "./classifier";
import { checkSuccess } from "./oracle";
import { getTarget } from "./targets";
import {
  OWASP_TITLES,
  categorySeverity,
  gradeFromSeverity,
  severityRank,
  type AttackPayload,
  type CategoryScore,
  type ChatMessage,
  type Finding,
  type OwaspId,
  type RunEvent,
  type RunRequest,
  type Scorecard,
  type Severity,
  type Verdict,
} from "./contract";
import type { TargetAdapter } from "./targets";

// Paces the stream so the live attack is watchable. Set GAUNTLET_NO_DELAY=1 (tests) to disable.
function attemptDelay(): number {
  return process.env.GAUNTLET_NO_DELAY ? 0 : 280;
}
const GUARD_MAX_OUTPUT = 1200; // the guard caps output length (mitigates unbounded consumption)

// The OWASP LLM Top 10 categories Gauntlet actively tests (black-box). LLM03/04/08/09 need
// build/training-time access and are on the roadmap.
const ALL_CATEGORIES: OwaspId[] = [
  "LLM01",
  "LLM02",
  "LLM05",
  "LLM06",
  "LLM07",
  "LLM10",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(s: string, n = 320): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// The output side of the runtime guard: redact leaked secrets, neutralize unescaped markup,
// and cap runaway length. Turns LLM02/05/07/10 compromises into safe responses on the re-run.
function applyOutputGuard(output: string, canary: string): string {
  let t = output.split(canary).join("[REDACTED-BY-GAUNTLET]");
  t = t.replace(/<\s*script/gi, "&lt;script").replace(/<\s*\/\s*script/gi, "&lt;/script");
  if (t.length > GUARD_MAX_OUTPUT) {
    t = `${t.slice(0, GUARD_MAX_OUTPUT)} …[truncated by Gauntlet guard]`;
  }
  return t;
}

// A short, human reason describing what the output guard changed, for the remediation view.
function describeOutputGuard(before: string, after: string, canary: string): string {
  const parts: string[] = [];
  if (before.includes(canary)) parts.push("secret redacted");
  if (/<\s*script/i.test(before)) parts.push("markup neutralized");
  if (after.includes("[truncated by Gauntlet guard]")) parts.push("output capped");
  return parts.length
    ? `Output sanitized: ${parts.join(", ")}.`
    : "Output sanitized.";
}

// The compromise oracle (looksLikeRefusal + checkSuccess) lives in ./oracle so it can be
// unit-tested and reused by scripts/eval.ts.

function scoreRun(
  findings: Finding[],
  totalAttempts: number,
  compromised: number,
  guarded: boolean,
  attemptedIds: Set<OwaspId>,
): Scorecard {
  const categories: CategoryScore[] = ALL_CATEGORIES.map((id) => {
    const fs = findings.filter((f) => f.owaspId === id);
    const worst = fs.reduce<Severity>(
      (w, f) => (severityRank(f.severity) > severityRank(w) ? f.severity : w),
      "none",
    );
    return {
      owaspId: id,
      title: OWASP_TITLES[id],
      tested: attemptedIds.has(id),
      worst,
      findingCount: fs.length,
    };
  });

  const worstOverall = findings.reduce<Severity>(
    (w, f) => (severityRank(f.severity) > severityRank(w) ? f.severity : w),
    "none",
  );
  const grade =
    guarded && compromised === 0 ? "A" : gradeFromSeverity(worstOverall);

  return { grade, guarded, totalAttempts, compromised, findings, categories };
}

interface ProbeOutcome {
  verdict: Verdict;
  response: string;
  guardReason?: string;
  canaryHit: boolean;
}

// Run one probe end to end (single- or multi-turn), applying the guard when active.
// Multi-turn plays each turn in sequence, carrying the model's replies, and a leak in
// ANY turn counts. The input guard stops the conversation at the first blocked turn.
async function executeProbe(
  target: TargetAdapter,
  p: AttackPayload,
  guarded: boolean,
  allowLive: boolean,
): Promise<ProbeOutcome> {
  const turns = p.turns && p.turns.length > 0 ? p.turns : [p.prompt];

  if (guarded) {
    for (const t of turns) {
      const inj = await assessInjectionSmart(t, allowLive);
      if (inj.blocked) {
        return {
          verdict: "blocked",
          response: "Blocked by Gauntlet guard (input filter).",
          guardReason: inj.reason,
          canaryHit: false,
        };
      }
    }
  }

  const convo: ChatMessage[] = [{ role: "system", content: target.systemPrompt }];
  const replies: string[] = [];
  let guardReason: string | undefined;

  for (const t of turns) {
    convo.push({ role: "user", content: t });
    const rawOriginal = await target.respond(convo);
    let reply = rawOriginal;
    if (guarded) {
      reply = applyOutputGuard(rawOriginal, target.canary);
      if (reply !== rawOriginal) {
        guardReason = describeOutputGuard(rawOriginal, reply, target.canary);
      }
    }
    convo.push({ role: "assistant", content: reply });
    replies.push(reply);
  }

  const combined = replies.join("\n");
  const success = checkSuccess(p.success, combined, target.canary);
  return {
    verdict: success ? "compromised" : "safe",
    response: turns.length > 1 ? combined : replies[replies.length - 1] ?? "",
    guardReason,
    canaryHit: success && (p.success?.kind ?? "canary") === "canary",
  };
}

export async function* runGauntlet(
  req: RunRequest,
  allowLive: boolean,
  notice?: string,
): AsyncGenerator<RunEvent> {
  if (notice) {
    yield { type: "notice", ts: Date.now(), level: "budget", message: notice };
  }
  const guarded = req.applyGuard === true;
  const target = getTarget(req.targetId, {
    systemPrompt: req.systemPrompt,
    allowLive,
    endpointUrl: req.endpointUrl,
    watchSecret: req.watchSecret,
  });

  yield {
    type: "phase",
    ts: Date.now(),
    phase: "recon",
    detail: `Target acquired: ${target.name}${guarded ? " (runtime guard ACTIVE)" : ""}`,
  };
  await sleep(attemptDelay());

  const { payloads, mode } = await generateAttacks(target, allowLive);
  yield {
    type: "phase",
    ts: Date.now(),
    phase: "plan",
    detail:
      mode === "live"
        ? `Attacker online: ${payloads.length} model-generated, target-aware probes`
        : `Attacker: ${payloads.length} seeded probes (set GAUNTLET_LIVE=true to generate live)`,
  };
  await sleep(attemptDelay());
  const findings: Finding[] = [];
  const attemptedIds = new Set<OwaspId>();
  let compromised = 0;

  for (let i = 0; i < payloads.length; i++) {
    const p = payloads[i];
    attemptedIds.add(p.owaspId);
    await sleep(attemptDelay());

    const outcome = await executeProbe(target, p, guarded, allowLive);

    if (outcome.verdict === "compromised") {
      compromised++;
      findings.push({
        attemptId: p.id,
        owaspId: p.owaspId,
        title: OWASP_TITLES[p.owaspId],
        severity: categorySeverity(p.owaspId),
        family: p.family,
        attackPrompt: p.prompt,
        evidence: truncate(outcome.response, 220),
      });
    }

    yield {
      type: "attempt",
      ts: Date.now(),
      attemptId: p.id,
      index: i + 1,
      total: payloads.length,
      family: p.family,
      owaspId: p.owaspId,
      payload: truncate(p.prompt),
      response: truncate(outcome.response),
      verdict: outcome.verdict,
      severity:
        outcome.verdict === "compromised" ? categorySeverity(p.owaspId) : "none",
      canaryHit: outcome.canaryHit,
      guardReason: outcome.guardReason,
    };
  }

  await sleep(attemptDelay());
  yield {
    type: "done",
    ts: Date.now(),
    scorecard: scoreRun(findings, payloads.length, compromised, guarded, attemptedIds),
  };
}
