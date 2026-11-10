export const DATE_MASK = "____-__-__ __:__:__";
export const DATE_SLOTS = [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18];
export function dateMask(value: string): string {
  const text = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return text;
  // Preserve empty slots when editing a partially filled value.
  if (text.length === DATE_MASK.length && text.includes("_"))
    return DATE_MASK.split("")
      .map((char, i) =>
        DATE_SLOTS.includes(i) && /\d/.test(text[i]) ? text[i] : char,
      )
      .join("");
  const digits = text.replace(/\D/g, "").slice(0, 14);
  let index = 0;
  return DATE_MASK.split("")
    .map((char, i) =>
      DATE_SLOTS.includes(i) ? (digits[index++] ?? "_") : char,
    )
    .join("");
}
export function editDateMask(
  value: string,
  start: number,
  end: number,
  text: string,
  direction?: "backward" | "forward",
) {
  const masked = dateMask(value).slice(0, 19).split("");
  // Editing a pasted offset ISO value switches back to local date fields.
  if (masked.length !== 19) return { value: DATE_MASK, caret: 0 };
  for (const i of DATE_SLOTS) if (i >= start && i < end) masked[i] = "_";
  let caret = start;
  if (direction) {
    if (start === end) {
      const index =
        direction === "backward"
          ? [...DATE_SLOTS].reverse().find((i) => i < start)
          : DATE_SLOTS.find((i) => i >= start);
      if (index !== undefined) {
        masked[index] = "_";
        caret = index;
      }
    }
  } else {
    for (const digit of text.replace(/\D/g, "")) {
      const index = DATE_SLOTS.find((i) => i >= caret);
      if (index === undefined) break;
      masked[index] = digit;
      caret = DATE_SLOTS.find((i) => i > index) ?? 19;
    }
  }
  // Reinstate all separators even when the source was a pasted ISO string.
  for (let i = 0; i < 19; i++)
    if (!DATE_SLOTS.includes(i)) masked[i] = DATE_MASK[i];
  const next = masked.join("");
  return { value: next === DATE_MASK ? "" : next, caret };
}
