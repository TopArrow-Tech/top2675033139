// Fixed numeric fields display the selected timezone, never the machine timezone.
// Keep the original explicit-offset input in state until the user edits a field.
export function dateTimeInputValue(text: string, zone: string): string {
  if (!text) return "";
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim())) {
    return text.trim().replace(" ", "T");
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(text));
    const values = Object.fromEntries(
      parts.map(({ type, value }) => [type, value]),
    );
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
  } catch {
    return "";
  }
}

export function normalizeDateInput(text: string): string {
  const value = text.trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3");
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  // Fill missing fields only; invalid supplied dates still reach strict validation.
  const match = value.match(
    /^(\d{4})(?:-(\d{0,2})(?:-(\d{0,2}))?)?(?:[T ](\d{0,2})(?::(\d{0,2})(?::(\d{0,2}))?)?)?$/,
  );
  if (!match) return value;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${(month || "01").padStart(2, "0")}-${(day || "01").padStart(2, "0")}T${(hour || "00").padStart(2, "0")}:${(minute || "00").padStart(2, "0")}:${(second || "00").padStart(2, "0")}`;
}

export function currentYearInput(zone: string): string {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
  }).format(new Date());
  return `${year}--T::`;
}
