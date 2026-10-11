import { docsLlms } from "@/lib/source";

export const revalidate = false;

const preface = `> glyphline: text highlights for pdf.js pages and HTML. One npm package, \`glyphline\`, with
> subpaths glyphline/react, glyphline/svelte, glyphline/pdf, glyphline/dom. Rules for coding agents:
> https://glyphline.lucaspiera.com/docs/agents (also node_modules/glyphline/AGENTS.md).
> All docs in one file: https://glyphline.lucaspiera.com/llms-full.txt

`;

export async function GET() {
  return new Response(preface + (await docsLlms.index()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
