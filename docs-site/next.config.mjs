import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// The site builds the library from its source (../src), so the build root is one level up.
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Empty on Vercel. Set it to serve the static export from a sub-path.
const basePath = process.env.DOCS_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    // The site uses the library the way an app would, by package name, but builds it from the
    // source in this repository (tsconfig paths match).
    resolveAlias: {
      glyphline: "../src/index.ts",
      "glyphline/dom": "../src/dom/index.ts",
      "glyphline/pdf": "../src/pdf/index.ts",
      "glyphline/react": "../src/react/index.ts",
      "glyphline/svelte": "../src/svelte/index.ts",
      "glyphline/style.css": "../src/style.css",
      "glyphline/pdf.css": "../src/pdf.css",
    },
  },
};

export default withMDX(config);
