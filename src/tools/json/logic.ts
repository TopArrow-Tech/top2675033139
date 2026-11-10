import { check } from "../shared";
import JSONBigFactory from "json-bigint";
// Preserve numeric tokens without converting them to IEEE-754; native JSON supplies strict syntax validation only.
const JSONBig = JSONBigFactory({
  alwaysParseAsBig: true,
  protoAction: "preserve",
  constructorAction: "preserve",
});
export function jsonProcess(text: string, action: string, indent: string) {
  check(text);
  JSON.parse(text);
  const value = JSONBig.parse(text);
  return JSONBig.stringify(
    value,
    null,
    action === "minify" ? undefined : indent,
  );
}
