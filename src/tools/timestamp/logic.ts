import { check, ToolError } from "../shared";
import { Temporal } from "@js-temporal/polyfill";
export function timestampToDate(text: string, unit: string, zone: string) {
  check(text);
  try {
    if (!/^-?\d+$/.test(text.trim())) throw Error();
    const value = BigInt(text.trim()) * (unit === "seconds" ? 1000n : 1n);
    if (value > 8640000000000000n || value < -8640000000000000n) throw Error();
    return dateResult(
      Temporal.Instant.fromEpochMilliseconds(Number(value)),
      zone,
    );
  } catch {
    throw new ToolError("invalidDate");
  }
}
export function dateToTimestamp(text: string, zone: string) {
  check(text);
  try {
    let instant: Temporal.Instant;
    if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim()))
      instant = Temporal.Instant.from(text.trim());
    else {
      const plain = Temporal.PlainDateTime.from(text.trim().replace(" ", "T"), {
        overflow: "reject",
      });
      instant = plain
        .toZonedDateTime(zone, { disambiguation: "reject" })
        .toInstant();
    }
    return dateResult(instant, zone);
  } catch {
    throw new ToolError("invalidDate");
  }
}
export function dateResult(instant: Temporal.Instant, zone: string) {
  const ms = instant.epochMilliseconds;
  return {
    formatted: instant
      .toZonedDateTimeISO(zone)
      .toPlainDateTime()
      .toString({ smallestUnit: "second" })
      .replace("T", " "),
    date: instant.toZonedDateTimeISO(zone).toString(),
    local: instant
      .toZonedDateTimeISO(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .toString(),
    iso: instant.toString({ smallestUnit: "millisecond" }),
    seconds: String(Math.floor(ms / 1000)),
    milliseconds: String(ms),
  };
}
