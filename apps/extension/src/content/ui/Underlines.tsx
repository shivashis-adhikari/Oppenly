import type { Rect } from '../adapters';
import { frame, hovered, sessions, settings } from '../store';
import { visibleBox } from './geometry';

export interface HitBox {
  session: string;
  suggestion: string;
  rect: Rect;
}

/** Underline boxes from the last render, used for hover and click hit-testing. */
export let hitBoxes: HitBox[] = [];

export function Underlines() {
  frame.value;
  const hover = hovered.value;
  const boxes: HitBox[] = [];
  const layers = sessions.value.map((session) => {
    const clip = visibleBox(session.element);
    if (!clip) return null;
    const lines = [];
    for (const s of session.suggestions.value) {
      const rects = session.adapter.rects(s.start, s.end);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]!;
        if (
          r.y + r.height < clip.y ||
          r.y > clip.y + clip.height ||
          r.x + r.width < clip.x ||
          r.x > clip.x + clip.width
        )
          continue;
        boxes.push({ session: session.id, suggestion: s.id, rect: r });
        const left = r.x - clip.x;
        const top = r.y - clip.y;
        if (hover === s.id) {
          lines.push(
            <div
              key={`h${s.id}${i}`}
              class="op-hl"
              data-cat={s.category}
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
              }}
            />,
          );
        }
        lines.push(
          <div
            key={`${s.id}${i}`}
            class="op-ul"
            data-cat={s.category}
            data-kind={s.kind === 'info' ? 'info' : undefined}
            style={{ left: `${left}px`, top: `${top + r.height - 1}px`, width: `${r.width}px` }}
          />,
        );
      }
    }
    return (
      <div
        key={session.id}
        class="op-clip"
        style={{
          left: `${clip.x}px`,
          top: `${clip.y}px`,
          width: `${clip.width}px`,
          height: `${clip.height + 3}px`,
        }}
      >
        {lines}
      </div>
    );
  });
  hitBoxes = boxes;
  return <div class={settings.value.underlineShapes ? 'op-shapes' : undefined}>{layers}</div>;
}
