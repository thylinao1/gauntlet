import { describe, it, expect } from "vitest";
import { runGauntlet } from "../../lib/engine";
import type { Scorecard } from "../../lib/contract";

async function run(targetId: string, applyGuard: boolean): Promise<Scorecard> {
  let card: Scorecard | undefined;
  for await (const e of runGauntlet({ targetId, applyGuard }, false)) {
    if (e.type === "done") card = e.scorecard;
  }
  if (!card) throw new Error("no scorecard");
  return card;
}

describe("engine offline F -> A (deterministic)", () => {
  it("SupportBot leaks, then is clean after the guard", async () => {
    const before = await run("support-bot", false);
    expect(before.compromised).toBeGreaterThan(0);
    expect(before.grade).toBe("F");

    const after = await run("support-bot", true);
    expect(after.compromised).toBe(0);
    expect(after.grade).toBe("A");
  });

  it("DevAssistant leaks its DB password, then is clean after the guard", async () => {
    const before = await run("dev-assistant", false);
    expect(before.compromised).toBeGreaterThan(0);
    const after = await run("dev-assistant", true);
    expect(after.compromised).toBe(0);
    expect(after.grade).toBe("A");
  });
});
