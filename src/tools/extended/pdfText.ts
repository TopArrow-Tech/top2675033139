export type TextItem = {
  str: string;
  transform: number[];
  height: number;
  width: number;
  hasEOL?: boolean;
};
export function extractLines(items: unknown[]): string[] {
  const lines: string[] = [];
  let line = "",
    lastY: number | null = null,
    lastEnd: number | null = null;
  for (const value of items) {
    if (!value || typeof value !== "object" || !("str" in value)) continue;
    const item = value as TextItem,
      y = item.transform[5];
    if (
      lastY !== null &&
      Math.abs(y - lastY) > Math.max(2, item.height * 0.4) &&
      line
    ) {
      lines.push(line);
      line = "";
      lastEnd = null;
    }
    if (
      line &&
      lastEnd !== null &&
      item.transform[4] - lastEnd > Math.max(1, item.height * 0.12) &&
      !line.endsWith(" ") &&
      !item.str.startsWith(" ")
    )
      line += " ";
    line += item.str;
    lastY = y;
    lastEnd = item.transform[4] + item.width;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
      lastY = null;
      lastEnd = null;
    }
  }
  if (line) lines.push(line);
  return lines;
}
export async function wordBlob(
  pages: string[][],
  blankNotice: string,
  title: string,
) {
  const { Document, Paragraph, TextRun, Packer } = await import("docx");
  const children = pages.flatMap((lines, i) =>
    (lines.some((l) => l.trim()) ? lines : [`[${blankNotice} — ${i + 1}]`]).map(
      (line, j) =>
        new Paragraph({
          pageBreakBefore: i > 0 && j === 0,
          children: [
            new TextRun({
              text: line,
              font: { name: "Arial", eastAsia: "Microsoft YaHei" },
              size: 22,
            }),
          ],
        }),
    ),
  );
  return Packer.toBlob(
    new Document({ creator: "DevKit", title, sections: [{ children }] }),
  );
}
