import { describe, it, expect } from "vitest";
import { gradeFromSeverity, severityRank } from "../../lib/contract";

describe("grading", () => {
  it("maps the worst severity to a letter grade", () => {
    expect(gradeFromSeverity("critical")).toBe("F");
    expect(gradeFromSeverity("high")).toBe("D");
    expect(gradeFromSeverity("medium")).toBe("C");
    expect(gradeFromSeverity("low")).toBe("B");
    expect(gradeFromSeverity("none")).toBe("A");
  });

  it("orders severities", () => {
    expect(severityRank("critical")).toBeGreaterThan(severityRank("high"));
    expect(severityRank("high")).toBeGreaterThan(severityRank("low"));
    expect(severityRank("low")).toBeGreaterThan(severityRank("none"));
  });
});
