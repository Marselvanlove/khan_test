import { expect, test, type Page } from "@playwright/test";

const DASHBOARD_HEADING = "Операционный дашборд заказов для Tomyris";
const SETUP_REQUIRED_TEXT = "Заполни SUPABASE_URL и SUPABASE_SECRET_KEY, чтобы увидеть данные.";

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    errors.push(String(error));
  });

  return errors;
}

async function assertDashboardShell(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/GBC Analytics Dashboard/);
  await expect(page.locator("main")).toContainText(DASHBOARD_HEADING);
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
}

test("dashboard smoke: production page renders without runtime errors", async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await assertDashboardShell(page);

  const mainText = await page.locator("main").innerText();
  expect(mainText.trim().length).toBeGreaterThan(0);

  if (process.env.E2E_EXPECT_SETUP_REQUIRED === "true") {
    expect(mainText).toContain(SETUP_REQUIRED_TEXT);
  }

  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});

test("dashboard smoke: extension-like body attrs do not trigger hydration mismatch", async ({
  page,
  context,
}) => {
  const runtimeErrors = collectRuntimeErrors(page);

  await context.addInitScript(() => {
    const applyAttrs = () => {
      if (document.body) {
        document.body.setAttribute(
          "__processed_ca649cf1-0890-4ec0-9d17-6a1c57145e03__",
          "true",
        );
        document.body.setAttribute("bis_register", "simulated-extension-payload");
      }
    };

    new MutationObserver(applyAttrs).observe(document, { childList: true, subtree: true });
    applyAttrs();
  });

  await assertDashboardShell(page);

  const bodyAttributes = await page.evaluate(() =>
    Array.from(document.body.attributes).map((attribute) => attribute.name),
  );

  expect(bodyAttributes).toContain("__processed_ca649cf1-0890-4ec0-9d17-6a1c57145e03__");
  expect(bodyAttributes).toContain("bis_register");
  expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
});
