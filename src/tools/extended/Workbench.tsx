import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Maximize2, Minimize2, Copy, Download, Play } from "lucide-react";
import NumberInput from "../../components/NumberInput";
import type { Key } from "../../locales";
import type { ExtendedId } from "../../app/registry";
import { examples } from "../../app/registry";
import { qrImage } from "./qr";
import SplitDivider from "../../editor/SplitDivider";
import { check } from "../shared";
import type { TextOptions } from "./logic";
const Editor = lazy(() => import("../../components/Editor"));
const ImageTool = lazy(() => import("./ImageTool"));
const PdfTool = lazy(() => import("./PdfTool"));
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const actions: Partial<Record<ExtendedId, Key[]>> = {
  textkit: [
    "trimLines",
    "uniqueLines",
    "sortLines",
    "reverseLines",
    "upperText",
    "lowerText",
    "camelText",
    "snakeText",
    "kebabText",
    "textStats",
  ],
  unicode: ["unicodeEncode", "unicodeDecode"],
  htmlentity: ["htmlEncode", "htmlDecode"],
  dataconvert: ["jsonYaml", "yamlJson", "jsonCsv", "csvJson"],
};
type Props = {
  id: ExtendedId;
  input: string;
  output: string;
  onInput: (text: string) => void;
  onOutput: (text: string) => void;
  t: (key: Key) => string;
  theme: string;
  fontSize: number;
  copy: (text: string) => void;
  runner: MutableRefObject<(() => void) | null>;
};
export default function ExtendedWorkbench(p: Props) {
  const { id, t, input, output } = p;
  const [options, setOptions] = useState<TextOptions>({
    action: actions[id]?.[0] || "",
    length: 20,
    count: 5,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    avoid: true,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false),
    [split, setSplit] = useState(50),
    [preview, setPreview] = useState(""),
    [qr, setQr] = useState(""),
    [qrLevel, setQrLevel] = useState<"L" | "M" | "Q" | "H">("M");
  const [qrTitle, setQrTitle] = useState(""),
    [qrFontSize, setQrFontSize] = useState(24),
    [qrPosition, setQrPosition] = useState<"top" | "bottom" | "center">(
      "bottom",
    ),
    [qrAlign, setQrAlign] = useState<"left" | "center" | "right">("center");
  const [qrRevision, setQrRevision] = useState(0);
  const qrTask = useRef(0);
  const pair = useRef<HTMLDivElement>(null),
    worker = useRef<Worker | null>(null),
    serial = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout>>(),
    latest = useRef(p);
  latest.current = p;
  function stop() {
    qrTask.current++;
    serial.current++;
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }
  useEffect(
    () => () => {
      serial.current++;
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const focus = document.activeElement as HTMLElement | null;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".sidebar,.topbar,.tool-heading,.workspace-note,.statusbar",
      ),
    );
    const before = nodes.map((n) => n.inert);
    nodes.forEach((n) => (n.inert = true));
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(
          ".extended-fullscreen .extended-close",
        )
        ?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      nodes.forEach((n, i) => (n.inert = before[i]));
      focus?.focus();
    };
  }, [expanded]);
  useEffect(() => {
    if (id !== "markdown") return;
    let active = true;
    const timeout = setTimeout(async () => {
      try {
        check(input, true);
        if (new TextEncoder().encode(input).length > 256 * 1024)
          throw Error("tooLarge");
        const [{ marked }, { default: purify }] = await Promise.all([
          import("marked"),
          import("dompurify"),
        ]);
        const html = purify.sanitize(
          await marked.parse(input, { async: false }),
          {
            FORBID_TAGS: [
              "img",
              "iframe",
              "style",
              "form",
              "input",
              "video",
              "audio",
              "object",
              "embed",
              "link",
              "meta",
            ],
            FORBID_ATTR: ["style", "src", "srcset"],
          },
        );
        if (active) {
          setPreview(html);
          latest.current.onOutput(html);
          setError("");
        }
      } catch {
        if (active) setError(t("tooLarge"));
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [input, id, p.theme]);
  useEffect(() => {
    if (id !== "qrcode") return;
    const task = ++qrTask.current;
    if (!input) {
      setQr("");
      setError("");
      setBusy(false);
      latest.current.onOutput("");
      return;
    }
    setBusy(true);
    setError("");
    const timeout = setTimeout(async () => {
      try {
        check(input);
        if (new TextEncoder().encode(input).length > 1000)
          throw Error("fileLimit");
        const url = await qrImage(input, {
          level: qrLevel,
          title: qrTitle,
          fontSize: qrFontSize,
          position: qrPosition,
          align: qrAlign,
        });
        if (task === qrTask.current) {
          setQr(url);
          latest.current.onOutput(input);
        }
      } catch (e) {
        if (task === qrTask.current) {
          const code = e instanceof Error ? e.message : "invalidInput";
          setError(
            latest.current.t(
              code === "qrCenterLimit"
                ? "qrCenterLimit"
                : code === "fileLimit"
                  ? "fileLimit"
                  : "invalidInput",
            ),
          );
        }
      } finally {
        if (task === qrTask.current) setBusy(false);
      }
    }, 120);
    return () => {
      clearTimeout(timeout);
      qrTask.current++;
    };
  }, [
    id,
    input,
    qrTitle,
    qrFontSize,
    qrPosition,
    qrAlign,
    qrLevel,
    qrRevision,
  ]);
  async function run() {
    if (id === "qrcode") {
      setQrRevision((v) => v + 1);
      return;
    }

    stop();
    const task = serial.current;
    setError("");
    if (id === "markdown") return;
    try {
      check(input, id === "password");
      setBusy(true);
      p.onOutput("");
      const w = new Worker(
        new URL("../../workers/extended.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = ({ data }) => {
        if (task !== serial.current) return;
        if (data.error) setError(t(data.error as Key));
        else p.onOutput(data.output);
        stop();
      };
      w.onerror = () => {
        if (task === serial.current) {
          setError(t("unknownError"));
          stop();
        }
      };
      timer.current = setTimeout(() => {
        if (task === serial.current) {
          setError(t("timeout"));
          stop();
        }
      }, 8000);
      w.postMessage({ id, input, options });
    } catch (e) {
      if (task === serial.current) {
        setError(
          t(
            e instanceof Error && e.message === "fileLimit"
              ? "fileLimit"
              : "invalidInput",
          ),
        );
        stop();
      }
    }
  }
  useEffect(() => {
    if (id === "image" || id === "pdfword") {
      p.runner.current = null;
      return;
    }
    p.runner.current = run;
    return () => {
      p.runner.current = null;
    };
  });
  if (id === "image")
    return (
      <Suspense fallback={<p>{t("editorLoading")}</p>}>
        <ImageTool t={t} />
      </Suspense>
    );
  if (id === "pdfword")
    return (
      <Suspense fallback={<p>{t("editorLoading")}</p>}>
        <PdfTool t={t} />
      </Suspense>
    );
  const change = (text: string) => {
    stop();
    setError("");
    if (id === "qrcode") p.onOutput("");
    p.onInput(text);
  };
  return (
    <div
      className={`extended-workbench ${id === "markdown" ? "markdown-workbench" : ""} ${expanded ? "extended-fullscreen" : ""}`}
    >
      {expanded && (
        <div className="advanced-fullscreen-title">
          <strong>{t(id)}</strong>
          <button className="extended-close" onClick={() => setExpanded(false)}>
            <Minimize2 size={14} />
            {t("exitFullscreen")} <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {id !== "markdown" && (
        <div className="tool-options extended-options">
          {actions[id] && (
            <label>
              {t("operation")}
              <select
                value={options.action}
                onChange={(e) => {
                  stop();
                  setOptions({ ...options, action: e.target.value });
                }}
              >
                {actions[id]!.map((a) => (
                  <option key={a} value={a}>
                    {t(a)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {id === "password" && (
            <>
              <label>
                {t("passwordLength")}
                <NumberInput
                  min={4}
                  max={128}
                  value={options.length ?? 20}
                  onChange={(value) =>
                    setOptions({ ...options, length: value })
                  }
                />
              </label>
              <label>
                {t("passwordCount")}
                <NumberInput
                  min={1}
                  max={100}
                  value={options.count ?? 5}
                  onChange={(value) => setOptions({ ...options, count: value })}
                />
              </label>
              {(
                [
                  ["upper", "useUpper"],
                  ["lower", "useLower"],
                  ["digits", "useDigits"],
                  ["symbols", "useSymbols"],
                  ["avoid", "avoidAmbiguous"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) =>
                      setOptions({ ...options, [key]: e.target.checked })
                    }
                  />
                  {t(label)}
                </label>
              ))}
            </>
          )}
          {id === "qrcode" && (
            <label>
              {t("qrLevel")}
              <select
                value={
                  qrPosition === "center" && qrTitle.trim() ? "H" : qrLevel
                }
                disabled={qrPosition === "center" && !!qrTitle.trim()}
                onChange={(e) => {
                  stop();
                  setQrLevel(e.target.value as typeof qrLevel);
                }}
              >
                {["L", "M", "Q", "H"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {id === "color" && <span>HEX · RGB(A) · HSL(A)</span>}
        </div>
      )}
      {id === "qrcode" && (
        <>
          <div className="tool-options qr-title-options">
            <label className="qr-title-field">
              {t("qrTitle")}
              <input
                value={qrTitle}
                maxLength={80}
                onChange={(e) => {
                  stop();
                  setQrTitle(e.target.value);
                }}
              />
            </label>
            <label>
              {t("qrTitleSize")}
              <NumberInput
                min={14}
                max={qrPosition === "center" ? 24 : 48}
                value={qrFontSize}
                onBlur={(e) =>
                  setQrFontSize(
                    Math.max(
                      14,
                      Math.min(
                        qrPosition === "center" ? 24 : 48,
                        Number(e.currentTarget.value) || qrFontSize,
                      ),
                    ),
                  )
                }
                onChange={(value) => {
                  if (
                    value >= 14 &&
                    value <= (qrPosition === "center" ? 24 : 48)
                  ) {
                    stop();
                    setQrFontSize(value);
                  }
                }}
              />
              px
            </label>
            <label>
              {t("qrTitlePosition")}
              <select
                value={qrPosition}
                onChange={(e) => {
                  stop();
                  setQrPosition(e.target.value as typeof qrPosition);
                  if (e.target.value === "center")
                    setQrFontSize((size) => Math.min(size, 24));
                }}
              >
                <option value="top">{t("titleTop")}</option>
                <option value="bottom">{t("titleBottom")}</option>
                <option value="center">{t("titleCenter")}</option>
              </select>
            </label>
            <label>
              {t("qrTitleAlign")}
              <select
                value={qrAlign}
                disabled={qrPosition === "center"}
                onChange={(e) => {
                  stop();
                  setQrAlign(e.target.value as typeof qrAlign);
                }}
              >
                <option value="left">{t("alignLeft")}</option>
                <option value="center">{t("alignCenter")}</option>
                <option value="right">{t("alignRight")}</option>
              </select>
            </label>
          </div>
          <p className="tool-hint">{t("qrTitleHint")}</p>
          {qrPosition === "center" && [...qrTitle.trim()].length > 8 && (
            <p className="tool-hint" role="status">
              {t("qrCenterTruncated")}
            </p>
          )}
        </>
      )}
      {(["dataconvert", "password", "qrcode", "markdown"] as const).includes(
        id as any,
      ) && (
        <p className="tool-hint">
          {t(
            (
              {
                dataconvert: "convertHint",
                password: "passwordHint",
                qrcode: "qrHint",
                markdown: "markdownHint",
              } as Record<string, Key>
            )[id],
          )}
        </p>
      )}
      <div className="action-bar">
        <div className="primary-actions">
          {(id === "markdown" || id === "qrcode") && (
            <span className="live-preview-label">{t("livePreview")}</span>
          )}
          {id !== "markdown" && id !== "qrcode" && (
            <button
              className="primary"
              onClick={() => void run()}
              disabled={busy}
            >
              <Play size={14} />
              {t(id === "password" ? "generate" : "run")}
            </button>
          )}
          {busy && id !== "qrcode" && (
            <button onClick={stop}>{t("cancelTask")}</button>
          )}
        </div>
        <div className="secondary-actions">
          <button onClick={() => setExpanded(!expanded)}>
            <Maximize2 size={14} />
            {t(expanded ? "exitFullscreen" : "compareFullscreen")}
          </button>
          <button
            onClick={() => {
              change(examples[id]);
              p.onOutput("");
            }}
          >
            {t("example")}
          </button>
          <button
            onClick={() => {
              change("");
              p.onOutput("");
              setPreview("");
            }}
          >
            {t("clear")}
          </button>
        </div>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      <div
        className="editors extended-editors"
        ref={pair}
        style={
          expanded
            ? {
                gridTemplateColumns: `minmax(0,${split}fr) 12px minmax(0,${100 - split}fr)`,
                gap: 0,
              }
            : undefined
        }
      >
        <section className="editor-panel">
          <div className="panel-header">
            <span>{t("input")}</span>
            <button
              onClick={async () => {
                try {
                  change(await navigator.clipboard.readText());
                } catch {
                  setError(t("clipboardError"));
                }
              }}
            >
              {t("paste")}
            </button>
          </div>
          <Suspense fallback={<p>{t("editorLoading")}</p>}>
            <Editor
              loading={t("editorLoading")}
              value={input}
              onChange={change}
              language={id === "dataconvert" ? "json" : "plaintext"}
              theme={p.theme}
              fontSize={p.fontSize}
            />
          </Suspense>
        </section>
        {expanded && (
          <SplitDivider
            container={pair}
            value={split}
            onChange={setSplit}
            label={t("resizeEditors")}
            hint={t("resizeEditorsHint")}
            valueText={`${Math.round(split)}% / ${Math.round(100 - split)}%`}
          />
        )}
        <section className="editor-panel">
          <div className="panel-header">
            <span>
              {t(id === "markdown" || id === "qrcode" ? "preview" : "output")}
            </span>
            <div>
              <button disabled={!output} onClick={() => p.copy(output)}>
                <Copy size={14} />
                {t("copyOutput")}
              </button>
              <button
                disabled={id === "qrcode" ? !qr || busy || !!error : !output}
                onClick={() => {
                  if (id === "qrcode") {
                    const a = document.createElement("a");
                    a.href = qr;
                    a.download = "devkit-qr.png";
                    a.click();
                  } else
                    saveBlob(
                      new Blob(
                        [id === "markdown" ? previewDocument(preview) : output],
                        {
                          type:
                            id === "markdown"
                              ? "text/html;charset=utf-8"
                              : "text/plain;charset=utf-8",
                        },
                      ),
                      id === "markdown"
                        ? "devkit-preview.html"
                        : "devkit-result.txt",
                    );
                }}
              >
                <Download size={14} />
                {t(
                  id === "qrcode"
                    ? "downloadPng"
                    : id === "markdown"
                      ? "downloadHtml"
                      : "download",
                )}
              </button>
            </div>
          </div>
          {id === "markdown" ? (
            !input.trim() ? (
              <div className="markdown-placeholder">{t("markdownEmpty")}</div>
            ) : (
              <iframe
                title={t("preview")}
                className="markdown-preview"
                sandbox=""
                srcDoc={previewDocument(preview, p.theme)}
              />
            )
          ) : id === "qrcode" ? (
            <div className="qr-preview">
              {qr ? (
                <img src={qr} alt={t("qrcode")} />
              ) : (
                <p>{t("outputEmpty")}</p>
              )}
            </div>
          ) : (
            <Suspense fallback={<p>{t("editorLoading")}</p>}>
              <Editor
                loading={t("editorLoading")}
                readOnly
                value={output}
                language={
                  id === "color" || id === "dataconvert" ? "json" : "plaintext"
                }
                theme={p.theme}
                fontSize={p.fontSize}
              />
            </Suspense>
          )}
        </section>
      </div>
    </div>
  );
}
export function previewDocument(html: string, theme = "light") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:15px/1.7 system-ui;color:${theme === "dark" ? "#dce3ee" : "#243047"};background:${theme === "dark" ? "#181d27" : "#fff"};padding:20px;overflow-wrap:anywhere}pre{white-space:pre-wrap;background:${theme === "dark" ? "#10141c" : "#eef2f7"};padding:12px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px}a{color:#326ddd}</style></head><body>${html}</body></html>`;
}
