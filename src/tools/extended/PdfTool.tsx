import { useEffect, useRef, useState } from "react";
import FilePicker from "../../components/FilePicker";
import type { Key } from "../../locales";
import { extractLines, wordBlob } from "./pdfText";
import { saveBlob } from "./Workbench";
export default function PdfTool({ t }: { t: (key: Key) => string }) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [result, setResult] = useState<Blob | null>(null),
    [emptyPages, setEmptyPages] = useState(0);
  const serial = useRef(0),
    task = useRef<{ destroy: () => Promise<void> } | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(),
    fileInput = useRef<HTMLInputElement>(null);
  function cancel() {
    serial.current++;
    void task.current?.destroy().catch(() => {});
    task.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }
  useEffect(
    () => () => {
      serial.current++;
      void task.current?.destroy().catch(() => {});
      clearTimeout(timer.current);
    },
    [],
  );
  async function convert() {
    cancel();
    const version = serial.current;
    setError("");
    setResult(null);
    setEmptyPages(0);
    setProgress("");
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError(t("fileLimit"));
      return;
    }
    setBusy(true);
    timer.current = setTimeout(() => {
      if (version === serial.current) {
        cancel();
        setError(t("timeout"));
      }
    }, 120000);
    try {
      const pdf = await import("pdfjs-dist");
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      if (version !== serial.current) return;
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (version !== serial.current) return;
      const loading = pdf.getDocument({
        data: bytes,
        cMapUrl: new URL("./pdf-assets/cmaps/", location.href).href,
        cMapPacked: true,
        standardFontDataUrl: new URL(
          "./pdf-assets/standard_fonts/",
          location.href,
        ).href,
        useSystemFonts: true,
        verbosity: 0,
      });
      task.current = loading;
      const doc = await loading.promise;
      if (version !== serial.current) return;
      if (doc.numPages > 100) throw Error("fileLimit");
      const pages: string[][] = [];
      let count = 0,
        blank = 0;
      for (let i = 1; i <= doc.numPages; i++) {
        if (version !== serial.current) return;
        setProgress(`${i} / ${doc.numPages} ${t("pdfPages")}`);
        const page = await doc.getPage(i),
          content = await page.getTextContent();
        const lines = extractLines(content.items);
        if (!lines.some((l) => l.trim())) blank++;
        count += lines.join("").trim().length;
        if (count > 1000000) throw Error("fileLimit");
        pages.push(lines);
        page.cleanup();
      }
      if (!count) throw Error("pdfNoText");
      if (version !== serial.current) return;
      const blob = await wordBlob(pages, t("pdfPartial"), file.name);
      if (version === serial.current) {
        setResult(blob);
        setEmptyPages(blank);
      }
    } catch (e) {
      if (version === serial.current) {
        const key =
          e instanceof Error && ["fileLimit", "pdfNoText"].includes(e.message)
            ? (e.message as Key)
            : "invalidPdf";
        setError(t(key));
      }
    } finally {
      if (version === serial.current) {
        clearTimeout(timer.current);
        const completed = task.current;
        task.current = null;
        setBusy(false);
        await completed?.destroy().catch(() => {});
      }
    }
  }
  return (
    <div className="media-workbench">
      <p className="tool-hint">{t("pdfHint")}</p>
      <p className="tool-hint">{t("localFilesHint")}</p>
      <div className="tool-options">
        <FilePicker
          inputRef={fileInput}
          label={t("choosePdf")}
          emptyText={t("noFilesSelected")}
          fileNames={file ? [file.name] : []}
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            cancel();
            setResult(null);
            setError("");
            setProgress("");
            setEmptyPages(0);
            setFile(e.target.files?.[0] || null);
          }}
        />
      </div>
      <div className="action-bar">
        <div>
          <button
            className="primary"
            disabled={!file || busy}
            onClick={() => void convert()}
          >
            {t("convertWord")}
          </button>
          {busy && <button onClick={cancel}>{t("cancelTask")}</button>}
          <button
            onClick={() => {
              cancel();
              setFile(null);
              setResult(null);
              setError("");
              setProgress("");
              setEmptyPages(0);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            {t("clear")}
          </button>
        </div>
      </div>
      {busy && (
        <p role="status">
          {t("progressLabel")} {progress}
        </p>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {result && (
        <section className="document-result">
          <p>{t("pdfReady")}</p>
          <p>{progress}</p>
          {emptyPages > 0 && (
            <p role="status">
              {t("pdfPartial")} ({emptyPages})
            </p>
          )}
          <button
            onClick={() =>
              saveBlob(
                result,
                (file?.name.replace(/\.pdf$/i, "") || "document") + ".docx",
              )
            }
          >
            {t("downloadWord")}
          </button>
        </section>
      )}
    </div>
  );
}
