import { describe, it, expect } from "vitest";
import { sqlProcess } from "../tools/sql/logic";
import { parseJwt } from "../tools/jwt/logic";
import { regexTest } from "../tools/regex/logic";
import { compareText } from "../tools/diff/logic";
import { digest } from "../tools/hash/logic";
import { generateUuids, checkUuids } from "../tools/uuid/logic";
import { cronPreview } from "../tools/cron/logic";
import { convertRadix } from "../tools/radix/logic";
import { encode64 } from "../tools/base64/logic";
const sqlOptions = {
  dialect: "mysql" as const,
  keywordCase: "upper" as const,
  indent: 2,
  action: "pretty",
};
describe("SQL", () => {
  it.each(["mysql", "postgresql", "sqlite", "sql"] as const)(
    "formats %s",
    (dialect) => {
      const result = sqlProcess(
        "select u.id,count(o.id) from users u left join orders o on u.id=o.user_id where u.name='select 中文' group by u.id",
        { ...sqlOptions, dialect },
      );
      expect(result).toContain("SELECT");
      expect(result).toContain("'select 中文'");
      expect(result).toContain("LEFT JOIN");
    },
  );
  it("minifies safely across strings and line comments", () => {
    const out = sqlProcess(
      "select   'a  b' as x, 'it''s ok' as y -- retain\n from  t /* block  comment */ where x = 1",
      { ...sqlOptions, action: "minify" },
    );
    expect(out).toContain("'a  b'");
    expect(out).toContain("'it''s ok'");
    expect(out).toContain("-- retain\n");
    expect(out).toContain("/* block  comment */");
  });
  it("preserves PostgreSQL dollar quotes and newline-separated strings", () => {
    const s = "select $$a  -- b$$, 'a'\n'b'";
    const out = sqlProcess(s, {
      ...sqlOptions,
      dialect: "postgresql",
      action: "minify",
    });
    expect(out).toContain("$$a  -- b$$");
    expect(out).toContain("'a'\n'b'");
  });
  it("preserves SQLite quoted identifiers", () =>
    expect(
      sqlProcess('select "a  b" from t', {
        ...sqlOptions,
        dialect: "sqlite",
        action: "minify",
      }),
    ).toContain('"a  b"'));
});
describe("JWT", () => {
  const token = (payload: unknown) =>
    `${encode64('{"alg":"none"}', true)}.${encode64(JSON.stringify(payload), true)}.`;
  it("decodes Unicode claims and seconds-based times", () => {
    const r = parseJwt(
      token({ name: "中文", exp: 100, iat: 50, nbf: 20 }),
      100000,
    );
    expect(r.payload.name).toBe("中文");
    expect(r.expired).toBe(true);
    expect(r.claims.exp.date).toBe("1970-01-01T00:01:40.000Z");
  });
  it("does not trust string time claims", () =>
    expect(parseJwt(token({ exp: "100" })).claims.exp.date).toBe(null));
  it.each(["a.b", "a.b.c.d.e", "bad.bad.bad", "e30.W10."])(
    "rejects invalid tokens %s",
    (s) => expect(() => parseJwt(s)).toThrow("invalidJwt"),
  );
});
describe("Regex", () => {
  it("returns named captures, ranges and real replacements", () => {
    const r = regexTest("(?<n>\\d+)", "g", "订单 12 和 34", "[$1]");
    expect(r.matches.map((m) => m.text)).toEqual(["12", "34"]);
    expect(r.matches[0].named).toEqual({ n: "12" });
    expect(r.replaced).toBe("订单 [12] 和 [34]");
  });
  it("advances Unicode zero-length matches", () =>
    expect(
      regexTest("(?:)", "gu", "😀", "-").matches.map((m) => m.index),
    ).toEqual([0, 2]));
  it("handles non-global matches exactly once", () =>
    expect(regexTest("a", "", "aaa", "b").matches.length).toBe(1));
  it("rejects invalid flags and patterns", () => {
    expect(() => regexTest("[", "g", "x", "")).toThrow("invalidRegex");
    expect(() => regexTest("x", "gg", "x", "")).toThrow("invalidRegex");
  });
  it("caps match counts", () =>
    expect(() => regexTest("", "g", "x".repeat(2100), "")).toThrow(
      "matchLimit",
    ));
});
describe("Diff", () => {
  it("finds Chinese modifications and character differences", () => {
    const r = compareText("你好\n原文\n", "你好\n新文\n新增\n", false);
    expect(r.modified).toBe(1);
    expect(r.added).toBe(1);
    expect(r.rows[1].chars?.some((c) => c.added)).toBe(true);
    expect(r.patch).toContain("+新文");
  });
  it("finds deletions and preserves original data", () => {
    const a = "a\nb\n";
    const r = compareText(a, "a\n", false);
    expect(r.removed).toBe(1);
    expect(a).toBe("a\nb\n");
  });
  it("can ignore whitespace differences", () =>
    expect(compareText(" a \n", "a\n", true).modified).toBe(0));
  it("supports empty inputs", () =>
    expect(compareText("", "", false).rows).toEqual([]));
});
describe("Hash", () => {
  it("matches known SHA-256 text vector", async () =>
    expect(await digest(new TextEncoder().encode("abc"), "SHA-256")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ));
  it.each(["SHA-384", "SHA-512"])(
    "computes %s at expected length",
    async (algorithm) =>
      expect((await digest(new Uint8Array(), algorithm)).length).toBe(
        algorithm === "SHA-384" ? 96 : 128,
      ),
  );
  it("rejects unsupported algorithms", async () =>
    expect(digest(new Uint8Array(), "MD5")).rejects.toThrow(
      "invalidAlgorithm",
    ));
});
describe("UUID", () => {
  it("generates unique v4 identifiers with RFC variant bits", () => {
    const list = generateUuids(1000);
    expect(new Set(list).size).toBe(1000);
    expect(checkUuids(list.join("\n")).valid).toBe(true);
  });
  it.each([0, -1, 1.5, 1001])("rejects count %s", (count) =>
    expect(() => generateUuids(count)).toThrow("invalidCount"),
  );
  it("detects duplicates case-insensitively", () => {
    const u = generateUuids(1)[0];
    expect(checkUuids(`${u}\n${u.toUpperCase()}`).duplicates).toBe(1);
  });
});
describe("Cron", () => {
  it("previews ten executions with the selected timezone", () => {
    const r = cronPreview(
      "0 9 * * 1-5",
      "Asia/Shanghai",
      "2025-01-01T00:00:00Z",
    );
    expect(r.length).toBe(10);
    expect(r[0].iso).toBe("2025-01-01T01:00:00.000Z");
  });
  it("supports names and DST", () => {
    expect(
      cronPreview(
        "0 9 * JUL MON",
        "America/New_York",
        "2025-07-01T00:00:00Z",
      )[0].iso,
    ).toBe("2025-07-07T13:00:00.000Z");
  });
  it.each([
    "0 0 9 * * *",
    "0 9 ? * MON",
    "0 9 L * *",
    "H * * * *",
    "0 9 * * 1#2",
  ])("rejects unsupported dialect %s", (s) =>
    expect(() => cronPreview(s, "UTC", "2025-01-01T00:00:00Z")).toThrow(
      "invalidCron",
    ),
  );
  it("rejects invalid timezone", () =>
    expect(() =>
      cronPreview("* * * * *", "bad/zone", "2025-01-01T00:00:00Z"),
    ).toThrow("invalidCron"));
});
describe("Radix", () => {
  it("preserves large integers", () =>
    expect(convertRadix("9007199254740993", 10)["16"]).toBe("20000000000001"));
  it("supports mathematical negative values", () =>
    expect(convertRadix("-ff", 16)["10"]).toBe("-255"));
  it.each(["1.5", "0xff", "-", "2"])("rejects invalid binary input %s", (s) =>
    expect(() => convertRadix(s, 2)).toThrow("invalidRadix"),
  );
});

it("preserves large JWT payload numbers in display and transfer", () => {
  const payload = '{"id":9007199254740993}';
  const token = `${encode64('{"alg":"none"}', true)}.${encode64(payload, true)}.`;
  expect(parseJwt(token).payloadText).toContain("9007199254740993");
});
it("reports final-newline-only differences", () =>
  expect(compareText("a", "a\n", false).newlineChanged).toBe(true));
it("rejects runaway replacement expansion before allocation", () =>
  expect(() => regexTest("a", "g", "a".repeat(1900), "x".repeat(3000))).toThrow(
    "tooLarge",
  ));
it("uses standard Cron OR semantics for day and weekday", () =>
  expect(cronPreview("0 9 1 * MON", "UTC", "2025-01-02T00:00:00Z")[0].iso).toBe(
    "2025-01-06T09:00:00.000Z",
  ));
it("rejects a nonexistent Cron preview start date", () =>
  expect(() => cronPreview("* * * * *", "UTC", "2025-02-30T00:00:00Z")).toThrow(
    "invalidCron",
  ));
