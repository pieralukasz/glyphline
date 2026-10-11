// Copied from docs-site/content/docs/react/selection.mdx
import type { Mark, TextRange } from 'glyphline';
import { GlyphOverlay, useDomSource } from 'glyphline/react';
import { useState } from 'react';

export function Annotated() {
	const [ref, source] = useDomSource<HTMLDivElement>();
	const [selected, setSelected] = useState<{ range: TextRange; text: string } | null>(null);
	const [marks, setMarks] = useState<Mark[]>([]);

	return (
		<>
			<button
				disabled={!selected}
				onMouseDown={(e) => e.preventDefault()} // keep the selection alive
				onClick={() => {
					if (!selected) return;
					setMarks((m) => [
						...m,
						{ id: crypto.randomUUID(), ...selected.range, className: 'note' }
					]);
					document.getSelection()?.removeAllRanges();
				}}
			>
				Highlight
			</button>
			<div style={{ position: 'relative' }}>
				<div ref={ref} className="gl-native-selection-hidden">
					text
				</div>
				<GlyphOverlay
					source={source}
					marks={marks}
					options={{
						trackSelection: {
							snapToWords: true,
							onChange: (range, text) => setSelected(range ? { range, text } : null)
						}
					}}
				/>
			</div>
		</>
	);
}
