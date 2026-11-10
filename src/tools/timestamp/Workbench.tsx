import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Copy, Play, Pause, RefreshCw } from "lucide-react";
import MaskedDateInput from "./MaskedDateInput";
import DateInput from "./DateInput";
import { dateTimeInputValue, normalizeDateInput } from "./input";
import { ToolError, check } from "../shared";
import type { Key } from "../../locales";
import type { dateResult } from "./logic";
const errorKeys = new Set([
  "empty",
  "tooLarge",
  "timeout",
  "invalidDate",
  "loadError",
  "unknownError",
]);
type Result = ReturnType<typeof dateResult>;
type Row = "timestamp" | "text" | "segments";
type Unit = "seconds" | "milliseconds";
export type TimestampState = {
  dateText: string;
  segments: string;
  units: Record<Row, Unit>;
  results: Partial<Record<Row, Result>>;
  errors: Partial<Record<Row, string>>;
  last?: Result;
};
const initial = (): TimestampState => ({
  dateText: "",
  segments: "",
  units: { timestamp: "seconds", text: "seconds", segments: "seconds" },
  results: {},
  errors: {},
});
type Props = {
  input: string;
  state?: TimestampState;
  onInput: (text: string) => void;
  onState: (state: TimestampState) => void;
  onOutput: (text: string) => void;
  zone: string;
  onZone: (zone: string) => void;
  t: (key: Key) => string;
  copy: (text: string) => void;
  runner: MutableRefObject<(() => void) | null>;
};
export default function TimestampWorkbench(p: Props) {
  const { t, zone, input } = p;
  const state = p.state ?? initial();
  const [now, setNow] = useState(Date.now()),
    [running, setRunning] = useState(true),
    [busy, setBusy] = useState<Row | null>(null);
  const active = useRef<Row>("timestamp"),
    worker = useRef<Worker | null>(null),
    version = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout>>();
  function stop() {
    version.current++;
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(null);
  }
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(
    () => () => {
      version.current++;
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    p.runner.current = () => run(active.current);
    return () => {
      p.runner.current = null;
    };
  });
  function change(row: Row, text: string) {
    stop();
    if (row === "timestamp") p.onInput(text);
    p.onState({
      ...state,
      ...(row === "text"
        ? { dateText: text }
        : row === "segments"
          ? { segments: text }
          : {}),
      last: undefined,
      results: { ...state.results, [row]: undefined },
      errors: { ...state.errors, [row]: undefined },
    });
    p.onOutput("");
  }
  function unit(row: Row, value: Unit) {
    stop();
    p.onState({
      ...state,
      units: { ...state.units, [row]: value },
      ...(row === "timestamp"
        ? {
            last: undefined,
            results: { ...state.results, timestamp: undefined },
          }
        : {}),
    });
    p.onOutput(
      row !== "timestamp" && state.last
        ? JSON.stringify(state.last, null, 2)
        : "",
    );
  }
  function run(row: Row) {
    stop();
    active.current = row;
    const current = version.current;
    const text =
      row === "timestamp"
        ? input
        : row === "text"
          ? state.dateText
          : state.segments;
    const normalized = row === "timestamp" ? text : normalizeDateInput(text);
    const finish = (result?: Result, error?: string) => {
      if (current !== version.current) return;
      p.onState({
        ...state,
        results: { ...state.results, [row]: result },
        errors: { ...state.errors, [row]: error },
        last: result,
      });
      p.onOutput(result ? JSON.stringify(result, null, 2) : "");
      stop();
    };
    try {
      check(normalized);
      setBusy(row);
      const w = new Worker(
        new URL("../../workers/process.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (data.error) finish(undefined, data.error);
        else {
          try {
            finish(JSON.parse(data.output));
          } catch {
            finish(undefined, "unknownError");
          }
        }
      };
      w.onerror = () => finish(undefined, "loadError");
      timer.current = setTimeout(() => finish(undefined, "timeout"), 8000);
      w.postMessage({
        tool: "timestamp",
        input: normalized,
        direction: row === "timestamp" ? "toDate" : "toTimestamp",
        unit: state.units.timestamp,
        zone,
      });
    } catch (e) {
      finish(undefined, e instanceof ToolError ? e.code : "invalidDate");
    }
  }
  const units = (row: Row) => (
    <div
      className="segmented timestamp-units"
      role="group"
      aria-label={
        t("unit") +
        " · " +
        t(
          row === "timestamp"
            ? "timestampLabel"
            : row === "text"
              ? "dateString"
              : "dateParts",
        )
      }
    >
      {(["seconds", "milliseconds"] as const).map((value) => (
        <button
          type="button"
          key={value}
          aria-pressed={state.units[row] === value}
          aria-label={t(value)}
          title={t(value)}
          onClick={() => unit(row, value)}
        >
          {t(value === "seconds" ? "secondsShort" : "millisecondsShort")}
        </button>
      ))}
    </div>
  );
  const resultText = (row: Row) => {
    const result = state.results[row];
    return result
      ? row === "timestamp"
        ? result.formatted
        : result[state.units[row]]
      : "";
  };
  const result = (row: Row) => (
    <>
      <input
        className="timestamp-output"
        readOnly
        aria-label={
          t("output") +
          " · " +
          t(
            row === "timestamp"
              ? "timestampLabel"
              : row === "text"
                ? "dateString"
                : "dateParts",
          )
        }
        value={resultText(row)}
        title={resultText(row)}
        placeholder="—"
      />
      <button
        type="button"
        className="icon-button"
        title={t("copy")}
        disabled={!resultText(row)}
        onClick={() => p.copy(resultText(row))}
      >
        <Copy size={14} />
      </button>
    </>
  );
  const error = (row: Row) =>
    state.errors[row] && (
      <div className="timestamp-row-error" role="alert">
        {errorKeys.has(state.errors[row]!)
          ? t(state.errors[row] as Key)
          : state.errors[row]}
      </div>
    );
  function example() {
    stop();
    p.onInput("1735689600");
    p.onState({
      ...initial(),
      dateText: "2025-01-01 08:00:00",
      segments: "2025-01-01T08:00:00",
    });
    p.onOutput("");
  }
  return (
    <div className="timestamp-workbench">
      <div className="timestamp-current">
        <span>{t("currentUnix")}</span>
        <output>{Math.floor(now / 1000)}</output>
        <button
          disabled={running}
          onClick={() => {
            setNow(Date.now());
            setRunning(true);
          }}
        >
          <Play size={13} />
          {t("startClock")}
        </button>
        <button disabled={!running} onClick={() => setRunning(false)}>
          <Pause size={13} />
          {t("stopClock")}
        </button>
        <button onClick={() => setNow(Date.now())}>
          <RefreshCw size={13} />
          {t("refreshClock")}
        </button>
        <span className="timestamp-clock-date">
          {new Date(now).toLocaleTimeString(undefined, { hour12: false })}
        </span>
      </div>
      <div className="timestamp-settings">
        <label>
          {t("zone")}
          <input
            className="zone-input"
            list="timestamp-zones"
            value={zone}
            onChange={(e) => {
              stop();
              p.onZone(e.target.value);
              p.onState({ ...state, results: {}, errors: {}, last: undefined });
              p.onOutput("");
            }}
          />
        </label>
        <datalist id="timestamp-zones">
          {[
            "Asia/Shanghai",
            "UTC",
            "America/New_York",
            "Europe/London",
            "Asia/Tokyo",
            "Europe/Berlin",
            "Australia/Sydney",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </datalist>
        <span>{t("timestampZoneHint")}</span>
        <div>
          <button onClick={example}>{t("example")}</button>
          <button
            onClick={() => {
              stop();
              p.onInput("");
              p.onState(initial());
              p.onOutput("");
            }}
          >
            {t("clear")}
          </button>
        </div>
      </div>
      <section className="timestamp-conversions" aria-label={t("timestamp")}>
        <div
          className="timestamp-conversion-row"
          onFocusCapture={() => {
            active.current = "timestamp";
          }}
        >
          <label htmlFor="unix-input">{t("timestampLabel")}</label>
          <input
            className="timestamp-source"
            id="unix-input"
            value={input}
            inputMode="numeric"
            placeholder="1735689600"
            onChange={(e) => change("timestamp", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                run("timestamp");
              }
            }}
          />
          {units("timestamp")}
          <button
            className="primary"
            disabled={busy === "timestamp"}
            onClick={() => run("timestamp")}
          >
            {t("toDateShort")}
          </button>

          {result("timestamp")}
          {error("timestamp")}
        </div>
        <div
          className="timestamp-conversion-row date-text-row"
          onFocusCapture={() => {
            active.current = "text";
          }}
        >
          <span className="timestamp-row-label">{t("dateString")}</span>
          <MaskedDateInput
            id="date-text-input"
            value={dateTimeInputValue(state.dateText, zone)}
            t={t}
            onChange={(text) => change("text", text)}
            onEnter={() => run("text")}
          />
          {units("text")}
          <button
            className="primary"
            disabled={busy === "text"}
            onClick={() => run("text")}
          >
            {t("toUnixShort")}
          </button>
          {result("text")}

          {error("text")}
        </div>
        <div
          className="timestamp-conversion-row date-parts-row"
          onFocusCapture={() => {
            active.current = "segments";
          }}
        >
          <span className="timestamp-row-label">{t("dateParts")}</span>
          <DateInput
            value={dateTimeInputValue(state.segments, zone)}
            onChange={(text) => change("segments", text)}
            t={t}
          />
          {units("segments")}
          <button
            className="primary"
            disabled={busy === "segments"}
            onClick={() => run("segments")}
          >
            {t("toUnixShort")}
          </button>
          {result("segments")}

          {error("segments")}
        </div>
      </section>
      {state.last && (
        <details className="timestamp-result-details">
          <summary>{t("conversionDetails")} · UTC / ISO 8601</summary>
          <section
            className="timestamp-inspector"
            aria-label={t("conversionDetails")}
          >
            {(["date", "iso", "local", "seconds", "milliseconds"] as const).map(
              (key) => (
                <div key={key}>
                  <label>
                    {t(
                      (
                        {
                          date: "resultDate",
                          iso: "utc",
                          local: "localDate",
                          seconds: "seconds",
                          milliseconds: "milliseconds",
                        } as const
                      )[key],
                    )}
                  </label>
                  <code>{state.last![key]}</code>
                  <button
                    className="icon-button"
                    title={t("copy")}
                    onClick={() => p.copy(state.last![key])}
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ),
            )}
          </section>
        </details>
      )}
      <p className="tool-hint">{t("dateHint")}</p>
    </div>
  );
}
