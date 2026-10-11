"use client";
import {
  type Box,
  interpolateWord,
  morphShape,
  sentenceShape,
  shapePath,
  wordPath,
} from "glyphline";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, icons, Segmented, Slider, Toolbar } from "./controls";

// Three lines of fake words, in a 480 × 150 viewBox
const LINE_H = 22;
/** Boxes for words of the given widths laid out on line `n`, 9 units apart. */
function line(widths: number[], n: number): Box[] {
  const out: Box[] = [];
  let x = 24;
  for (const w of widths) {
    out.push({ x, y: 24 + n * (LINE_H + 12), w, h: 16 });
    x += w + 9;
  }
  return out;
}
const lines: Box[][] = [
  line([30, 64, 50, 90, 40, 70, 56], 0),
  line([56, 38, 80, 44, 60, 92], 1),
  line([70, 48, 36, 88, 52], 2),
];

type Case = "stretch" | "travel" | "pop" | "sentence";
const CASES: Record<Case, { label: string; text: string }> = {
  stretch: {
    label: "Along a line",
    text: "The leading edge runs to the next word in the first half, the trailing edge catches up in the second. For a moment the cursor spans both words, like ink spreading.",
  },
  travel: {
    label: "To another line",
    text: "Vertically it stretches the same way (the edge on the side of the move arrives first), horizontally it glides. Going down a line reads as the same motion as moving along it.",
  },
  pop: {
    label: "From nothing",
    text: "With no cursor on screen the new box grows from 70 % with a small overshoot and fades in over the first third. Leaving, it shrinks to 80 % and fades.",
  },
  sentence: {
    label: "Sentence",
    text: "Sentence outlines with the same number of columns morph line by line; extra lines grow out of the nearest one. A line on the same row stretches like the cursor.",
  },
};

export function MotionAnatomy() {
  const [kind, setKind] = useState<Case>("stretch");
  const [t, setT] = useState(0.35);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!playing) return;
    let start = performance.now() - tRef.current * 1600;
    const step = (now: number) => {
      let p = (now - start) / 1600;
      if (p > 1.25) {
        start = now;
        p = 0;
      }
      setT(Math.min(1, p));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const frames = useMemo(() => {
    const ease = (x: number) => 1 - (1 - x) ** 3;
    if (kind === "sentence") {
      const a = sentenceShape([...lines[0].slice(1), ...lines[1].slice(0, 2)]);
      const b = sentenceShape([...lines[1].slice(2), ...lines[2]]);
      const m = morphShape(a, b);
      const at = (x: number) => (m ? shapePath(m(ease(x))) : "");
      return {
        from: shapePath(a),
        to: shapePath(b),
        at,
        ghosts: [0.2, 0.4, 0.6, 0.8].map(at),
      };
    }
    const from =
      kind === "pop"
        ? null
        : { box: kind === "stretch" ? lines[0][1] : lines[0][4], o: 1 };
    const toBox =
      kind === "stretch"
        ? lines[0][3]
        : kind === "travel"
          ? lines[1][1]
          : lines[1][3];
    const fn = interpolateWord(from, { box: toBox, o: 1 });
    const at = (x: number) => {
      const f = fn(ease(x));
      return f ? { d: wordPath(f.box, { pad: 2, radius: 4 }), o: f.o } : null;
    };
    return {
      from: from ? wordPath(from.box, { pad: 2, radius: 4 }) : "",
      to: wordPath(toBox, { pad: 2, radius: 4 }),
      at,
      ghosts: [0.15, 0.3, 0.45, 0.6, 0.75].map((x) => at(x)?.d ?? ""),
    };
  }, [kind]);

  const now = frames.at(t);
  const d = typeof now === "string" ? now : (now?.d ?? "");
  const o = typeof now === "string" ? 1 : (now?.o ?? 0);

  return (
    <div className="gl-demo">
      <Toolbar>
        <Segmented
          label="Move"
          value={kind}
          onChange={setKind}
          options={(Object.keys(CASES) as Case[]).map((k) => ({
            value: k,
            label: CASES[k].label,
          }))}
        />
      </Toolbar>
      <svg
        className="gl-anatomy"
        viewBox="0 0 480 130"
        role="img"
        aria-label={`${CASES[kind].label}: frame at ${Math.round(t * 100)} %`}
      >
        {lines.flat().map((b) => (
          <rect
            key={`${b.x}-${b.y}`}
            className="gl-anatomy-word"
            x={b.x}
            y={b.y + 5}
            width={b.w}
            height={6}
            rx={3}
          />
        ))}
        {frames.ghosts.map((g) => (
          <path key={g} className="gl-anatomy-ghost" d={g} />
        ))}
        {frames.from && <path className="gl-anatomy-from" d={frames.from} />}
        <path className="gl-anatomy-to" d={frames.to} />
        <path
          className={
            kind === "sentence"
              ? "gl-anatomy-now is-sentence"
              : "gl-anatomy-now"
          }
          d={d}
          style={{ opacity: o }}
        />
      </svg>
      <Toolbar>
        <Button
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          <Icon d={playing ? icons.pause : icons.play} />
        </Button>
        <Slider
          label="t"
          value={Math.round(t * 100)}
          min={0}
          max={100}
          unit=" %"
          onChange={(v) => {
            setPlaying(false);
            setT(v / 100);
          }}
        />
      </Toolbar>
      <p className="gl-caption">
        {CASES[kind].text} Dashed: start and end. Faint: frames at even steps of
        eased time.
      </p>
    </div>
  );
}
