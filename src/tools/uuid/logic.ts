import { ToolError } from "../shared";
export function generateUuids(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 1000)
    throw new ToolError("invalidCount");
  if (!globalThis.crypto?.getRandomValues)
    throw new ToolError("cryptoUnavailable");
  const list = new Set<string>();
  while (list.size < count) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
    list.add(
      `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`,
    );
  }
  return [...list];
}
export function checkUuids(text: string) {
  const values = text.split(/\s+/).filter(Boolean);
  if (!values.length) throw new ToolError("empty");
  const valid = values.every((v) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    ),
  );
  return {
    valid,
    total: values.length,
    unique: new Set(values.map((v) => v.toLowerCase())).size,
    duplicates:
      values.length - new Set(values.map((v) => v.toLowerCase())).size,
  };
}
