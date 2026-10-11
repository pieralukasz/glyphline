// The Svelte demo on /docs/svelte: real Svelte 5 components from glyphline/svelte, built into
// public/svelte-demo/ and mounted by the docs page. Run by the docs prebuild.
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const pkg = (p: string) =>
  fileURLToPath(new URL(`../../packages/${p}`, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [svelte()],
  resolve: {
    alias: [
      {
        find: /^glyphline\/dom$/,
        replacement: pkg("glyphline/src/dom/index.ts"),
      },
      {
        find: /^glyphline\/pdf$/,
        replacement: pkg("glyphline/src/pdf/index.ts"),
      },
      { find: /^glyphline$/, replacement: pkg("glyphline/src/index.ts") },
      {
        find: /^glyphline\/svelte$/,
        replacement: pkg("glyphline/src/svelte/index.ts"),
      },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("../public/svelte-demo", import.meta.url)),
    emptyOutDir: true,
    lib: { entry: "src/main.ts", formats: ["es"], fileName: () => "demo.js" },
    rollupOptions: { external: [] },
  },
});
