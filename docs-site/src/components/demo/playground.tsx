"use client";
import type { HighlighterOptions } from "glyphline";
import type { PdfTextSource } from "glyphline/pdf";
import { useMemo, useState } from "react";
import { Button, Segmented, Slider, Toggle, Toolbar } from "./controls";
import { PdfPage } from "./pdf";

const EASINGS = {
  "ease-out cubic": (t: number) => 1 - (1 - t) ** 3,
  linear: (t: number) => t,
  "ease-in-out": (t: number) =>
    t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  "ease-out back": (t: number) =>
    1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
} as const;
type Easing = keyof typeof EASINGS;

/** Every option of createHighlighter on the PDF page, with buttons for each kind of move. */
export function Playground() {
  const [source, setSource] = useState<PdfTextSource | null>(null);
  const [word, setWord] = useState(0);
  const [wordMs, setWordMs] = useState(240);
  const [sentenceMs, setSentenceMs] = useState(340);
  const [slow, setSlow] = useState(1);
  const [easing, setEasing] = useState<Easing>("ease-out cubic");
  const [pad, setPad] = useState(2);
  const [radius, setRadius] = useState(5);
  const [wordPad, setWordPad] = useState(1.5);
  const [showSentence, setShowSentence] = useState(true);
  const [animate, setAnimate] = useState(true);

  const options = useMemo<HighlighterOptions>(
    () => ({
      animate,
      respectReducedMotion: false,
      duration: { word: wordMs * slow, sentence: sentenceMs * slow },
      easing: EASINGS[easing],
      sentenceShape: { pad, radius },
      wordShape: { pad: wordPad, radius: Math.min(radius, 4) },
    }),
    [animate, wordMs, sentenceMs, slow, easing, pad, radius, wordPad],
  );

  const words = source?.words ?? [];
  const sentence = showSentence ? (words[word]?.sentence ?? -1) : null;
  const go = (i: number) =>
    source && setWord(Math.max(0, Math.min(words.length - 1, i)));
  /** first word whose box sits on another line than the current one */
  const nextLine = () => {
    if (!source) return;
    const svg = document.querySelector<SVGSVGElement>(
      "[data-playground] svg.gl-overlay",
    );
    if (!svg) return;
    const [cur] = source.boxes(words[word].start, words[word].end, svg);
    for (let i = word + 1; i < words.length; i++) {
      const [b] = source.boxes(words[i].start, words[i].end, svg);
      if (b && cur && b.y > cur.y + cur.h * 0.5) return go(i);
    }
  };
  const nextSentence = () => {
    if (!source) return;
    const s = source.sentences[(words[word]?.sentence ?? 0) + 1];
    if (s) go(s.firstWord);
  };
  const otherColumn = () => {
    if (!source) return;
    const svg = document.querySelector<SVGSVGElement>(
      "[data-playground] svg.gl-overlay",
    );
    if (!svg) return;
    const mid = source.width / 2;
    const [cur] = source.boxes(words[word].start, words[word].end, svg);
    const left = cur ? cur.x < mid : true;
    for (let i = 0; i < words.length; i++) {
      const [b] = source.boxes(words[i].start, words[i].end, svg);
      if (
        b &&
        b.y > (cur?.y ?? 0) - 40 &&
        (left ? b.x > mid : b.x < mid) &&
        b.y < (cur?.y ?? 0) + 40
      )
        return go(i);
    }
  };

  return (
    <div className="gl-demo gl-playground" data-playground="">
      <Toolbar>
        <Button onClick={() => go(word - 1)}>← word</Button>
        <Button className="is-primary" onClick={() => go(word + 1)}>
          word →
        </Button>
        <Button onClick={() => go(word + 4)}>+4 words</Button>
        <Button onClick={nextLine}>next line</Button>
        <Button onClick={nextSentence}>next sentence</Button>
        <Button onClick={otherColumn}>other column</Button>
      </Toolbar>
      <div className="gl-playground-grid">
        <div className="gl-paper">
          <PdfPage
            state={{ word, sentence }}
            options={options}
            onSource={setSource}
            onWordClick={setWord}
          />
        </div>
        <div className="gl-panel">
          <Segmented
            label="Speed"
            value={slow}
            onChange={setSlow}
            options={[
              { value: 1, label: "1×" },
              { value: 4, label: "4× slower" },
              { value: 10, label: "10×" },
            ]}
          />
          <Slider
            label="Word"
            value={wordMs}
            min={60}
            max={800}
            step={10}
            unit=" ms"
            onChange={setWordMs}
          />
          <Slider
            label="Sentence"
            value={sentenceMs}
            min={60}
            max={1200}
            step={10}
            unit=" ms"
            onChange={setSentenceMs}
          />
          <label className="gl-select">
            <span>Easing</span>
            <select
              value={easing}
              onChange={(e) => setEasing(e.target.value as Easing)}
            >
              {Object.keys(EASINGS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <Slider
            label="Outline pad"
            value={pad}
            min={0}
            max={6}
            step={0.5}
            onChange={setPad}
          />
          <Slider
            label="Radius"
            value={radius}
            min={0}
            max={10}
            step={0.5}
            onChange={setRadius}
          />
          <Slider
            label="Word pad"
            value={wordPad}
            min={0}
            max={4}
            step={0.5}
            onChange={setWordPad}
          />
          <Toggle
            label="Sentence outline"
            checked={showSentence}
            onChange={setShowSentence}
          />
          <Toggle label="Animate" checked={animate} onChange={setAnimate} />
          <pre className="gl-options">{`{
  duration: {
    word: ${wordMs * slow},
    sentence: ${sentenceMs * slow},
  },
  easing: ${easing === "ease-out cubic" ? "easeOutCubic" : `/* ${easing} */`},
  sentenceShape: { pad: ${pad}, radius: ${radius} },
  wordShape: { pad: ${wordPad}, radius: ${Math.min(radius, 4)} },${animate ? "" : "\n  animate: false,"}
}`}</pre>
        </div>
      </div>
    </div>
  );
}
