"use client";
import type { Mark, TextRange } from "glyphline";
import type { PdfTextSource } from "glyphline/pdf";
import { GlyphOverlay, useDomSource } from "glyphline/react";
import { useEffect, useMemo, useState } from "react";
import { Button, Segmented, Toggle, Toolbar } from "./controls";
import { PdfPage } from "./pdf";

const COLORS = [
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "pink", label: "Pink" },
] as const;
type Color = (typeof COLORS)[number]["id"];
type Note = Mark & { text: string; color: Color };

const ALICE = [
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
  "So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.",
];

/**
 * Select text, then keep it as a coloured mark. The same component works on HTML (domSource) and
 * on the PDF page (pdfSource with its text layer).
 */
export function SelectionDemo({
  initial = "html",
}: {
  initial?: "html" | "pdf";
}) {
  const [mode, setMode] = useState<"html" | "pdf">(initial);
  const [snap, setSnap] = useState(true);
  const [draw, setDraw] = useState(true);
  const [color, setColor] = useState<Color>("yellow");
  const [selected, setSelected] = useState<{
    range: TextRange;
    text: string;
  } | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pdf, setPdf] = useState<PdfTextSource | null>(null);
  const [article, html] = useDomSource<HTMLDivElement>();
  const source = mode === "html" ? html : pdf;

  const switchMode = (m: "html" | "pdf") => {
    setMode(m);
    setNotes([]);
    setSelected(null);
  };

  const options = useMemo(
    () => ({
      trackSelection: draw
        ? {
            snapToWords: snap,
            onChange: (range: TextRange | null, text: string) =>
              setSelected(range ? { range, text } : null),
          }
        : false,
    }),
    [draw, snap],
  );

  // without drawing, the native selection is read on demand
  useEffect(() => {
    if (draw || !source) return;
    const read = () => {
      const r = source.rangeFromSelection?.(document.getSelection()) ?? null;
      setSelected(
        r ? { range: r, text: source.text.slice(r.start, r.end) } : null,
      );
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [draw, source]);

  const keep = () => {
    if (!selected) return;
    setNotes((n) => [
      ...n,
      {
        id: crypto.randomUUID(),
        ...selected.range,
        text: selected.text,
        color,
        className: `gl-mark-${color}`,
      },
    ]);
    document.getSelection()?.removeAllRanges();
  };

  const state = { marks: notes };

  return (
    <div className="gl-demo">
      <Toolbar>
        <Segmented
          label="Text"
          value={mode}
          onChange={switchMode}
          options={[
            { value: "html", label: "HTML" },
            { value: "pdf", label: "PDF page" },
          ]}
        />
        <Toggle label="Draw selection" checked={draw} onChange={setDraw} />
        <Toggle label="Snap to words" checked={snap} onChange={setSnap} />
      </Toolbar>
      <Toolbar className="gl-toolbar-sub">
        <Segmented
          label="Colour"
          value={color}
          onChange={setColor}
          options={COLORS.map((c) => ({ value: c.id, label: c.label }))}
        />
        <Button
          className="is-primary"
          disabled={!selected}
          onClick={keep}
          onMouseDown={(e) => e.preventDefault()}
        >
          Highlight {selected ? `“${clip(selected.text)}”` : "selection"}
        </Button>
        {notes.length > 0 && (
          <Button onClick={() => setNotes([])}>Clear {notes.length}</Button>
        )}
      </Toolbar>
      {mode === "html" ? (
        <div className="gl-article-wrap">
          <div
            ref={article}
            className={
              draw ? "gl-article gl-native-selection-hidden" : "gl-article"
            }
            lang="en"
          >
            <h3>Down the Rabbit-Hole</h3>
            {ALICE.map((p) => (
              <p key={p.slice(0, 12)}>{p}</p>
            ))}
          </div>
          <GlyphOverlay source={html} {...state} options={options} />
        </div>
      ) : (
        <div className="gl-paper">
          <PdfPage
            state={state}
            options={options}
            onSource={setPdf}
            drawSelection={draw}
          />
        </div>
      )}
      {notes.length > 0 && (
        <ul className="gl-notes">
          {notes.map((n) => (
            <li key={n.id}>
              <span
                className={`gl-swatch gl-swatch-${n.color}`}
                aria-hidden="true"
              />
              <span className="gl-note-text">{n.text}</span>
              <code>
                {n.start}–{n.end}
              </code>
              <button
                type="button"
                onClick={() =>
                  setNotes((all) => all.filter((x) => x.id !== n.id))
                }
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="gl-caption">
        A mark is a character range of the source text, so it can be stored and
        redrawn later, at any zoom or width.
      </p>
    </div>
  );
}

const clip = (s: string) => (s.length > 24 ? `${s.slice(0, 22)}…` : s);
