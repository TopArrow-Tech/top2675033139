import { useEffect, useRef, useState } from "react";
import NumberInput from "../../components/NumberInput";
import FilePicker from "../../components/FilePicker";
import type { Key } from "../../locales";
import { keepSmallerOriginal } from "./imagePolicy";
import { saveBlob } from "./Workbench";
type Crop = { x: number; y: number; width: number; height: number };
type Source = { file: File; url: string; width: number; height: number };
type Result = {
  retained: boolean;
  blob: Blob;
  url: string;
  name: string;
  original: number;
};
export default function ImageTool({ t }: { t: (key: Key) => string }) {
  const [mode, setMode] = useState("compress"),
    [sources, setSources] = useState<Source[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [format, setFormat] = useState("auto"),
    [preserve, setPreserve] = useState(true),
    [quality, setQuality] = useState(80),
    [dimension, setDimension] = useState(1920),
    [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 0, height: 0 });
  const serial = useRef(0),
    sourceRef = useRef<Source[]>([]),
    resultRef = useRef<Result[]>([]),
    drag = useRef<{ x: number; y: number } | null>(null),
    inputRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      serial.current++;
      sourceRef.current.forEach((s) => URL.revokeObjectURL(s.url));
      resultRef.current.forEach((r) => URL.revokeObjectURL(r.url));
    },
    [],
  );
  function clearResults() {
    resultRef.current.forEach((r) => URL.revokeObjectURL(r.url));
    resultRef.current = [];
    setResults([]);
  }
  function reset(clearInput = true) {
    serial.current++;
    setBusy(false);
    sourceRef.current.forEach((s) => URL.revokeObjectURL(s.url));
    sourceRef.current = [];
    setSources([]);
    clearResults();
    setError("");
    setProgress(0);
    if (clearInput && inputRef.current) inputRef.current.value = "";
  }
  async function choose(files: FileList | null) {
    const list = Array.from(files || []);
    reset(false);
    if (!list.length) return;
    const task = serial.current;
    if (
      list.length > (mode === "crop" ? 1 : 10) ||
      list.reduce((sum, file) => sum + file.size, 0) > 60 * 1024 * 1024 ||
      list.some(
        (f) =>
          f.size > 12 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(f.type),
      )
    ) {
      setError(t("fileLimit"));
      return;
    }
    setBusy(true);
    const next: Source[] = [];
    try {
      let totalPixels = 0;
      for (const file of list) {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        bitmap.close();
        totalPixels += width * height;
        if (
          totalPixels > 40000000 ||
          width * height > 16000000 ||
          width < 1 ||
          height < 1
        )
          throw Error("fileLimit");
        next.push({ file, width, height, url: URL.createObjectURL(file) });
      }
      if (task !== serial.current) {
        next.forEach((s) => URL.revokeObjectURL(s.url));
        return;
      }
      sourceRef.current = next;
      setSources(next);
      setCrop({ x: 0, y: 0, width: next[0].width, height: next[0].height });
    } catch (e) {
      next.forEach((s) => URL.revokeObjectURL(s.url));
      if (task === serial.current)
        setError(
          t(
            e instanceof Error && e.message === "fileLimit"
              ? "fileLimit"
              : "invalidImage",
          ),
        );
    } finally {
      if (task === serial.current) setBusy(false);
    }
  }
  function setting() {
    serial.current++;
    setBusy(false);
    clearResults();
    setError("");
  }
  function updateCrop(patch: Partial<Crop>) {
    setting();
    setCrop((prev) => ({ ...prev, ...patch }));
  }
  async function process() {
    const task = ++serial.current;
    clearResults();
    setError("");
    setBusy(true);
    setProgress(0);
    const next: Result[] = [];
    try {
      if (
        !Number.isFinite(dimension) ||
        dimension < 128 ||
        dimension > 4096 ||
        !Number.isFinite(quality) ||
        quality < 1 ||
        quality > 100
      )
        throw Error();
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i],
          box =
            mode === "crop"
              ? crop
              : { x: 0, y: 0, width: source.width, height: source.height };
        if (
          !Object.values(box).every(Number.isInteger) ||
          box.x < 0 ||
          box.y < 0 ||
          box.width < 1 ||
          box.height < 1 ||
          box.x + box.width > source.width ||
          box.y + box.height > source.height
        )
          throw Error();
        const bitmap = await createImageBitmap(source.file);
        try {
          if (task !== serial.current) return;
          const outputType = format === "auto" ? source.file.type : format;
          const scale = Math.min(
            1,
            dimension / Math.max(box.width, box.height),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(box.width * scale));
          canvas.height = Math.max(1, Math.round(box.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw Error();
          if (outputType === "image/jpeg") {
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(
            bitmap,
            box.x,
            box.y,
            box.width,
            box.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          let blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (v) => (v ? resolve(v) : reject(Error())),
              outputType,
              quality / 100,
            ),
          );
          canvas.width = 0;
          canvas.height = 0;
          if (blob.type !== outputType) throw Error();
          const retained = keepSmallerOriginal(source.file, blob, {
            preserve,
            resized: scale < 1,
            cropped: mode === "crop",
          });
          if (retained) blob = source.file;
          if (task !== serial.current) return;
          const name = retained
            ? source.file.name
            : source.file.name.replace(/\.[^.]+$/, "") +
              "-" +
              (mode === "crop" ? "crop" : "compressed") +
              "." +
              (outputType === "image/jpeg"
                ? "jpg"
                : outputType === "image/png"
                  ? "png"
                  : "webp");
          next.push({
            retained,
            blob,
            url: URL.createObjectURL(blob),
            name,
            original: source.file.size,
          });
          setProgress(i + 1);
        } finally {
          bitmap.close();
        }
      }
      if (task === serial.current) {
        resultRef.current = next;
        setResults(next);
      }
    } catch {
      if (task === serial.current) setError(t("invalidImage"));
    } finally {
      if (task === serial.current) setBusy(false);
      if (task !== serial.current || next.length !== sources.length)
        next.forEach((r) => URL.revokeObjectURL(r.url));
    }
  }
  const source = sources[0];
  const pointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(
        Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * source.width,
      ),
      y: Math.round(
        Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) *
          source.height,
      ),
    };
  };
  return (
    <div className="media-workbench">
      <div className="tool-options">
        <div className="segmented">
          {["compress", "crop"].map((v) => (
            <button
              key={v}
              aria-pressed={mode === v}
              onClick={() => {
                reset();
                setMode(v);
              }}
            >
              {t(v === "compress" ? "compressImage" : "cropImage")}
            </button>
          ))}
        </div>
        <FilePicker
          inputRef={inputRef}
          label={t("chooseImages")}
          emptyText={t("noFilesSelected")}
          fileNames={sources.map((s) => s.file.name)}
          accept="image/jpeg,image/png,image/webp"
          multiple={mode === "compress"}
          disabled={busy}
          onChange={(e) => void choose(e.target.files)}
        />
      </div>
      <p className="tool-hint">{t("imageHint")}</p>
      <p className="tool-hint">{t("localFilesHint")}</p>
      <p className="tool-hint">{t("compressionHint")}</p>
      <div className="tool-options">
        <label>
          {t("imageFormat")}
          <select
            value={format}
            onChange={(e) => {
              setting();
              setFormat(e.target.value);
            }}
          >
            <option value="auto">{t("autoImageFormat")}</option>
            <option value="image/webp">WebP</option>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
        <label>
          {t("quality")}
          <NumberInput
            min={1}
            max={100}
            disabled={format === "image/png"}
            value={quality}
            onChange={(value) => {
              setting();
              setQuality(value);
            }}
          />
        </label>
        <label>
          {t("maxDimension")}
          <NumberInput
            min={128}
            max={4096}
            value={dimension}
            onChange={(value) => {
              setting();
              setDimension(value);
            }}
          />
          px
        </label>
      </div>
      {mode === "compress" && (
        <label className="preserve-original">
          <input
            type="checkbox"
            checked={preserve}
            onChange={(e) => {
              setting();
              setPreserve(e.target.checked);
            }}
          />
          {t("preserveOriginal")}
        </label>
      )}
      {mode === "crop" && source && (
        <>
          <p className="tool-hint">{t("cropHint")}</p>
          <div className="tool-options">
            {(
              [
                ["x", "cropX"],
                ["y", "cropY"],
                ["width", "cropWidth"],
                ["height", "cropHeight"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {t(label)}
                <NumberInput
                  min={key === "width" || key === "height" ? 1 : 0}
                  max={
                    key === "x" || key === "width"
                      ? source.width
                      : source.height
                  }
                  value={crop[key]}
                  onChange={(value) => updateCrop({ [key]: value })}
                />
              </label>
            ))}
            <button
              onClick={() => {
                setting();
                setCrop({
                  x: 0,
                  y: 0,
                  width: source.width,
                  height: source.height,
                });
              }}
            >
              {t("resetCrop")}
            </button>
          </div>
          <div
            className="crop-stage"
            style={{
              aspectRatio: `${source.width}/${source.height}`,
              width: `min(100%, 720px, ${(source.width / source.height) * 600}px)`,
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = pointer(e);
              setting();
            }}
            onPointerMove={(e) => {
              if (
                !drag.current ||
                !e.currentTarget.hasPointerCapture(e.pointerId)
              )
                return;
              const pos = pointer(e),
                start = drag.current;
              setCrop({
                x: Math.min(start.x, pos.x),
                y: Math.min(start.y, pos.y),
                width: Math.max(1, Math.abs(pos.x - start.x)),
                height: Math.max(1, Math.abs(pos.y - start.y)),
              });
            }}
            onPointerUp={(e) => {
              drag.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <img src={source.url} alt={source.file.name} draggable={false} />
            <div
              className="crop-selection"
              style={{
                left: `${(crop.x / source.width) * 100}%`,
                top: `${(crop.y / source.height) * 100}%`,
                width: `${(crop.width / source.width) * 100}%`,
                height: `${(crop.height / source.height) * 100}%`,
              }}
            />
          </div>
        </>
      )}
      <div className="action-bar">
        <div>
          <button
            className="primary"
            disabled={busy || !sources.length}
            onClick={() => void process()}
          >
            {t("processImages")}
          </button>
          {busy && (
            <button
              onClick={() => {
                serial.current++;
                setBusy(false);
              }}
            >
              {t("cancelTask")}
            </button>
          )}
          <button onClick={() => reset()}>{t("clear")}</button>
        </div>
        {busy && (
          <span role="status">
            {t("progressLabel")} {progress}/{sources.length}
          </span>
        )}
        {results.length > 1 && (
          <button
            onClick={async () => {
              const { zipSync } = await import("fflate");
              const entries: Record<string, Uint8Array> = {};
              for (const [i, r] of results.entries())
                entries[`${i + 1}-${r.name}`] = new Uint8Array(
                  await r.blob.arrayBuffer(),
                );
              saveBlob(
                new Blob([zipSync(entries, { level: 0 }) as BlobPart]),
                "devkit-images.zip",
              );
            }}
          >
            {t("downloadAll")}
          </button>
        )}
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {!results.length && mode === "compress" && (
        <div className="media-results">
          {sources.map((s) => (
            <article key={s.url}>
              <img src={s.url} alt={s.file.name} />
              <p>
                {s.file.name} · {s.width} × {s.height} · {size(s.file.size)}
              </p>
            </article>
          ))}
        </div>
      )}
      <div className="media-results">
        {results.map((r) => (
          <article key={r.url}>
            <img src={r.url} alt={r.name} />
            <p>{r.name}</p>
            {r.blob.size > r.original && <p role="status">{t("imageGrew")}</p>}
            {r.retained && (
              <p className="retained-notice">{t("originalRetained")}</p>
            )}
            <p>
              {t("originalSize")}: {size(r.original)} → {t("processedSize")}:{" "}
              {size(r.blob.size)} (
              {((r.blob.size / r.original - 1) * 100).toFixed(1)}%)
            </p>
            <button onClick={() => saveBlob(r.blob, r.name)}>
              {t("download")}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
function size(n: number) {
  return n > 1024 * 1024
    ? (n / 1024 / 1024).toFixed(2) + " MiB"
    : (n / 1024).toFixed(1) + " KiB";
}
