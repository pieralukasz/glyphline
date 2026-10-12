import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

// Vite already owns esbuild; no docs build or development server is needed.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite/package.json"))(
  "esbuild",
);
const source = readFileSync(
  new URL("../src/components/demo/pdf.tsx", import.meta.url),
  "utf8",
);
const component = source.slice(source.indexOf("const docs ="));
const harness = `
import React, { act, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const cn = (...xs) => xs.filter(Boolean).join(" ");
const asset = (url) => url;
const wordAtPoint = () => -1;
const GlyphOverlay = ({ source }) => <output data-source={source?.id ?? ""} />;
const gates = new Map();
const calls = { layers: [], sources: [], cancelled: [] };
function gate(key) {
  if (!gates.has(key)) return Promise.resolve();
  return gates.get(key).promise;
}
function hold(key) {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  gates.set(key, { promise, resolve, reject });
}
const makeSource = (id) => ({
  id,
  withTextLayer(divs) { return makeSource(id + ":" + divs.map(d => d.textContent).join("")); },
});
async function pdfSource(page) { await gate("source:" + page.id); return makeSource(page.id); }
const m = {
  OPS: {},
  getDocument({url}) { return {promise: Promise.resolve({
    async getPage(n) {
      const id = url + ":" + n;
      await gate("page:" + id);
      return {
        id,
        getViewport({scale}) { return {width: 420 * scale, height: 560 * scale, scale}; },
        render() { return {promise: gate("canvas:" + id), cancel() { calls.cancelled.push(id); }}; },
        async getTextContent() { await gate("content:" + id); return {id}; },
      };
    }
  })}; },
  TextLayer: class {
    constructor({textContentSource, container, viewport}) {
      this.id = textContentSource.id;
      this.container = container;
      this.viewport = viewport;
      this.textDivs = [];
      calls.layers.push(this);
    }
    async render() {
      const span = document.createElement("span");
      span.textContent = this.id;
      this.textDivs.push(span);
      this.container.append(span);
      await gate("layer:" + this.id);
    }
    update({viewport}) { this.viewport = viewport; }
    cancel() { this.cancelled = true; }
  },
};
async function pdfjs() { await gate("library"); return m; }
${component}
const root = createRoot(document.getElementById("root"));
let props = { url: "first", onSource: s => calls.sources.push(s.id) };
async function flush() { await act(async () => { await new Promise(r => setTimeout(r, 30)); }); }
window.harness = {
  hold,
  async release(key, message) {
    const pending = gates.get(key);
    gates.delete(key);
    await act(async () => { message ? pending.reject(new Error(message)) : pending.resolve(); });
    await flush();
  },
  async render(next = {}) { props = {...props, ...next}; await act(async () => root.render(<PdfPage {...props}/>)); await flush(); },
  async resize(width) { document.getElementById("root").style.width = width + "px"; await flush(); },
  async unmount() { await act(async () => root.unmount()); },
  snapshot() { return {
    text: document.querySelector(".textLayer")?.textContent,
    source: document.querySelector("output")?.dataset.source,
    ready: document.querySelector(".gl-pdf-page")?.hasAttribute("data-ready"),
    error: document.querySelector('[role="alert"]')?.textContent,
    layers: calls.layers.map(l => ({id: l.id, scale: l.viewport.scale, cancelled: !!l.cancelled})),
    sources: calls.sources,
  }; },
};
`;
let browser;
let bundle;
before(async () => {
  bundle = (
    await build({
      stdin: {
        contents: harness,
        loader: "tsx",
        resolveDir: new URL("..", import.meta.url).pathname,
      },
      bundle: true,
      write: false,
      format: "iife",
      define: { "process.env.NODE_ENV": '"development"' },
    })
  ).outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
});
async function setup(t) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, [], "no unhandled browser errors");
  });
  await page.setContent('<div id="root" style="width:420px"></div>');
  await page.addScriptTag({ content: bundle });
  return page;
}
const snapshot = (page) => page.evaluate(() => harness.snapshot());
const ready = (page) => page.waitForFunction(() => harness.snapshot().ready);

test("a resized-away library continuation cannot install a stale layer", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("canvas:first:1");
    await harness.render();
    harness.hold("library");
    await harness.release("canvas:first:1");
  });
  await page.evaluate(() => harness.resize(630));
  await page.waitForFunction(
    () => document.querySelector("canvas").width === 630,
  );
  await page.evaluate(() => harness.release("library"));
  await ready(page);
  const result = await snapshot(page);
  assert.equal(result.layers.length, 1);
  assert.equal(result.layers[0].scale, 1.5);
});

test("unmounting while text content is pending cannot create a layer", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("content:first:1");
    await harness.render();
  });
  await page.evaluate(() => harness.unmount());
  await page.evaluate(() => harness.release("content:first:1"));
  assert.equal((await snapshot(page)).layers.length, 0);
});

test("a cancelled layer rejection cannot replace the next page with an alert", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("layer:first:1");
    await harness.render();
  });
  await page.evaluate(() => harness.render({ pageNumber: 2 }));
  await ready(page);
  await page.evaluate(() => harness.release("layer:first:1", "cancelled"));
  const result = await snapshot(page);
  assert.equal(result.error, undefined);
  assert.equal(result.text, "first:2");
  assert.equal(result.layers[0].cancelled, true);
});

test("a completed layer is reused on resize", async (t) => {
  const page = await setup(t);
  await page.evaluate(() => harness.render());
  await ready(page);
  await page.evaluate(() => harness.resize(630));
  await page.waitForFunction(() => harness.snapshot().layers[0].scale === 1.5);
  const result = await snapshot(page);
  assert.equal(result.layers.length, 1);
  assert.equal(result.ready, true);
  assert.equal(result.text, "first:1");
});

test("a successful resize retry clears the previous render error", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("layer:first:1");
    await harness.render();
  });
  await page.evaluate(() => harness.release("layer:first:1", "layer failed"));
  assert.equal((await snapshot(page)).error, "layer failed");
  await page.evaluate(() => harness.resize(630));
  await ready(page);
  assert.equal((await snapshot(page)).error, undefined);
});

test("a superseded page load cannot overwrite the current page with an error", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("source:first:1");
    await harness.render();
  });
  await page.evaluate(() => harness.render({ url: "second" }));
  await ready(page);
  await page.evaluate(() =>
    harness.release("source:first:1", "old load failed"),
  );
  const result = await snapshot(page);
  assert.equal(result.error, undefined);
  assert.equal(result.source, "second:1:second:1");
});

for (const phase of ["canvas", "content", "layer"]) {
  test(`${phase} failures surface as an alert instead of disappearing or escaping`, async (t) => {
    const page = await setup(t);
    await page.evaluate(async (phase) => {
      harness.hold(`${phase}:first:1`);
      await harness.render();
    }, phase);
    await page.evaluate(
      (phase) => harness.release(`${phase}:first:1`, `${phase} failed`),
      phase,
    );
    assert.equal((await snapshot(page)).error, `${phase} failed`);
  });
}

test("resizing during text rendering still publishes a measured source", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("layer:first:1");
    await harness.render();
  });
  await page.waitForFunction(() => harness.snapshot().layers.length === 1);
  await page.evaluate(() => harness.resize(630));
  await page.waitForFunction(
    () => document.querySelector("canvas").width === 630,
  );
  await page.evaluate(() => harness.release("layer:first:1"));
  const result = await snapshot(page);
  assert.equal(result.ready, true);
  assert.equal(result.source, "first:1:first:1");
  assert.equal(result.text, "first:1");
});

test("a resized-away text request cannot install a stale layer", async (t) => {
  const page = await setup(t);
  await page.evaluate(async () => {
    harness.hold("content:first:1");
    await harness.render();
  });
  await page.evaluate(() => harness.resize(630));
  await page.waitForFunction(
    () => document.querySelector("canvas").width === 630,
  );
  await page.evaluate(() => harness.release("content:first:1"));
  await ready(page);
  const result = await snapshot(page);
  assert.equal(result.layers.length, 1);
  assert.equal(result.layers[0].scale, 1.5);
  assert.equal(result.text, "first:1");
});

test("switching pages replaces the previous text layer and source", async (t) => {
  const page = await setup(t);
  await page.evaluate(() => harness.render());
  await ready(page);
  assert.equal((await snapshot(page)).text, "first:1");
  await page.evaluate(() => harness.render({ pageNumber: 2 }));
  await ready(page);
  const result = await snapshot(page);
  assert.equal(result.text, "first:2");
  assert.equal(result.source, "first:2:first:2");
  assert.equal(result.layers[0].cancelled, true);
});
