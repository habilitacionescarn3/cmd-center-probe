import { test, expect } from "@playwright/test";

test("status page renders headline", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /status operacional/i }),
  ).toBeVisible();
});
