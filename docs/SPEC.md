# Gauntlet — Spec (5-field kernel)

The anti-drift contract. Locked in Phase 0. Stable IDs; workstreams build to these.

## Why (problem + quantified pain)
Teams ship AI features with zero adversarial testing. Prompt injection is the #1 risk in the
OWASP LLM Top 10 (2025), and most exploits need no special access — just text. A leaked system
prompt or exfiltrated user record is a real, current, expensive failure.

## Capabilities (measurable, tech-agnostic success criteria — the demo path)
- C1: Given a target (bundled demo target **or** a pasted system prompt), run ≥5 OWASP-mapped
  attack families and return a result in <90s.
- C2: Stream each attack attempt + verdict live (visible autonomy).
- C3: Detect compromise deterministically via a planted **canary** (no false positives on stage).
- C4: Produce an OWASP LLM Top 10 scorecard with a letter grade + per-category severity + findings.
- C5: "Apply Guard" measurably raises the grade on re-run (before/after delta shown).
- C6: Cover multi-turn escalation and indirect injection (payload inside a processed document).
- C7: Measure the oracle's false-positive / false-negative rate and publish reproducible grades.

**Status (current):** C1 ✅ (13 probes, 6 categories: LLM01/02/05/06/07/10) · C2 ✅ (SSE) ·
C3 ✅ (canary oracle, refusal-gated) · C4 ✅ (grade + categories + findings + per-attack remediation) ·
C5 ✅ (F→A reproducible: SupportBot 10/13, DevAssistant 5/13, PolicyBot 9/13, all → A) ·
C6 ✅ (multi-turn + indirect injection) · C7 ✅ (oracle FP 0% / FN 20% on a labeled set, `npm run eval`).

## Constraints
House stack (Next.js + Vercel + Supabase + OpenAI/Claude); ~1 week build (⚠ verify deadline —
the live Devpost page shows June 5, 2026 @ 11:45pm EDT); 4+ person team; deployed URL; demo
video + deck + public repo required; **Round 1 is graded by an AI** evaluator (verbalize the
architecture, state the problem first, list the stack).

## Non-goals (what we deliberately will NOT build)
Not a hardened security product. Not training-time attacks (LLM03/04/08). Not multi-tenant
auth. Not a shippable guard SDK. No "100% safe" claims. The BYO HTTP-endpoint adapter now exists
but is live-gated and SSRF-guarded; it is a flex, not the demo spine.

## Success signal (how a judge sees it worked)
A judge picks SupportBot, clicks Run, watches it leak a customer SSN live, sees the score hit
**Critical/F**, clicks Apply Guard, and watches it climb to **A** — on the deployed URL,
re-runnable, with the OWASP LLM Top 10 mapping on screen.

## Architecture / CONTRACT
See [CONTRACT.md](CONTRACT.md) (interfaces) and [architecture.md](architecture.md) (diagram).

## Work split (parallel agents — non-overlapping dirs)
- **A · AI-Core** (`lib/`): live model-generated attacker behind `GAUNTLET_LIVE`; expand families to LLM05/LLM10.
- **B · Backend** (`app/api/`, Supabase): persist runs/findings; SystemPrompt + ChatEndpoint adapters; security scan.
- **C · Frontend** (`app/`, `components/`): polish the console + scorecard; empty/error states; `/team-designer` ≥8.
- **D · Eval/Targets** (`lib/targets.ts`, `scripts/`): more vulnerable targets; Playwright `demo:verify` 3×; lock the before/after number.
