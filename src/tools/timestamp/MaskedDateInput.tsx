import DateInput from "./DateInput";
import type { Key } from "../../locales";
// Share the same field widths, typography and separators as the date-parts row.
export default function MaskedDateInput({
  id,
  value,
  onChange,
  onEnter,
  t,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  t: (key: Key) => string;
}) {
  return (
    <DateInput
      id={id}
      label={t("dateString")}
      value={value}
      onChange={onChange}
      onEnter={onEnter}
      t={t}
    />
  );
}
