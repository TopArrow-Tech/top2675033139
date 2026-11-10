import { check, ToolError } from "../shared";

export function encode64(text: string, urlSafe = false) {
  check(text);
  if (
    !!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      text,
    )
  )
    throw new ToolError("invalidUtf8");
  const bytes = new TextEncoder().encode(text);
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const result = btoa(raw);
  return urlSafe
    ? result.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    : result;
}
export function decode64(text: string, urlSafe = false) {
  check(text);
  const pattern = urlSafe ? /^[A-Za-z0-9_-]*={0,2}$/ : /^[A-Za-z0-9+/]*={0,2}$/;
  if (!pattern.test(text)) throw new ToolError("invalidBase64");
  let normalized = text.replace(/-/g, "+").replace(/_/g, "/");
  const bare = normalized.replace(/=+$/, "");
  if (
    bare.length % 4 === 1 ||
    (normalized.includes("=") && normalized.length % 4 !== 0)
  )
    throw new ToolError("invalidBase64");
  normalized = bare + "=".repeat((4 - (bare.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
  } catch {
    throw new ToolError("invalidBase64");
  }
  // Reject non-zero padding bits with a round-trip check.
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192)
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  if (btoa(raw) !== normalized) throw new ToolError("invalidBase64");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ToolError("invalidUtf8");
  }
}
