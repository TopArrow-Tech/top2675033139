import { CronExpressionParser } from "cron-parser";
import { check, ToolError } from "../shared";
export function cronPreview(input: string, zone: string, start: string) {
  check(input);
  const fields = input.trim().split(/\s+/);
  if (fields.length !== 5 || fields.some((f) => /[^\dA-Za-z*,/\-]/.test(f)))
    throw new ToolError("invalidCron");
  // Only standard names and ranges/lists/steps; reject extensions such as Quartz L/W/# and hashed H.
  const names =
    "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC SUN MON TUE WED THU FRI SAT".split(
      " ",
    );
  for (const f of fields)
    for (const word of f.match(/[a-z]+/gi) ?? [])
      if (!names.includes(word.toUpperCase()))
        throw new ToolError("invalidCron");
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(start)) throw Error();
    const date = new Date(start);
    if (!Number.isFinite(date.getTime())) throw Error();
    const expression = CronExpressionParser.parse(input, {
      tz: zone,
      currentDate: start,
    });
    const result = [];
    for (let i = 0; i < 10; i++) {
      const next = expression.next().toDate();
      result.push({
        iso: next.toISOString(),
        local: new Intl.DateTimeFormat("sv-SE", {
          timeZone: zone,
          dateStyle: "short",
          timeStyle: "long",
          hourCycle: "h23",
        }).format(next),
      });
    }
    return result;
  } catch {
    throw new ToolError("invalidCron");
  }
}
