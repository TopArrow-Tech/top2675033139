import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  Play,
  Copy,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { Key } from "../locales";
import { examples, type AdvancedId } from "../app/registry";
import { check, ToolError } from "./shared";
const Editor = lazy(() => import("../components/Editor"));
type Props = {
  id: AdvancedId;
  details: any;
  onDetails: (result: any) => void;
  input: string;
  second: string;
  output: string;
  onInput: (text: string) => void;
  onSecond: (text: string) => void;
  onOutput: (text: string) => void;
  onError: (text: string) => void;
  t: (key: Key) => string;
  theme: string;
  fontSize: number;
  copy: (text: string) => void;
  download: () => void;
  runner: MutableRefObject<(() => void) | null>;
};
export default function Workbench(p: Props) {
  const { id, input, second, output, t } = p;
  const [options, setOptions] = useState({
    dialect: "mysql",
    keywordCase: "upper",
    indent: 2,
    pattern: "#(?<id>\\d+)",
    flags: "g",
    replacement: "ID:$1",
    ignoreWhitespace: false,
    view: "side",
    algorithm: "SHA-256",
    count: 5,
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    start: new Date().toISOString(),
    base: 10,
    live: false,
  });
  const result = p.details;
  const setResult = p.onDetails;
  const [busy, setBusy] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [file, setFile] = useState<File | null>(null),
    [expanded, setExpanded] = useState<"input" | "output" | null>(null);
  const worker = useRef<Worker | null>(null),
    serial = useRef(0),
    timeout = useRef<ReturnType<typeof setTimeout>>();
  const opt = (patch: Partial<typeof options>) =>
    setOptions((prev) => ({ ...prev, ...patch }));
  function stop() {
    serial.current++;
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timeout.current);
    setBusy(false);
  }
  useEffect(() => {
    setExpanded(null);
    stop();
    return () => {
      serial.current++;
      worker.current?.terminate();
      clearTimeout(timeout.current);
    };
  }, [id]);
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(null);
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  async function run(action = "pretty") {
    stop();
    const version = serial.current;
    const start = performance.now();
    p.onError("");
    p.onOutput("");
    setResult(null);
    try {
      if (
        id !== "uuid" &&
        !(id === "hash" && file) &&
        id !== "diff" &&
        id !== "regex" &&
        id !== "hash"
      )
        check(input);
      else {
        check(input, true);
        if (id === "diff") check(second, true);
      }
      setBusy(true);
      let bytes: Uint8Array | undefined;
      if (id === "hash" && file) {
        if (file.size > 32 * 1024 * 1024) throw new ToolError("fileTooLarge");
        bytes = new Uint8Array(await file.arrayBuffer());
        if (version !== serial.current) return;
      }
      const w = new Worker(
        new URL("../workers/advanced.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      const fail = (message: string) => {
        if (version !== serial.current) return;
        p.onError(message);
        setElapsed(performance.now() - start);
        stop();
      };
      w.onerror = () => fail(t("loadError"));
      w.onmessage = ({ data }) => {
        if (version !== serial.current) return;
        if (data.error) {
          fail(data.code ? t(data.error as Key) : data.error);
          return;
        }
        setResult(data.result);
        const r = data.result;
        const text =
          typeof r === "string"
            ? r
            : id === "jwt"
              ? r.payloadText
              : id === "diff"
                ? r.patch
                : id === "regex"
                  ? r.replaced
                  : id === "uuid" && Array.isArray(r)
                    ? r.join("\n")
                    : JSON.stringify(r, null, 2);
        p.onOutput(text);
        setElapsed(performance.now() - start);
        stop();
      };
      timeout.current = setTimeout(
        () => fail(t("timeout")),
        id === "regex" ? 1500 : 8000,
      );
      w.postMessage({
        id,
        input,
        bytes,
        options: { ...options, second, action },
      });
    } catch (e) {
      if (version === serial.current) {
        p.onError(
          e instanceof ToolError
            ? t(e.code as Key)
            : e instanceof Error
              ? e.message
              : t("unknownError"),
        );
        stop();
      }
    }
  }
  useEffect(() => {
    p.runner.current = () => {
      void run();
    };
    return () => {
      p.runner.current = null;
    };
  });
  useEffect(() => {
    if (id !== "regex" || !options.live) return;
    const timer = setTimeout(() => void run(), 450);
    return () => clearTimeout(timer);
  }, [
    id,
    input,
    options.live,
    options.pattern,
    options.flags,
    options.replacement,
  ]);
  const edit = (
    value: string,
    onChange?: (text: string) => void,
    language = "plaintext",
  ) => (
    <Suspense fallback={<div className="empty">{t("editorLoading")}</div>}>
      <Editor
        value={value}
        onChange={onChange}
        readOnly={!onChange}
        language={language}
        theme={p.theme}
        fontSize={p.fontSize}
        loading={t("editorLoading")}
      />
    </Suspense>
  );
  const hint: Key = (
    {
      sql: "sqlHint",
      jwt: "jwtHint",
      regex: "regexHint",
      diff: "diffCopyHint",
      hash: "hashHint",
      uuid: "uuidDesc",
      cron: "cronHint",
      radix: "radixHint",
    } as const
  )[id];
  const optionLabel = (key: Key, control: ReactNode) => (
    <label>
      {t(key)}
      {control}
    </label>
  );
  const highlighted = () => {
    const nodes: ReactNode[] = [];
    let end = 0;
    for (const [i, m] of result.matches.entries()) {
      nodes.push(
        input.slice(end, m.index),
        <mark key={i}>{m.text || "¦"}</mark>,
      );
      end = m.end;
    }
    nodes.push(input.slice(end));
    return nodes;
  };
  return (
    <div
      className={`advanced-workbench ${id === "diff" ? "diff-workbench" : ""}`}
    >
      {id === "jwt" && (
        <div className="security-banner">
          <strong>{t("unverified")}</strong> · {t("jwtHint")}
        </div>
      )}
      <div className="tool-options advanced-options">
        {id === "sql" && (
          <>
            {optionLabel(
              "dialect",
              <select
                value={options.dialect}
                onChange={(e) => opt({ dialect: e.target.value })}
              >
                {["mysql", "postgresql", "sqlite", "sql"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>,
            )}
            {optionLabel(
              "keywordCase",
              <select
                value={options.keywordCase}
                onChange={(e) => opt({ keywordCase: e.target.value })}
              >
                {(["upper", "lower", "preserve"] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </select>,
            )}
            {optionLabel(
              "indent",
              <select
                value={options.indent}
                onChange={(e) => opt({ indent: Number(e.target.value) })}
              >
                <option>2</option>
                <option>4</option>
              </select>,
            )}
          </>
        )}
        {id === "regex" && (
          <>
            <label className="pattern-field">
              {t("pattern")}
              <input
                value={options.pattern}
                onChange={(e) => opt({ pattern: e.target.value })}
              />
            </label>
            {optionLabel(
              "flags",
              <input
                className="flags-input"
                value={options.flags}
                onChange={(e) => opt({ flags: e.target.value })}
              />,
            )}
            {optionLabel(
              "replacement",
              <input
                value={options.replacement}
                onChange={(e) => opt({ replacement: e.target.value })}
              />,
            )}
            <label>
              <input
                type="checkbox"
                checked={options.live}
                onChange={(e) => opt({ live: e.target.checked })}
              />
              {t("live")}
            </label>
          </>
        )}
        {id === "diff" && (
          <>
            <label>
              <input
                type="checkbox"
                checked={options.ignoreWhitespace}
                onChange={(e) => opt({ ignoreWhitespace: e.target.checked })}
              />
              {t("ignoreWhitespace")}
            </label>
            <div
              className="segmented"
              role="group"
              aria-label={t("outputMode")}
            >
              {(["side", "inline"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={options.view === v}
                  onClick={() => opt({ view: v })}
                >
                  {t(v === "side" ? "sideBySide" : "inline")}
                </button>
              ))}
            </div>
          </>
        )}
        {id === "hash" && (
          <>
            {optionLabel(
              "algorithm",
              <select
                value={options.algorithm}
                onChange={(e) => opt({ algorithm: e.target.value })}
              >
                {["SHA-256", "SHA-384", "SHA-512"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>,
            )}
            <label className="file-control">
              {t("file")}
              <input
                type="file"
                key={file?.name ?? "none"}
                onChange={(e) => {
                  stop();
                  setResult(null);
                  p.onOutput("");
                  p.onError("");
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 32 * 1024 * 1024) {
                    p.onError(t("fileTooLarge"));
                    setFile(null);
                    e.target.value = "";
                  } else setFile(f);
                }}
              />
              {file && (
                <span>
                  {file.name} · {file.size.toLocaleString()} {t("bytes")}
                </span>
              )}
            </label>
            {file && (
              <button
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  p.onOutput("");
                }}
              >
                {t("clearFile")}
              </button>
            )}
          </>
        )}
        {id === "uuid" &&
          optionLabel(
            "count",
            <input
              type="number"
              min={1}
              max={1000}
              value={options.count}
              onChange={(e) => opt({ count: Number(e.target.value) })}
            />,
          )}
        {id === "cron" && (
          <>
            {optionLabel(
              "zone",
              <input
                value={options.zone}
                onChange={(e) => opt({ zone: e.target.value })}
              />,
            )}
            {optionLabel(
              "startTime",
              <input
                value={options.start}
                onChange={(e) => opt({ start: e.target.value })}
              />,
            )}
            {optionLabel(
              "templates",
              <select value="" onChange={(e) => p.onInput(e.target.value)}>
                <option value="">—</option>
                {[
                  ["* * * * *", "everyMinute"],
                  ["0 * * * *", "hourly"],
                  ["0 9 * * *", "daily"],
                  ["0 9 * * 1-5", "weekdays"],
                ].map(([value, key]) => (
                  <option key={value} value={value}>
                    {t(key as Key)}
                  </option>
                ))}
              </select>,
            )}
          </>
        )}
        {id === "radix" &&
          optionLabel(
            "inputBase",
            <select
              value={options.base}
              onChange={(e) => opt({ base: Number(e.target.value) })}
            >
              {([2, 8, 10, 16] as const).map((value, i) => (
                <option key={value} value={value}>
                  {t((["binary", "octal", "decimal", "hex"] as const)[i])} (
                  {value})
                </option>
              ))}
            </select>,
          )}
        {id === "jwt" && <span>{t("unverified")} · JSON / Base64URL</span>}
      </div>
      <p className="tool-hint">{t(hint)}</p>
      <div className="action-bar">
        <div className="primary-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => void run()}
          >
            <Play size={14} />
            {t(id === "uuid" ? "generate" : id === "sql" ? "pretty" : "run")}
          </button>
          {id === "sql" && (
            <button disabled={busy} onClick={() => void run("minify")}>
              {t("minify")}
            </button>
          )}
          {id === "uuid" && (
            <button disabled={busy} onClick={() => void run("check")}>
              {t("checkUuid")}
            </button>
          )}
          {busy && <button onClick={stop}>{t("cancel")}</button>}
        </div>
        <div className="secondary-actions">
          <button
            onClick={() => {
              stop();
              p.onInput(examples[id]);
              if (id === "diff")
                p.onSecond("Hello DevKit\nLocal-first tools\nVersion 2\n");
              setFile(null);
              p.onError("");
              p.onOutput("");
              setResult(null);
            }}
          >
            {t("example")}
          </button>
          <button
            onClick={() => {
              stop();
              p.onInput("");
              p.onSecond("");
              p.onOutput("");
              p.onError("");
              setFile(null);
              setResult(null);
            }}
          >
            <Trash2 size={14} />
            {t("clear")}
          </button>
        </div>
      </div>
      <div className="editors advanced-editors">
        <section
          className={`editor-panel ${expanded === "input" ? "panel-fullscreen" : ""}`}
        >
          <div className="panel-header">
            <span>{t(id === "diff" ? "before" : "input")}</span>
            <button
              title={t(
                expanded === "input" ? "exitFullscreen" : "appFullscreen",
              )}
              onClick={() => setExpanded(expanded === "input" ? null : "input")}
            >
              {expanded === "input" ? (
                <Minimize2 size={14} />
              ) : (
                <Maximize2 size={14} />
              )}
            </button>
          </div>
          {edit(
            input,
            (text) => {
              stop();
              p.onInput(text);
            },
            id === "sql" ? "sql" : id === "jwt" ? "plaintext" : "plaintext",
          )}
        </section>
        <section
          className={`editor-panel ${expanded === "output" ? "panel-fullscreen" : ""}`}
        >
          <div className="panel-header">
            <span>{t(id === "diff" ? "after" : "output")}</span>
            <div>
              <button
                title={t(
                  expanded === "output" ? "exitFullscreen" : "appFullscreen",
                )}
                onClick={() =>
                  setExpanded(expanded === "output" ? null : "output")
                }
              >
                {expanded === "output" ? (
                  <Minimize2 size={14} />
                ) : (
                  <Maximize2 size={14} />
                )}
              </button>
              {id !== "diff" && (
                <>
                  <button
                    title={t("download")}
                    disabled={!output}
                    onClick={p.download}
                  >
                    <Download size={14} />
                  </button>
                  <button
                    title={t("copy")}
                    disabled={!output}
                    onClick={() => p.copy(output)}
                  >
                    <Copy size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
          {id === "diff" ? (
            edit(second, (text) => {
              stop();
              p.onSecond(text);
            })
          ) : result === null ? (
            <div className="empty">
              {busy ? t("processing") : t("noResult")}
            </div>
          ) : id === "jwt" ? (
            <div className="structured-result">
              <div className="security-banner">
                {t("unverified")} ·{" "}
                {t(
                  result.expired
                    ? "expired"
                    : result.notYet
                      ? "notYet"
                      : "claimsOnly",
                )}
              </div>
              {(["header", "payload"] as const).map((key) => (
                <section key={key}>
                  <h3>
                    {key === "header" ? "Header" : "Payload"}
                    <button
                      title={t("copy") + " " + key}
                      onClick={() => p.copy(result[key + "Text"])}
                    >
                      <Copy size={13} />
                    </button>
                  </h3>
                  <pre>{result[key + "Text"]}</pre>
                </section>
              ))}
              <h3>{t("signature")}</h3>
              <code>{result.signature || "∅"}</code>
              <h3>{t("claims")}</h3>
              {Object.entries(
                result.claims as Record<
                  string,
                  { value: unknown; date: string | null }
                >,
              ).map(([key, v]) => (
                <p key={key}>
                  <b>{key}</b> {String(v.value)}
                  <br />
                  {v.date ?? t("invalidClaim")}
                </p>
              ))}
            </div>
          ) : id === "regex" ? (
            <div className="structured-result">
              <h3>
                {t("matches")}: {result.matches.length}
              </h3>
              <pre className="match-preview">{highlighted()}</pre>
              <h3>{t("regexResult")}</h3>
              {result.matches.length === 0 ? (
                <p>{t("noMatches")}</p>
              ) : (
                result.matches.map((m: any, i: number) => (
                  <details key={i}>
                    <summary>
                      #{i + 1} · [{m.index}, {m.end}) · {JSON.stringify(m.text)}
                    </summary>
                    <p>{t("matchPosition")}</p>
                    <pre>
                      {JSON.stringify(
                        { groups: m.groups, named: m.named },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))
              )}
              <h3>{t("preview")}</h3>
              <pre>{result.replaced}</pre>
            </div>
          ) : id === "cron" ? (
            <div className="structured-result">
              {result.map((row: any, i: number) => (
                <div className="cron-row" key={i}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <span>
                    {row.local}
                    <small>{row.iso}</small>
                  </span>
                  <button title={t("copy")} onClick={() => p.copy(row.iso)}>
                    <Copy size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : id === "radix" ? (
            <div className="structured-result">
              {Object.entries(result as Record<string, string>).map(
                ([base, value]) => (
                  <section key={base}>
                    <h3>
                      Base {base}
                      <button title={t("copy")} onClick={() => p.copy(value)}>
                        <Copy size={13} />
                      </button>
                    </h3>
                    <pre>{value}</pre>
                  </section>
                ),
              )}
            </div>
          ) : id === "uuid" && !Array.isArray(result) ? (
            <div className="structured-result">
              <h3>{t(result.valid ? "validUuid" : "invalidUuid")}</h3>
              <p>
                {t("total")}: {result.total} · {t("unique")}: {result.unique} ·{" "}
                {t("duplicates")}: {result.duplicates}
              </p>
            </div>
          ) : (
            edit(output, undefined, id === "sql" ? "sql" : "plaintext")
          )}
        </section>
      </div>
      {id === "diff" && result && (
        <section className="diff-result">
          <header>
            <span>
              {t("added")} +{result.added} · {t("removed")} −{result.removed} ·{" "}
              {t("modified")} {result.modified}
            </span>
            <div>
              <button onClick={() => p.copy(output)}>
                <Copy size={14} />
                {t("copy")}
              </button>
              <button onClick={p.download}>
                <Download size={14} />
                {t("download")}
              </button>
            </div>
          </header>
          <div className={`diff-rows ${options.view}`}>
            {result.rows.slice(0, 1500).map((row: any, i: number) => (
              <div key={i} className={`diff-row ${row.kind}`}>
                <span className="diff-line-number">{i + 1}</span>
                {options.view === "side" ? (
                  <>
                    <pre>
                      {row.kind === "changed" && row.chars.length
                        ? row.chars
                            .filter((c: any) => !c.added)
                            .map((c: any, j: number) => (
                              <span
                                className={c.removed ? "char-removed" : ""}
                                key={j}
                              >
                                {c.value}
                              </span>
                            ))
                        : row.left}
                    </pre>
                    <pre>
                      {row.kind === "changed" && row.chars.length
                        ? row.chars
                            .filter((c: any) => !c.removed)
                            .map((c: any, j: number) => (
                              <span
                                className={c.added ? "char-added" : ""}
                                key={j}
                              >
                                {c.value}
                              </span>
                            ))
                        : row.right}
                    </pre>
                  </>
                ) : (
                  <pre>
                    {row.kind === "changed"
                      ? row.chars.map((c: any, j: number) => (
                          <span
                            key={j}
                            className={
                              c.added
                                ? "char-added"
                                : c.removed
                                  ? "char-removed"
                                  : ""
                            }
                          >
                            {c.value}
                          </span>
                        ))
                      : row.kind === "removed"
                        ? "- " + row.left
                        : row.kind === "added"
                          ? "+ " + row.right
                          : row.right}
                  </pre>
                )}
              </div>
            ))}
          </div>
          <small>
            {result.newlineChanged && <span>{t("newlineDifference")} · </span>}
            {Math.min(result.rows.length, 1500)} / {result.rows.length}{" "}
            {t("lines")}
          </small>
        </section>
      )}
      <div className="advanced-status">
        {busy ? t("processing") : t("ready")}
        {elapsed > 0 && ` · ${elapsed.toFixed(1)} ms`}
      </div>
      {expanded && (
        <div
          className="editor-fullscreen-backdrop"
          onClick={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
