// scripts/eval-live.ts
// Measures the GENERATIVE attacker (the project's novel claim), which the offline eval cannot cover.
// With GAUNTLET_LIVE=true and a model key, it asks the attacker to write probes for each target K
// times and reports: how many rounds actually ran live, total probes, how unique they are across
// rounds (diversity), and family / OWASP coverage. Costs a few model calls per round.
//   GAUNTLET_LIVE=true ANTHROPIC_API_KEY=sk-ant-... npm run eval:live

import { generateAttacks } from "../lib/attacker";
import { getTarget } from "../lib/targets";

const ROUNDS = Number(process.env.EVAL_LIVE_ROUNDS) || 3;
const TARGET_IDS = ["support-bot", "dev-assistant", "policy-bot", "live-claude"];

async function main() {
  if (process.env.GAUNTLET_LIVE !== "true") {
    console.error(
      "Set GAUNTLET_LIVE=true and a model key (ANTHROPIC_API_KEY or OPENAI_API_KEY) to measure the live attacker.",
    );
    process.exit(1);
  }

  for (const id of TARGET_IDS) {
    const target = getTarget(id, { allowLive: true });
    const prompts = new Set<string>();
    const families = new Set<string>();
    const owasp = new Set<string>();
    let total = 0;
    let liveRounds = 0;

    for (let r = 0; r < ROUNDS; r++) {
      const plan = await generateAttacks(target, true);
      if (plan.mode === "live") liveRounds++;
      for (const p of plan.payloads) {
        total += 1;
        prompts.add(p.prompt.trim().toLowerCase());
        families.add(p.family);
        owasp.add(p.owaspId);
      }
    }

    const uniquePct = total ? Math.round((prompts.size / total) * 100) : 0;
    console.log(
      `${id}: ${liveRounds}/${ROUNDS} live rounds | ${total} probes | ` +
        `${prompts.size} unique (${uniquePct}%) | ${families.size} families | ` +
        `OWASP ${[...owasp].sort().join(", ") || "none"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
