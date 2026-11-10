import { useEffect, useRef, type RefObject } from "react";
import { clampSplit, pointerSplit } from "./split";
export default function SplitDivider({
  container,
  value,
  onChange,
  label,
  hint,
  valueText,
}: {
  container: RefObject<HTMLDivElement>;
  value: number;
  onChange: (value: number) => void;
  label: string;
  hint: string;
  valueText: string;
}) {
  const frame = useRef<number>(),
    pending = useRef(value);
  function flush() {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    onChange(pending.current);
  }
  function move(x: number) {
    const node = container.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(node).paddingLeft) || 0;
    pending.current = pointerSplit(
      x,
      bounds.left + padding,
      bounds.width - padding * 2,
    );
    if (frame.current === undefined)
      frame.current = requestAnimationFrame(() => {
        frame.current = undefined;
        onChange(pending.current);
      });
  }
  function stop() {
    flush();
    container.current?.removeAttribute("data-resizing");
  }
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      container.current?.removeAttribute("data-resizing");
    },
    [],
  );
  return (
    <div
      className="json-split-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={20}
      aria-valuemax={80}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
      tabIndex={0}
      title={hint}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        pending.current = value;
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        container.current?.setAttribute("data-resizing", "true");
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.preventDefault();
          move(e.clientX);
        }
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          stop();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={stop}
      onLostPointerCapture={() =>
        container.current?.removeAttribute("data-resizing")
      }
      onDoubleClick={() => onChange(50)}
      onKeyDown={(e) => {
        let next: number | undefined;
        if (e.key === "ArrowLeft") next = value - (e.shiftKey ? 10 : 2);
        if (e.key === "ArrowRight") next = value + (e.shiftKey ? 10 : 2);
        if (e.key === "Home") next = 20;
        if (e.key === "End") next = 80;
        if (e.key === "Enter") next = 50;
        if (next !== undefined) {
          e.preventDefault();
          onChange(clampSplit(next));
        }
      }}
    >
      <span />
    </div>
  );
}
