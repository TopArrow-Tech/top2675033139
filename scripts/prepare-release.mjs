import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, deflateRawSync } from "node:zlib";
const root = fileURLToPath(new URL("../", import.meta.url));
const asset = path.join(root, "assets");
const release = path.join(root, "release");
await fs.mkdir(asset, { recursive: true });
await fs.mkdir(release, { recursive: true });
function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
// Original vector identity: code brackets and slash on a rounded blue tile.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#326ddd"/><g fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"><path d="M183 177 106 256 183 335M329 177 406 256 329 335M281 149 231 363"/></g></svg>';
await fs.writeFile(path.join(asset, "devkit.svg"), svg);
const points = [
  [
    [183, 177],
    [106, 256],
  ],
  [
    [106, 256],
    [183, 335],
  ],
  [
    [329, 177],
    [406, 256],
  ],
  [
    [406, 256],
    [329, 335],
  ],
  [
    [281, 149],
    [231, 363],
  ],
];
function distance(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
    );
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
const scan = Buffer.alloc(512 * (1 + 512 * 4));
for (let y = 0; y < 512; y++) {
  const row = y * (1 + 512 * 4);
  scan[row] = 0;
  for (let x = 0; x < 512; x++) {
    let alpha = 0,
      white = 0;
    for (let sy = 0; sy < 2; sy++)
      for (let sx = 0; sx < 2; sx++) {
        const px = x + (sx + 0.5) / 2,
          py = y + (sy + 0.5) / 2,
          cx = Math.max(112, Math.min(400, px)),
          cy = Math.max(112, Math.min(400, py));
        if (Math.hypot(px - cx, py - cy) <= 112) {
          alpha++;
          if (points.some(([a, b]) => distance(px, py, a, b) <= 14)) white++;
        }
      }
    const i = row + 1 + x * 4;
    const mix = alpha ? white / alpha : 0;
    scan[i] = Math.round(50 + (255 - 50) * mix);
    scan[i + 1] = Math.round(109 + (255 - 109) * mix);
    scan[i + 2] = Math.round(221 + (255 - 221) * mix);
    scan[i + 3] = Math.round((alpha / 4) * 255);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(512, 0);
ihdr.writeUInt32BE(512, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(scan)),
  chunk("IEND", Buffer.alloc(0)),
]);
if (png.length > 200 * 1024) throw Error("Icon exceeds marketplace size");
await fs.writeFile(path.join(asset, "devkit-icon.png"), png);
await fs.writeFile(path.join(release, "devkit-icon.png"), png);
// Preserve notices for every production dependency, including transitive libraries.
const production = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
const visited = new Set();
let notices = "DevKit — Third-party runtime licenses\n";
async function collect(name, parent = root) {
  let base = parent,
    folder;
  while (true) {
    const candidate = path.join(base, "node_modules", name);
    try {
      await fs.access(path.join(candidate, "package.json"));
      folder = candidate;
      break;
    } catch {}
    const next = path.dirname(base);
    if (next === base) throw Error("Missing dependency license: " + name);
    base = next;
  }
  if (visited.has(folder)) return;
  visited.add(folder);
  const pkg = JSON.parse(
    await fs.readFile(path.join(folder, "package.json"), "utf8"),
  );
  notices +=
    "\n===== " +
    pkg.name +
    " " +
    pkg.version +
    " (" +
    pkg.license +
    ") =====\n";
  let found = false;
  for (const file of await fs.readdir(folder)) {
    if (/^(license|licence|notice|authors)(\.|$)/i.test(file)) {
      const info = await fs.stat(path.join(folder, file));
      if (info.isFile()) {
        found = true;
        notices += await fs.readFile(path.join(folder, file), "utf8");
        notices += "\n";
      }
    }
  }
  if (!found) {
    const source = await fs
      .readFile(path.join(folder, pkg.main || "index.js"), "utf8")
      .catch(() => "");
    const header = source.match(/^\s*\/\*([\s\S]*?)\*\//)?.[0];
    if (header && /licen[sc]e/i.test(header)) {
      notices += header + "\n";
      found = true;
    } else {
      const readme = await fs
        .readFile(path.join(folder, "README.md"), "utf8")
        .catch(() => "");
      const section = readme.match(/^#{1,3} +licen[sc]e[\s\S]*$/im)?.[0];
      if (section) {
        notices += section + "\n";
        found = true;
      }
    }
    if (!found) throw Error("License text missing: " + name);
  }
  for (const dependency of Object.keys(pkg.dependencies ?? {}))
    await collect(dependency, folder);
}
for (const name of Object.keys(production.dependencies)) await collect(name);
await fs.writeFile(
  path.join(root, "THIRD_PARTY_NOTICES.txt"),
  notices.trimEnd() + "\n",
);
const target = path.join(release, "DevKit");
await fs.rm(target, { recursive: true, force: true });
await fs.mkdir(target, { recursive: true });
for (const item of [
  "public",
  "server",
  "manifest.json",
  "THIRD_PARTY_NOTICES.txt",
])
  await fs.cp(path.join(root, item), path.join(target, item), {
    recursive: true,
  });
await fs.copyFile(
  path.join(asset, "devkit-icon.png"),
  path.join(target, "icon.png"),
);
await fs.writeFile(
  path.join(target, "README.txt"),
  "DevKit · 开发者效率工具箱\n开发者：栈外手记\n\n在本机顶箭中打开即可使用。12 个工具均在本地处理，无需登录或付费 API。\n支持中英切换、深浅主题、搜索、收藏、最近使用和手动工具联动。\n输入不自动保存；本机浏览器仅保存偏好和工具 ID。\nJSON、SQL、Base64、URL、时间戳、JWT、正则、Diff、Hash、UUID、Cron、进制转换。\nJWT 仅解析，不验证签名；SQL 仅格式化不执行；SHA 摘要不是加密；Cron 是标准五字段。\n单次文本上限 2 MiB；文件摘要上限 32 MiB；复杂正则会超时终止。\nCmd/Ctrl+K 搜索；Cmd/Ctrl+Enter 执行；Esc 关闭弹窗/应用内全屏。\n",
);
const files = [];
async function walk(directory, prefix = "") {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      await walk(path.join(directory, entry.name), relative + "/");
    else
      files.push({
        name: relative,
        data: await fs.readFile(path.join(directory, entry.name)),
      });
  }
}
await walk(target);
if (files.length > 20000) throw Error("Too many files");
let total = 0;
for (const f of files) {
  total += f.data.length;
  if (
    f.name.length > 200 ||
    f.data.length > 256 * 1024 * 1024 ||
    /(^|\/)(?:\.git|node_modules|data|logs|runtime|backups)(\/|$)/.test(f.name)
  )
    throw Error("Unsafe package path: " + f.name);
}
if (total > 1024 ** 3) throw Error("Package too large");
// Portable ZIP with relative paths, UTF-8 names, no platform-specific metadata.
const local = [],
  central = [];
let offset = 0;
for (const { name, data } of files) {
  const n = Buffer.from(name),
    compressed = deflateRawSync(data),
    crc = crc32(data),
    header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(0x21, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(n.length, 26);
  local.push(header, n, compressed);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50);
  c.writeUInt16LE(20, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x800, 8);
  c.writeUInt16LE(8, 10);
  c.writeUInt16LE(0x21, 14);
  c.writeUInt32LE(crc, 16);
  c.writeUInt32LE(compressed.length, 20);
  c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(n.length, 28);
  c.writeUInt32LE(offset, 42);
  central.push(c, n);
  offset += header.length + n.length + compressed.length;
}
const directory = Buffer.concat(central),
  end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
await fs.writeFile(
  path.join(release, "DevKit-market-ready.zip"),
  Buffer.concat([...local, directory, end]),
);
console.log(
  JSON.stringify({
    files: files.length,
    uncompressedBytes: total,
    iconBytes: png.length,
    package: "release/DevKit-market-ready.zip",
  }),
);
