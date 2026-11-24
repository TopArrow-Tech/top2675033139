export type QrTitleOptions = {
  level: "L" | "M" | "Q" | "H";
  title: string;
  fontSize: number;
  position: "top" | "bottom" | "center";
  align: "left" | "center" | "right";
};
export function titleLines(
  title: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const c of [...title.trim()]) {
    if (c === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    if (line && measure(line + c) > maxWidth) {
      lines.push(line);
      line = c;
    } else line += c;
  }
  if (line) lines.push(line);
  return lines;
}
export function validateQrTitle(o: QrTitleOptions) {
  const center = o.position === "center";
  if (
    !Number.isInteger(o.fontSize) ||
    o.fontSize < 14 ||
    o.fontSize > (center ? 24 : 48) ||
    [...o.title].length > (center ? 8 : 80)
  )
    throw Error(center ? "qrCenterLimit" : "invalidInput");
}
export async function qrImage(input: string, options: QrTitleOptions) {
  const { default: QRCode } = await import("qrcode");
  const title =
      options.position === "center"
        ? [...options.title.trim()].slice(0, 8).join("")
        : options.title.trim(),
    center = options.position === "center" && !!title;
  if (title) validateQrTitle({ ...options, title });
  // Use integer-sized modules to avoid blurred edges.
  const qr = document.createElement("canvas");
  const model = QRCode.create(input, {
    errorCorrectionLevel: center ? "H" : options.level,
  });
  const modules = model.modules.size,
    scale = Math.max(1, Math.floor(512 / (modules + 8))),
    quiet = 4 * scale;
  const codeSize = (modules + 8) * scale;
  await QRCode.toCanvas(qr, input, {
    errorCorrectionLevel: center ? "H" : options.level,
    scale,
    margin: 4,
  });
  if (!title) return qr.toDataURL("image/png");
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx) throw Error("invalidInput");
  const font = `600 ${options.fontSize}px system-ui, sans-serif`;
  ctx.font = font;
  if (center) {
    const maxWidth = Math.floor(modules * scale * 0.32),
      maxHeight = modules * scale * 0.22;
    let actualSize = options.fontSize,
      lines: string[] = [],
      width = 0,
      height = 0,
      lineHeight = 0;
    for (; actualSize >= 14; actualSize--) {
      ctx.font = `600 ${actualSize}px system-ui, sans-serif`;
      lines = titleLines(
        title,
        maxWidth - 12,
        (text) => ctx.measureText(text).width,
      );
      if (lines.length === 2 && !title.includes("\n")) {
        const chars = [...title],
          middle = Math.ceil(chars.length / 2);
        const balanced = [
          chars.slice(0, middle).join(""),
          chars.slice(middle).join(""),
        ];
        if (
          balanced.every((line) => ctx.measureText(line).width <= maxWidth - 12)
        )
          lines = balanced;
      }
      lineHeight = Math.ceil(actualSize * 1.15);
      width =
        Math.ceil(
          Math.max(...lines.map((text) => ctx.measureText(text).width)),
        ) + 12;
      height = lines.length * lineHeight + 8;
      if (lines.length <= 2 && width <= maxWidth && height <= maxHeight) break;
    }
    if (actualSize < 14) throw Error("qrCenterLimit");
    canvas.width = codeSize;
    canvas.height = codeSize;
    ctx.drawImage(qr, 0, 0);
    const left = Math.floor((codeSize - width) / 2),
      top = Math.floor((codeSize - height) / 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(left, top, width, height);
    ctx.font = `600 ${actualSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111827";
    lines.forEach((line, i) =>
      ctx.fillText(line, codeSize / 2, top + 4 + lineHeight * (i + 0.5)),
    );
  } else {
    const lines = titleLines(
        title,
        codeSize - 32,
        (t) => ctx.measureText(t).width,
      ),
      lineHeight = Math.ceil(options.fontSize * 1.2);
    const titleHeight = lines.length * lineHeight + 8;
    canvas.width = codeSize;
    canvas.height = codeSize + titleHeight - 2 * scale;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Keep captions compact: retain two clear modules on the caption-facing edge.
    const topTitle = options.position === "top";
    if (topTitle)
      ctx.drawImage(
        qr,
        0,
        2 * scale,
        codeSize,
        codeSize - 2 * scale,
        0,
        titleHeight,
        codeSize,
        codeSize - 2 * scale,
      );
    else
      ctx.drawImage(
        qr,
        0,
        0,
        codeSize,
        codeSize - 2 * scale,
        0,
        0,
        codeSize,
        codeSize - 2 * scale,
      );
    ctx.font = font;
    ctx.textAlign = options.align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111827";
    const x =
      options.align === "left"
        ? quiet
        : options.align === "right"
          ? codeSize - quiet
          : codeSize / 2;
    const startY = topTitle ? 4 : codeSize - 2 * scale + 4;
    lines.forEach((line, i) =>
      ctx.fillText(line, x, startY + lineHeight * (i + 0.5)),
    );
  }
  return canvas.toDataURL("image/png");
}
