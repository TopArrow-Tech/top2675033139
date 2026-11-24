import { describe, it, expect } from "vitest";
import { keepSmallerOriginal } from "../tools/extended/imagePolicy";
import { titleLines } from "../tools/extended/qr";
import { categories, ids } from "../app/registry";
describe("Image output selection", () => {
  const original = new Blob(["small"], { type: "image/png" });
  it("retains a smaller source without changing dimensions or format", () =>
    expect(
      keepSmallerOriginal(
        original,
        new Blob(["larger output"], { type: "image/png" }),
        { preserve: true, resized: false, cropped: false },
      ),
    ).toBe(true));
  it("keeps an actually smaller encoded result", () =>
    expect(
      keepSmallerOriginal(original, new Blob(["x"], { type: "image/png" }), {
        preserve: true,
        resized: false,
        cropped: false,
      }),
    ).toBe(false));
  it.each([
    { preserve: false, resized: false, cropped: false },
    { preserve: true, resized: true, cropped: false },
    { preserve: true, resized: false, cropped: true },
  ])("honors explicit modifications", (o) =>
    expect(
      keepSmallerOriginal(
        original,
        new Blob(["larger output"], { type: "image/png" }),
        o,
      ),
    ).toBe(false),
  );
  it("does not undo a format conversion", () =>
    expect(
      keepSmallerOriginal(
        original,
        new Blob(["larger output"], { type: "image/webp" }),
        { preserve: true, resized: false, cropped: false },
      ),
    ).toBe(false));
});
describe("QR title wrapping", () => {
  it("wraps text and preserves Unicode codepoints", () =>
    expect(titleLines("你好👋标题", 3, (t) => [...t].length)).toEqual([
      "你好👋",
      "标题",
    ]));
  it("honors explicit line breaks", () =>
    expect(titleLines("Title\nSubtitle", 100, (t) => t.length)).toEqual([
      "Title",
      "Subtitle",
    ]));
  it("omits empty titles", () =>
    expect(titleLines("   ", 10, (t) => t.length)).toEqual([]));
});
it("the catalogue covers every registered tool exactly once", () => {
  const entries = categories.flatMap((c) => c.ids);
  expect(entries.length).toBe(ids.length);
  expect(new Set(entries)).toEqual(new Set(ids));
});

import { normalizeIntegerDraft } from "../components/numberDraft";
describe("Editable number drafts", () => {
  it("allows deleting all digits without forcing zero", () =>
    expect(normalizeIntegerDraft("")).toBe(""));
  it.each([
    ["050", "50"],
    ["00050", "50"],
    ["0", "0"],
    ["00", "0"],
    ["1920", "1920"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeIntegerDraft(input)).toBe(expected),
  );
  it.each(["-1", "1.5", "1e2", "abc"])(
    "rejects non-integer notation %s",
    (input) => expect(normalizeIntegerDraft(input)).toBe(null),
  );
});
