import { describe, it, expect } from "vitest";
import {
  jsonProcess,
  encode64,
  decode64,
  urlProcess,
  parseQuery,
  buildQuery,
  timestampToDate,
  dateToTimestamp,
  check,
  MAX_BYTES,
} from "../tools/core";
import { zh, en } from "../locales";
describe("JSON", () => {
  it("formats nested objects and Unicode without losing large numbers", () => {
    const result = jsonProcess(
      '{"n":9007199254740993,"v":[true,null,"中文"],"d":1.234567890123456789}',
      "pretty",
      "  ",
    );
    expect(result).toContain("9007199254740993");
    expect(result).toContain("1.234567890123456789");
    expect(result).toContain("中文");
    expect(jsonProcess(result, "minify", "  ")).toBe(
      '{"n":9007199254740993,"v":[true,null,"中文"],"d":1.234567890123456789}',
    );
  });
  it.each(["null", "true", "0", '"你好"', "[1,2]"])(
    "accepts primitive and array %s",
    (s) => expect(() => jsonProcess(s, "pretty", "  ")).not.toThrow(),
  );
  it.each(['{"a":1,}', "// comment\n{}", "[1,]", "NaN", ""])(
    "rejects invalid JSON %s",
    (s) => expect(() => jsonProcess(s, "pretty", "  ")).toThrow(),
  );
  it("preserves special property names", () =>
    expect(
      jsonProcess('{"__proto__":{"x":1},"constructor":2}', "minify", "  "),
    ).toContain('"__proto__"'));
});
describe("Base64", () => {
  it("round trips Unicode", () => {
    const input = "你好 👋 café";
    expect(decode64(encode64(input))).toBe(input);
    expect(encode64("中文")).toBe("5Lit5paH");
  });
  it("supports URL-safe alphabet", () => {
    const text = "😀?";
    expect(decode64(encode64(text, true), true)).toBe(text);
  });
  it.each(["a", "a===", "!!!!", "Zh==", "Zg=", "Zg==\n", "AA-A"])(
    "rejects malformed standard input %s",
    (s) => expect(() => decode64(s)).toThrow("invalidBase64"),
  );
  it("rejects invalid UTF-8", () =>
    expect(() => decode64("/w==")).toThrow("invalidUtf8"));
  it("rejects lone surrogates", () =>
    expect(() => encode64("\uD800")).toThrow("invalidUtf8"));
});
describe("URL", () => {
  it("distinguishes full URI from components", () => {
    expect(urlProcess("https://a.test/?q=中文", "encode", true)).toBe(
      "https://a.test/?q=%E4%B8%AD%E6%96%87",
    );
    expect(urlProcess("/?", "encode")).toBe("%2F%3F");
  });
  it("retains duplicates, empty values, equals and plus rules", () => {
    const pairs = parseQuery(
      "https://x.test/?a=1&a=2&empty=&v=a%3Db&space=a+b&plus=%2B",
    );
    expect(pairs).toEqual([
      ["a", "1"],
      ["a", "2"],
      ["empty", ""],
      ["v", "a=b"],
      ["space", "a b"],
      ["plus", "+"],
    ]);
    expect(parseQuery(buildQuery(pairs))).toEqual(pairs);
  });
  it.each(["%", "%GG", "%FF"])("rejects malformed escapes %s", (s) => {
    expect(() => urlProcess(s, "decode")).toThrow("invalidUrl");
    expect(() => parseQuery("x=" + s)).toThrow("invalidUrl");
  });
});
describe("Time", () => {
  it("uses explicit seconds and milliseconds", () => {
    expect(
      timestampToDate("1735689600", "seconds", "Asia/Shanghai").date,
    ).toContain("2025-01-01T08:00:00+08:00");
    expect(timestampToDate("1735689600000", "milliseconds", "UTC").iso).toBe(
      "2025-01-01T00:00:00.000Z",
    );
  });
  it("interprets local date in selected timezone", () =>
    expect(
      dateToTimestamp("2025-01-01 08:00:00", "Asia/Shanghai").seconds,
    ).toBe("1735689600"));
  it("respects explicit offsets", () =>
    expect(dateToTimestamp("2025-01-01T08:00:00+08:00", "UTC").seconds).toBe(
      "1735689600",
    ));
  it.each(["2025-02-30 10:00:00", "2025-13-01 10:00:00", "foo"])(
    "rejects invalid dates %s",
    (s) => expect(() => dateToTimestamp(s, "UTC")).toThrow("invalidDate"),
  );
  it("rejects missing and ambiguous DST times", () => {
    expect(() =>
      dateToTimestamp("2025-03-09 02:30:00", "America/New_York"),
    ).toThrow("invalidDate");
    expect(() =>
      dateToTimestamp("2025-11-02 01:30:00", "America/New_York"),
    ).toThrow("invalidDate");
    expect(
      dateToTimestamp("2025-11-02T01:30:00-04:00", "America/New_York").iso,
    ).toBe("2025-11-02T05:30:00.000Z");
  });
  it("rejects invalid zone and out of range values", () => {
    expect(() => timestampToDate("1", "seconds", "no/zone")).toThrow();
    expect(() =>
      timestampToDate("9999999999999999999", "seconds", "UTC"),
    ).toThrow();
  });
  it("supports negative timestamps", () =>
    expect(timestampToDate("-1", "milliseconds", "UTC").seconds).toBe("-1"));
});
it("enforces a UTF-8 byte limit", () =>
  expect(() => check("中".repeat(Math.ceil(MAX_BYTES / 3)))).toThrow(
    "tooLarge",
  ));
it("has matching language keys", () =>
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort()));

it("encodes whitespace text without trimming", () => {
  expect(encode64(" ")).toBe("IA==");
  expect(urlProcess(" ", "encode")).toBe("%20");
});
it("rejects lone surrogates in edited query values", () =>
  expect(() => buildQuery([["x", "\uD800"]])).toThrow("invalidUrl"));
it("limits query row count", () =>
  expect(() => parseQuery("x=1&".repeat(1001))).toThrow("tooManyParameters"));

// Native date/time fields must display the chosen timezone, not silently shift to UTC.
import { dateTimeInputValue } from "../tools/timestamp/input";
describe("Date input display", () => {
  it("keeps a timezone-local selection unchanged", () =>
    expect(dateTimeInputValue("2025-01-01 08:00:00", "Asia/Shanghai")).toBe(
      "2025-01-01T08:00:00",
    ));
  it("displays current or pasted ISO in the selected zone", () =>
    expect(
      dateTimeInputValue("2025-01-01T00:00:00.000Z", "Asia/Shanghai"),
    ).toBe("2025-01-01T08:00:00"));
  it("uses the correct daylight-saving offset", () =>
    expect(dateTimeInputValue("2025-07-01T00:00:00Z", "America/New_York")).toBe(
      "2025-06-30T20:00:00",
    ));
  it("handles empty input and invalid zones", () => {
    expect(dateTimeInputValue("", "UTC")).toBe("");
    expect(dateTimeInputValue("2025-01-01T00:00:00Z", "bad/zone")).toBe("");
  });
});

import { normalizeDateInput } from "../tools/timestamp/input";
it("normalizes pasted slash dates without changing ISO offsets", () => {
  expect(normalizeDateInput(" 2025/01/01 08:00:00 ")).toBe(
    "2025-01-01 08:00:00",
  );
  expect(normalizeDateInput("2025-01-01T08:00:00+08:00")).toBe(
    "2025-01-01T08:00:00+08:00",
  );
  expect(() =>
    dateToTimestamp(normalizeDateInput("2025/02/30 08:00:00"), "UTC"),
  ).toThrow("invalidDate");
});
