# MemoCard 性能与加载审查 · 2026-10-11

结论：当前优先级最高的是笔记库扫描成本，以及扫描进入打开、保存、属性和轮询等交互路径。骨架屏改善了详情刷新时的显示，但还没有缩短数据就绪时间。建议先消除已定位的日期排序热点和重复扫描，再优化加载依赖及前端渲染。

本轮交付为代码审查、测量和优化目标，没有实施性能改动。上一轮 `App.tsx`、`App.test.tsx` 的详情刷新修复仍是未提交状态；本报告以包含该修复的工作区为基线，HEAD 为 `ad66615`。

## 范围与证据边界

审查覆盖 React 页面与编辑器、浏览器文件库和 IndexedDB、Swift 文件库、Apple 宿主与 WKWebView、本机 HTTP 服务、MCP 适配器、contracts、构建和 CI 的主要调用链。不是对每个文件逐行证明性能正确。

实测环境为 Apple M4 / 16 GB / macOS 27.0.1。浏览器测量使用已运行的本机测试服务，无网络或 CPU 限速；没有修改真实笔记内容。原生基准使用 Swift release 构建，独立临时目录中的 Obsidian 兼容库，每篇正文 2,080 UTF-8 字节，100 / 1,000 篇笔记。未测 iOS 真机、iCloud 下载延迟、Chrome 文件系统 API 的真实大库、10,000 篇笔记和长时间内存增长。

原生基准每种规模执行一次初次读取和一次暖读取；“初次”指新 store 的解析缓存，不是磁盘冷缓存。浏览器详情刷新为一次样本，编辑器基准每种文档插入十次。以下均不能当作 p95、线上指标或跨设备保证。临时副本的排序实验也尚未经过功能回归，不是可直接发布的补丁。

本地证据保存在 `verification-artifacts/performance-review-2026-10-11/`，该目录已被项目忽略：原生基线、排序对照、采样栈、浏览器网络时序、编辑器基准源码与结果、现有测试日志。报告中的时间表足以保留主要结论；原始证据仅包含合成库和已去除凭据、笔记正文的浏览器元数据。

## 实测基线

### 原生文件库

| 操作 | 100 篇暖读取 | 1,000 篇暖读取 | 1,000 篇排序实验 |
| --- | ---: | ---: | ---: |
| `getStatus` | 651 ms | 9,804 ms | 1,158 ms |
| `queryNotes`，复用 status 快照，默认 50 条 | 24 ms | 223 ms | 222 ms |
| `listTags`，复用快照 | 1.2 ms | 2.4 ms | 2.5 ms |
| `listFolders`，复用快照 | 1.0 ms | 1.1 ms | 1.0 ms |
| `getNote` | 654 ms | 9,737 ms | 1,093 ms |
| `getNoteProperties` | 1,391 ms | 20,361 ms | 3,022 ms |

1,000 篇的初次 `getStatus` 为 10,397 ms，初次列表为 1,298 ms，单篇读取为 9,756 ms，属性为 20,484 ms。可见解析缓存有作用，但没有消除暖读取中的主要扫描成本。

对照只在临时源码副本中把 `createdAt` 从“比较时解析”改为“每篇在排序前解析一次”，保留 Date 比较与 ID 决胜规则。1,000 篇暖 `getNote` 耗时下降约 89%，属性下降约 85%。实验没有去掉文件协调、哈希或 coverage 判断。采样栈也命中 `scan → sort → parseDate → ISO8601DateFormatter.init`，因此日期排序是有采样和对照支持的热点。

### 当前测试库的详情刷新

从导航到自动化观察到“笔记内容”可见约 **1.77 秒**；该数值包含观察开销，不等同于精确的首次可编辑打点。关键请求如下，时间相对于首个捕获的资源请求；与页面导航时钟有小幅偏移。

| 阶段 | 开始 | 结束 | 耗时 |
| --- | ---: | ---: | ---: |
| `getEnvironment` | 53 ms | 60 ms | 8 ms |
| `getStatus` | 53 ms | 717 ms | 664 ms |
| `listVaults` | 718 ms | 721 ms | 3 ms |
| `getDrafts` | 722 ms | 724 ms | 2 ms |
| 列表、标签、目录 | 724 ms | 747 ms | 23 ms |
| `getNote` | 756 ms | 1,360 ms | 604 ms |
| Editor / Markdown 动态资源开始 | 1,364 ms | — | — |

进入编辑器时，`/assets/` 资源响应体累计 **2,282,658 B，约 2.28 MB**，其中 JS / CSS 为 2,194,310 B。资源没有 HTTP 压缩，`encodedBodySize == decodedBodySize`；捕获的响应均为 `no-store, private`。该总量不包含 API、HTML 和 favicon，不是完整页面传输总量。

详情额外加载的主要 JS：Editor 790,882 B、Markdown 604,816 B。当前入口 JS / CSS 的 gzip 检查为 214,323 B，预算为 215,040 B；通过预算只说明入口通过，不能说明整个详情路由轻量。已观察到的详情 JS / CSS 按文件离线 gzip 后约 664 KB，仅用于体积比较，服务没有实际这样传输。

### 编辑器合成 CPU 基准

真实 `RichMarkdownEditor` 在 jsdom 中装载纯文本段落，每次在开头插入一个字符。未包含父级 `EditorSession`、磁盘保存、浏览器布局、真实按键和绘制。

| 文档 | 挂载 | 十次更新中位数 | 最大值 |
| --- | ---: | ---: | ---: |
| 100 段，19,388 B | 108 ms | 1.0 ms | 5.4 ms |
| 1,000 段，194,888 B | 88 ms | 4.9 ms | 9.0 ms |
| 5,000 段，978,888 B | 497 ms | 22.7 ms | 38.1 ms |

挂载受模块预热影响，不可据此判断 1,000 段比 100 段更快。更新成本随文档增长，但本基准没有证明当前普通文档存在严重输入卡顿；复杂标题、标签、表格、公式及完整保存链路还需浏览器 profiling。

## 按优先级排序的发现

P1 表示核心交互已出现显著延迟或有超时风险，应先处理；P2 表示下一阶段优化或需补充场景测量。不同发现共享同一个扫描热点，预期收益不能相加。

### F1 · P1 · 排序在比较器内反复解析日期

位置：`packages/native-core/Sources/MemoCardCore/VaultStore.swift:325`、`:419`、`Models.swift:128`，尤其 `Models.swift:143`。

每次扫描排序都对左右笔记执行 `parseDate`，其内部执行格式校验、日历校验并新建 ISO8601DateFormatter。这把昂贵解析放进通常需要 O(N log N) 比较的过程，所有调用 scan 的读取和保存都受到影响。上述采样及临时 A/B 已确认其显著成本。

queryNotes 也在过滤每篇笔记时无条件 parseDate，即使没有时间条件或游标；排序对照没有修改它，因此列表暖读取仍约 222 ms。该调用是另一处可复用日期键的成本机制，尚未单独做采样对照。

建议先把解析结果作为单次扫描的排序键，必要时再随 parsed cache 缓存并供查询使用；保持跨时区、分数秒和相同时间的排序语义，不能直接假定字符串顺序等于时间顺序。验证日期边界和排序稳定性后，再测 100 / 1,000 / 10,000 篇。

### F2 · P1 · 展开属性会扫描两次，再读取全库属性

位置：`VaultStore.swift:148`、`:150`、`:621`、`:628`；UI 为 `apps/ui/src/NoteProperties.tsx:95`。

已有笔记的 `getNoteProperties` 先调用 `getNote`，触发 scan；随后再次 scan，并通过 `libraryProperties` 协调读取和解析全部非删除笔记的属性。即使当前笔记没有需要聚合的选择项，也先计算全库属性。1,000 篇的暖读取达到 20.36 秒，已经超过本机 Web / native bridge 的 15 秒默认等待预算（`bridge.ts:25`、`:63`）；这是核心操作耗时推导出的 UI 超时风险，本轮没有在真实 1,000 篇浏览器库中端到端触发超时。

属性面板关闭时不会请求，已有这一按需机制。面板开启后，每次保存改变 `note.contentHash` 都会重新获取，放大成本。

建议同一次操作复用一个有效快照和选中笔记来源，建立随文件变更更新的属性定义 / 选项聚合缓存；只在需要选项或继承时读取相关聚合。失效键至少覆盖 vault binding、文件 hash 和 property definition hash。保留库级属性一致性及外部修改冲突判断。

### F3 · P1 · 整库扫描进入打开、保存和后台轮询，争用同一个 actor

位置：`VaultStore.swift:233`、`:260`、`:301`、`:362`、`:462`、`:492`；`apps/ui/src/App.tsx:103`、`:149`；浏览器分支 `browser-vault.ts:245`、`:412`、`:656`。

原生 parsed cache 的命中发生在读文件及 SHA-256 之后：暖缓存仍会枚举目录、协调读取所有 Markdown、计算哈希、处理身份并排序。`getNote` 和 `saveNote` 都扫描全库。`getStatus` 也扫描，而本机 Web / 浏览器文件库每五秒在可见页面轮询 status，再刷新列表及侧栏。读取、保存和草稿都进入同一个 VaultStore actor；同步扫描期间其他操作要排队。后台刷新已有防重入，但它不能缩短单次扫描，也不能合并多标签页及前台事件请求。加载更多后的提前返回发生在 getStatus 之后，仍有扫描。

暖 getStatus 在 1,000 篇达到 9.8 秒，已经长于轮询间隔。保存同样存在扫描成本，是源码确认的机制，本轮未对 saveNote 单独计时。native 宿主还有写入通知与 NSFilePresenter 通知，UI 前台 refresh 不受同一后台 guard 限制，事件突发需要合并验证（`NativeHost.swift:170`、`:255`）。

浏览器分支也逐文件等待 readBytes / hash，兼容库还再次 getFile 取 mtime，并用锁串行扫描；不能把原生秒数直接套用到该分支。

建议把连接健康、索引版本与完整扫描分开；复用按 vault 隔离的快照与 ID→path 索引，同一版本扫描 single-flight，文件通知合并后增量更新，轮询只作低成本兜底。针对修改过的目标文件仍协调读取并检查 baseHash。必须保留 duplicate ID、coverage 不完整、外部改名 / 删除和 iCloud pending 的正确判断；仅靠 mtime 不能保证内容未变。先做单次快照复用，再依据测量决定增量索引深度，不需要立即引入数据库。

### F4 · P2 · 详情恢复等待无关列表数据，编辑器模块也启动较晚

位置：`App.tsx:113`、`:118`、`:124`、`:125`、`:252`、`:389`、`:30`。

初始详情路由必须等 refresh 的 loading 结束，refresh 又等待 status、vaults、drafts、queryNotes、tags、folders。然后 getNote 才开始；Editor 的 lazy import 要到 showEditor 后才触发。网络时序确认了这一串行链路。骨架屏解决了错误列表先出现的问题，但没有改变等待关系。

建议让“宿主与当前 vault 确认、当前笔记、该笔记恢复草稿、编辑器模块”形成最短详情路径，侧栏列表独立更新。在识别详情路由或用户准备打开时预加载 editor，避免把重量转回所有列表首屏。恢复草稿优先于可编辑状态、切库隔离、失效请求不能覆盖新页面等语义需要保留。对同一个同步 store 盲目 Promise.all 并不会让扫描并行，需与 F3 一起设计。

### F5 · P2 · 详情资源和非当前运行模式代码未被现有预算覆盖

位置：`apps/ui/src/bridge.ts:4`、`RichMarkdownEditor.tsx:16`、`:24`、`NoteProperties.tsx:16`；`packages/local-service/Sources/MemoCardLocalWeb/LocalWebServer.swift:269`、`:303`；`scripts/check-ui-bundle.mjs:7`。

bridge 静态导入 browser-vault，把浏览器文件库相关实现带入 native / local-web 公共依赖链；富文本编辑器静态引用完整 Markdown 预览及公式实现，空正文详情也加载相关模块。属性面板虽然不请求关闭状态的数据，但选择器代码仍随 Editor 导入。动态拆包已有基础，实际详情仍读取约 2.28 MB 资源。

本机 HTTP 对入口、哈希静态资源、API 和附件统一 no-store，且没有压缩。刷新不能正常复用这些静态响应。当前局域 loopback 下载本身很快，代码解析、执行和无缓存重载也要一起测量；不能承诺开启 gzip 就能解决 1.77 秒加载。

建议按运行模式延迟导入 transport，把不在详情初始交互中需要的选择器 / 复杂渲染按使用加载；防止拆分制造新的串行请求。哈希化的随应用发布静态资源可采用 private 缓存和合适的 immutable 策略，入口需保证更新，笔记 API、授权和附件维持当前保密与新鲜度策略；预压缩 JS / CSS 是可独立评估的后续项。HTTP 缓存结论不直接适用于 WKWebView 自定义 scheme。

预算应增加列表与详情路由的累计依赖体积和真实传输体积；仅统计 index.html 直接引用会遗漏编辑器与 Markdown。根据 MDN，内容 hash URL 与长期缓存需配套使用，不能给可变入口直接套永久缓存。[HTTP 缓存指导](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)

### F6 · P2 · 图片的 lazy 只推迟图片加载，没有推迟链接解析 / 文件读取

位置：`apps/ui/src/markdown.tsx:17`、`note-image.ts:8`、`:31`、`VaultStore.swift:913`、`browser-vault.ts:662`。

卡片挂载图片后，effect 立即调用 bindNoteImage。对于 `memocard-resolve:`，每个实例立即请求 resolveLink；原生实现先全库扫描，再枚举图片目录。离屏图片也会做这项工作。浏览器文件库的直接图片则立即读取 Blob，之后才赋给 loading=lazy 的 img。相同链接缺乏跨实例 in-flight 去重。直接且已验证的资源 URL 不一定经过 resolveLink，不能把所有图片都算成一次整库扫描。

建议使用每个 vault 版本的路径索引，对相同 sourcePath / target / wiki 解析去重，并在接近视口时才解析 / 读 Blob。保留不唯一链接的拒绝与 binding 检查、对象 URL 回收。用 30 张卡片、同图重复、不同图和离屏图验证请求次数及 actor 排队时间；本轮未测图片库实际秒数。

### F7 · P2 · 卡片先完整解析 Markdown 再裁剪，加载更多累计保留所有卡片

位置：`apps/ui/src/NotePreview.tsx:31`、`:42`、`:75`、`:89`；`components/note-collection.tsx:63`；`markdown.tsx:29`。

compact 只过滤部分标签行，没有限制正文大小，整个正文仍进入 GFM、HTML、sanitize、数学公式等渲染流程，然后用 CSS / DOM 测量裁剪。measure 中存在修改 line-clamp 后立即读尺寸的模式，还为每张卡片建立 ResizeObserver。30 条分页限制了初始数量，但多次加载更多后所有已加载卡片仍挂载。刷新会设置新 notes 对象，未变化的卡片缺乏 hash 驱动的渲染复用。

建议卡片使用保留 Markdown 结构边界的有界摘要，按 contentHash / 路径 / 显示偏好复用结果；批量安排测量，避免反复读写布局。先测首屏长文和累计 300 张卡片，再决定 content-visibility 或虚拟化，保留键盘焦点、滚动位置和展开全文行为。不能靠截断原始 Markdown 或移除 sanitize 换取速度。此项为代码确认的成本机制，尚无卡片浏览器 CPU / layout 对照。

### F8 · P2 · 文档更新与选择变化含全量计算，需用真实复杂文档确认瓶颈

位置：`RichMarkdownEditor.tsx:230`、`:239`；`wysiwyg-markdown.ts:100`；`rich-inline-tags.ts:41`、`:62`；`rich-heading-fold.tsx:49`；`Editor.tsx:32`。

每次内容更新调用 getJSON、全树 fingerprint，再遍历顶层块比较 fingerprint / 序列化。标签规范化扫描旧、新文档，标签 decorations 也遍历全文；标题折叠 decorations 在 view 更新时遍历文档。selection 更新还测量工具栏并更新 React 状态，父 Editor 在 session notify 时重渲染。纯文本基准体现了规模增长，但尚未达到本次样本中的 50 ms 单次更新，不能因此宣称已复现输入延迟。

建议先用 React Profiler 和浏览器 trace 分开量化 ProseMirror、React、序列化与布局。以 transaction changed ranges / plugin state 更新 decorations，复用未变块的源文本与序列化结果，减少无关状态更新。必须保留原始 Markdown、HTML、注释、IME、撤销和标签规范化语义。Tiptap 官方强调隔离编辑器及按需要订阅状态；不要只机械添加 memo 或复制配置开关。[Tiptap 性能指导](https://tiptap.dev/docs/guides/performance)、[React Profiler](https://react.dev/reference/react/Profiler)

### F9 · P2 · 草稿恢复频率与正文保存 debounce 不一致

位置：`apps/ui/src/editor-session.ts:34`、`:42`、`:47`；`VaultStore.swift:842`；`bridge.ts:92`。

正文保存等待 650 ms，但每次 update 都尝试 recover。recoveryQueued 只在任务排队时合并，开始执行就复位；当草稿保存快于按键间隔时，可能每次输入都发送和持久化整篇草稿。native 保存草稿还重新计算标签、JSON 编码、原子写入，并把完整草稿返回，经 HTTP 再解析。dirty 判断也反复 JSON.stringify 正文。与 F3 结合时，草稿会等待扫描；加长超时不能解决排队成本。

建议测量 100 KB / 1 MB 文档连续输入的 saveDraft 次数、字节和持久化延迟，再制定有上限的 coalescing / latest revision 策略，目标是降低重复全量写入，同时明确恢复窗口。保留 save 前持久草稿、隐藏时 recover、切页 flush、冲突草稿保护，不能简单移除 recover。此项未实测写盘频率与崩溃恢复损失窗口。

## 优化目标与验收口径

以下是建议目标，属于产品性能预算，尚未被证明达标，也不是所有设备统一的行业标准。默认参考本机桌面、1,000 篇 / 正文约 2 KB、30 张首屏卡片；初始冷索引、暖操作和页面重载分别统计，每组至少 30 次并保存全部样本。浏览器暖打开指已连接且已有有效索引 / 模块，不与完整刷新混为一谈。

| 场景 | 建议验收目标 | 验证方法 |
| --- | --- | --- |
| 1,000 篇初次索引 | 原生完成 p95 ≤ 2 s；页面首屏 / 深链可用 p95 ≤ 2.5 s | 独立 fixture、release、从新 store / 页面导航打点；侧栏不能阻塞详情 |
| 暖打开单篇 | API p95 ≤ 150 ms；点击至可编辑 p95 ≤ 300 ms | 已建立索引；单篇外部变更、重复 ID 与缺失文件用例另测 |
| 暖属性展开 | API p95 ≤ 200 ms；内容就绪 p95 ≤ 300 ms | 选择项 / 继承 / 定义变化及不同笔记同时测 |
| 搜索 | 暖 API p95 ≤ 150 ms；含现有 240 ms debounce 的结果可见 p95 ≤ 500 ms | 稀有词、常见词、无结果、标签 / 快捷筛选；输入期间旧请求不堆积 |
| 正文保存 | 暖 saveNote p95 ≤ 300 ms；单次已接收编辑在停止输入后 ≤ 1 s 持久化正文 | 包含 650 ms debounce；另外测修改持续超过一秒和排队，不承诺连续输入每秒提交 |
| 空闲读取 | 无文件变化的可见页面 60 s 内不进行重复全库正文读取；后台页不触发 UI 轮询 | 索引 scan/read 计数；外部变化检测兜底另设预算，不能以缓存掩盖变化 |
| 输入响应 | 100 KB 复杂文档输入至下一绘制 p95 ≤ 100 ms；定位并减少自身 ≥ 50 ms 的同步任务 | 真实浏览器按键 / IME / 选择、粘贴单独统计；1 MB 文档先建立基线 |
| 路由体积 | 列表入口 JS / CSS gzip ≤ 180 KiB；详情累计 JS / CSS gzip ≤ 450 KiB，raw ≤ 1.5 MiB | 依赖闭包 + 实际导航资源双检查；压缩体积与实际 HTTP 传输分别记录 |
| 重复刷新静态资源 | 未更新的 hash 静态资源正常重载可复用缓存；API 和附件遵守原策略 | HTTP headers、cache hit、应用升级后资源一致性，native scheme 另测 |
| 图片 / 卡片 | 同版本相同链接只解析一次；离屏卡片不预读图片 Blob；300 卡片滚动 / 选择无自身长任务热点 | 30 / 300 卡片、复杂 Markdown 和图片场景，记录请求、布局和 JS heap |
| 恢复可靠性 | 性能改造后恢复窗口、冲突处理和退出保护不低于当前约定 | 显式定义 draft 持久化窗口，并做进程终止、切库、隐藏和保存失败验收 |

Web 的 INP 良好阈值是真实访问第 75 百分位 ≤ 200 ms；本表的实验室 p95 输入目标是额外产品预算，不能拿十次 jsdom 更新冒充 INP。长任务通常以超过 50 ms 为边界，应测量任务组成后缩减或分解。[INP 指导](https://web.dev/articles/optimize-inp)、[长任务指导](https://web.dev/articles/optimize-long-tasks)

10,000 篇先作为容量测试：要求暖单篇访问不再随全库正文量线性增长、没有超时和持续扫描；首次索引给出真实进度且可取消。测量后再为该规模和 iCloud / 移动设备分别制定 SLO，不用桌面 1,000 篇的数字覆盖它们。

## 推荐实施顺序

1. **建立反馈回路并修复排序热点**：把本轮 fixture 和操作耗时形成可重复基准；日期解析次数应随笔记数而非比较次数增长。现有功能测试通过，时间排序 / 时区语义通过，排序单项对照收益稳定后提交。CI 先收集时序，固定 runner 多次测量后启用宽容的回归阈值，避免单样本绝对时限造成波动。
2. **减少扫描与属性汇总**：先让单次请求复用快照、属性来源；再加入按 vault / 版本隔离的索引、同版本去重、增量失效和轻量健康检查。分别验证 getNote、saveNote、getNoteProperties、resolveLink 与外部修改，包含 actor 排队和多标签页。每步独立复测，保留安全写入和 coverage 规则。
3. **缩短详情关键路径并管控资源**：先调整数据依赖与适度预加载，再做运行模式 transport 和次要组件拆分；增加路由预算。HTTP 静态缓存 / 预压缩独立交付，检查重载和升级，不与数据缓存混合。
4. **按 profiling 优化卡片、图片和长文**：先限制不可见工作、解析去重与摘要复用，再考虑虚拟化和编辑器增量序列化；给草稿 coalescing 明确恢复窗口。每项都通过 IME、撤销、选择、折叠、原文保真、保存冲突与恢复验证。

以上顺序没有估算工期；增量索引与编辑器源文保真属于较高复杂度改造，不应与一次低风险排序优化混成大提交。

## 已有机制与本轮检查结果

应保留的机制包括：列表 30 条分页、查询响应体限制、refresh 共享一次快照、已解析内容缓存、editor / 部分菜单动态导入、选中字体按需加载、图片 URL 回收、VaultStore actor 隔离、协调读写与 hash 冲突、WKWebView 静态文件 Task.detached 读取、草稿先行和离页 flush。本轮没有证据支持把全库迁往数据库或笼统重写 React 状态管理。

MCP 已检查连接校验、每请求 socket、15 秒等待、结果尺寸限制和序列化；它共享 native scan 瓶颈，尚未测到需要优先改造 socket / 配置读取的独立证据。contracts 目前把完整 body 交给列表；有界摘要若需要新增协议应保留 MCP getNote 的完整正文语义。服务的鉴权、源文件协调和日志内容保护不作为削减性能成本的对象。

本轮重跑结果：

- `pnpm test`：UI 585 项、MCP 16 项通过。
- `pnpm test:native`：60 项通过。
- `pnpm test:service`：Swift 本机服务 7 项、HTTP 场景 9 项通过。
- `pnpm test:native-network`：8 项通过。
- `pnpm check:bundle`：通过，但只覆盖上述入口预算。
- 临时编辑器基准：通过；临时 native 基线和排序对照：执行完成。

现有功能测试合计 685 项通过。测试通过证明现有功能基线可用，不代表上述性能目标已满足。本轮未重新执行完整 Xcode release / iOS 构建，也未部署性能修改。
