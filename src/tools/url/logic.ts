import { check, ToolError } from "../shared";

export function urlProcess(text: string, action: string, full = false) {
  check(text);
  try {
    return action === "encode"
      ? full
        ? encodeURI(text)
        : encodeURIComponent(text)
      : full
        ? decodeURI(text)
        : decodeURIComponent(text);
  } catch {
    throw new ToolError("invalidUrl");
  }
}
export type Pair = [string, string];
export function parseQuery(text: string): Pair[] {
  check(text);
  let query = text;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
    try {
      query = new URL(text).search.slice(1);
    } catch {
      throw new ToolError("invalidUrl");
    }
  } else {
    query = text.replace(/^\?/, "").split("#")[0];
  }
  for (const part of query.split("&")) {
    try {
      decodeURIComponent(part.replace(/\+/g, " "));
    } catch {
      throw new ToolError("invalidUrl");
    }
  }
  const pairs = Array.from(new URLSearchParams(query).entries());
  if (pairs.length > 1000) throw new ToolError("tooManyParameters");
  return pairs;
}
export function buildQuery(pairs: Pair[]) {
  if (pairs.length > 1000) throw new ToolError("tooManyParameters");
  for (const pair of pairs)
    for (const value of pair) {
      if (
        /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
          value,
        )
      )
        throw new ToolError("invalidUrl");
    }
  return new URLSearchParams(pairs).toString();
}
