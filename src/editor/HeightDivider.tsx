import type { RefObject } from "react";
export default function HeightDivider({
  container,
  height,
  onChange,
  label,
  hint,
}: {
  container: RefObject<HTMLDivElement>;
  height: number | null;
  onChange: (height: number | null) => void;
  label: string;
  hint: string;
}) {
  function bounds() {
    const panel = container.current;
    const root = panel?.closest(".advanced-fullscreen");
    if (!panel || !root) return { top: 0, max: 500, current: 200 };
    const box = panel.getBoundingClientRect();
    return {
      top: box.top,
      max: Math.max(120, root.getBoundingClientRect().bottom - box.top - 200),
      current: box.height,
    };
  }
  function change(value: number) {
    onChange(Math.max(120, Math.min(bounds().max, value)));
  }
  return (
    <div
      className="height-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      title={hint}
      tabIndex={0}
      aria-valuemin={120}
      aria-valuenow={Math.round(height ?? bounds().current)}
      aria-valuemax={Math.round(bounds().max)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
        container.current?.setAttribute("data-height-resizing", "true");
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.preventDefault();
          change(e.clientY - bounds().top);
        }
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        container.current?.removeAttribute("data-height-resizing");
      }}
      onPointerCancel={() =>
        container.current?.removeAttribute("data-height-resizing")
      }
      onLostPointerCapture={() =>
        container.current?.removeAttribute("data-height-resizing")
      }
      onDoubleClick={() => onChange(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          change(
            bounds().current +
              (e.key === "ArrowUp" ? -1 : 1) * (e.shiftKey ? 50 : 10),
          );
        }
        if (e.key === "Enter") {
          e.preventDefault();
          onChange(null);
        }
      }}
    >
      <span />
    </div>
  );
}
