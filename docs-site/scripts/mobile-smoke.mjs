// Touch-capable browser emulation, not an iPhone hardware test.
// BASE=http://localhost:3422 bun scripts/mobile-smoke.mjs
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, webkit } from "playwright";

const base = process.env.BASE ?? "http://localhost:3422";
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const failures = [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  for (const width of [320, 390, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
    });
    const page = await context.newPage();
    for (const path of [
      "/",
      "/docs",
      "/docs/html",
      "/docs/playground",
      "/docs/selection",
      "/docs/svelte",
      "/docs/accuracy",
    ]) {
      try {
        await page.goto(base + path, { waitUntil: "networkidle" });
        const size = await page.evaluate(() => ({
          viewport: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        assert.ok(
          size.content <= width + 1 && size.viewport <= width + 1,
          `horizontal overflow: viewport=${size.viewport}, content=${size.content}, device=${width}`,
        );
        const clipped = await page
          .locator(".gl-seg button")
          .evaluateAll((buttons) =>
            buttons
              .filter((button) => {
                const r = button.getBoundingClientRect();
                return (
                  r.left < 0 ||
                  r.right > document.documentElement.clientWidth + 1
                );
              })
              .map((button) => button.textContent),
          );
        assert.deepEqual(
          clipped,
          [],
          "segmented options must fit the viewport",
        );
        console.log(`PASS ${engine.name()} ${width} ${path} layout`);
      } catch (error) {
        failures.push(`${engine.name()} ${width} ${path}: ${error.message}`);
      }
    }
    try {
      await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
      if (width < 768)
        await page
          .getByRole("button", { name: "Open Sidebar", exact: true })
          .filter({ visible: true })
          .first()
          .tap();
      const link = page
        .getByRole("link", { name: "Getting started", exact: true })
        .filter({ visible: true })
        .first();
      await link.tap();
      await page.waitForURL("**/docs/getting-started");
      console.log(
        `PASS ${engine.name()} ${width} sidebar navigation via touch`,
      );

      await page.goto(`${base}/docs`, { waitUntil: "networkidle" });
      const reader = page.locator("[data-read-along]");
      await reader.locator(".gl-pdf-page[data-ready]").waitFor();
      await reader.getByRole("button", { name: "Play", exact: true }).tap();
      await page.waitForFunction(() =>
        document
          .querySelector("[data-read-along] .gl-word")
          ?.getAttribute("d")
          ?.startsWith("M"),
      );
      const first = await reader.locator(".gl-word").getAttribute("d");
      await page.waitForFunction(
        (d) =>
          document
            .querySelector("[data-read-along] .gl-word")
            ?.getAttribute("d") !== d,
        first,
      );
      await reader.getByRole("button", { name: "Pause", exact: true }).tap();
      console.log(
        `PASS ${engine.name()} ${width} PDF read-along touch playback`,
      );

      // Selection is set through the DOM: Playwright does not emulate native iOS selection handles.
      // Keeping it uses real touchscreen taps, including the browser's focus/selection clearing.
      for (const mode of ["html", "pdf", "svelte"]) {
        await page.goto(
          `${base}/docs/${mode === "svelte" ? "svelte" : "selection"}`,
          { waitUntil: "networkidle" },
        );
        if (mode === "pdf") {
          await page
            .getByRole("radio", { name: "PDF page", exact: true })
            .tap();
          await page.locator(".gl-pdf-page[data-ready]").waitFor();
        }
        const root = mode === "svelte" ? "[data-svelte-host]" : ".gl-demo";
        if (mode === "svelte") {
          await page
            .locator(root)
            .getByRole("button", { name: "Read", exact: true })
            .tap();
          await page.waitForFunction(() =>
            document
              .querySelector("[data-svelte-demo] .gl-word")
              ?.getAttribute("d")
              ?.startsWith("M"),
          );
          const d = await page
            .locator("[data-svelte-demo] .gl-word")
            .getAttribute("d");
          await page.waitForFunction(
            (previous) =>
              document
                .querySelector("[data-svelte-demo] .gl-word")
                ?.getAttribute("d") !== previous,
            d,
          );
          await page
            .locator(root)
            .getByRole("button", { name: "Pause", exact: true })
            .tap();
        }
        await page.evaluate((mode) => {
          const selector =
            mode === "pdf"
              ? ".textLayer span"
              : mode === "svelte"
                ? "[data-svelte-demo] p"
                : ".gl-article p";
          const element = [...document.querySelectorAll(selector)].find(
            (el) =>
              el.firstChild?.nodeType === Node.TEXT_NODE &&
              el.firstChild.length > 25,
          );
          const range = document.createRange();
          range.setStart(element.firstChild, 8);
          range.setEnd(element.firstChild, 22);
          const selection = document.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }, mode);
        await page.waitForFunction(() =>
          document
            .querySelector(".gl-selection")
            ?.getAttribute("d")
            ?.startsWith("M"),
        );
        await page
          .locator(root)
          .getByRole("button", { name: /^Highlight/ })
          .tap();
        await page.waitForFunction(
          () => document.querySelectorAll(".gl-mark").length === 1,
        );
        console.log(
          `PASS ${engine.name()} ${width} ${mode} selection → mark via touch`,
        );
      }
      if (shots && width === 320) {
        await page.goto(`${base}/docs/accuracy`, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `${shots}/after-${engine.name()}-accuracy-320.png`,
        });
        await page.goto(base, { waitUntil: "networkidle" });
        await page.screenshot({
          path: `${shots}/after-${engine.name()}-home-320.png`,
        });
      }
    } catch (error) {
      failures.push(`${engine.name()} ${width} interactions: ${error.message}`);
    }
    await context.close();
  }
  await browser.close();
}
for (const failure of failures) console.error(`FAIL ${failure}`);
assert.equal(failures.length, 0, `${failures.length} mobile checks failed`);
console.log("All mobile checks passed");
