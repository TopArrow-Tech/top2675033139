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
  return text.trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3");
}
