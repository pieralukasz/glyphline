"use client";
import type { Box } from "glyphline";
import {
  type CharGeometry,
  type PdfTextSource,
  partBoxes,
  wordParts,
} from "glyphline/pdf";
import { useMemo, useState } from "react";
import { Segmented, Slider, Toolbar } from "./controls";
import { PdfPage } from "./pdf";

type Method = "items" | "range" | "glyphs" | "drawn";
const LABELS: Record<Method, string> = {
  items: "M1 text items",
  range: "M2 text layer",
  glyphs: "M3 glyphs",
  drawn: "Drawn (M3 + fallback)",
};

/** Word boxes of each positioning method over the real page; zoom in to see the drift. */
export function MethodCompare() {
  const [source, setSource] = useState<PdfTextSource | null>(null);
  const [method, setMethod] = useState<Method>("items");
  const [zoom, setZoom] = useState(2.4);

  const boxes = useMemo(() => {
    if (!source) return [];
    const g: CharGeometry | null =
      method === "drawn"
        ? source.geometry.geom
        : method === "range"
          ? source.methods.range
          : source.methods[method];
    if (!g) return [];
    return partBoxes(source.pageText, g, wordParts(source.pageText)).filter(
      (b): b is Box => b !== null,
    );
  }, [source, method]);

  return (
    <div className="gl-demo">
      <Toolbar>
        <Segmented
          label="Method"
          value={method}
          onChange={setMethod}
          options={(Object.keys(LABELS) as Method[]).map((m) => ({
            value: m,
            label: LABELS[m],
          }))}
        />
        <Slider
          label="Zoom"
          value={zoom}
          min={1}
          max={4}
          step={0.2}
          unit="×"
          onChange={setZoom}
        />
      </Toolbar>
      <div className="gl-zoom">
        <div style={{ width: `${zoom * 100}%` }}>
          <PdfPage onSource={setSource} maxScale={6}>
            {(s) => (
              <svg
                className="gl-method-boxes"
                viewBox={`0 0 ${s.width} ${s.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {boxes.map((b) => (
                  <rect
                    key={`${b.x},${b.y}`}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                  />
                ))}
              </svg>
            )}
          </PdfPage>
        </div>
      </div>
      <p className="gl-caption">
        {method === "items" &&
          "Each text item's width split evenly over its characters: exact at item edges, drifting inside a line."}
        {method === "range" &&
          "DOM ranges on pdf.js's text layer: a substitute font stretched to each span. Edges of spans match, words inside drift."}
        {method === "glyphs" &&
          "The page's glyph stream with the embedded fonts' advance widths: the boxes sit on the printed letters."}
        {method === "drawn" &&
          `What glyphline draws: glyphs per text item, the text layer or items only where the glyph walk could not place an item (${source?.fallbackItems ?? 0} on this page).`}
      </p>
    </div>
  );
}
