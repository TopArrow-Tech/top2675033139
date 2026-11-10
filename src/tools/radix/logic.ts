import { ToolError, check } from "../shared";
export function convertRadix(text: string, base: number) {
  check(text);
  if (![2, 8, 10, 16].includes(base)) throw new ToolError("invalidRadix");
  const digits = text.trim();
  if (digits.length > 10000) throw new ToolError("tooLarge");
  const pattern =
    base === 2
      ? /^-?[01]+$/
      : base === 8
        ? /^-?[0-7]+$/
        : base === 10
          ? /^-?\d+$/
          : /^-?[0-9a-f]+$/i;
  if (!pattern.test(digits)) throw new ToolError("invalidRadix");
  const negative = digits.startsWith("-");
  const raw = negative ? digits.slice(1) : digits;
  let value = BigInt(
    (base === 2 ? "0b" : base === 8 ? "0o" : base === 16 ? "0x" : "") + raw,
  );
  if (negative) value = -value;
  return Object.fromEntries(
    [2, 8, 10, 16].map((b) => [String(b), value.toString(b)]),
  );
}
