# 项目总览

## 标识
- 应用 ID：zhanwai-devkit（发布后不可修改）
- 显示名：开发者效率工具箱 / DevKit
- 开发者：栈外手记
- 版本：1.0.1，完整 12 工具
- 运行时：顶箭 Node，manifest 最低 22；开发机顶箭内置 Node 24

## 技术栈
React 18、TypeScript、Vite、Monaco、Lucide；json-bigint、Temporal polyfill；Vitest。无需数据库。界面手写 CSS，资源本地化。

## 目录结构
- manifest.json：顶箭启动配置
- server/main.mjs：无第三方运行依赖的静态服务和 /__health
- public/：Vite 生产产物，包含本地编辑器和 Worker，必须随应用分发
- src/app/App.tsx：双语桌面工作台、工具状态、操作、设置、错误边界
- src/components/Editor.tsx：按需加载 Monaco，配置本地 Worker
- src/tools/{json,base64,timestamp,url}/logic.ts：独立工具逻辑
- src/tools/shared.ts：错误和输入限制；core.ts：测试用统一导出
- src/workers/process.worker.ts：按工具动态加载算法，处理结果或错误
- src/locales/index.ts：中文、英文界面文字
- src/tests/core.test.ts：核心逻辑测试
- _doc/：架构、方案、测试、变更记录
- data/：开发机 TOPARROW_DATA_DIR，不提交、不打包

## 功能模块
JSON：格式化、压缩、校验、树形视图、自定义缩进、大数值保真。
Base64：标准、URL-safe、Unicode 双向转换、严格校验。
时间戳：明确秒/毫秒、日期转换、IANA 时区、ISO/本地/UTC、夏令时校验。
URL：URI 组件/完整 URI 编解码，重复 Query 参数的解析、编辑和生成。
全局：搜索、深浅主题、中英切换、复制粘贴下载、示例、清空、快捷键、偏好设置。

## 状态与隐私
输入仅在 React 内存中保留，不写 localStorage、URL 或服务日志；工具切换保留本次页面会话输入，刷新清空。localStorage 的 devkit.preferences 仅保存语言、主题、字号与缩进。
所有转换在独立 Worker 中进行，单次输入上限 2 MiB，8 秒超时后终止。切换工具、修改输入和新操作会终止旧任务，防止过期结果覆盖。
顶箭端口由环境注入；仅监听 127.0.0.1。本期不产生业务文件，不需要数据库。

## 第二至四轮后的当前结构
现已提供完整 12 个工具。JSON、Base64、URL 沿用基础工作台；时间戳由独立的 `src/tools/timestamp/Workbench.tsx` 提供三行同屏转换；新增八工具由 `src/tools/Workbench.tsx` 按工具渲染操作和结构化结果，算法分别位于对应目录 `logic.ts`，通过 `src/workers/advanced.worker.ts` 懒加载。正则超时 1.5 秒，其余 8 秒，支持取消任务。

`src/app/registry.ts` 为全部工具的唯一注册表，包含 ID、分类、图标、关键词及示例。`src/locales/advanced.ts` 扩展双语。主状态按工具隔离输入、第二输入、输出、错误和结构化结果；不写入持久化。统一手动传递输出到目标输入，覆盖前确认，保留来源并等待主动执行。

收藏、最近使用通过 `devkit.preferences` 保存工具 ID；全局清空会同时释放结构化结果、文件选择和工作线程。日期采用 `timestamp/DateInput.tsx` 固定分隔符数字分段，方向与单位使用并排按钮。JSON 与高级工具均支持应用内放大。

新增依赖：sql-formatter 15.9.0（词法压缩使用其内部 lexer，升级需回归测试）、diff、cron-parser。Hash 使用 Web Crypto；UUID 使用安全随机数；进制使用 BigInt。不增加运行时数据库或业务文件。

`assets/` 为原创图标；`scripts/prepare-release.mjs` 汇总生产依赖许可、生成图标与分发 ZIP。运行目录和 ZIP 输出到系统临时目录 `devkit-release-*`，不再在应用根目录生成 release/，避免顶箭直接打包应用目录时带入重复安装包及草稿。

## 紧凑工作区与并排全屏
标题旁放置工具联动，收紧导航、顶部、操作栏和间距。JSON 以 CSS 固定定位展开同一个双栏容器，两个 Monaco 实例保持挂载，顶部保留格式化/压缩/校验/树形及退出；背景控件 inert，Esc 恢复焦点。
时间戳工作台包含当前时间戳开始/停止/刷新、时间戳转日期、日期字符串转时间戳、数字分段转时间戳三行，每行独立输入、单位、结果、校验及复制。表单/结果存放当前工具 details 内存状态；共享可取消 Worker，UTC 等详情按需展开。日期字符串支持标准斜杠日期规范化，仍保留严格日期及时区校验。

## 固定日期模板与分栏调整
`timestamp/MaskedDateInput.tsx` 作为日期字符串行适配器，复用 `DateInput.tsx` 的六段数字输入外观，两行的占位符、字号和间距一致；`mask.ts` 辅助处理整段数字粘贴。三行共享 CSS grid-area，通过容器查询在窄区域统一换行，并为旧浏览器提供媒体查询后备。
JSON 双栏加入 `editor/SplitDivider.tsx`；`split.ts` 限制 20%–80% 比例。拖动由 Pointer Capture 跟踪，动画帧合并更新；支持双击/Enter 均分、方向键、Home/End。宽度只在页面会话内保存，不记录输入内容，不重新创建编辑器。

## 2026-11-04 工作区扩展
高级工具的全屏改为整个 Workbench 固定定位展开，保留选项、操作、双栏输入和结构化结果，Esc 退出并恢复焦点；基础编码工具沿用 JSON 双栏全屏。时间戳组件挂载时按照当前单位填入当前 Unix 值，清空重置为当前秒值。两种日期输入目前能力相同，标为输入 A/B，支持独立填写两组日期。

## 省略日期字段与统一分栏
日期输入转换前在 input.ts 中补齐空月日为 01、空时分秒为 00，保留严格校验及 ISO 偏移；输入 B 按所选时区初始化当前年份。高级工具全屏复用 editor/SplitDivider.tsx，左右比例仅保留于页面内存，文本对比并排结果同步比例。

文本对比全屏通过 HeightDivider 调节上方原文/新文本与下方差异结果的高度，保留最小可见区域；支持拖动、上下方向键、双击恢复默认。

## 发布目录体积
node_modules 不是运行依赖，发布前应移出应用目录或删除；仅修改源码后需要恢复依赖并重新构建 public。当前开发依赖在系统临时目录以 devkit-build-deps-* 暂存，若系统已清理则按 package-lock.json 重新安装。不要以软链接把开发依赖放回待发布目录。
