import { format, mysql, postgresql, sqlite, sql } from "sql-formatter";
// sql-formatter 15.9.0 is pinned: its lexer is reused for safe whitespace compaction.
import { createDialect } from "../../../node_modules/sql-formatter/dist/esm/dialect.js";
import { check, ToolError } from "../shared";
const dialects = { mysql, postgresql, sqlite, sql };
export function sqlProcess(
  input: string,
  options: {
    dialect: keyof typeof dialects;
    keywordCase: "upper" | "lower" | "preserve";
    indent: number;
    action: string;
  },
) {
  check(input);
  if (!dialects[options.dialect]) throw new ToolError("invalidSql");
  try {
    if (options.action !== "minify")
      return format(input, {
        language: options.dialect,
        keywordCase: options.keywordCase,
        tabWidth: options.indent,
      });
    const tokens = createDialect(dialects[options.dialect]).tokenizer.tokenize(
      input,
      {},
    );
    let out = "";
    let previous = "";
    for (const token of tokens) {
      const gap = token.precedingWhitespace ?? "";
      const separator =
        previous === "LINE_COMMENT" ||
        (previous === "STRING" && token.type === "STRING" && /[\r\n]/.test(gap))
          ? "\n"
          : gap
            ? " "
            : "";
      let raw = token.raw;
      if (
        (token.type.startsWith("RESERVED") ||
          [
            "CASE",
            "END",
            "WHEN",
            "ELSE",
            "THEN",
            "LIMIT",
            "BETWEEN",
            "AND",
            "OR",
            "XOR",
          ].includes(token.type)) &&
        options.keywordCase !== "preserve"
      )
        raw =
          options.keywordCase === "upper"
            ? raw.toUpperCase()
            : raw.toLowerCase();
      out += (out ? separator : "") + raw;
      previous = token.type;
    }
    return out.trim();
  } catch {
    throw new ToolError("invalidSql");
  }
}
