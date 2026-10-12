// pdf.js runs its parser in a worker; the static site serves the worker file from public/.
// Legacy build: it matches the legacy main thread build and runs on older Safari.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const worker = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(worker, "public/pdf.worker.min.mjs");
