# 1.1.0 扩展工具

新增 10 个工具入口，注册表总计 22 个。`isExtended` 与原高级工具互斥；App 为每个工具保留文本输入/输出，文件仅由当前组件持有，切换时释放。

- `src/tools/extended/Workbench.tsx`：文本双栏、示例、复制、导出、应用内全屏及 SplitDivider，扩展 Worker 8 秒超时/取消，Markdown 300ms 防抖本地预览。
- `logic.ts`：文本整理、Unicode、HTML 实体、JSON/CSV/YAML、颜色和随机密码的纯算法。文本 2 MiB；数据格式转换拒绝不安全整数和超过 100 层的对象；CSV 首行字段名、严格引号与列数检查，保留字符串值，不自动执行公式；密码使用 crypto.getRandomValues 与拒绝采样及安全洗牌。
- `extended.worker.ts`：算法隔离运行，错误映射到集中语言文件。
- 二维码：本地 qrcode 按约 512px 整数模块缩放生成 PNG，限制 1,000 UTF-8 字节，支持 L/M/Q/H 纠错。
- Markdown：marked + DOMPurify，256 KiB，禁止脚本、外部图片、嵌入页面与内联样式；预览在空 sandbox 的 iframe 内，静态 HTML 导出附带 CSP。
- `ImageTool.tsx`：Canvas/createImageBitmap 支持 JPEG、PNG、WebP；10 张，每张 12 MiB/16MP、合计 60 MiB/40MP。支持质量、最大边长、不放大、透明 JPEG 填白、压缩前后体积显示、批量 ZIP（存储不重复压缩）。裁剪支持拖动和原图像素坐标；切换设置使旧结果失效。
- `PdfTool.tsx` / `pdfText.ts`：PDF.js 独立本地 worker 提取文字，按位置分行，docx 导出可编辑段落和页分隔。20 MiB、100 页、100 万字符、120 秒超时；支持取消，扫描/空白页提示，加密 PDF 不支持。明确不还原表格、图片和原始排版。
- `vite.config.ts`：构建时复制 PDF CMaps、标准字体到 public/pdf-assets。所有依赖本地化，Node 服务器补充 .mjs MIME 和 blob 图片 CSP。运行时仍无需 node_modules，未引入原生跨平台运行依赖。
- `src/locales/extended.ts`：新增界面中英文集中维护。

开发依赖恢复后才能构建；完成开发需再次移出 node_modules 与构建缓存。分发脚本只输出到应用外系统临时目录，不在工作区生成 release/。

## 目录与体验补充
- ToolCatalog 按注册分类完整列出 22 项，支持分类、用途搜索和收藏，使用主工作区纵向滚动。
- qr.ts 负责本地 QR Canvas 和标题换行；上下标题收紧间距，中间标题最多 8 字/14–24px/两行，强制 H 纠错并限制覆盖范围。Workbench 通过取消旧请求和 120ms 防抖实时更新，期间保留预览并暂禁下载，避免闪空白或导出过期设置。
- imagePolicy.ts 决定是否回退较小原图，仅限未裁剪、未缩放、MIME 未改且用户开启保留选项；返回原图会保留原始元数据，界面有明确说明。
- Markdown 编辑区填充工作区剩余高度，空输入显示提示而非白框；预览跟随主题，导出静态 HTML 默认浅色。

共享控件：components/FilePicker.tsx 自定义文件按钮随语言切换，避免原生 Choose Files 文案；components/NumberInput.tsx 使用本地字符串草稿，数字业务状态仅在非空合法整数时更新，避免清空时强制生成 0。

中间标题渲染仅取前八个 Unicode 字符，不修改输入，提供截取提示；字体在设置值至 14px 之间自适应，仍保留两行和覆盖面积上限。错误提示区不可被 flex 压扁。
