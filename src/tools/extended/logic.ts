import { load, dump, JSON_SCHEMA } from "js-yaml";
import { encodeHTML, decodeHTML } from "entities";
import { check, ToolError } from "../shared";
export type TextOptions = {
  action: string;
  length?: number;
  count?: number;
  upper?: boolean;
  lower?: boolean;
  digits?: boolean;
  symbols?: boolean;
  avoid?: boolean;
};
function invalid(): never {
  throw new ToolError("invalidInput");
}
function safeNumbers(value: unknown, depth = 0): void {
  if (depth > 100) invalid();
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    throw new ToolError("unsafeNumber");
  if (Array.isArray(value)) value.forEach((v) => safeNumbers(v, depth + 1));
  else if (value && typeof value === "object")
    Object.values(value).forEach((v) => safeNumbers(v, depth + 1));
}
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) invalid();
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closed = false;
      if (rows.length > 10001) invalid();
    } else {
      if (closed) invalid();
      cell += c;
    }
  }
  if (quoted) invalid();
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift();
  if (
    !headers?.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    invalid();
  return rows.map((cells) => {
    if (cells.length !== headers.length) invalid();
    return Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
  });
}
export function toCsv(value: unknown): string {
  if (
    !Array.isArray(value) ||
    value.length > 10000 ||
    value.some((r) => !r || typeof r !== "object" || Array.isArray(r))
  )
    invalid();
  const headers = [...new Set(value.flatMap((r) => Object.keys(r)))];
  if (!headers.length) return "";
  const escape = (v: unknown) => {
    if (v !== null && typeof v === "object") invalid();
    const s = v == null ? "" : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [
    headers.map(escape).join(","),
    ...value.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\r\n");
}
function randomIndex(max: number): number {
  const array = new Uint32Array(1),
    limit = Math.floor(0x100000000 / max) * max;
  do {
    crypto.getRandomValues(array);
  } while (array[0] >= limit);
  return array[0] % max;
}
export function passwords(o: TextOptions): string {
  const length = o.length ?? 20,
    count = o.count ?? 5;
  if (
    !Number.isInteger(length) ||
    length < 4 ||
    length > 128 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100
  )
    invalid();
  const sets = [
    o.upper && "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    o.lower && "abcdefghijklmnopqrstuvwxyz",
    o.digits && "0123456789",
    o.symbols && "!@#$%^&*()-_=+[]{}:,.?",
  ]
    .filter((v): v is string => !!v)
    .map((s) => (o.avoid ? s.replace(/[Il1O0o]/g, "") : s));
  if (!sets.length || length < sets.length) invalid();
  const alphabet = sets.join("");
  return Array.from({ length: count }, () => {
    const chars = sets.map((s) => s[randomIndex(s.length)]);
    while (chars.length < length)
      chars.push(alphabet[randomIndex(alphabet.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }).join("\n");
}
export function colorConvert(input: string) {
  let rgb: number[],
    alpha = 1;
  const text = input.trim();
  const hex = text.match(
    /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  );
  if (hex) {
    let h = hex[1];
    if (h.length < 5) h = [...h].map((c) => c + c).join("");
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    if (h.length === 8) alpha = parseInt(h.slice(6), 16) / 255;
  } else {
    const r = text.match(
      /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i,
    );
    const h = text.match(
      /^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i,
    );
    if (r) {
      rgb = r.slice(1, 4).map(Number);
      if (rgb.some((v) => v > 255)) invalid();
      alpha = r[4] === undefined ? 1 : +r[4];
    } else if (h) {
      let hue = ((+h[1] % 360) + 360) % 360;
      const sat = +h[2] / 100,
        light = +h[3] / 100;
      if (sat > 1 || light > 1) invalid();
      const c = (1 - Math.abs(2 * light - 1)) * sat,
        x = c * (1 - Math.abs(((hue / 60) % 2) - 1)),
        m = light - c / 2;
      const a =
        hue < 60
          ? [c, x, 0]
          : hue < 120
            ? [x, c, 0]
            : hue < 180
              ? [0, c, x]
              : hue < 240
                ? [0, x, c]
                : hue < 300
                  ? [x, 0, c]
                  : [c, 0, x];
      rgb = a.map((v) => Math.round((v + m) * 255));
      alpha = h[4] === undefined ? 1 : +h[4];
    } else invalid();
  }
  rgb = rgb.map(Math.round);
  const [r, g, b] = rgb.map((v) => v / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min,
    light = (max + min) / 2;
  let hue =
    delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  hue = (hue + 360) % 360;
  const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
  const luminance = rgb
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  return {
    hex:
      "#" +
      rgb.map((v) => v.toString(16).padStart(2, "0")).join("") +
      (alpha < 1
        ? Math.round(alpha * 255)
            .toString(16)
            .padStart(2, "0")
        : ""),
    rgb: `rgba(${rgb.join(", ")}, ${+alpha.toFixed(3)})`,
    hsl: `hsla(${+hue.toFixed(1)}, ${+(sat * 100).toFixed(1)}%, ${+(light * 100).toFixed(1)}%, ${+alpha.toFixed(3)})`,
    contrastBlack: alpha === 1 ? +((luminance + 0.05) / 0.05).toFixed(2) : null,
    contrastWhite: alpha === 1 ? +(1.05 / (luminance + 0.05)).toFixed(2) : null,
  };
}
export function textProcess(id: string, input: string, o: TextOptions): string {
  check(input, id === "password");
  let output: string;
  if (id === "password") output = passwords(o);
  else if (id === "color")
    output = JSON.stringify(colorConvert(input), null, 2);
  else if (id === "unicode") {
    if (o.action === "unicodeEncode")
      output = input
        .split("")
        .map((c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))
        .join("");
    else {
      output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] !== "\\" || input[i + 1] !== "u") {
          output += input[i];
          continue;
        }
        const match = input
          .slice(i)
          .match(/^\\u(?:\{([0-9a-f]{1,6})\}|([0-9a-f]{4}))/i);
        if (!match) invalid();
        const cp = parseInt(match[1] || match[2], 16);
        if (cp > 0x10ffff) invalid();
        output += String.fromCodePoint(cp);
        i += match[0].length - 1;
      }
    }
  } else if (id === "htmlentity")
    output = o.action === "htmlEncode" ? encodeHTML(input) : decodeHTML(input);
  else if (id === "dataconvert") {
    let value: unknown;
    if (o.action === "csvJson") value = parseCsv(input.replace(/^\uFEFF/, ""));
    else if (o.action === "yamlJson")
      value = load(input, { schema: JSON_SCHEMA, json: false });
    else value = JSON.parse(input);
    safeNumbers(value);
    output =
      o.action === "jsonCsv"
        ? toCsv(value)
        : o.action === "jsonYaml"
          ? dump(value, { schema: JSON_SCHEMA, noRefs: true, lineWidth: 100 })
          : JSON.stringify(value, null, 2);
    if (typeof output !== "string") invalid();
  } else {
    const lines = input.split(/\r?\n/),
      words = input.match(/[\p{L}\p{N}]+/gu) || [];
    switch (o.action) {
      case "trimLines":
        output = lines.map((l) => l.trim()).join("\n");
        break;
      case "uniqueLines":
        output = [...new Set(lines)].join("\n");
        break;
      case "sortLines":
        output = lines.sort().join("\n");
        break;
      case "reverseLines":
        output = lines.reverse().join("\n");
        break;
      case "upperText":
        output = input.toUpperCase();
        break;
      case "lowerText":
        output = input.toLowerCase();
        break;
      case "textStats":
        output = JSON.stringify(
          {
            characters: [...input].length,
            words: words.length,
            lines: lines.length,
            utf8Bytes: new TextEncoder().encode(input).length,
          },
          null,
          2,
        );
        break;
      default: {
        const parts = input
          .replace(/([a-z\d])([A-Z])/g, "$1 $2")
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean)
          .map((w) => w.toLowerCase());
        output =
          o.action === "camelText"
            ? parts
                .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w))
                .join("")
            : parts.join(o.action === "snakeText" ? "_" : "-");
      }
    }
  }
  check(output, true);
  return output;
}
