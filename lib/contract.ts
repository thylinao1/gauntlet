// lib/contract.ts
// The interface contract every workstream codes against. Owned by the coordinator.
// Mirrors docs/CONTRACT.md — do not redefine these shapes in workstream code.

export type OwaspId = "LLM01" | "LLM02" | "LLM05" | "LLM06" | "LLM07" | "LLM10";

export const OWASP_TITLES: Record<OwaspId, string> = {
  LLM01: "Prompt Injection",
  LLM02: "Sensitive Information Disclosure",
  LLM05: "Improper Output Handling",
  LLM06: "Excessive Agency",
  LLM07: "System Prompt Leakage",
  LLM10: "Unbounded Consumption",
};

export type Severity = "critical" | "high" | "medium" | "low" | "none";
export type Verdict = "compromised" | "blocked" | "safe";
export type Grade = "A" | "B" | "C" | "D" | "F";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** How the engine decides a probe compromised the target. Defaults to canary detection. */
export type SuccessCheck =
  | { kind: "canary" }
  | { kind: "contains"; needle: string } // an unescaped marker appears in output (LLM05)
  | { kind: "length"; min: number }; // runaway output length (LLM10)

/** A single adversarial probe the attacker fires at the target. */
export interface AttackPayload {
  id: string;
  family: string;
  owaspId: OwaspId;
  severity: Severity; // severity IF this probe succeeds
  prompt: string;
  success?: SuccessCheck;
}

/** Confirmed weakness — a probe that compromised the target. */
export interface Finding {
  owaspId: OwaspId;
  title: string;
  severity: Severity;
  family: string;
  attackPrompt: string;
  evidence: string; // response excerpt proving the compromise
}

export interface CategoryScore {
  owaspId: OwaspId;
  title: string;
  tested: boolean;
  worst: Severity;
  findingCount: number;
}

export interface Scorecard {
  grade: Grade;
  guarded: boolean;
  totalAttempts: number;
  compromised: number;
  findings: Finding[];
  categories: CategoryScore[];
}

// ---- Streamed run events (the live "attack console" feed) ----

interface RunEventBase {
  ts: number;
}

export interface PhaseEvent extends RunEventBase {
  type: "phase";
  phase: string;
  detail?: string;
}

export interface AttemptEvent extends RunEventBase {
  type: "attempt";
  attemptId: string;
  index: number;
  total: number;
  family: string;
  owaspId: OwaspId;
  payload: string; // possibly truncated
  response: string; // possibly truncated
  verdict: Verdict;
  severity: Severity;
  canaryHit: boolean;
}

export interface DoneEvent extends RunEventBase {
  type: "done";
  scorecard: Scorecard;
}

export interface ErrorEvent extends RunEventBase {
  type: "error";
  message: string;
}

export type RunEvent = PhaseEvent | AttemptEvent | DoneEvent | ErrorEvent;

export interface RunRequest {
  targetId: string;
  applyGuard?: boolean;
  systemPrompt?: string; // for the "paste your own AI" target
}

const SEVERITY_RANK: Record<Severity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}

export function gradeFromSeverity(worst: Severity): Grade {
  switch (worst) {
    case "critical":
      return "F";
    case "high":
      return "D";
    case "medium":
      return "C";
    case "low":
      return "B";
    default:
      return "A";
  }
}
