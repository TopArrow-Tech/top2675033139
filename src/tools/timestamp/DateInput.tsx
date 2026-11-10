import { useEffect, useRef, useState } from "react";
import { dateMask } from "./mask";
import type { Key } from "../../locales";
const labels: Key[] = ["year", "month", "day", "hour", "minute", "second"];
const placeholders = ["YYYY", "MM", "DD", "HH", "mm", "ss"];
function split(value: string) {
  const match = value.match(
    /^(\d{0,4})-(\d{0,2})-(\d{0,2})[T ](\d{0,2}):(\d{0,2})(?::(\d{0,2}))?/,
  );
  return match
    ? match.slice(1, 7).map((v) => v ?? "")
    : ["", "", "", "", "", ""];
}
export default function DateInput({
  value,
  onChange,
  t,
  id,
  label,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  t: (key: Key) => string;
  id?: string;
  label?: string;
  onEnter?: () => void;
}) {
  const [parts, setParts] = useState(() => split(value));
  const last = useRef(value);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setParts(split(value));
    }
  }, [value]);
  function change(index: number, text: string) {
    const next = parts.map((part, i) => (i === index ? text : part));
    setParts(next);
    const result = `${next[0]}-${next[1]}-${next[2]}T${next[3]}:${next[4]}:${next[5]}`;
    last.current = result;
    onChange(result);
  }
  return (
    <div
      id={id}
      className="date-segments"
      role="group"
      aria-label={label ?? t("dateLabel")}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text").trim();
        if (/^\d{14}$/.test(text)) {
          e.preventDefault();
          onChange(dateMask(text));
          return;
        }
        if (/^\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}/.test(text)) {
          e.preventDefault();
          onChange(text.replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3"));
        }
      }}
    >
      {parts.map((part, i) => (
        <span key={labels[i]}>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            aria-label={t(labels[i])}
            placeholder={placeholders[i]}
            value={part}
            maxLength={i === 0 ? 4 : 2}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, "");
              change(i, text);
              if (text.length === (i === 0 ? 4 : 2) && i < 5)
                refs.current[i + 1]?.focus();
            }}
            onBlur={(e) => {
              const text = e.currentTarget.value;
              if (i > 0 && text && text.length < 2)
                change(i, text.padStart(i === 0 ? 4 : 2, "0"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && onEnter) {
                e.preventDefault();
                onEnter();
                return;
              }
              if (
                (e.key === "ArrowLeft" &&
                  e.currentTarget.selectionStart === 0) ||
                (e.key === "Backspace" && !part)
              ) {
                e.preventDefault();
                refs.current[i - 1]?.focus();
              } else if (
                e.key === "ArrowRight" &&
                e.currentTarget.selectionStart === part.length
              ) {
                e.preventDefault();
                refs.current[i + 1]?.focus();
              }
            }}
          />
          {i < 5 && (
            <b aria-hidden="true">{i < 2 ? "-" : i === 2 ? " " : ":"}</b>
          )}
        </span>
      ))}
    </div>
  );
}
