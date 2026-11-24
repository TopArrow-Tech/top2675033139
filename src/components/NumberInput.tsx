import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { normalizeIntegerDraft } from "./numberDraft";
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & { value: number; onChange: (value: number) => void };
export default function NumberInput({
  value,
  onChange,
  onBlur,
  ...props
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setDraft(String(value));
    }
  }, [value]);
  return (
    <input
      {...props}
      type="number"
      step={props.step ?? 1}
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const next = normalizeIntegerDraft(e.target.value);
        if (next === null) return;
        setDraft(next);
        if (next !== "") {
          const numeric = Number(next);
          if (Number.isFinite(numeric)) {
            last.current = numeric;
            onChange(numeric);
          }
        }
      }}
      onBlur={(e) => {
        if (draft === "") setDraft(String(value));
        else setDraft(String(Number(draft)));
        onBlur?.(e);
      }}
    />
  );
}
