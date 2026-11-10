import { jsonProcess } from "../json/logic";
import { decode64 } from "../base64/logic";
import { check, ToolError } from "../shared";
export function parseJwt(text: string, now = Date.now()) {
  check(text);
  const parts = text.trim().split(".");
  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !/^[-_a-zA-Z0-9]*$/.test(parts[2])
  )
    throw new ToolError("invalidJwt");
  try {
    const header = JSON.parse(decode64(parts[0], true)),
      payload = JSON.parse(decode64(parts[1], true));
    if (
      !header ||
      Array.isArray(header) ||
      typeof header !== "object" ||
      !payload ||
      Array.isArray(payload) ||
      typeof payload !== "object"
    )
      throw Error();
    const claims: Record<string, { value: unknown; date: string | null }> = {};
    for (const key of ["exp", "iat", "nbf"]) {
      if (payload[key] !== undefined) {
        const value = payload[key];
        claims[key] = {
          value,
          date:
            typeof value === "number" &&
            Number.isFinite(value) &&
            Math.abs(value * 1000) <= 8640000000000000
              ? new Date(value * 1000).toISOString()
              : null,
        };
      }
    }
    return {
      header,
      payload,
      headerText: jsonProcess(decode64(parts[0], true), "pretty", "  "),
      payloadText: jsonProcess(decode64(parts[1], true), "pretty", "  "),
      signature: parts[2],
      claims,
      expired: typeof payload.exp === "number" && now / 1000 >= payload.exp,
      notYet: typeof payload.nbf === "number" && now / 1000 < payload.nbf,
    };
  } catch {
    throw new ToolError("invalidJwt");
  }
}
