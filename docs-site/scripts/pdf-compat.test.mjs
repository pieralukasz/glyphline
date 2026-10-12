import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
const ts = createRequire(new URL("../../package.json", import.meta.url))(
  "typescript",
);

// Evaluate the actual compatibility function in isolation without importing React or pdf.js.
const source = readFileSync(
  new URL("../src/components/demo/pdf.tsx", import.meta.url),
  "utf8",
);
const start = source.indexOf("function legacyPolyfills()");
const end = source.indexOf("\n/**", start);
const compiled = ts.transpile(source.slice(start, end), {
  target: ts.ScriptTarget.ES2022,
});
function install() {
  class Stream extends ReadableStream {}
  Object.defineProperty(Stream.prototype, Symbol.asyncIterator, {
    value: undefined,
    configurable: true,
    writable: true,
  });
  vm.runInNewContext(`${compiled}\nlegacyPolyfills();`, {
    ReadableStream: Stream,
  });
  return Stream;
}

test("early iteration exit cancels the source and releases its lock", async () => {
  const Stream = install();
  let cancelled = false;
  const stream = new Stream({
    start(c) {
      c.enqueue("word");
    },
    cancel() {
      cancelled = true;
    },
  });
  for await (const value of stream) {
    assert.equal(value, "word");
    break;
  }
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});

test("normal exhaustion releases the lock without cancelling", async () => {
  const Stream = install();
  let cancelled = false;
  const stream = new Stream({
    start(c) {
      c.enqueue("word");
      c.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const values = [];
  for await (const value of stream) values.push(value);
  assert.deepEqual(values, ["word"]);
  assert.equal(cancelled, false);
  assert.equal(stream.locked, false);
});

test("read failures propagate and release the lock", async () => {
  const Stream = install();
  const stream = new Stream({
    start(c) {
      c.error(new Error("read failed"));
    },
  });
  await assert.rejects(async () => {
    for await (const _ of stream) {
    }
  }, /read failed/);
  assert.equal(stream.locked, false);
});
