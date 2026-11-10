import { describe, it, expect } from "vitest";
import { DATE_MASK, dateMask, editDateMask } from "../tools/timestamp/mask";
import { clampSplit, pointerSplit } from "../editor/split";
import { dateToTimestamp } from "../tools/timestamp/logic";
describe("Fixed date string", () => {
  it("shows separators before any digits are entered", () =>
    expect(dateMask("")).toBe("____-__-__ __:__:__"));
  it("inserts separators while typing only numbers", () => {
    let value = "",
      caret = 0;
    for (const digit of "20261123222222") {
      const next = editDateMask(value, caret, caret, digit);
      value = next.value;
      caret = next.caret;
    }
    expect(value).toBe("2026-11-23 22:22:22");
    expect(dateToTimestamp(value, "Asia/Shanghai").seconds).toBe("1795443742");
  });
  it("keeps separator positions when deleting or replacing a range", () => {
    expect(editDateMask("2026-11-23 22:22:22", 5, 7, "09").value).toBe(
      "2026-09-23 22:22:22",
    );
    expect(
      editDateMask("2026-11-23 22:22:22", 8, 8, "", "backward").value,
    ).toBe("2026-1_-23 22:22:22");
  });
  it("clears only digits on select-all delete", () => {
    const next = editDateMask("2026-11-23 22:22:22", 0, 19, "", "forward");
    expect(next.value).toBe("");
    expect(dateMask(next.value)).toBe(DATE_MASK);
  });
  it("formats pasted digits and slash dates", () => {
    expect(dateMask("20261123222222")).toBe("2026-11-23 22:22:22");
    expect(dateMask("2026/11/23 22:22:22")).toBe("2026-11-23 22:22:22");
  });
  it("preserves explicit ISO offsets until editing fields", () =>
    expect(dateMask("2025-01-01T08:00:00+08:00")).toBe(
      "2025-01-01T08:00:00+08:00",
    ));
  it("does not silently repair invalid dates", () =>
    expect(() =>
      dateToTimestamp(dateMask("2025-02-30 08:00:00"), "UTC"),
    ).toThrow("invalidDate"));
});
describe("Editor split bounds", () => {
  it("maps mouse coordinates to the panel ratio", () =>
    expect(pointerSplit(350, 100, 1000)).toBe(25));
  it("keeps both panels visible at each drag boundary", () => {
    expect(pointerSplit(-100, 0, 1000)).toBe(20);
    expect(pointerSplit(1200, 0, 1000)).toBe(80);
  });
  it("handles collapsed bounds and invalid values", () => {
    expect(pointerSplit(0, 0, 0)).toBe(50);
    expect(clampSplit(NaN)).toBe(50);
  });
});
