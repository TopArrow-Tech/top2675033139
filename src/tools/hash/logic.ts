import { ToolError } from "../shared";
export async function digest(bytes: Uint8Array, algorithm: string) {
  if (!["SHA-256", "SHA-384", "SHA-512"].includes(algorithm))
    throw new ToolError("invalidAlgorithm");
  if (!globalThis.crypto?.subtle) throw new ToolError("cryptoUnavailable");
  const result = await crypto.subtle.digest(
    algorithm,
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(result), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
