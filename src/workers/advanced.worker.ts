import { ToolError } from "../tools/shared";
self.onmessage = async ({ data }) => {
  try {
    let result: unknown;
    const { id, input, options: o } = data;
    switch (id) {
      case "sql":
        result = (await import("../tools/sql/logic")).sqlProcess(input, o);
        break;
      case "jwt":
        result = (await import("../tools/jwt/logic")).parseJwt(input);
        break;
      case "regex":
        result = (await import("../tools/regex/logic")).regexTest(
          o.pattern,
          o.flags,
          input,
          o.replacement,
        );
        break;
      case "diff":
        result = (await import("../tools/diff/logic")).compareText(
          input,
          o.second,
          o.ignoreWhitespace,
        );
        break;
      case "hash":
        result = await (
          await import("../tools/hash/logic")
        ).digest(data.bytes ?? new TextEncoder().encode(input), o.algorithm);
        break;
      case "uuid":
        result =
          o.action === "check"
            ? (await import("../tools/uuid/logic")).checkUuids(input)
            : (await import("../tools/uuid/logic")).generateUuids(o.count);
        break;
      case "cron":
        result = (await import("../tools/cron/logic")).cronPreview(
          input,
          o.zone,
          o.start,
        );
        break;
      case "radix":
        result = (await import("../tools/radix/logic")).convertRadix(
          input,
          o.base,
        );
        break;
    }
    self.postMessage({ result });
  } catch (e) {
    self.postMessage({
      error:
        e instanceof ToolError
          ? e.code
          : e instanceof Error
            ? e.message
            : "unknownError",
      code: e instanceof ToolError,
    });
  }
};
