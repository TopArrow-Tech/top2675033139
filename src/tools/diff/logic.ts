import { diffLines, diffChars, createTwoFilesPatch } from "diff";
import { check, ToolError } from "../shared";
export function compareText(
  left: string,
  right: string,
  ignoreWhitespace: boolean,
) {
  check(left, true);
  check(right, true);
  const changes = diffLines(left, right, { ignoreWhitespace, timeout: 1200 });
  if (!changes) throw new ToolError("timeout");
  const rows: {
    left: string;
    right: string;
    kind: "equal" | "added" | "removed" | "changed";
    chars: ReturnType<typeof diffChars>;
  }[] = [];
  let added = 0,
    removed = 0,
    modified = 0;
  const lines = (s: string) => {
    const list = s.split("\n");
    if (list.at(-1) === "") list.pop();
    return list;
  };
  for (let i = 0; i < changes.length; i++) {
    const part = changes[i];
    if (part.removed) {
      const old = lines(part.value);
      const next = changes[i + 1];
      const fresh = next?.added ? lines(next.value) : [];
      if (next?.added) i++;
      const count = Math.max(old.length, fresh.length);
      for (let j = 0; j < count; j++) {
        const a = old[j],
          b = fresh[j];
        const kind =
          a !== undefined && b !== undefined
            ? "changed"
            : a !== undefined
              ? "removed"
              : "added";
        if (kind === "changed") modified++;
        else if (kind === "added") added++;
        else removed++;
        rows.push({
          left: a ?? "",
          right: b ?? "",
          kind,
          chars:
            kind === "changed" ? (diffChars(a, b, { timeout: 100 }) ?? []) : [],
        });
      }
    } else
      for (const line of lines(part.value)) {
        if (part.added) added++;
        rows.push({
          left: part.added ? "" : line,
          right: line,
          kind: part.added ? "added" : "equal",
          chars: [],
        });
      }
    if (rows.length > 10000) throw new ToolError("diffLimit");
  }
  return {
    rows,
    added,
    removed,
    modified,
    newlineChanged: left.endsWith("\n") !== right.endsWith("\n"),
    patch:
      createTwoFilesPatch(
        "before",
        "after",
        left,
        right,
        undefined,
        undefined,
        { ignoreWhitespace, timeout: 1200 },
      ) ?? "",
  };
}
