"use client";
import type { PdfTextSource } from "glyphline/pdf";
import { useEffect, useState } from "react";
import { Button, Icon, icons, Slider, Toggle, Toolbar } from "./controls";
import { PdfPage } from "./pdf";
import { useReader } from "./use-reader";

/** The PDF page reading itself: sentence outline + word cursor on a timed clock. */
export function ReadAlong({
  autoPlay = false,
  compact = false,
}: {
  autoPlay?: boolean;
  compact?: boolean;
}) {
  const [source, setSource] = useState<PdfTextSource | null>(null);
  const [wpm, setWpm] = useState(230);
  const [animate, setAnimate] = useState(true);
  const reader = useReader(source, { wpm });
  const { play } = reader;

  useEffect(() => {
    if (!autoPlay || !source) return;
    // start when the page scrolls into view, not while it is off screen
    const el = document.querySelector("[data-read-along]");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && play(), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [autoPlay, source, play]);

  const current =
    source && reader.word >= 0 ? source.words[reader.word]?.text : null;

  return (
    <div className="gl-demo" data-read-along="">
      <Toolbar>
        <Button
          onClick={reader.prevSentence}
          aria-label="Previous sentence"
          disabled={!source}
        >
          <Icon d={icons.prev} />
        </Button>
        <Button
          className="is-primary"
          onClick={reader.toggle}
          aria-label={reader.playing ? "Pause" : "Play"}
          disabled={!source}
        >
          <Icon d={reader.playing ? icons.pause : icons.play} />
          <span>{reader.playing ? "Pause" : "Read"}</span>
        </Button>
        <Button
          onClick={reader.nextSentence}
          aria-label="Next sentence"
          disabled={!source}
        >
          <Icon d={icons.next} />
        </Button>
        {!compact && (
          <Slider
            label="Speed"
            value={wpm}
            min={120}
            max={420}
            step={10}
            unit=" wpm"
            onChange={setWpm}
          />
        )}
        <Toggle label="Animate" checked={animate} onChange={setAnimate} />
        <span className="gl-status" aria-live="off">
          {current ? (
            <>
              Word: <b>{current}</b>
            </>
          ) : (
            "Click a word to start there"
          )}
        </span>
      </Toolbar>
      <div className="gl-paper">
        <PdfPage
          state={{ sentence: reader.sentence, word: reader.word }}
          options={{ animate }}
          onSource={setSource}
          onWordClick={(w) => {
            reader.jump(w);
            reader.play();
          }}
        />
      </div>
      <p className="gl-caption">
        A real PDF page rendered by pdf.js. The cursor follows a timer here (no
        audio); in a reader it follows the voice. Text stays selectable: drag
        across it.
      </p>
    </div>
  );
}
