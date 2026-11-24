import { textProcess } from "../tools/extended/logic";
import { ToolError } from "../tools/shared";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      output: textProcess(data.id, data.input, data.options),
    });
  } catch (e) {
    self.postMessage({
      error: e instanceof ToolError ? e.code : "invalidInput",
    });
  }
};
