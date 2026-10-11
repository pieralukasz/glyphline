"use client";
import type { TextSource } from "glyphline";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A timed read-along cursor: no audio, each word stays on screen for a time that grows with its
 * length and with the punctuation after it. Enough to show the motion; the read-aloud guide shows
 * how to drive the same state from speechSynthesis word boundaries.
 */
export function useReader(
  source: TextSource | null,
  { wpm = 220, loop = true } = {},
) {
  const [word, setWord] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(0);
  const sentence =
    source && word >= 0 ? (source.words[word]?.sentence ?? -1) : -1;

  const dwell = useCallback(
    (i: number) => {
      if (!source) return 0;
      const w = source.words[i];
      const base = 60_000 / wpm;
      const after = source.text.slice(w.end, w.end + 2);
      const pause = /[.!?]/.test(after) ? 2.2 : /[,;:)]/.test(after) ? 1.4 : 1;
      return base * (0.6 + Math.min(w.text.length, 12) / 10) * pause;
    },
    [source, wpm],
  );

  useEffect(() => {
    if (!playing || !source) return;
    const i = word < 0 ? 0 : word;
    if (word < 0) setWord(0);
    timer.current = window.setTimeout(() => {
      const next = i + 1;
      if (next < source.words.length) setWord(next);
      else if (loop) setWord(0);
      else setPlaying(false);
    }, dwell(i));
    return () => window.clearTimeout(timer.current);
  }, [playing, word, source, dwell, loop]);

  const jumpSentence = (delta: number) => {
    if (!source) return;
    const s = Math.max(
      0,
      Math.min(
        source.sentences.length - 1,
        (sentence < 0 ? 0 : sentence) + delta,
      ),
    );
    const first = source.sentences[s]?.firstWord ?? 0;
    setWord(first >= 0 ? first : 0);
  };

  return {
    word,
    sentence,
    playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    jump: (w: number) => setWord(w),
    nextSentence: () => jumpSentence(1),
    prevSentence: () => jumpSentence(-1),
    reset: () => {
      setPlaying(false);
      setWord(-1);
    },
  };
}
