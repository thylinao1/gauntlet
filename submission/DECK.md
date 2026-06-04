# Gauntlet — pitch deck (6 slides)

Keep one idea per slide. Dark security-console aesthetic to match the product. Use real screenshots
from `eval-screens/` for slides 3 and 4.

---

## Slide 1 — The problem
**Everyone is shipping AI. Almost no one is testing it for attacks.**
- Prompt injection is the #1 risk in the OWASP LLM Top 10 (2025).
- A leaked system prompt or an exfiltrated record needs nothing but text.
- The existing tools are command-line scanners built for security engineers.
- Visual: a chat bubble leaking a secret.

## Slide 2 — What Gauntlet is
**An autonomous red-team that attacks, scores, and fixes your AI in one visible loop.**
- Point it at a bot, a pasted prompt, a real model, or your own endpoint.
- A generative, target-aware attacker fires OWASP-mapped probes, live.
- One click installs a runtime guard and re-tests. The grade climbs F to A.
- Visual: the four-step loop (attack, score, guard, rescore).

## Slide 3 — The wow: before and after
**F to A, on the real app, in two clicks.**
- Screenshot: SupportBot at F with the leaked SSN, beside the same bot at A.
- The remediation panel names what changed for each attack.
- Reproducible: SupportBot 10/13 leaked, then 0.
- Visual: side-by-side F and A scorecards.

## Slide 4 — How it works
**A streaming, multi-stage agent loop.**
- Planner, generative attacker, target adapter, layered guard, canary oracle, scorer.
- Streamed over Server-Sent Events, so the autonomy is visible.
- Stack: Next.js 16, React 19, TypeScript, Tailwind, Vercel, Vitest, Playwright.
- Visual: the architecture diagram from the README.

## Slide 5 — We measured it (the honest slide)
**Numbers we earned, not adjectives.**
- Oracle: 0% false positives, 20% false negatives on a labeled set (the miss is documented).
- A real frontier model mostly holds; only conflicting-instruction prompts leaked (~1 in 6).
- The real risk is prompt misconfiguration, and that is what Gauntlet surfaces.
- Visual: the `npm run eval` output.

## Slide 6 — Impact and the ask
**Adversarial testing any builder can run.**
- The guard is free and deterministic at runtime; the production path is a local classifier.
- Scales to any app via the bring-your-own endpoint and a one-line CI check (next).
- Built for Beyond Tomorrow. Live at gauntlet-seven.vercel.app, open source on GitHub.
- Visual: the hero with the tagline "Throw your AI in. See what survives."
