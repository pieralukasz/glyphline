// Builds public/demo.pdf: the opening of "Alice's Adventures in Wonderland" (public domain, from
// Project Gutenberg) set in two justified, hyphenated columns, printed by Chromium with embedded
// fonts. Run with `bun run demo-pdf`; the output is committed, so the site build does not need it.
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const paragraphs = [
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
  "So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
  "There was nothing so <em>very</em> remarkable in that; nor did Alice think it so <em>very</em> much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually <em>took a watch out of its waistcoat-pocket</em>, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.",
  "In another moment down went Alice after it, never once considering how in the world she was to get out again.",
  "The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.",
];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
  @page { size: 420pt 560pt; margin: 34pt 32pt 38pt; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 10.6pt; line-height: 1.42; color: #1d1b18; }
  header { border-bottom: 0.6pt solid #b9b2a6; margin-bottom: 12pt; padding-bottom: 7pt; }
  .kicker { font: 600 7.5pt/1 "Helvetica Neue", Arial, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8174; }
  h1 { font-size: 19pt; font-weight: 700; margin: 6pt 0 0; letter-spacing: -0.01em; }
  .cols { column-count: 2; column-gap: 18pt; text-align: justify; hyphens: auto; }
  p { margin: 0 0 6pt; text-indent: 1.1em; }
  p:first-child { text-indent: 0; }
  p:first-child::first-letter { font-size: 2.6em; float: left; line-height: 0.9; padding: 2pt 3pt 0 0; font-weight: 700; }
</style></head><body>
<header><div class="kicker">Lewis Carroll · Alice’s Adventures in Wonderland · Chapter I</div><h1>Down the Rabbit-Hole</h1></header>
<div class="cols">${paragraphs.map((p) => `<p>${p}</p>`).join("")}</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: "1" });
await browser.close();
writeFileSync("public/demo.pdf", pdf);
console.log(`public/demo.pdf: ${pdf.length} bytes`);
