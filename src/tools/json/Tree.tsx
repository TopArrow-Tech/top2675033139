import type { ReactNode } from "react";
// Each expandable node owns its subtree; keep numeric tokens as text to preserve precision.
export default function JsonTree({ text }: { text: string }) {
  const lines = text.split("\n");
  function nodes(start: number, end: number): ReactNode[] {
    const result: ReactNode[] = [];
    for (let i = start; i < end; i++) {
      const line = lines[i],
        trim = line.trim();
      if (/[\[{]$/.test(trim)) {
        let depth = 1,
          j = i + 1;
        for (; j < end; j++) {
          const s = lines[j].trim();
          if (/[\[{]$/.test(s)) depth++;
          if (/^[\]}],?$/.test(s)) depth--;
          if (depth === 0) break;
        }
        if (j < end) {
          result.push(
            <details open key={i}>
              <summary>{trim}</summary>
              <div className="tree-children">{nodes(i + 1, j)}</div>
              <div>{lines[j].trim()}</div>
            </details>,
          );
          i = j;
          continue;
        }
      }
      result.push(
        <div className="tree-leaf" key={i}>
          {trim}
        </div>,
      );
    }
    return result;
  }
  return <div className="tree-view">{nodes(0, lines.length)}</div>;
}
