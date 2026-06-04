# Gauntlet — autonomous AI red-team (Devpost write-up)

**Tagline:** Throw your AI in. See what survives.

**One line:** Gauntlet is an autonomous agent that attacks your AI app the way a real attacker
would, scores it against the OWASP LLM Top 10, then installs a one-click runtime guard and re-tests
so the grade climbs from F to A in front of you.

**Live demo:** https://gauntlet-seven.vercel.app · **Repo:** https://github.com/thylinao1/gauntlet

---

## The problem

Almost every team is shipping AI features, and almost none of them adversarially test those features.
Prompt injection is the number one risk in the OWASP LLM Top 10 (2025), and most attacks need no
special access, just text. A leaked system prompt, an exfiltrated customer record, or an abused tool
is a real and expensive failure happening right now. The tools that exist for this (NVIDIA garak,
Microsoft PyRIT, promptfoo) are built for security engineers on the command line. The person actually
shipping the AI feature, a founder or a product engineer, has no fast way to see whether their app is
exposed.

## What Gauntlet does

You point Gauntlet at a target (a bundled vulnerable bot, a system prompt you paste, a real model, or
your own HTTP endpoint). You press Run. An autonomous attacker generates and fires OWASP-mapped probes,
and every attempt streams into a live console with a verdict. The app leaks its secret, and the
scorecard lands on F. You press Apply Guard and Re-run. A runtime guard blocks the injections and
redacts the secrets, and the grade climbs to A, with a line-by-line list of what changed and why. The
whole find-and-fix loop is legible to someone who is not a security engineer.

## How it works (architecture)

A streaming, multi-stage agent loop in `lib/engine.ts`, surfaced to the browser over Server-Sent
Events from `app/api/run/route.ts`:

1. **Planner** selects the OWASP attack families to cover.
2. **Attacker** (`lib/attacker.ts`) generates the probes. With a key, a black-box LLM writes
   app-specific attacks from only the target's public name and description. It can also produce a
   multi-turn escalation and an indirect-injection document. Without a key it uses a deterministic
   seeded corpus, so the demo never breaks.
3. **Target adapter** (`lib/targets.ts`) is the app under test. Bundled vulnerable bots are
   deterministic; the real-model, pasted-prompt, and BYO-endpoint targets call a live model or your
   endpoint.
4. **Guard** (`lib/guard.ts` plus `lib/classifier.ts`) is the runtime defense: a normalize-and-decode
   regex firewall, an optional learned classifier, and an output sanitizer that redacts secrets and
   neutralizes markup.
5. **Oracle** (`lib/oracle.ts`) decides compromise deterministically: the planted canary appears in
   the output and the output is not a refusal.
6. **Scorer** maps findings to the OWASP LLM Top 10 and assigns the letter grade.

Every attempt is streamed live, so the autonomy is visible rather than asserted.

## Tech stack

Next.js 16 (App Router, route handlers, streaming) · React 19 · TypeScript · Tailwind v4 · Vitest ·
Playwright · deployed on Vercel · Anthropic Claude (Haiku) for the live attacker and real-model
targets, via a plain fetch client with an OpenAI fallback.

## What we measured (not just claimed)

We built an eval so the numbers are earned. Run `npm run eval` to regenerate them.

- **Oracle accuracy** on an 18-case labeled set: 0% false positives, 11% false negatives (1 of 9 positives). The single miss is
  obfuscated exfiltration (a secret spelled out phonetically), a limitation we surface rather than
  hide.
- **Reproducible grades:** SupportBot F (10 of 13 probes) to A, DevAssistant F (5 of 13) to A,
  PolicyBot F (9 of 13) to A.
- **Against a real frontier model** (Claude Haiku 4.5, about 40 probes): direct injection leaked 0,
  indirect 0 of 8, multi-turn 0, and deliberately over-permissive prompts 0 of 3 each. Only
  conflicting-instruction prompts leaked, about 1 in 6. The honest conclusion is that a current
  frontier model resists these attacks, and the real exposure is in prompt misconfiguration, which is
  exactly what Gauntlet finds for your app.

## How it is different

Generative attack tools exist, and promptfoo even has a web UI and a prompt-hardening step. Gauntlet's
contribution is narrower and specific: the visible attack, score, one-click runtime guard, rescore
loop, with a letter grade and a per-attack before-and-after, runnable by a non-expert. We are not
claiming we invented red-teaming. We made the loop legible, and we measured the parts we claim.

## Honest limits

Single-turn coverage dominates, with one multi-turn and one indirect case. The bundled targets and
their canaries are ours, so they are a controlled demonstration, not a third-party finding. The
regex guard can be paraphrased around, which is why the learned classifier layer and the documented
local Prompt Guard 2 backend exist. We do not claim any AI is "100% safe."

## What is next

A trained local classifier in the guard by default, deeper multi-turn and indirect coverage,
persisted shareable run reports, and a one-line CI check so Gauntlet runs on every pull request.

## OWASP coverage

LLM01 prompt injection, LLM02 sensitive information disclosure, LLM05 improper output handling, LLM06
excessive agency, LLM07 system-prompt leakage, LLM10 unbounded consumption. Training-time risks
(LLM03/04/08) need build access and are out of scope.
