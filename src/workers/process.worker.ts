import { ToolError } from "../tools/shared";
self.onmessage = async ({ data }) => {
  try {
    let output = "";
    if (data.tool === "json") {
      const { jsonProcess } = await import("../tools/json/logic");
      output = jsonProcess(data.input, data.action, data.indent);
    }
    if (data.tool === "base64") {
      const { encode64, decode64 } = await import("../tools/base64/logic");
      output =
        data.action === "decode"
          ? decode64(data.input, data.safe)
          : encode64(data.input, data.safe);
    }
    if (data.tool === "url") {
      const { urlProcess } = await import("../tools/url/logic");
      output = urlProcess(data.input, data.action, data.full);
    }
    if (data.tool === "timestamp") {
      const { timestampToDate, dateToTimestamp } =
        await import("../tools/timestamp/logic");
      const result =
        data.direction === "toDate"
          ? timestampToDate(data.input, data.unit, data.zone)
          : dateToTimestamp(data.input, data.zone);
      output = JSON.stringify(result, null, 2);
    }
    self.postMessage({ output });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof ToolError,
    });
  }
};
