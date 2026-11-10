export class ToolError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export const MAX_BYTES = 2 * 1024 * 1024;
export function check(text: string, allowEmpty = false) {
  if (!allowEmpty && !text.length) throw new ToolError("empty");
  if (new TextEncoder().encode(text).length > MAX_BYTES)
    throw new ToolError("tooLarge");
}
