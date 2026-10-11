"use client";
import { GlyphOverlay, useDomSource } from "glyphline/react";
import { Button, Icon, icons, Toolbar } from "./controls";
import { useReader } from "./use-reader";

/** The same cursor on ordinary HTML. Resize the window: the shapes follow the reflow. */
export function HtmlReadAlong() {
  const [ref, source] = useDomSource<HTMLDivElement>();
  const reader = useReader(source, { wpm: 240 });

  return (
    <div className="gl-demo">
      <Toolbar>
        <Button
          className="is-primary"
          onClick={reader.toggle}
          disabled={!source}
        >
          <Icon d={reader.playing ? icons.pause : icons.play} />
          <span>{reader.playing ? "Pause" : "Read"}</span>
        </Button>
        <Button onClick={reader.nextSentence} disabled={!source}>
          Next sentence
        </Button>
        <span className="gl-status">
          Inline markup, a heading and a list: one text for glyphline.
        </span>
      </Toolbar>
      {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: click-to-read is a pointer shortcut; the buttons are the keyboard path */}
      <div
        className="gl-article-wrap gl-article-resizable"
        onClick={(e) => {
          if (!source || !document.getSelection()?.isCollapsed) return;
          const i = source.charAtPoint(e.clientX, e.clientY);
          const w = source.words.findIndex((x) => i >= x.start && i < x.end);
          if (w >= 0) {
            reader.jump(w);
            reader.play();
          }
        }}
      >
        <div ref={ref} className="gl-article" lang="en">
          <h3>How the cursor moves</h3>
          <p>
            Along a line the cursor <em>stretches</em> toward the next word and
            then contracts onto it. Between lines it travels with the same
            motion, so going down a line reads like moving{" "}
            <strong>along</strong> it.
          </p>
          <ul>
            <li>A sentence is one rounded shape, even across lines.</li>
            <li>
              Justified line ends are snapped, so the edge stays straight.
            </li>
          </ul>
          <p>Drag the corner of this box to change its width while it reads.</p>
        </div>
        <GlyphOverlay
          source={source}
          sentence={reader.sentence}
          word={reader.word}
        />
      </div>
    </div>
  );
}
