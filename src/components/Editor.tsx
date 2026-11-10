import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css";
import Monaco, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController";
import "monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: (_: string, label: string) =>
    label === "json" ? new JsonWorker() : new EditorWorker(),
};
loader.config({ monaco });
export default function Editor({
  value,
  onChange,
  readOnly,
  language,
  theme,
  fontSize,
  loading,
}: {
  value: string;
  onChange?: (s: string) => void;
  readOnly?: boolean;
  language: string;
  theme: string;
  fontSize: number;
  loading: string;
}) {
  return (
    <Monaco
      height="100%"
      language={language}
      theme={theme === "dark" ? "vs-dark" : "light"}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      loading={<span>{loading}</span>}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize,
        fontFamily: "Menlo, Consolas, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        padding: { top: 18 },
        renderLineHighlight: "none",
        tabSize: 2,
        contextmenu: true,
        unicodeHighlight: { ambiguousCharacters: false },
        quickSuggestions: false,
      }}
    />
  );
}
