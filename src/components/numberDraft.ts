export function normalizeIntegerDraft(text: string): string | null {
  if (!/^\d*$/.test(text)) return null;
  return text.replace(/^0+(?=\d)/, "");
}
