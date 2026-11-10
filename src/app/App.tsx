import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useMemo,
  Component,
  type ReactNode,
} from "react";
import {
  Star,
  Maximize2,
  Minimize2,
  Braces,
  Binary,
  Link,
  Search,
  Sun,
  Moon,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  Copy,
  Download,
  Clipboard,
  Trash2,
  ArrowLeftRight,
  Play,
  Check,
  ShieldCheck,
  X,
  Plus,
  Code2,
  ChevronRight,
} from "lucide-react";
import type { TimestampState } from "../tools/timestamp/Workbench";

import JsonTree from "../tools/json/Tree";
import {
  ids,
  icons,
  keywords,
  examples,
  categories,
  isAdvanced,
  validIds,
  type Id,
} from "./registry";
import SplitDivider from "../editor/SplitDivider";
import { zh, en, type Key } from "../locales";
import { ToolError, check } from "../tools/shared";
import { parseQuery, buildQuery, type Pair } from "../tools/url/logic";
const TimestampWorkbench = lazy(() => import("../tools/timestamp/Workbench"));
const Workbench = lazy(() => import("../tools/Workbench"));
const Editor = lazy(() => import("../components/Editor"));
type State = {
  input: string;
  output: string;
  error: string;
  elapsed: number;
  second?: string;
  details?: unknown;
};
const blank = (): State => ({
  input: "",
  output: "",
  error: "",
  elapsed: 0,
  second: "",
});
function initialStates() {
  return Object.fromEntries(ids.map((id) => [id, blank()])) as Record<
    Id,
    State
  >;
}
function readPrefs() {
  try {
    const value = JSON.parse(
      localStorage.getItem("devkit.preferences") || "{}",
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
export class Boundary extends Component<
  {
    children: ReactNode;
    message: string;
    reload: string;
    resetKey?: string;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous: { resetKey?: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed)
      this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? (
      <div className="fatal">
        <h2>{this.props.message}</h2>
        <button onClick={() => location.reload()}>{this.props.reload}</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const initial = useRef(readPrefs()).current;
  const [lang, setLang] = useState<"zh" | "en">(
    initial.lang === "en" ? "en" : "zh",
  );
  const [theme, setTheme] = useState(
    initial.theme === "light" ? "light" : "dark",
  );
  const [fontSize, setFontSize] = useState(
    [12, 14, 16, 18, 20].includes(initial.fontSize) ? initial.fontSize : 14,
  );
  const [indent, setIndent] = useState(
    initial.indent === "\t" ? "\t" : initial.indent === "    " ? "    " : "  ",
  );
  const [tool, setTool] = useState<Id>("json");
  const [states, setStates] = useState<Record<Id, State>>(initialStates);
  const [favorites, setFavorites] = useState<Id[]>(validIds(initial.favorites));
  const [recent, setRecent] = useState<Id[]>(validIds(initial.recent));
  const [transferTarget, setTransferTarget] = useState<Id | "">("");
  const [resetVersion, setResetVersion] = useState(0);
  const extraRunner = useRef<(() => void) | null>(null);
  const [collapsed, setCollapsed] = useState(false),
    [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [settings, setSettings] = useState(false),
    [toast, setToast] = useState("");
  const [action, setAction] = useState("pretty"),
    [tree, setTree] = useState(false),
    [safe, setSafe] = useState(false),
    [full, setFull] = useState(false),
    [pairs, setPairs] = useState<Pair[]>([]);
  const [zone, setZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [jsonSplit, setJsonSplit] = useState(50);
  const jsonPairRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<"input" | "output" | null>(null);
  const expansionTrigger = useRef<HTMLButtonElement | null>(null);
  function closeExpanded() {
    setExpanded(null);
    requestAnimationFrame(() => expansionTrigger.current?.focus());
  }
  useEffect(() => {
    if (!expanded) return;
    const chrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".shell > .sidebar,.topbar,.tool-heading,.workspace > .tool-options,.workspace > .action-bar,.workspace-note,.statusbar",
      ),
    );
    const previous = chrome.map((element) => element.inert);
    chrome.forEach((element) => {
      element.inert = true;
    });
    const frame = requestAnimationFrame(() =>
      document
        .querySelector<HTMLButtonElement>(".json-fullscreen-toolbar button")
        ?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      chrome.forEach((element, index) => {
        element.inert = previous[index];
      });
    };
  }, [expanded]);
  function toggleExpanded(
    panel: "input" | "output",
    trigger: HTMLButtonElement,
  ) {
    if (expanded) closeExpanded();
    else {
      expansionTrigger.current = trigger;
      setExpanded(panel);
    }
  }
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    workspaceRef.current?.scrollTo({ top: 0 });
  }, [tool]);
  const t = (key: Key) => (lang === "zh" ? zh : en)[key];
  const s = states[tool];
  function notify(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }
  function update(patch: Partial<State>, id: Id = tool) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function cancel() {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }
  function select(id: Id) {
    cancel();
    setExpanded(null);
    setRecent((prev) =>
      [id, ...prev.filter((item) => item !== id)].slice(0, 6),
    );
    setTransferTarget("");
    setTool(id);
    setSearchOpen(false);
    setSearch("");
    setAction(id === "json" ? "pretty" : "encode");
    setTree(false);
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = "DevKit · " + t("tagline");
    try {
      localStorage.setItem(
        "devkit.preferences",
        JSON.stringify({ lang, theme, fontSize, indent, favorites, recent }),
      );
    } catch {
      notify(t("storageError"));
    }
  }, [lang, theme, fontSize, indent, favorites, recent]);
  useEffect(() => {
    return () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        if (!searchOpen && !settings && expanded) closeExpanded();
        setSearchOpen(false);
        setSettings(false);
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        !settings &&
        !searchOpen
      ) {
        e.preventDefault();
        run();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function errorText(error: unknown) {
    if (error instanceof ToolError) return t(error.code as Key);
    return error instanceof Error ? error.message : t("unknownError");
  }
  function run(chosen?: string) {
    if (isAdvanced(tool) || tool === "timestamp") {
      extraRunner.current?.();
      return;
    }
    cancel();
    const id = tool;
    const start = performance.now();
    const a = chosen ?? action;
    setAction(a);
    update({ error: "", output: "" });
    try {
      check(s.input);
      setBusy(true);
      if (tool === "json") setTree(a === "tree");
      const w = new Worker(
        new URL("../workers/process.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      const version = generation.current;
      const finish = (patch: Partial<State>) => {
        if (generation.current !== version) return;
        update({ ...patch, elapsed: performance.now() - start }, id);
        cancel();
      };
      w.onmessage = ({ data }) => {
        if (data.error)
          finish({
            error: data.code
              ? t(data.error as Key)
              : t("jsonParse") + ": " + data.error,
          });
        else {
          finish({ output: data.output });
          if (a === "validate") notify(t("valid"));
        }
      };
      w.onerror = () => finish({ error: t("loadError") });
      timer.current = setTimeout(() => finish({ error: t("timeout") }), 8000);
      w.postMessage({
        tool,
        input: s.input,
        action: a,
        indent,
        safe,
        full,
        zone,
      });
    } catch (e) {
      update({ error: errorText(e), elapsed: performance.now() - start });
    }
  }
  async function copy(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify(t("copied"));
    } catch {
      notify(t("clipboardError"));
    }
  }
  async function paste() {
    try {
      const input = await navigator.clipboard.readText();
      check(input, true);
      cancel();
      update({ input, error: "" });
    } catch (e) {
      notify(e instanceof ToolError ? errorText(e) : t("clipboardError"));
    }
  }
  function download() {
    try {
      const blob = new Blob([s.output], {
        type:
          tool === "json"
            ? "application/json;charset=utf-8"
            : "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devkit-${tool}.${tool === "json" ? "json" : "txt"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      notify(t("downloadError"));
    }
  }
  function queryParse() {
    try {
      setPairs(parseQuery(s.input));
      update({ error: "" });
    } catch (e) {
      update({ error: errorText(e) });
    }
  }
  function transfer() {
    if (!transferTarget || !s.output) {
      notify(t("transferError"));
      return;
    }
    try {
      check(s.output);
    } catch (error) {
      notify(errorText(error));
      return;
    }
    if (states[transferTarget].input && !confirm(t("transferReplace"))) return;
    const target = transferTarget,
      input = s.output;
    select(target);
    update({ input, output: "", error: "", details: null }, target);
    notify(t("transferDone"));
  }
  function reset() {
    if (!confirm(t("resetConfirm"))) return;
    cancel();
    let storageCleared = true;
    try {
      localStorage.removeItem("devkit.preferences");
    } catch {
      storageCleared = false;
    }
    setStates(initialStates());
    extraRunner.current = null;
    setResetVersion((v) => v + 1);
    setFavorites([]);
    setRecent([]);
    setPairs([]);
    setTheme("dark");
    setFontSize(14);
    setIndent("  ");
    notify(t(storageCleared ? "clearAll" : "storageError"));
  }
  const matches = ids.filter((id) =>
    (keywords[id] + " " + t(id)).toLowerCase().includes(search.toLowerCase()),
  );
  const stats = useMemo(
    () => ({
      chars: Array.from(s.input).length,
      lines: s.input ? s.input.split("\n").length : 0,
      bytes: new TextEncoder().encode(s.input).length,
    }),
    [s.input],
  );
  const Icon = icons[tool];
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  const editor = (value: string, readOnly = false) => (
    <Suspense fallback={<div className="empty">{t("editorLoading")}</div>}>
      <Editor
        value={value}
        readOnly={readOnly}
        onChange={
          readOnly
            ? undefined
            : (input) => {
                cancel();
                update({ input, error: "" });
              }
        }
        language={tool === "json" ? "json" : "plaintext"}
        theme={theme}
        fontSize={fontSize}
        loading={t("editorLoading")}
      />
    </Suspense>
  );
  return (
    <Boundary message={t("loadError")} reload={t("reload")}>
      <div className={`shell ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              select("json");
            }}
          >
            <span className="logo">
              <Code2 size={23} />
            </span>
            {!collapsed && (
              <span>
                DevKit<small>{t("tagline")}</small>
              </span>
            )}
          </a>
          <button
            className="search-button"
            title={t("search")}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={16} />
            {!collapsed && (
              <>
                <span>{t("search")}</span>
                <kbd>{modifier} K</kbd>
              </>
            )}
          </button>
          {!collapsed && <div className="nav-caption">{t("workspace")}</div>}
          <nav>
            {!collapsed && (
              <>
                <div className="category">{t("favorites")}</div>
                {favorites.length === 0 && (
                  <p className="nav-empty">{t("noFavorites")}</p>
                )}
                {favorites.map((id) => {
                  const I = icons[id];
                  return (
                    <button
                      className={`nav-item ${id === tool ? "active" : ""}`}
                      key={"fav-" + id}
                      onClick={() => select(id)}
                    >
                      <I size={16} />
                      <span>{t(id)}</span>
                    </button>
                  );
                })}
                {recent.length > 0 && (
                  <details className="recent-tools">
                    <summary>{t("recent")}</summary>
                    {recent.map((id) => (
                      <button
                        className="nav-item"
                        key={"recent-" + id}
                        onClick={() => select(id)}
                      >
                        {t(id)}
                      </button>
                    ))}
                  </details>
                )}
              </>
            )}
            {categories.map((category) => (
              <div className="nav-group" key={category.key}>
                {!collapsed && (
                  <div className="category">{t(category.key)}</div>
                )}
                {category.ids.map((id) => {
                  const I = icons[id];
                  return (
                    <button
                      title={t(id)}
                      className={`nav-item ${id === tool ? "active" : ""}`}
                      key={id}
                      onClick={() => select(id)}
                    >
                      <I size={18} />
                      {!collapsed && (
                        <>
                          <span>{t(id)}</span>
                          {id === tool && <span className="active-dot" />}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {!collapsed && (
              <div className="local-note">
                <ShieldCheck size={16} />
                <span>{t("local")}</span>
              </div>
            )}
            <button
              className="nav-item"
              onClick={() => setSettings(true)}
              title={t("settings")}
            >
              <Settings size={17} />
              {!collapsed && <span>{t("settings")}</span>}
            </button>
            <div className="brand-footer">
              {!collapsed && (
                <span>
                  {t("brand")} <small>v1.0.0</small>
                </span>
              )}
              <button
                className="icon-button"
                title={t(collapsed ? "expand" : "collapse")}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? (
                  <PanelLeftOpen size={17} />
                ) : (
                  <PanelLeftClose size={17} />
                )}
              </button>
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <div className="breadcrumb">
              DevKit <ChevronRight size={14} /> <span>{t(tool)}</span>
            </div>
            <div className="header-actions">
              <span className="private-badge">
                <span />
                {t("local")}
              </span>
              <button
                className="language-button"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
              <button
                className="icon-button"
                title={t(theme === "dark" ? "light" : "dark")}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                className="icon-button"
                title={t("settings")}
                onClick={() => setSettings(true)}
              >
                <Settings size={18} />
              </button>
            </div>
          </header>
          <section className="workspace" ref={workspaceRef}>
            <div className="tool-heading">
              <div>
                <div className="eyebrow">{t("phase")}</div>
                <h1>
                  <Icon size={29} />
                  {t(tool)}
                  <button
                    className={`icon-button favorite-toggle ${favorites.includes(tool) ? "is-favorite" : ""}`}
                    aria-pressed={favorites.includes(tool)}
                    title={t(
                      favorites.includes(tool) ? "unfavorite" : "favorite",
                    )}
                    onClick={() =>
                      setFavorites((prev) =>
                        prev.includes(tool)
                          ? prev.filter((id) => id !== tool)
                          : [...prev, tool],
                      )
                    }
                  >
                    <Star
                      size={19}
                      fill={favorites.includes(tool) ? "currentColor" : "none"}
                    />
                  </button>
                </h1>
                <p>{t((tool + "Desc") as Key)}</p>
              </div>
              <div className="transfer-bar">
                <label>
                  {t("sendTo")}
                  <select
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value as Id)}
                  >
                    <option value="">{t("selectTool")}</option>
                    {ids
                      .filter((id) => id !== tool)
                      .map((id) => (
                        <option key={id} value={id}>
                          {t(id)}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={!s.output || !transferTarget}
                  onClick={transfer}
                >
                  {t("transfer")}
                </button>
              </div>
            </div>
            {tool === "timestamp" ? (
              <Boundary
                key={resetVersion}
                resetKey={tool}
                message={t("loadError")}
                reload={t("reload")}
              >
                <Suspense
                  fallback={<div className="empty">{t("editorLoading")}</div>}
                >
                  <TimestampWorkbench
                    input={s.input}
                    state={s.details as TimestampState | undefined}
                    onInput={(input) => update({ input, error: "" })}
                    onState={(details) =>
                      update({
                        details,
                        error:
                          Object.values(details.errors).find(Boolean) ?? "",
                      })
                    }
                    onOutput={(output) => update({ output })}
                    zone={zone}
                    onZone={setZone}
                    t={t}
                    copy={copy}
                    runner={extraRunner}
                  />
                </Suspense>
              </Boundary>
            ) : isAdvanced(tool) ? (
              <Boundary
                key={resetVersion}
                resetKey={tool}
                message={t("loadError")}
                reload={t("reload")}
              >
                <Suspense
                  fallback={<div className="empty">{t("editorLoading")}</div>}
                >
                  <Workbench
                    key={resetVersion}
                    id={tool}
                    details={s.details ?? null}
                    onDetails={(details) => update({ details })}
                    input={s.input}
                    second={s.second ?? ""}
                    output={s.output}
                    onInput={(input) => update({ input, error: "" })}
                    onSecond={(second) => update({ second, error: "" })}
                    onOutput={(output) => update({ output })}
                    onError={(error) => update({ error })}
                    t={t}
                    theme={theme}
                    fontSize={fontSize}
                    copy={copy}
                    download={download}
                    runner={extraRunner}
                  />
                  {s.error && (
                    <div className="error-message" role="alert">
                      {s.error}
                    </div>
                  )}
                </Suspense>
              </Boundary>
            ) : (
              <>
                <div className="tool-options">
                  {tool === "json" && (
                    <>
                      <label>
                        {t("indent")}
                        <select
                          value={indent}
                          onChange={(e) => setIndent(e.target.value)}
                        >
                          <option value="  ">2</option>
                          <option value="    ">4</option>
                          <option value={"\t"}>{t("tab")}</option>
                        </select>
                      </label>
                      <span className="option-hint">{t("jsonHint")}</span>
                    </>
                  )}
                  {tool === "base64" && (
                    <>
                      <label>
                        {t("mode")}
                        <select
                          value={safe ? "url" : "standard"}
                          onChange={(e) => setSafe(e.target.value === "url")}
                        >
                          <option value="standard">{t("standard")}</option>
                          <option value="url">{t("urlSafe")}</option>
                        </select>
                      </label>
                      <span className="option-hint">UTF-8 / Unicode</span>
                    </>
                  )}
                  {tool === "url" && (
                    <>
                      <label>
                        {t("mode")}
                        <select
                          value={full ? "full" : "component"}
                          onChange={(e) => setFull(e.target.value === "full")}
                        >
                          <option value="component">{t("component")}</option>
                          <option value="full">{t("fullUrl")}</option>
                        </select>
                      </label>
                      <span className="option-hint">{t("urlHint")}</span>
                    </>
                  )}
                </div>
                <div className="action-bar">
                  <div className="primary-actions">
                    {tool === "json" ? (
                      (["pretty", "minify", "validate", "tree"] as const).map(
                        (a, i) => (
                          <button
                            key={a}
                            className={i === 0 ? "primary" : ""}
                            disabled={busy}
                            onClick={() => run(a)}
                          >
                            {i === 0 && <Play size={14} />} {t(a)}
                          </button>
                        ),
                      )
                    ) : (
                      <>
                        <button
                          className="primary"
                          onClick={() => run("encode")}
                        >
                          <ArrowRight size={15} />
                          {t("encode")}
                        </button>
                        <button onClick={() => run("decode")}>
                          {t("decode")}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="secondary-actions">
                    {tool === "json" && (
                      <button
                        title={t("compareFullscreen")}
                        onClick={(e) =>
                          toggleExpanded("input", e.currentTarget)
                        }
                      >
                        <Maximize2 size={14} />
                        {t("compareFullscreen")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        cancel();
                        update({
                          input: examples[tool],
                          output: "",
                          error: "",
                        });
                      }}
                    >
                      {t("example")}
                    </button>
                    {
                      <button
                        disabled={!s.output}
                        onClick={() => {
                          cancel();
                          update({
                            input: s.output,
                            output: s.input,
                            error: "",
                          });
                        }}
                      >
                        <ArrowLeftRight size={14} />
                        {t("swap")}
                      </button>
                    }
                    <button
                      onClick={() => {
                        cancel();
                        update(blank());
                        if (tool === "url") setPairs([]);
                      }}
                    >
                      <Trash2 size={14} />
                      {t("clear")}
                    </button>
                  </div>
                </div>
                <div
                  ref={jsonPairRef}
                  style={
                    expanded
                      ? {
                          gridTemplateColumns: `${jsonSplit}fr 12px ${100 - jsonSplit}fr`,
                        }
                      : undefined
                  }
                  className={`editors ${expanded ? "editors-fullscreen" : ""}`}
                >
                  {expanded && (
                    <div className="json-fullscreen-toolbar">
                      <strong>
                        {t("json")} · {t("input")} / {t("output")}
                      </strong>
                      <span>
                        {stats.chars.toLocaleString()} {t("chars")}
                      </span>
                      <div>
                        {(
                          ["pretty", "minify", "validate", "tree"] as const
                        ).map((a) => (
                          <button
                            key={a}
                            disabled={busy}
                            onClick={() => run(a)}
                          >
                            {t(a)}
                          </button>
                        ))}
                        <button onClick={closeExpanded}>
                          <Minimize2 size={14} />
                          {t("exitFullscreen")} <kbd>Esc</kbd>
                        </button>
                      </div>
                      {s.error && (
                        <p className="fullscreen-error" role="alert">
                          {s.error}
                        </p>
                      )}
                    </div>
                  )}
                  <section
                    className="editor-panel"
                    aria-label={Boolean(expanded) ? t("input") : undefined}
                  >
                    <div className="panel-header">
                      <span>
                        <span className="panel-dot" />
                        {t("input")}
                        <small>{t("source")}</small>
                      </span>
                      <div>
                        <button onClick={paste}>
                          <Clipboard size={13} />
                          {t("paste")}
                        </button>
                      </div>
                    </div>
                    {editor(s.input)}
                  </section>
                  {expanded && (
                    <SplitDivider
                      container={jsonPairRef}
                      value={jsonSplit}
                      onChange={setJsonSplit}
                      label={t("resizeEditors")}
                      hint={t("resizeEditorsHint")}
                      valueText={
                        t("input") +
                        " " +
                        Math.round(jsonSplit) +
                        "% · " +
                        t("output") +
                        " " +
                        Math.round(100 - jsonSplit) +
                        "%"
                      }
                    />
                  )}
                  <section
                    className="editor-panel"
                    aria-label={Boolean(expanded) ? t("output") : undefined}
                  >
                    <div className="panel-header">
                      <span>
                        <span className="panel-dot output-dot" />
                        {t("output")}
                        <small>{t("target")}</small>
                      </span>
                      <div>
                        <button
                          disabled={!s.output}
                          title={t("download")}
                          onClick={download}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          disabled={!s.output}
                          onClick={() => copy(s.output)}
                        >
                          <Copy size={13} />
                          {t("copy")}
                        </button>
                      </div>
                    </div>
                    {s.output ? (
                      tool === "json" && tree ? (
                        s.output.split("\n").length > 3000 ? (
                          <div className="empty">{t("treeLimit")}</div>
                        ) : (
                          <JsonTree text={s.output} />
                        )
                      ) : (
                        editor(s.output, true)
                      )
                    ) : (
                      <div className="empty">
                        <div className="empty-icon">
                          <Icon size={32} />
                        </div>
                        <span>{busy ? t("editorLoading") : t("noResult")}</span>
                      </div>
                    )}
                  </section>
                </div>
                {s.error && (
                  <div className="error-message" role="alert">
                    <X size={16} />
                    {s.error}
                  </div>
                )}
                {tool === "url" && (
                  <section className="query-panel">
                    <div className="query-heading">
                      <h3>{t("query")}</h3>
                      <div>
                        <button onClick={queryParse}>{t("parseQuery")}</button>
                        <button
                          onClick={() =>
                            setPairs((prev) => [...prev, ["", ""]])
                          }
                        >
                          <Plus size={14} />
                          {t("add")}
                        </button>
                        <button
                          onClick={() => {
                            try {
                              const output = buildQuery(pairs);
                              check(output, true);
                              update({ output, error: "" });
                            } catch (e) {
                              update({ error: errorText(e) });
                            }
                          }}
                        >
                          {t("buildQuery")}
                        </button>
                      </div>
                    </div>
                    <p>{t("queryHint")}</p>
                    {pairs.length === 0 ? (
                      <div className="query-empty">{t("noQuery")}</div>
                    ) : (
                      pairs.map(([key, value], i) => (
                        <div className="query-row" key={i}>
                          <span>{i + 1}</span>
                          <input
                            aria-label={`${t("key")} ${i + 1}`}
                            placeholder={t("key")}
                            value={key}
                            onChange={(e) =>
                              setPairs((prev) =>
                                prev.map((pair, n) =>
                                  n === i ? [e.target.value, pair[1]] : pair,
                                ),
                              )
                            }
                          />
                          <input
                            aria-label={`${t("value")} ${i + 1}`}
                            placeholder={t("value")}
                            value={value}
                            onChange={(e) =>
                              setPairs((prev) =>
                                prev.map((pair, n) =>
                                  n === i ? [pair[0], e.target.value] : pair,
                                ),
                              )
                            }
                          />
                          <button
                            title={t("remove")}
                            onClick={() =>
                              setPairs((prev) => prev.filter((_, n) => n !== i))
                            }
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </section>
                )}
              </>
            )}
            <div className="workspace-note">
              <ShieldCheck size={14} />
              <span>{t("privacy")}</span>
            </div>
          </section>
          <footer className="statusbar">
            <span className={s.error ? "status-error" : "status-ready"}>
              <span />
              {s.error
                ? t("error")
                : busy
                  ? "…"
                  : s.output
                    ? t("done")
                    : t("ready")}
            </span>
            <div>
              <span>
                {stats.chars.toLocaleString()} {t("chars")}
              </span>
              <span>
                {stats.lines} {t("lines")}
              </span>
              <span>
                {stats.bytes.toLocaleString()} {t("bytes")}
              </span>
              {s.elapsed > 0 && <span>{s.elapsed.toFixed(1)} ms</span>}
              <kbd>{modifier} ↵</kbd>
            </div>
          </footer>
        </main>
        {expanded && (
          <div
            className="editor-fullscreen-backdrop"
            onClick={closeExpanded}
            aria-hidden="true"
          />
        )}
        {searchOpen && (
          <div className="overlay" onClick={() => setSearchOpen(false)}>
            <section
              className="search-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("search")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="search-field">
                <Search size={20} />
                <input
                  ref={searchRef}
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && matches[0]) select(matches[0]);
                  }}
                />
                <button onClick={() => setSearchOpen(false)}>Esc</button>
              </div>
              {matches.map((id) => {
                const I = icons[id];
                return (
                  <button
                    className="search-result"
                    key={id}
                    onClick={() => select(id)}
                  >
                    <I size={20} />
                    <span>
                      {t(id)}
                      <small>{t((id + "Desc") as Key)}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
              {matches.length === 0 && (
                <p className="empty">{t("emptySearch")}</p>
              )}
            </section>
          </div>
        )}
        {settings && (
          <div className="overlay" onClick={() => setSettings(false)}>
            <section
              className="settings-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("settings")}
              onClick={(e) => e.stopPropagation()}
            >
              <header>
                <h2>{t("settings")}</h2>
                <button title={t("close")} onClick={() => setSettings(false)}>
                  <X size={18} />
                </button>
              </header>
              <label>
                {t("language")}
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as "zh" | "en")}
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {t("theme")}
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="dark">{t("dark")}</option>
                  <option value="light">{t("light")}</option>
                </select>
              </label>
              <label>
                {t("fontSize")}
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                >
                  {[12, 14, 16, 18, 20].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <h3>{t("shortcuts")}</h3>
              <p>
                {t("searchShortcut")} <kbd>{modifier} K</kbd>
              </p>
              <p>
                {t("runShortcut")} <kbd>{modifier} ↵</kbd>
              </p>
              <p className="muted">{t("privacy")}</p>
              <p className="muted">{t("limits")}</p>
              <button className="danger" onClick={reset}>
                <Trash2 size={15} />
                {t("reset")}
              </button>
            </section>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            {toast}
          </div>
        )}
      </div>
    </Boundary>
  );
}
