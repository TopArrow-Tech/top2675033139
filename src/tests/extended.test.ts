import { describe, expect, it } from "vitest";
import {
  textProcess,
  parseCsv,
  toCsv,
  passwords,
  colorConvert,
} from "../tools/extended/logic";
import { extractLines, wordBlob } from "../tools/extended/pdfText";
import { unzipSync, strFromU8 } from "fflate";
import { ids, validIds } from "../app/registry";
const run = (id: string, input: string, action: string) =>
  textProcess(id, input, { action });
describe("Extended text tools", () => {
  it("deduplicates without losing Unicode or line content", () =>
    expect(run("textkit", "你好\nhello\n你好", "uniqueLines")).toBe(
      "你好\nhello",
    ));
  it.each([
    ["camelText", "helloWorld"],
    ["snakeText", "hello_world"],
    ["kebabText", "hello-world"],
  ])("changes naming %s", (action, result) =>
    expect(run("textkit", "Hello World", action)).toBe(result),
  );
  it("counts Unicode codepoints and UTF-8 bytes", () =>
    expect(JSON.parse(run("textkit", "你好👋", "textStats"))).toMatchObject({
      characters: 3,
      utf8Bytes: 10,
    }));
  it("round trips Unicode including emoji", () => {
    const text = "中文\n👋";
    expect(
      run("unicode", run("unicode", text, "unicodeEncode"), "unicodeDecode"),
    ).toBe(text);
    expect(run("unicode", "\\u{1f600}", "unicodeDecode")).toBe("😀");
  });
  it("round trips HTML and decodes named entities", () => {
    const text = '<div title="你好">&</div>';
    expect(
      run("htmlentity", run("htmlentity", text, "htmlEncode"), "htmlDecode"),
    ).toBe(text);
    expect(run("htmlentity", "&copy;&#x1f600;&nbsp;", "htmlDecode")).toBe(
      "©😀 ",
    );
  });
  it("round trips CSV quotes, commas, newlines and Unicode", () => {
    const rows = [
      { name: 'hello,"world"', value: "你好\r\n🙂" },
      { name: "", value: "" },
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it.each(["a,a\n1,2", "a,b\n1", 'a\n"unterminated', 'a\n"ok"bad'])(
    "rejects malformed CSV %s",
    (text) => expect(() => parseCsv(text)).toThrow(),
  );
  it("preserves dangerous property names as own CSV values", () => {
    const result = parseCsv("__proto__,constructor\nvalue,other")[0];
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toBe("value");
  });
  it("round trips YAML and rejects unsafe numeric IDs", () => {
    const input = '{"name":"开发者","ok":true,"items":[1,null]}';
    expect(
      JSON.parse(
        run("dataconvert", run("dataconvert", input, "jsonYaml"), "yamlJson"),
      ),
    ).toEqual(JSON.parse(input));
    expect(() =>
      run("dataconvert", '{"id":9007199254740993}', "jsonYaml"),
    ).toThrow("unsafeNumber");
  });
  it("rejects arbitrary YAML types and cyclic aliases", () => {
    expect(() =>
      run("dataconvert", "!!js/function > function() {}", "yamlJson"),
    ).toThrow();
    expect(() => run("dataconvert", "&a [*a]", "yamlJson")).toThrow();
  });
  it("does not mutate formula-like CSV values", () =>
    expect(parseCsv("cell\n=1+1")[0].cell).toBe("=1+1"));
  it("calculates RGB, HSL and contrast", () => {
    expect(colorConvert("#fff")).toMatchObject({
      hex: "#ffffff",
      contrastBlack: 21,
      contrastWhite: 1,
    });
    expect(colorConvert("hsl(120, 100%, 50%)").hex).toBe("#00ff00");
    expect(colorConvert("rgba(255, 0, 0, 0.5)").contrastBlack).toBe(null);
    expect(() => colorConvert("rgb(999,0,0)")).toThrow();
  });
  it("passwords honor length and all selected sets", () => {
    const values = passwords({
      action: "",
      length: 20,
      count: 20,
      upper: true,
      lower: true,
      digits: true,
      symbols: true,
      avoid: true,
    }).split("\n");
    expect(new Set(values).size).toBe(20);
    for (const value of values) {
      expect(value).toHaveLength(20);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[2-9]/);
      expect(value).toMatch(/[^a-z0-9]/i);
      expect(value).not.toMatch(/[Il1O0o]/);
    }
  });
  it("rejects no character set or invalid count", () => {
    expect(() => passwords({ action: "", length: 20, count: 1 })).toThrow();
    expect(() =>
      passwords({ action: "", length: 1, count: 1, upper: true }),
    ).toThrow();
  });
  it("keeps all 22 valid tool IDs", () => {
    expect(ids).toHaveLength(22);
    expect(validIds([...ids, "unknown", ids[0]])).toHaveLength(22);
  });
});
describe("PDF text export", () => {
  it("groups text lines and ignores non-text records", () => {
    const item = (str: string, x: number, y: number, eol = false) => ({
      str,
      transform: [1, 0, 0, 1, x, y],
      height: 12,
      width: str.length * 6,
      hasEOL: eol,
    });
    expect(
      extractLines([
        item("Hello", 0, 100),
        {},
        item("World", 40, 100, true),
        item("中文", 0, 70),
      ]),
    ).toEqual(["Hello World", "中文"]);
  });
  it("creates a Word archive with Unicode and page breaks", async () => {
    const blob = await wordBlob(
      [["Hello 开发者"], ["Second page"], []],
      "No text",
      "sample.pdf",
    );
    const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(zip["word/document.xml"]);
    expect(xml).toContain("Hello 开发者");
    expect(xml).toContain("Second page");
    expect(xml).toContain("No text");
    expect(xml).toContain("pageBreakBefore");
    expect(zip["[Content_Types].xml"]).toBeDefined();
  });
});

it("rejects malformed Unicode escapes", () => {
  for (const value of ["\\uXYZ", "\\u{110000}"])
    expect(() => runUnicode(value)).toThrow();
});
function runUnicode(input: string) {
  return textProcess("unicode", input, { action: "unicodeDecode" });
}
