# Gauntlet — demo video script (target 2:45, hard cap 3:00)

Two audiences. Round 1 is an AI evaluator scoring a transcript, so the narration states the problem
first, says the architecture out loud, and names the stack. Round 2 is a human panel, so the live
before-and-after has to land cleanly. Record at 1440p, captions on. Record a backup take of the full
run in case the live one stalls.

Criteria shorthand: [INN] Innovation, [TECH] Technical, [IMP] Impact/Scalability, [DES] Design/UX.

---

### 0:00–0:15 — Hook and problem  [IMP] [communication]
On screen: the hero, then the four target cards.
Say: "Almost every team is shipping AI features. Almost none of them security-test those features.
Prompt injection is the number one risk in the OWASP LLM Top 10, and it takes nothing but text. This
is Gauntlet. It attacks your AI app, scores it, and fixes it, in one loop."

### 0:15–0:35 — The promise  [INN]
On screen: hover the SupportBot card.
Say: "Gauntlet is an autonomous red-team agent. With an API key it generates app-specific attacks
from only the target's public description, so a hit is genuine discovery, not a fixed checklist. Let
me show you against a support bot that is holding a customer's SSN."

### 0:35–1:15 — The break, with the architecture spoken  [TECH]
On screen: pick SupportBot, press Run Gauntlet, let probes stream, land on F.
Say: "Here is the loop. A planner picks OWASP attack families. The attacker generates probes and
streams each one over Server-Sent Events. The target responds. A canary oracle decides compromise:
the planted secret has to appear and the response must not be a refusal. A scorer maps every finding
to the OWASP LLM Top 10. Watch the attempts stream in. The bot leaks its system prompt and the SSN,
and the grade lands on F. Ten of thirteen attacks got in."

### 1:15–1:45 — The fix  [IMP] [TECH]
On screen: press Apply Guard and Re-run, grade climbs to A, point at the remediation list.
Say: "Now one click. The runtime guard normalizes and decodes the input, so base64 and unicode
tricks cannot slip past, scores it against weighted intent patterns, and redacts secrets on the way
out. Re-run, and the grade climbs to A. Zero got through. And it tells you exactly what changed:
this one blocked at the input filter, this one had its output sanitized."

### 1:45–2:10 — The honest part  [TECH] [credibility]
On screen: select the Live model bot, run it, it holds at A; then show the measured strip.
Say: "We also point it at a real frontier model. It mostly holds, and that is the honest result. We
measured it: across about forty probes, direct, indirect, and multi-turn attacks all failed, and the
only leaks came from prompts with conflicting instructions. The real exposure is misconfiguration,
and that is what Gauntlet finds for your app. Our oracle runs at zero false positives on our labeled
set, and the before-and-after is reproducible with one command."

### 2:10–2:35 — Bring your own, and scale  [IMP]
On screen: the "paste your own prompt" and "your endpoint" targets.
Say: "Point it at your own system prompt, or at a real HTTP endpoint you control, and it tests that
black-box. The guard is free and deterministic at runtime, and the production path is a local trained
classifier, so this scales to any app without a per-call security bill."

### 2:35–2:55 — Stack and close  [communication] [vision]
On screen: the full console, then the repo.
Say: "Built on Next.js 16, React 19, TypeScript, and Tailwind, deployed on Vercel, with Vitest and
Playwright covering the loop. Gauntlet turns adversarial testing from something only a security
engineer does into one click any builder can run. Throw your AI in, and see what survives."

---

## Backup plan
- Pre-record the full SupportBot F to A run and the Live model bot run. If the live demo stalls,
  cut to the recording and keep narrating.
- The public site is seeded and deterministic, so the bundled F to A is the same every time.
- Have `public/eval.json` open in a tab as proof of the numbers.
