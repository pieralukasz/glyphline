"use client";
import type { HighlighterOptions, HighlightState } from "glyphline";
import { wordAtPoint } from "glyphline";
import { type PdfTextSource, pdfSource } from "glyphline/pdf";
import { GlyphOverlay } from "glyphline/react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/shared";
import "../../../../packages/glyphline/src/pdf.css";

type Pdfjs = typeof import("pdfjs-dist");
type TextLayer = InstanceType<Pdfjs["TextLayer"]>;

let lib: Promise<Pdfjs> | null = null;
/** pdf.js touches the DOM at import time: load it in the browser only, once. */
export function pdfjs(): Promise<Pdfjs> {
  lib ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = asset("/pdf.worker.min.mjs");
    return m;
  });
  return lib;
}

const docs = new Map<string, Promise<PDFDocumentProxy>>();
function openDoc(url: string) {
  let doc = docs.get(url);
  if (!doc) {
    // fontExtraProperties: glyphline reads the embedded fonts' metrics
    doc = pdfjs().then(
      (m) => m.getDocument({ url, fontExtraProperties: true }).promise,
    );
    docs.set(url, doc);
  }
  return doc;
}

export const demoPdf = () => asset("/demo.pdf");

type Props = {
  url?: string;
  pageNumber?: number;
  state?: HighlightState;
  options?: HighlighterOptions;
  /** the source once the page is read, again once the text layer is measured */
  onSource?: (source: PdfTextSource) => void;
  onWordClick?: (word: number) => void;
  /** hide the browser selection colour (when the overlay draws the selection) */
  drawSelection?: boolean;
  className?: string;
  /** extra layers over the page, e.g. a debug svg in page units */
  children?: (source: PdfTextSource) => ReactNode;
  /** CSS px per PDF unit is the box width divided by the page width; this caps it */
  maxScale?: number;
};

/**
 * One PDF page: canvas, the native pdf.js text layer (selectable, transparent) and the glyphline
 * overlay on top. It fills its parent's width and re-renders sharp on resize.
 */
export function PdfPage({
  url,
  pageNumber = 1,
  state,
  options,
  onSource,
  onWordClick,
  drawSelection,
  className,
  children,
  maxScale = 3,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const textLayer = useRef<TextLayer | null>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [base, setBase] = useState<PdfTextSource | null>(null);
  const [layered, setLayered] = useState<PdfTextSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const source = layered ?? base;
  const onSourceRef = useRef(onSource);
  onSourceRef.current = onSource;

  useEffect(() => {
    let off = false;
    (async () => {
      const m = await pdfjs();
      const doc = await openDoc(url ?? demoPdf());
      const p = await doc.getPage(pageNumber);
      const s = await pdfSource(p, {
        OPS: m.OPS as unknown as Record<string, number>,
      });
      if (off) return;
      setPage(p);
      setBase(s);
    })().catch((e: Error) => setError(e.message));
    return () => {
      off = true;
    };
  }, [url, pageNumber]);

  useEffect(() => {
    if (source) onSourceRef.current?.(source);
  }, [source]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setWidth(Math.round(e.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    const host = box.current;
    const tlEl = layer.current;
    if (!page || !base || !width || !c || !host || !tlEl) return;
    let cancelled = false;
    const unit = page.getViewport({ scale: 1 });
    const scale = Math.min(maxScale, width / unit.width);
    const vp = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(vp.width * dpr);
    c.height = Math.floor(vp.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    host.style.setProperty("--scale-factor", String(scale));
    host.style.setProperty("--total-scale-factor", String(scale));
    const task = page.render({ canvas: c, canvasContext: ctx, viewport: vp });
    (async () => {
      try {
        await task.promise;
      } catch {
        return; // cancelled by a newer size
      }
      if (cancelled) return;
      const m = await pdfjs();
      if (!textLayer.current) {
        const tl = new m.TextLayer({
          textContentSource: await page.getTextContent(),
          container: tlEl,
          viewport: vp,
        });
        textLayer.current = tl;
        await tl.render();
        if (cancelled) return;
        // the text layer becomes the first fallback (and makes selections readable)
        setLayered(base.withTextLayer(tl.textDivs, tlEl, scale));
      } else {
        textLayer.current.update({ viewport: vp });
      }
    })();
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [page, base, width, maxScale]);

  useEffect(
    () => () => {
      textLayer.current?.cancel();
      textLayer.current = null;
    },
    [],
  );

  const unit = page?.getViewport({ scale: 1 });
  const ratio = unit ? `${unit.width} / ${unit.height}` : "420 / 560";
  const scale = unit && width ? Math.min(maxScale, width / unit.width) : 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-to-read is a pointer shortcut; the toolbar is the keyboard path
    <div
      ref={box}
      className={cn(
        "gl-pdf-page",
        drawSelection && "gl-native-selection-hidden",
        className,
      )}
      style={{
        aspectRatio: ratio,
        maxWidth: unit ? unit.width * maxScale : undefined,
      }}
      data-ready={layered ? "" : undefined}
      onClick={(e) => {
        if (!onWordClick || !source) return;
        if (!document.getSelection()?.isCollapsed) return;
        const svg = box.current?.querySelector<SVGSVGElement>("svg.gl-overlay");
        if (!svg) return;
        const w = wordAtPoint(source, svg, e.clientX, e.clientY);
        if (w >= 0) onWordClick(w);
      }}
    >
      <canvas ref={canvas} style={{ width: "100%", height: "100%" }} />
      <div ref={layer} className="textLayer" />
      <GlyphOverlay
        source={source}
        {...state}
        options={options}
        theme="light"
      />
      {source && scale ? children?.(source) : null}
      {!source && !error && (
        <div className="gl-pdf-loading">Loading the page…</div>
      )}
      {error && (
        <p role="alert" className="gl-pdf-loading">
          {error}
        </p>
      )}
    </div>
  );
}
