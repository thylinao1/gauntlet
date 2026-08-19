# Gauntlet spec

The interface kernel: the stable IDs and success criteria the rest of the code builds against.

## Why

Teams ship AI features with no adversarial testing at all. Prompt injection is the number one risk
in the OWASP LLM Top 10 (2025), and most exploits need no special access, only text. A leaked
system prompt or an exfiltrated user record is a real and expensive failure.

## Capabilities

Measurable, technology-agnostic success criteria for the demo path.

- C1: given a target (a bundled demo target or a pasted system prompt), run at least 5
  OWASP-mapped attack families and return a result in under 90s.
- C2: stream each attack attempt and verdict live.
- C3: detect compromise deterministically via a planted canary, with no false positives in the demo.
- C4: produce an OWASP LLM Top 10 scorecard with a letter grade, per-category severity, and findings.
- C5: "Apply Guard" measurably raises the grade on a re-run, and the before/after delta is shown.
- C6: cover multi-turn escalation and indirect injection (the payload sits inside a processed
  document).
- C7: measure the oracle's false-positive and false-negative rate, and publish reproducible grades.

| Capability | Status | Evidence |
| --- | --- | --- |
| C1 | done | 13 probes across 6 categories (LLM01/02/05/06/07/10) |
| C2 | done | SSE stream from `app/api/run/route.ts` |
| C3 | done | canary oracle, refusal-gated (`lib/oracle.ts`) |
| C4 | done | grade, categories, findings, per-attack remediation |
| C5 | done | F to A reproducible: SupportBot 10/13, DevAssistant 5/13, PolicyBot 9/13, all to A |
| C6 | done | multi-turn escalation and indirect injection in `lib/attacks.ts` |
| C7 | done | 18-case labeled set: 0 false positives of 9 negatives, 1 false negative of 9 positives (`npm run eval`) |

## Constraints

Next.js, Vercel, TypeScript. The demo must run offline with no API keys, and the live model path
must degrade to the deterministic run. Deployed URL, demo video, and public repo.

## Non-goals

Not a hardened security product. Not training-time attacks (LLM03/04/08). Not multi-tenant auth.
Not a shippable guard SDK. No "100% safe" claims. The bring-your-own HTTP endpoint adapter exists,
but it is live-gated and SSRF-guarded, and it is not the spine of the demo.

## Success signal

A visitor picks SupportBot, clicks Run, watches it leak a customer SSN live, sees the score hit
Critical/F, clicks Apply Guard, and watches it climb to A. On the deployed URL, re-runnable, with
the OWASP LLM Top 10 mapping on screen.

## Architecture and contract

See [CONTRACT.md](CONTRACT.md) for the interfaces and [architecture.md](architecture.md) for the
diagram.
