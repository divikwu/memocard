# 旧 UI 清理与统一入口

2026-10-25。新版作为唯一产品 UI；清理范围为旧纯视图、旧样式与旧 Storybook。共享控制器、编辑器内核、文件/宿主桥接和原生表面协议继续保留。此记录描述代码迁移，未把内存 fixture、编译或浏览器窄屏测试称作真实文件系统与设备验收。

## 入口与维护职责

| 用途 | 当前入口 | 输出 / 运行方式 |
| --- | --- | --- |
| Web / H5 / macOS / iOS WebView / 本机服务 | `apps/ui/src/main.tsx` → `WebAppearanceProvider` → `App` → 当前视图 | 唯一生产输出 `apps/ui/dist`；`pnpm --filter @memocard/ui dev` / `build` |
| iOS 原生导航及系统表面 | `ui-next/native/IOSAppChrome.tsx` 与各业务 surface producer | 保留既有 slot、action、busy、focus、vault binding 和原生确认 |
| Storybook | `.storybook-next` + `ui-next/stories` | `pnpm --filter @memocard/ui storybook` / `build:storybook` |
| 整页状态与流程 | `ui-next/preview` + `ui-state-fixtures` | `pnpm --filter @memocard/ui dev:states` / `build:states:ui-next` |
| 共享业务及内容 | 保留的 `src/*core`、hooks、Markdown管线、bridge和浏览器存储 | 由当前视图注入控件，不再默认回退到旧视图 |

删除旧 UI 不等于删除整个 `src`。当前编辑器、属性、标签、撤销、搜索、草稿、附件、安全清洗与保存仍使用保留模块。生产依赖图和 [维护清单](component-inventory.md) 同时追踪 `src`、`ui-next`；测试/Story/预览模块不进入产品图。

## 功能与偏好兼容

当前视图覆盖主页最近/固定、标签与快捷筛选、卡片/列表、分页、编辑/保存/冲突、搜索与H5返回会话、快速记录、草稿恢复/删除、回收站预览/恢复/永久删除、设置、权限和断线恢复。iOS 继续使用 SwiftUI / UIKit 的导航、搜索、快速记录和系统确认，Web 内容切为当前视图；原生适配必须独立回归，不能以Web/H5功能覆盖推断通过。

外观仍支持3种显示模式、8种强调色、2种中性色，正文风格沿用7项共享偏好。旧设备外观键只在新键缺失时作为迁移输入，保留已有字体/圆角值；新的常规圆角菜单采用0/7.2/8/10/14px，Noto Sans SC/PingFang/Songti 在已有值时显示兼容选项。兼容已有偏好不表示常规菜单与旧版选项完全相同。

## 设计门禁

- token catalog 以当前 `ui-next/theme.css` 和明确覆盖来源为准，记录实际生产消费者与共享/native runtime outputs；删除旧主题运行时生成链，不维护第二套生产主题。
- `check-design-inventory` 从唯一默认入口追踪两处实际生产源码目录，拒绝漏登、不可达条目和失效验证引用。
- spacing / typography 读取可达主题与组件CSS，icons保留真实Lucide/native导出范围，不能把该目录当作完整Hugeicons清单。
- 旧sidebar尺寸JSON继续生成原生所需常量；未被当前Web消费的条目按基准/原生职责登记，不以同值推断消费关系。
- bundle budgets按当前manifest的路由依赖闭包、初始入口与字体分别约束，继续拒绝旧UI产物、Radix与懒加载全局utilities。

## 验证记录

本次维护回归38项通过，包含生产图、token定义/覆盖/未知引用/循环与所有权反例、spacing/icon/typography目录和bundle依赖闭包。生产图登记84个TSX，token catalog登记356个CSS名称、14个runtime output、28个原生/基准尺寸和107个消费文件；计数是维护范围，不是状态覆盖率。

默认入口浏览器验收使用Chromium在OPFS隔离沙盒建立笔记库，实际新建保存并读取生成的`.md`，刷新后搜索、删除、回收站预览和恢复；WebKit在390px验证初始引导与设置，两个引擎无console error。自动化由 `scripts/test-default-ui.mjs` 在生产构建后执行，未向用户真实目录写入，也未自动触发系统picker。详细本地证据位于 `build/verification/legacy-ui-retirement/browser.json`。

原生真机软键盘、系统附件/目录picker、safe-area、跨进程真实用户目录写入和双端同步仍需单独验收。代码切换与清理完成不表示已安装客户端被替换或已公开发布。

## 最终验证（2026-10-25）

- `pnpm verify:web` 通过：共享业务55文件/1025项、新版45文件/391项，以及MCP/CI/类型/lint/生产构建和包体积检查；默认 `pnpm test` 现在同时执行共享与新版回归。
- `pnpm verify:ui-next` 通过：新版类型/lint/391项回归及独立状态Preview构建。
- `pnpm verify:design` 通过：维护反例、生成检查、新版Storybook构建与Chromium/WebKit 136项真实浏览器回归。
- 正式默认产物的两引擎验收通过；Chromium使用实际OPFS/IndexedDB完成创建、保存、读回Markdown、重载、搜索、删除与恢复，最后等待正文预览可见。仅系统目录picker被替换为沙盒句柄。
- `pnpm verify:native` 通过：Swift Core133项、真实loopback读取11项、本机Web14项；`pnpm test:service` 全部通过。
- `pnpm test:native-surfaces` 通过：13项Python回归和iOS 27.1 Simulator上的独立probe（6个原生订阅场景及字段、交互和预览保护）；probe已卸载，未加载WebView或用户目录。
- Mac、iOS Simulator、service最终构建通过；Mac/service签名校验通过。三个App内Web树的587份文件与最终`dist`逐文件SHA256一致，未安装或启动这些产品包。资源核对记录保存在本地 `build/verification/legacy-ui-retirement/native-resources.json`。

浏览器边界：本机Firefox在启动阶段报告 `Could not find profile folder.`，未执行用例；CI仍强制启用Chromium/Firefox/WebKit矩阵。Storybook回归保留ResizeObserver循环、隐藏图表零尺寸与Base UI动画诊断，退出码通过不代表其控制台全净；正式默认入口的两引擎验收未出现console error。完整真机与系统picker验收仍按前述边界单独进行。

## 生产包成本

使用同一依赖安装分别构建迁移前HEAD（`6214317`，临时独立源码目录）与迁移后的默认入口，按manifest静态依赖闭包去重累加每个JS/CSS的raw与gzip字节。以下是本地构建成本，不是浏览器首屏时间或网络性能测量。明细见 [bundle成本记录](verification/2026-10-25/ui-retirement/bundle-metrics.json)。

| 范围 | 旧默认入口 gzip | 当前默认入口 gzip | 说明 |
| --- | ---: | ---: | --- |
| 初始JS/CSS闭包 | 194,987 B | 316,274 B | 当前主题与默认字体声明增加，不能称初始包全面减小 |
| 主页+快速记录，不含可选卡片正文renderer | 515,712 B | 432,848 B | 同类静态闭包，不等于实际有数据页面总网络流量 |
| 编辑器+完整Markdown renderer | 651,810 B | 793,883 B | 当前富文本、属性与完整正文组合成本增加 |
| 初始入口CSS raw | 115,848 B | 393,846 B | 新版包含218个font-face声明；声明不等于全部字体立即下载 |
| 打包字体（woff/woff2） | 6,245,480 B | 17,701,416 B | 保留新版字体选项、normal/italic字形子集与双CJK companion；按字形和字体选择加载 |

保持单JS 600KiB限制。当前入口CSS限制400KiB、初始闭包330KiB gzip，各路由在测得成本上保留约4–8%空间；字体按normal非CJK、italic非CJK、双CJK分别限制3.75/3.75/10.5MiB。已将设置页恢复为按路由加载，并将生产Tailwind扫描范围与Storybook展示代码分开；没有通过移除字体或预览能力压低数值。门禁继续拒绝旧视图、故事/夹具、Radix或懒加载global utilities进入产品产物。

## 全面审查后的优化（2026-10-25）

上述数据属于首次入口迁移。后续审查发现的旧工具链、无用样式与文档契约已完成清理：

- shadcn 的 utils alias 和两个共享编辑组件统一使用当前 `ui-next/lib/utils`；删除旧 helper，新增语义尺寸、时长、阴影、缓动与状态回调的 10 项回归。
- 删除无调用的 `collectionClasses` 和旧 Web token CSS/TS 文件、生成格式、专属消费识别分支。保留原生 Swift 常量与基准文档；生成检查和实际 CSS 产物检查共同阻止旧输出、旧全局 token 和旧网格工具类回流。当前 token 消费文件数为 106，其余定义及原生输出数量未变。
- Web 标签基准默认使用已发布 UI-next `de51cec`，修复历史模块依赖与 `useSidebar` mock；1,000 / 5,000 / 10,000 标签的三种结构均得到基线/当前各 9 组、每组 11 次结果。共享依赖使用当前版本，测量是 SSR 冷挂载，不能作为完整历史 App、DOM 或 FPS 对比；结果接近，不宣称性能改善。
- 更新现行主题、排版、组件、编辑器和平台职责，历史双 UI 与旧主题工程记录明确标为历史。新增 18 份现行文档的源码路径、链接与退役命令检查及 5 项反例。
- 冻结锁文件的离线安装清除 17 个多余依赖；清除旧 Storybook 缓存和四处可重建 Apple/service 输出，删除前文件字节合计约 1.31GB，不等于精确磁盘释放量。恢复备份与历史验证材料保留。

本轮重新执行类型、lint、共享 1,022 项、新版 401 项、Storybook Chromium/WebKit 136 项和默认生产浏览器 2 条流程，全部通过；维护目录、token/icon/spacing/typography、CI/构建脚本与 palette 检查通过。Swift Core 133 项、loopback 11 项、本机 Web 14 项、原生侧栏 6 项、服务回归，以及 13 项 Python 与 Simulator surface probe 全部通过。probe 已卸载；没有使用真实用户目录。

生产、状态预览、Storybook、Mac、iOS Simulator 和 Service 构建通过，Service 签名校验通过；三份 App 和 Apple 源资源的 587 个 Web 文件与生产构建逐文件 SHA256 一致。当前初始静态闭包为 315,924 B gzip，主页加快速记录为 432,498 B，编辑器加完整 Markdown 为 793,487 B；原预算继续通过。这些是打包成本，不是运行速度测量。

具体数值与资源一致性见[本轮验证证据](verification/2026-10-25/ui-cleanup-followup/verification.json)。上文 Firefox、Storybook 控制台和真机验收边界继续适用；本轮只提交本地分支，未推送、合并、安装或替换现有客户端。

## 跨端候选验收跟进（2026-10-26）

交付工作在 [PR #64](https://github.com/divikwu/memocard/pull/64) 继续。新增回归修复均来自实际验收：

- 本机 Web 服务仅允许静态字体 GET 使用合法的 `font-retry` 正整数参数，支持字体加载失败后的重试；API、其他资源和异常 query 仍拒绝。真实 HTTP 回归 16 项通过，本机服务完整回归共 45 项通过。
- 成功删除笔记后，同步移除保留搜索会话中的结果，废弃旧请求并按原查询和已加载页数获取新分页游标；保留当前条目身份和返回位置。刷新失败后的 Web 与原生“重试”使用同一恢复动作，避免重新使用旧游标。恢复笔记后仍可通过后续搜索出现，不维护永久排除名单。
- Service Release 构建显式关闭 Xcode 的基础 entitlement 注入，修复额外的调试权限；声明的 sandbox、用户目录授权和网络权限不变。候选签名权限与现有安装版本逐项一致。

独立 iOS Simulator 候选 `2165f7f` 已通过实际系统目录选择，载入六篇测试笔记；中文原生搜索、详情返回保留查询，以及 WebView 输入后经原生返回保存均已操作，并从实际 Markdown 文件读回保存标记。该记录对应当时的候选，后续重建包仍需交互复验。

Mac 再次锁屏后，用户选择先继续后台验收。macOS 独立目录选择、剩余 Simulator 交互和真机安装验收仍未完成；设备签名恢复及候选构建通过不能替代这些验收。PR 保持草稿，现有安装客户端尚未替换，不能将代码清理完成称为跨端交付完成。
