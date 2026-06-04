import { test, expect } from "@playwright/test";

// The headline claim, verified on the real app three times: SupportBot scores F, the guard
// is applied, and the grade climbs to A. Seeded mode, so it is deterministic.
for (let run = 1; run <= 3; run++) {
  test(`SupportBot F -> A, run ${run}`, async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Run Gauntlet/i }).click();
    await expect(page.getByText(/scan complete/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("grade")).toHaveText("F");

    await page.getByRole("button", { name: /Apply Guard/i }).click();
    await expect(page.getByText(/guard verified/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("grade")).toHaveText("A");
  });
}
