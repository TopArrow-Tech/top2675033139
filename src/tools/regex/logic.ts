import { check, ToolError } from "../shared";
export function regexTest(
  pattern: string,
  flags: string,
  text: string,
  replacement: string,
) {
  check(text, true);
  check(replacement, true);
  if (pattern.length > 10000) throw new ToolError("tooLarge");
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch {
    throw new ToolError("invalidRegex");
  }
  const matches: {
    text: string;
    index: number;
    end: number;
    groups: (string | null)[];
    named: Record<string, string> | null;
  }[] = [];
  let captureBytes = 0,
    maxCapture = 0,
    maxMatch = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (matches.length >= 2000 || match.length > 256)
      throw new ToolError("matchLimit");
    for (const capture of match) {
      captureBytes += (capture ?? "").length;
      maxCapture = Math.max(maxCapture, (capture ?? "").length);
    }
    if (captureBytes > 4 * 1024 * 1024) throw new ToolError("tooLarge");
    maxMatch = Math.max(maxMatch, match[0].length);
    matches.push({
      text: match[0],
      index: match.index,
      end: match.index + match[0].length,
      groups: Array.from(match)
        .slice(1)
        .map((v) => v ?? null),
      named: match.groups ?? null,
    });
    if (!regex.global && !regex.sticky) break;
    if (match[0] === "") {
      const i = regex.lastIndex;
      regex.lastIndex =
        i +
        ((regex.unicode || flags.includes("v")) &&
        (text.codePointAt(i) ?? 0) > 0xffff
          ? 2
          : 1);
    }
  }
  // Bound expansion before native replacement can allocate a very large string.
  const refs = replacement.match(/\$(?:\d{1,2}|<[^>]+>|[&`'])/g) ?? [];
  const estimate =
    replacement.length +
    refs.reduce(
      (sum, ref) =>
        sum +
        (["$`", "$'"].includes(ref)
          ? text.length
          : ref === "$&"
            ? maxMatch
            : maxCapture),
      0,
    );
  if (estimate * matches.length + text.length > 4 * 1024 * 1024)
    throw new ToolError("tooLarge");
  const replaced = text.replace(new RegExp(pattern, flags), replacement);
  if (replaced.length > 4 * 1024 * 1024) throw new ToolError("tooLarge");
  return { matches, replaced };
}
