# Gauntlet — Spec (5-field kernel)

The interface kernel. Stable IDs that the rest of the code builds against.

## Why (problem + quantified pain)
Teams ship AI features with zero adversarial testing. Prompt injection is the #1 risk in the
OWASP LLM Top 10 (2025), and most exploits need no special access — just text. A leaked system
prompt or exfiltrated user record is a real, current, expensive failure.

## Capabilities (measurable, tech-agnostic success criteria — the demo path)
- C1: Given a target (bundled demo target **or** a pasted system prompt), run ≥5 OWASP-mapped
  attack families and return a result in <90s.
- C2: Stream each attack attempt + verdict live (visible autonomy).
- C3: Detect compromise deterministically via a planted **canary** (no false positives in the demo).
- C4: Produce an OWASP LLM Top 10 scorecard with a letter grade + per-category severity + findings.
- C5: "Apply Guard" measurably raises the grade on re-run (before/after delta shown).
- C6: Cover multi-turn escalation and indirect injection (payload inside a processed document).
- C7: Measure the oracle's false-positive / false-negative rate and publish reproducible grades.

**Status (current):** C1 ✅ (13 probes, 6 categories: LLM01/02/05/06/07/10) · C2 ✅ (SSE) ·
C3 ✅ (canary oracle, refusal-gated) · C4 ✅ (grade + categories + findings + per-attack remediation) ·
C5 ✅ (F→A reproducible: SupportBot 10/13, DevAssistant 5/13, PolicyBot 9/13, all → A) ·
C6 ✅ (multi-turn + indirect injection) · C7 ✅ (oracle FP 0% / FN 20% on a labeled set, `npm run eval`).

## Constraints
Next.js + Vercel + TypeScript. The demo must run offline with no API keys, and the live model
path must degrade to the deterministic run. Deployed URL, demo video, and public repo.

## Non-goals (what we deliberately will NOT build)
Not a hardened security product. Not training-time attacks (LLM03/04/08). Not multi-tenant
auth. Not a shippable guard SDK. No "100% safe" claims. The BYO HTTP-endpoint adapter now exists
but is live-gated and SSRF-guarded; it is a flex, not the demo spine.

## Success signal
A visitor picks SupportBot, clicks Run, watches it leak a customer SSN live, sees the score hit
**Critical/F**, clicks Apply Guard, and watches it climb to **A** — on the deployed URL,
re-runnable, with the OWASP LLM Top 10 mapping on screen.

## Architecture / CONTRACT
See [CONTRACT.md](CONTRACT.md) (interfaces) and [architecture.md](architecture.md) (diagram).
