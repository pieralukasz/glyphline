// Smoke check of the built docs site: every page loads without console errors, every live demo
// draws, the cursor moves, the selection becomes a mark. BASE=http://127.0.0.1:<port>.
// Screenshots go to SHOTS (default ./screenshots) when SHOTS is set.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3411";
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const pages = [
  "/",
  "/docs",
  "/docs/getting-started",
  "/docs/playground",
  "/docs/pdf",
  "/docs/html",
  "/docs/selection",
  "/docs/read-aloud",
  "/docs/styling",
  "/docs/motion",
  "/docs/accuracy",
  "/docs/api",
  "/docs/adapters",
  "/docs/limits",
];

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL ${msg}`);
};

const browser = await chromium.launch();
for (const [label, viewport, scheme] of [
  ["desktop", { width: 1440, height: 900 }, "light"],
  ["phone", { width: 390, height: 844 }, "dark"],
]) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: scheme,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  for (const path of pages) {
    errors.length = 0;
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    if (res?.status() !== 200)
      fail(`${label} ${path}: status ${res?.status()}`);
    // every PDF page on it is rendered and measured
    const pdfs = await page.locator(".gl-pdf-page").count();
    if (pdfs) {
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll(".gl-pdf-page")].every((p) =>
              p.hasAttribute("data-ready"),
            ),
          null,
          { timeout: 15_000 },
        )
        .catch(() => fail(`${label} ${path}: a PDF page never became ready`));
    }
    if (errors.length)
      fail(
        `${label} ${path}: console errors: ${errors.slice(0, 3).join(" | ")}`,
      );
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/${label}${path.replaceAll("/", "_") || "_home"}.png`,
        fullPage: path === "/",
      });
    console.log(`ok ${label} ${path}${pdfs ? ` (${pdfs} pdf)` : ""}`);
  }

  // read-along on the intro page: play moves the cursor
  await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
  await page.waitForSelector(".gl-pdf-page[data-ready]");
  const demo = page.locator("[data-read-along]");
  await demo.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(900);
  const d1 = await demo.locator("svg.gl-overlay .gl-word").getAttribute("d");
  await page.waitForTimeout(900);
  const d2 = await demo.locator("svg.gl-overlay .gl-word").getAttribute("d");
  const sentence = await demo
    .locator("svg.gl-overlay .gl-sentence")
    .getAttribute("d");
  if (!d1?.startsWith("M") || !sentence?.startsWith("M"))
    fail(`${label} read-along: nothing drawn`);
  if (d1 === d2) fail(`${label} read-along: cursor did not move`);
  else console.log(`ok ${label} read-along moves`);
  await demo.getByRole("button", { name: "Pause" }).click();

  // click a word: the cursor lands on it
  const pdfBox = await demo.locator(".gl-pdf-page").boundingBox();
  if (pdfBox) {
    const target = await page.evaluate(() => {
      const spans = [
        ...document.querySelectorAll("[data-read-along] .textLayer span"),
      ];
      const s =
        spans.find((x) => (x.textContent ?? "").includes("Rabbit")) ?? spans[8];
      const t = s.firstChild;
      const i = (t.textContent ?? "").indexOf("Rabbit");
      const r = document.createRange();
      r.setStart(t, Math.max(0, i));
      r.setEnd(t, Math.max(0, i) + 3);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    await page.mouse.click(target.x, target.y);
    // read before the reader moves on (a word stays ~300 ms)
    await page.waitForTimeout(60);
    const status = await demo.locator(".gl-status").innerText();
    await demo
      .getByRole("button", { name: "Pause" })
      .click()
      .catch(() => {});
    if (!/Rabbit/.test(status))
      fail(`${label} click-to-read: status "${status}"`);
    else
      console.log(
        `ok ${label} click on a word starts there (${status.trim()})`,
      );
  }

  // selection on HTML becomes a mark
  await page.goto(`${BASE}/docs/selection`, { waitUntil: "networkidle" });
  const article = page.locator(".gl-article").first();
  await article.scrollIntoViewIfNeeded();
  const sel = await page.evaluate(() => {
    const p = document.querySelector(".gl-article p");
    const t = p.firstChild;
    const r = document.createRange();
    r.setStart(t, 8); // inside "was"
    r.setEnd(t, 27); // inside "get"
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
    return document.getSelection().toString();
  });
  await page.waitForTimeout(250);
  const selD = await page
    .locator(".gl-article-wrap svg .gl-selection")
    .getAttribute("d");
  if (!selD?.startsWith("M")) fail(`${label} selection not drawn (${sel})`);
  const btn = page.getByRole("button", { name: /^Highlight/ });
  const btnText = await btn.innerText();
  if (!btnText.includes("was beginning to get"))
    fail(`${label} snap to words: "${btnText}"`);
  await btn.click();
  await page.waitForTimeout(150);
  const marks = await page.locator(".gl-article-wrap svg .gl-mark").count();
  if (marks !== 1) fail(`${label} mark not kept (${marks})`);
  else console.log(`ok ${label} selection → mark (${btnText.trim()})`);

  // the same on the PDF page
  await page.getByRole("radio", { name: "PDF page" }).click();
  await page.waitForSelector(".gl-pdf-page[data-ready]");
  await page.evaluate(() => {
    const spans = [
      ...document.querySelectorAll(".gl-pdf-page .textLayer span"),
    ].filter((s) => (s.textContent ?? "").length > 20);
    const t = spans[2].firstChild;
    const r = document.createRange();
    r.setStart(t, 2);
    r.setEnd(t, 14);
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(r);
  });
  await page.waitForTimeout(250);
  const pdfSel = await page
    .locator(".gl-pdf-page svg .gl-selection")
    .getAttribute("d");
  if (!pdfSel?.startsWith("M")) fail(`${label} PDF selection not drawn`);
  await page.getByRole("button", { name: /^Highlight/ }).click();
  await page.waitForTimeout(150);
  if ((await page.locator(".gl-pdf-page svg .gl-mark").count()) !== 1)
    fail(`${label} PDF mark not kept`);
  else console.log(`ok ${label} PDF selection → mark`);
  if (SHOTS)
    await page
      .locator(".gl-demo")
      .first()
      .screenshot({ path: `${SHOTS}/${label}_selection-pdf.png` });

  // playground: next line moves the cursor down
  await page.goto(`${BASE}/docs/playground`, { waitUntil: "networkidle" });
  await page.waitForSelector(".gl-pdf-page[data-ready]");
  const y = async () =>
    page.evaluate(
      () =>
        document.querySelector("[data-playground] svg .gl-word").getBBox().y,
    );
  const y0 = await y();
  await page.getByRole("button", { name: "next line" }).click();
  await page.waitForTimeout(500);
  const y1 = await y();
  if (!(y1 > y0)) fail(`${label} playground next line: ${y0} → ${y1}`);
  else
    console.log(
      `ok ${label} playground next line ${y0.toFixed(1)} → ${y1.toFixed(1)}`,
    );

  // search
  await page.goto(`${BASE}/api/search`);
  const body = await page.content();
  if (!body.includes("selection"))
    fail(`${label} search index missing content`);

  await ctx.close();
}
await browser.close();

if (failures.length) {
  console.log(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nall checks passed");
