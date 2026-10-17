import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  HtmlReadAlong,
  MethodCompare,
  ReadAlong,
  SelectionDemo,
} from "@/components/demo";
import { authorUrl, repoUrl } from "@/lib/shared";

const reactCode = `import { GlyphOverlay, useDomSource } from "glyphline/react";
import "glyphline/style.css";

export function Article({ sentence, word }) {
  const [ref, source] = useDomSource();
  return (
    <div style={{ position: "relative" }}>
      <article ref={ref}>…</article>
      <GlyphOverlay source={source} sentence={sentence} word={word} />
    </div>
  );
}`;

const svelteCode = `<script>
  import { domText, GlyphOverlay } from "glyphline/svelte";
  import "glyphline/style.css";

  let { sentence, word } = $props();
  const text = domText();
</script>

<div style="position: relative">
  <article {@attach text.attach}>…</article>
  <GlyphOverlay source={text.source} {sentence} {word} />
</div>`;

const coreCode = `import { createHighlighter } from "glyphline";
import { pdfSource } from "glyphline/pdf"; // or domSource from "glyphline/dom"
import "glyphline/style.css";

const source = await pdfSource(page, { OPS });
const hl = createHighlighter(svg, source, { trackSelection: true });

hl.update({ sentence: 3, word: 41 }); // glides there`;

export default function HomePage() {
  return (
    <main className="gl-home flex flex-col">
      <section className="gl-ruled border-b">
        <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-6 pt-12 pb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center">
          <div>
            <p className="gl-label font-medium text-fd-primary">
              Text highlighting for PDF.js and HTML
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-[2.75rem] sm:leading-[1.1]">
              Highlights that sit{" "}
              <span className="gl-hero-mark">on the glyphs</span>, and move like
              ink.
            </h1>
            <p className="mt-4 max-w-[58ch] text-lg text-fd-muted-foreground">
              glyphline draws a sentence outline that morphs, a word cursor that
              glides between words, the reader&apos;s selection as one shape,
              and saved marks. On PDF pages the positions come from the embedded
              fonts, so the boxes land on the printed letters at any zoom.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/docs/getting-started"
                className="gl-press rounded-full bg-fd-primary px-6 py-2.5 font-medium text-fd-primary-foreground"
              >
                Get started
              </Link>
              <a
                href={repoUrl}
                className="gl-press rounded-full border bg-fd-card px-6 py-2.5 font-medium"
              >
                GitHub
              </a>
              <code className="rounded-full border bg-fd-card px-4 py-2.5 font-mono text-sm">
                bun add glyphline
              </code>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-fd-muted-foreground sm:grid-cols-2">
              <li>✦ One package: core, React and Svelte 5 adapters</li>
              <li>✦ pdf.js pages and plain HTML, one API</li>
              <li>✦ Interruptible motion, reduced-motion aware</li>
              <li>✦ No dependencies; React, Svelte and pdf.js are optional</li>
            </ul>
          </div>
          <ReadAlong autoPlay compact />
        </div>
      </section>

      <Section eyebrow="Select" title="The selection, drawn as one shape">
        <p className="-mt-4 mb-6 max-w-[65ch] text-fd-muted-foreground">
          Drag across the text. The overlay follows the glyphs instead of the
          browser&apos;s line boxes, can snap to whole words, and turns into a
          coloured mark you can store as a character range.
        </p>
        <SelectionDemo />
      </Section>

      <Section eyebrow="Any text" title="The same motion on HTML">
        <p className="-mt-4 mb-6 max-w-[65ch] text-fd-muted-foreground">
          <code>domSource</code> reads text nodes under an element, inline
          markup included, and re-measures when the text reflows.
        </p>
        <HtmlReadAlong />
      </Section>

      <Section eyebrow="Accuracy" title="Why the boxes land on the letters">
        <p className="-mt-4 mb-6 max-w-[65ch] text-fd-muted-foreground">
          pdf.js&apos;s text layer is set in a substitute font stretched to each
          span, so boxes measured on it drift inside a line. glyphline walks the
          page&apos;s glyph stream with the real font widths. Switch methods and
          zoom in.
        </p>
        <MethodCompare />
        <p className="mt-4 text-sm text-fd-muted-foreground">
          On the bundled 19-page stress document the median horizontal edge
          error is under 0.01 px on every page.{" "}
          <Link className="underline" href="/docs/accuracy">
            How it is measured
          </Link>
          .
        </p>
      </Section>

      <Section eyebrow="Usage" title="One overlay over your text">
        <Tabs items={["React", "Svelte", "No framework"]}>
          <Tab value="React">
            <DynamicCodeBlock lang="tsx" code={reactCode} />
          </Tab>
          <Tab value="Svelte">
            <DynamicCodeBlock lang="svelte" code={svelteCode} />
          </Tab>
          <Tab value="No framework">
            <DynamicCodeBlock lang="ts" code={coreCode} />
          </Tab>
        </Tabs>
        <p className="mt-5 text-fd-muted-foreground">
          Each framework has its own section,{" "}
          <Link className="underline" href="/docs/react">
            React
          </Link>{" "}
          and{" "}
          <Link className="underline" href="/docs/svelte">
            Svelte
          </Link>
          , and the{" "}
          <Link className="underline" href="/docs/playground">
            playground
          </Link>{" "}
          exposes every timing and shape option.
        </p>
      </Section>

      <Section
        eyebrow="For humans and agents"
        title="Docs you can read, docs your agent can load"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-fd-card p-5">
            <p className="font-medium">For humans</p>
            <p className="mt-2 text-sm text-fd-muted-foreground">
              Live demos on every page, a{" "}
              <Link className="underline" href="/docs/playground">
                playground
              </Link>{" "}
              for every option, and separate{" "}
              <Link className="underline" href="/docs/react">
                React
              </Link>{" "}
              and{" "}
              <Link className="underline" href="/docs/svelte">
                Svelte
              </Link>{" "}
              sections.
            </p>
          </div>
          <div className="rounded-xl border bg-fd-card p-5">
            <p className="font-medium">For agents</p>
            <p className="mt-2 text-sm text-fd-muted-foreground">
              <a className="underline" href="/llms.txt">
                llms.txt
              </a>
              ,{" "}
              <a className="underline" href="/llms-full.txt">
                llms-full.txt
              </a>
              , Markdown for every page, and <code>AGENTS.md</code> inside the
              npm package with the rules that are easy to get wrong.{" "}
              <Link className="underline" href="/docs/agents">
                How to point your agent at them
              </Link>
              .
            </p>
          </div>
        </div>
      </Section>

      <footer className="border-t py-10 text-center font-mono text-xs text-fd-muted-foreground">
        <p>
          Made by{" "}
          <a
            className="font-medium text-fd-foreground underline underline-offset-4"
            href={authorUrl}
          >
            Lucas Piera
          </a>
          . MIT licensed.{" "}
          <a className="underline" href={repoUrl}>
            Source on GitHub
          </a>
          . Demo text: Lewis Carroll, public domain.
        </p>
      </footer>
    </main>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[880px] px-6 py-14">
      <p className="gl-label font-medium text-fd-primary">{eyebrow}</p>
      <h2 className="mt-2 mb-8 text-3xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
