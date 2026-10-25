# iOS 原生外壳与定制弹窗

> 历史范围（2026-10-25 标记）：本页保留各日期的原生外壳实现及设备验收，旧端口、源码路径、默认外观及主题 API 不再作为现行维护契约。当前规则见[现行规范](../design/component-ownership.md)。被删除的源文件可用 `git show 6214317:<仓库相对路径>` 查看迁移前快照；本机 ignored 证据路径不保证在新克隆中存在。


更新：2026-10-17。

## 范围

顶部导航、页面菜单、底部搜索与快速记录入口使用 SwiftUI。底部保持两个独立控件：48 点的圆形搜索按钮，以及撑满剩余宽度的快速记录胶囊，间距 12 点。在 iOS 26 及以上使用系统 `.glass` 按钮；部署目标保持 iOS 17。

主导航使用 UIKit 自定义容器与 SwiftUI 自定义内容布局，内部按 H5 移动端结构排列：仅顶部 Logo 与设置按钮固定；主页、所有笔记、日历和标签放在同一个纵向滚动区域；侧栏不再重复显示搜索和新建笔记，搜索与快速记录保留底部入口，完整新建笔记保留页面操作菜单入口；iOS 26 及以上将固定品牌栏放入系统 `safeAreaBar`，滚动区域上下均指定 `.soft` 原生柔和边缘，底部用透明标签锚定系统效果，避免实色条截断模糊；旧系统保留固定品牌栏与普通滚动；快捷筛选在“所有笔记”下折叠；置顶标签与普通标签独立分组，支持层级、折叠和搜索；设置与笔记库入口位于 Logo 右侧，使用 44 点的原生玻璃齿轮按钮，右侧留白采用外层 UIKit 系统边距，与主页面收起按钮两侧留白一致；底部不再重复显示笔记库；异常时的笔记库状态提示随导航内容显示在品牌栏下方。日历保持未开放，草稿继续从主页面更多菜单进入。笔记库弹层保留切换、打开文件夹、重新授权（可用时）、设置、回收站与未开放的帮助入口。侧栏宽度／主页面推移量按主页面左右原生工具栏按钮的中心间距（44 点按钮，加上 UIKit `systemMinimumLayoutMargins` 提供的两侧系统边距；小屏为各 16 点、大屏为各 20 点）计算，使展开后的侧栏按钮与收起状态的右侧“…”按钮中心重合。主页面保持原宽度，展开时整张向右平移，露出其左侧内容与 32 点连续圆角，并联动阴影；不缩小正文视口。两个 hosting controller 只创建一次，不重建 WKWebView。侧栏不再显示独立收起按钮，保留主页面上的侧栏按钮；点击露出的主页面可关闭，支持无障碍退出，侧栏显示时隐藏主内容的无障碍入口。搜索、快速记录或其他弹层打开时禁用侧栏展开手势。

此前验证的 `UISplitViewController` 双列 `.overlay` 无法实现参考图的整页右移，因此改用 Apple 支持的自定义子控制器容器结构。展开手势限定左侧 24 点并要求水平向右，关闭手势要求水平滑动；纵向滚动不触发。平移使用 UIKit 属性动画，拖动直接更新位移，松手按当前位置与速度展开或收起；开启“减弱动态效果”时省略自动过渡动画。侧栏使用 SwiftUI 原生按钮与文本输入，并通过自定义布局对齐 H5，继续复用现有 React 动作，不改变笔记编辑器。

搜索使用 SwiftUI 定制的底部弹层容器，左右和底部始终贴边，仅顶部圆角；快速记录按新确认的参考图使用键盘上方的浮动输入卡片和系统 `.regularMaterial` 模糊背景。`NativeDesignedPanel.swift` 按确认的移动端内容布局定制，不使用通用 `List` 表单：

- 搜索按最新确认去掉独立标题，顶部同一行使用系统 `UISearchTextField` 和右侧液态玻璃关闭按钮，两者高度统一为 44 点，关闭按钮直径为 44 点。保留关键词高亮、时间分组、选中背景、加载／重试与分页入口，以及自动聚焦、系统清空、搜索键和上下键选择。中文输入法组合期间不覆盖输入内容，候选提交后再更新查询。
- 快速记录去掉独立标题栏和右上角关闭按钮，紧凑状态保留 160 点原生文本区、卡片内的附件和已选标签、底部标签／图片入口与“记录”按钮。标签和图片入口仅显示图标，保留无障碍名称，点击区域均为 44 × 44 点。无错误提示时，操作栏整行距卡片底部 8 点；32 点高的“记录”按钮居中后，其可见底边距卡片底部 14 点。顶部保留拖动柄，轻点可切换卡片大小；可点击背景、下拉或使用 VoiceOver 退出动作关闭。未完成记录继续自动保留。标签仍从原入口弹出选择，图片支持全屏预览和独立移除。
- “切换为页面”、保留草稿和保护失败重试集中到底部“更多记录操作”菜单，底部不显示草稿／保存状态文字，错误提示仍保留。卡片左右留 12 点，底部距离键盘或安全区 12 点，四角半径 24 点。默认高度按内容测量；顶部拖动柄向上拖动可展开至可用高度，文本区跟随增高，操作栏保持在卡片底部。展开后下拉恢复紧凑状态，继续下拉可关闭；VoiceOver 也可通过调整动作展开／收起。长内容可滚动，写入期间禁止重复提交、调整和关闭。
- 搜索和快速记录容器提供底部滑入／收起、背景点击关闭、顶部拖动关闭和 VoiceOver 退出动作，显示期间隐藏底层内容的无障碍入口。保留主 WKWebView，键盘由系统管理。两者分别使用贴边和浮动的外框；iOS 图片入口由 `NativeHost` 从当前控制器呈现系统 `PHPickerViewController` 相册，仅选择图片，沿用原附件导入、20 MB 限制与笔记库身份校验，并清理临时副本。笔记库选择继续使用文件选择器，Mac 图片选择保持原实现。

搜索和图片预览的关闭按钮共用 `NativeCloseButton`，在 iOS 26 及以上使用系统 `glassEffect(.regular.interactive(), in: Circle())`，尺寸遵循各处确认的设计，保持位置、无障碍名称和忙碌禁用行为。快速记录按最新反馈省略关闭按钮。旧系统使用原生材质；标准导航弹窗保留系统工具栏关闭按钮，确认框保留系统取消按钮。搜索清空、移除标签和移除附件继续保持各自原有样式。

搜索列表纵向间距对照现有 H5：列表上下内边距 8 点，结果行左右 12 点、上下 10 点、文字行高 20 点（总行高 40 点），分组标题行高 16 点、上方 12 点、下方 8 点，分组之间另留 8 点。按最新横向对齐反馈，列表取消额外的 8 点左右内边距，结果行背景与顶部搜索区同为距弹窗边缘 16 点，文字距弹窗边缘 28 点。

导航、笔记库、草稿和标签编辑继续使用原生控件；删除确认使用系统 alert。正文列表、设置正文、笔记编辑器及编辑器内部工具继续使用共享 React 实现；回收站的只读预览也保留共享 Markdown 渲染器及原附件路径，避免丢失富文本与图片。iOS 编辑器按用户反馈仅显示保存失败和冲突状态，隐藏等待保存、保存中、已保存、新笔记说明及等待笔记库就绪等常规状态文字；自动保存、草稿保护、重试和冲突处理逻辑保持原实现。H5 和 Mac 的状态提示不变。

## 状态、主题与性能

React 保留查询、分页、竞态保护、草稿、附件导入、写入校验和失败重试。原生视图只接收可见内容和动作标识。返回笔记编辑器前后不重建主 WKWebView；搜索关键词和结果继续保留，原生滚动锚点按会话保存，改变查询和卸载时清理。

每个表面有独立 instance，原生层拒绝过期、已关闭或已禁用控件的动作。关闭的表面只发布必要元数据；相同快照不重复发送。原生输入在本地即时保留，Web 确认后清理临时值；快速记录使用同步引用保护最后一次输入，失败保留内容，成功后重置。

iOS 专用入口统一读取现有 CSS 的主题和标签色值，主题变化时更新；Web / Mac 不读取这些原生色值或构建原生模型。缩略图在后台通过 ImageIO 缩小到 240 像素，图片预览最大边 2048 像素。没有提高既有 Web 路由资源预算；新增 iOS 首页预算包含原生模型及标签颜色样式，较 Web 首页额外预留 16 KiB 原始体积／2 KiB gzip。

同一份依赖下，修改前 HEAD 的首屏 JS / CSS 为 27 个文件、192,199 gzip 字节；当前为 14 个文件、189,256 gzip 字节。这只衡量加载资源，不代表真机帧率或耗电改善。

## 验证

最终 `pnpm verify` 通过：UI 1035、Swift 核心 126、MCP 16、原生 TCP 8、本机 HTTP 14，共 1199 项测试。覆盖原生状态去重、过期动作、草稿恢复、附件移除保留最后输入、失败重试、重复提交、搜索过期响应与会话保留。所有资源预算通过。ESLint 仅保留原有编辑器 Hook 依赖警告。

日志：

- `/tmp/memocard-ios-designed-panels-verify-final.log`
- `/tmp/memocard-ios-designed-panels-build-final.log`
- `/tmp/memocard-ios-designed-panels-mac-build.log`

使用 iPhone 18 Pro / iOS 27.0 和独立的 MemoCard iOS QA 测试笔记库核验，不包含真实用户笔记。实际操作验证了中文键盘输入、标签选择、图片导入／预览／移除、重启恢复草稿，以及附图时键盘展开和收起后的完整布局。移除图片后文字和标签保留，点击“记录”后测试笔记正文和标签写入 Markdown。搜索输入“我”后打开结果，返回时关键词和匹配结果保留。

截图保存在 `build/verification/ios-preview/native-search.png`、`native-search-keyboard.png` 和 `native-capture.png`。最终 iOS 和 Mac 构建通过，Web 资源在源目录和两端产品中的哈希一致。实体 iPhone、最低系统运行、iCloud 双端同步、真机帧率／耗电和长时间内存表现尚未验收。

关闭按钮统一后的 iOS 构建通过（`/tmp/memocard-ios-glass-close-build.log`），模拟器核验了搜索和快速记录的显示及点击关闭。效果截图：`build/verification/ios-preview/glass-close-capture.png`。

搜索框改用系统控件后的 iOS 构建通过（`/tmp/memocard-ios-native-search-field-build.log`）。模拟器核验了无标题单行布局、自动弹出键盘、中文组合输入与候选提交、系统清空后恢复全部结果，以及系统“搜索”键打开当前结果。查询、分组和返回会话的数据逻辑沿用现有实现。

搜索框和关闭按钮统一为 44 点、列表间距对齐 H5 后，最终 iOS 构建通过，已在模拟器检查并截图：`build/verification/ios-preview/native-search-aligned.png`。

取消列表额外横向缩进后，iOS 构建通过（`/tmp/memocard-ios-search-horizontal-spacing-build.log`），模拟器确认结果行背景与顶部搜索区的左右外边缘对齐；截图：`build/verification/ios-preview/native-search-horizontal-spacing.png`。

搜索改为始终贴边的容器后，iOS 构建通过（`/tmp/memocard-ios-edge-search-build.log`），18 项搜索／原生桥接测试通过（`/tmp/memocard-ios-edge-search-tests.log`）。模拟器实测键盘弹出与收起时均贴边，键盘圆角后方无灰缝，关闭后恢复主页操作，重新打开自动聚焦。截图：`build/verification/ios-preview/native-search-edge.png`、`native-search-edge-keyboard.png`。拖动关闭已实现；本轮坐标手势自动化返回 `noWindowsAvailable`，未完成实际拖动验收。

快速记录改为浮动卡片后的 iOS 构建通过（`/tmp/memocard-ios-floating-capture-build.log`），32 项快速记录／原生桥接测试通过（`/tmp/memocard-ios-floating-capture-tests.log`）。模拟器实测中文输入、标签选择、图片导入和全屏预览、附图时键盘避让、关闭重开恢复，以及“记录”写入文字／标签／图片到测试笔记。更多菜单的“切换为页面”打开原编辑器并保留正文，返回首页后笔记正常保存。写入失败、草稿保护重试和重复提交的逻辑由原有测试覆盖，未修改共享 React 实现。下拉手势的本轮自动化也返回 `noWindowsAvailable`，尚未完成实际拖动验收。

按后续反馈移除关闭按钮并增加展开状态后，最终 iOS 构建通过。模拟器实测轻点拖动柄展开／收起，展开时文本区增高、操作栏保持底部，输入内容在大小切换和无障碍关闭／重开后保留。截图：`build/verification/ios-preview/native-floating-capture-compact.png`、`native-floating-capture-expanded.png`。上下拖动已实现；实际拖动与点击背景的自动化接口仍返回 `noWindowsAvailable`，未把它们记为实测通过。

标签／图片入口改为仅显示图标后，iOS 构建通过（`/tmp/memocard-ios-capture-toolbar-icons-build.log`）。模拟器确认两处文字已去掉、无障碍名称保留，点击标签图标仍打开原选择弹层；底部间距未改。截图：`build/verification/ios-preview/native-floating-capture-icons.png`。

按最新反馈隐藏底部草稿／保存状态文字，并将操作栏整行距卡片底部改为 8 点后，iOS 构建通过（`/tmp/memocard-ios-capture-bottom-spacing-build.log`）。模拟器确认状态文字已消失，紧凑与展开布局均保持新的底部间距，切换后原有输入保留。错误提示和草稿保存逻辑未改。截图：`build/verification/ios-preview/native-capture-bottom-8pt.png`。

标签选择弹层的搜索框改用与全库搜索共用的系统 `UISearchTextField`，高度 44 点，顶部与两侧总留白各 12 点，保留独立无障碍名称及自动聚焦。iOS 构建通过（`/tmp/memocard-ios-tag-search-style-build.log`）。模拟器实测中文组合输入提交后筛选、显示新建标签入口、系统清空恢复列表、选择／取消选择标签。截图：`build/verification/ios-preview/native-tag-search-field.png`。

图片入口改为系统相册后，iOS 与 Mac 构建通过（`/tmp/memocard-ios-photo-library-build.log`、`/tmp/memocard-mac-photo-library-regression-build.log`）。模拟器实测相册打开、取消后保留原草稿、选取系统内置照片后显示缩略图及全屏预览。紧凑设备窗口的坐标接口报错，切换到完整 Device Hub 窗口后完成了实际选图和取消操作。截图：`build/verification/ios-preview/native-photo-library-picker.png`、`native-photo-library-import.png`。

iOS 编辑器改为仅显示失败／冲突状态后，编辑器与保存会话 103 项测试通过，覆盖常规状态隐藏、自动保存请求、失败重试及冲突恢复入口（`/tmp/memocard-ios-editor-save-hints-tests.log`）。iOS 构建与资源预算检查通过，Web 构建、打包资源及模拟器产品入口哈希一致。模拟器打开附图笔记确认标题下无常规保存提示，正文与图片保留；截图：`build/verification/ios-preview/native-editor-error-only-status.png`。本轮未在模拟器制造真实写入失败或冲突；相关反馈由测试验证。

按用户要求临时模拟保存失败与冲突的显示状态，在同一篇附图笔记上截图：`build/verification/ios-preview/native-editor-save-failure-preview.png`、`native-editor-save-conflict-preview.png`。仅覆盖渲染状态与提示文案，没有改变保存会话或制造真实文件错误；未点击模拟卡片的处理按钮。截图后原源文件按哈希完整恢复，重新构建并安装正常版本（`/tmp/memocard-ios-save-status-preview-restore-build.log`）。10 篇 QA 笔记内容哈希均未改变。当前两种异常均显示顶部错误卡片和标题下状态文字。

此前覆盖式 UIKit 侧栏验证版 iOS 与 Mac 构建通过（`/tmp/memocard-ios-uikit-sidebar-build.log`、`/tmp/memocard-mac-uikit-sidebar-build.log`）。模拟器实测侧栏打开、切换所有笔记与标签筛选、点击右侧主页面关闭、从侧栏打开全库搜索及草稿弹层、关闭草稿返回主页，以及快速记录键盘避让与系统相册呈现。截图：`build/verification/ios-preview/native-uikit-sidebar-open.png`。实际侧滑手势、iOS 17 和 iPad 尚未验收。

按参考图改为 UIKit 自定义侧栏容器后，最终 iOS 与 Mac 构建通过（`/tmp/memocard-ios-push-sidebar-build.log`、`/tmp/memocard-mac-push-sidebar-build.log`），`git diff --check` 通过。模拟器验证主页面保持原宽度整体右移，显示的是其左侧内容，圆角及阴影正常；左侧边缘右滑展开、左滑收起、短距离拖动不误展开，以及点击露出的主页面关闭均通过。原生侧栏按钮可被辅助功能树读取。验证了所有笔记、标签筛选、搜索打开及关闭返回、草稿弹层、快速记录键盘避让，以及系统相册打开和取消返回。临时手势诊断日志已删除，最终构建已安装，截图：`build/verification/ios-preview/native-push-sidebar-open.png`。未改编辑器和共享 React 逻辑；连续慢拖跟手的视觉细节、系统中断取消、真实 VoiceOver 使用、iOS 17、iPad 和真机性能仍待验证。

按后续反馈删除侧栏右上角的独立收起按钮，保留主页面上的按钮、点击主页面关闭和侧滑关闭。iOS 构建通过（`/tmp/memocard-ios-sidebar-single-button-build.log`）。模拟器确认侧栏右上角按钮消失，主页面按钮可打开和收起侧栏；截图：`build/verification/ios-preview/native-sidebar-single-button.png`。

按最新反馈将推移量改为安全区宽度减 76 点，使展开后的侧栏按钮与收起前右侧“…”位置重合；iPhone 18 Pro 竖屏为 326 点。未改原生工具栏的样式、按钮大小和垂直位置。iOS 与 Mac 构建通过（`/tmp/memocard-ios-sidebar-button-alignment-build.log`、`/tmp/memocard-mac-sidebar-button-alignment-build.log`）。模拟器验证按钮点击收起与左边缘侧滑展开；展开前后截图的两处图标包围框中心差各为 0.5 像素。截图：`build/verification/ios-preview/native-sidebar-alignment-before.png`、`native-sidebar-alignment-after.png`。临时测量视图与诊断日志已移除；其他机型、横屏和旧系统的工具栏布局仍待实测。

2026-10-17 补充多尺寸竖屏验证：发现 iPhone 18 Pro Max 的系统工具栏左右边距各为 20 点，固定减 76 点会多推移 8 点。现改为读取外层 UIKit 容器的 `systemMinimumLayoutMargins`，按安全区宽度减两侧系统边距及 44 点按钮宽度计算。不能读取已经平移的 hosting controller：其屏幕外一侧的最小边距可能变为 0。此轮只改推移量计算，未改工具栏样式、编辑器、React 动作或侧滑逻辑。系统边距依据：[Apple UIViewController.systemMinimumLayoutMargins](https://developer.apple.com/documentation/uikit/uiviewcontroller/systemminimumlayoutmargins)。

以下三个模拟器均使用最终 iOS 27.0 构建，实际检查按钮关闭、左边缘右滑展开和左滑收起；三个设备均未连接笔记库，本轮没有写入笔记。

| 机型 | 逻辑尺寸（pt） | 推移量（pt） | 图标中心偏差 X / Y（px） | 按钮关闭／右滑展开／左滑收起 |
| --- | --- | --- | --- | --- |
| iPhone SE（第 3 代，现有 Small Screen QA 模拟器） | 375 × 667 | 299 | 0.5 / 0.5 | 通过 |
| iPhone 17e | 390 × 844 | 314 | 0.5 / 0.5 | 通过 |
| iPhone 18 Pro Max | 440 × 956 | 356 | 0.5 / 0.5 | 通过 |

中心偏差按截图中右侧“…”与展开后侧栏图标的深色像素包围框测量，并非按钮点击区域测量；每轴容差为 1 像素，三个设备均通过。截图为 `build/verification/ios-preview/sidebar-{se,17e,max}-{before,after}.png`，测量脚本和结果为同目录的 `measure-sidebar.swift`、`sidebar-alignment-results.csv`。`sidebar-max-before-fix.png` 保留修正前 8 点偏移的画面。

最终 iOS 与 Mac 构建通过（`/tmp/memocard-ios-sidebar-adaptive-margins-build.log`、`/tmp/memocard-mac-sidebar-adaptive-margins-build.log`），临时边距诊断代码已移除。自动化期间出现宿主窗口连接及截图错误，重连 Device Hub 后已补齐以上实际操作检查，失败调用未计为通过。为控制模拟器内存占用，设备依次运行；验证后恢复原 iPhone 18 Pro 并安装最终构建。横屏、旧系统、iPad、真机及连续慢拖的跟手细节仍未验收。

2026-10-17 按 H5 对齐侧栏内部布局：移除系统分组卡片、分隔线及标签数量副标题，改用固定顶部导航、可滚动标签区和固定底部笔记库入口。导航行高 48 点、字号 16 点、图标 16 点、行间距 4 点、外层内边距 8 点；标签组标题高 44 点、字号 12 点，子级每层缩进 24 点并显示层级引导线。选中项使用 H5 的 `sidebar-accent` 色值，背景、文字、边框与用户圆角选项从 Web 主题传入。图标继续使用 SF Symbols，中文使用系统字体。快捷筛选默认收起；标签层级及置顶标签默认展开；搜索按完整路径匹配并平铺结果。移动端标签置顶和编辑仍从主页面标题菜单进入，与 H5 保持一致。关闭侧栏会释放标签搜索焦点，切换笔记库会重置折叠和搜索状态。通过侧栏底部打开笔记库菜单后，取消菜单返回侧栏；选择菜单项完成对应导航，程序关闭菜单不会重复展开侧栏。外层 UIKit 容器、推移量计算、主页面工具栏、侧滑逻辑与编辑器没有改动。

本轮完整校验首轮通过：UI 1041、Swift 核心 126、MCP 16、原生 TCP 8、本机 HTTP 14，共 1205 项测试。收尾重跑 `pnpm verify` 与 Xcode 构建并发时，UI 出现 5 项超时／等待界面失败；降低为单 worker 后上述 5 项均通过，全量为 1040 / 1041，另有既有 Select 键盘用例失败。该文件独立复跑 7 / 7 通过；未修改这些既有测试或编辑器实现。最终不把全量复跑记为无失败。资源预算单独复验通过。新增 5 项原生侧栏桥接测试，覆盖层级路径与置顶顺序、筛选与选中、搜索及新建笔记回调、当前库／其他库动作、设置／回收站、重新授权和不可用状态。ESLint 仅有原有编辑器 Hook 依赖警告。日志：`/tmp/memocard-ios-sidebar-h5-verify.log`、`/tmp/memocard-ios-sidebar-h5-ui-final-tests.log`、`/tmp/memocard-ios-sidebar-h5-base-ui-retest.log`、`/tmp/memocard-ios-sidebar-h5-tests.log`、`/tmp/memocard-ios-sidebar-h5-bundle-final.log`；最终 iOS／Mac 构建日志：`/tmp/memocard-ios-sidebar-h5-final-build.log`、`/tmp/memocard-mac-sidebar-h5-final-build.log`。

iPhone 18 Pro / iOS 27.0 实测：快捷筛选展开／收起与选中导航、普通及三级标签导航、子级独立折叠、置顶分组、标签完整路径搜索、标签区滚动、固定底部入口、笔记库弹层、侧栏搜索打开与退出，以及边缘右滑展开和左滑收起。原生导航在展开后仍整体右移，右侧按钮与原“…”图标包围框中心每轴偏差 0.5 像素，通过 1 像素容差检查。截图与测量结果：`build/verification/ios-preview/sidebar-h5-before.png`、`sidebar-h5-after.png`、`sidebar-h5-tag-search.png`、`sidebar-h5-hierarchy.png`、`sidebar-h5-alignment.csv`。为层级检查添加了一篇独立 QA 临时笔记，完成后已移除；临时置顶已取消，原有 10 篇 Markdown 内容哈希一致。模拟器窗口自动化偶发连接错误，重连后按实际画面确认结果，没有将失败调用计为通过。横屏、旧系统、iPad、真机及自定义字体在原生侧栏中的逐像素一致性未验收。

补充检查了 iPhone SE 第三代 / iOS 27.0 的未连接状态：平铺导航、标签空状态与固定底部入口均可见，无重叠；本轮未在该设备连接笔记库或重复验收全部业务操作。小屏自动化存在 AX 状态和画面延迟，交互回归结论以上述 iPhone 18 Pro 实测为准。验证后恢复 iPhone 18 Pro，安装最终版本。Web 构建目录、打包资源和 iOS／Mac 产品资源哈希一致，`git diff --check` 通过。

2026-10-17 修复推移主页面顶部／底部的背景与圆角接缝：外层 UIKit 容器改用 Web 传入的 `sidebar` 背景色，覆盖侧栏宽度以外的圆角底层；新增内容裁切层，主页面与点击收起遮罩共同裁切连续圆角，阴影仍由外层卡片绘制。推移量、工具栏、手势、阴影参数和编辑器保持原实现。

iOS 与 Mac 构建通过（`/tmp/memocard-ios-sidebar-seams-build.log`、`/tmp/memocard-mac-sidebar-seams-build.log`），`git diff --check` 通过。iPhone 18 Pro / iOS 27.0 实际检查顶部与底部已无矩形遮罩和异色底板，点击主页面按钮收起、左边缘右滑展开、左滑收起均通过。原“…”与展开后侧栏图标包围框中心每轴偏差仍为 0.5 像素，通过 1 像素容差。截图：`build/verification/ios-preview/sidebar-seams-before.png`、`sidebar-seams-closed.png`、`sidebar-seams-after.png`、`sidebar-seams-gesture-closed.png`；测量脚本及结果：`measure-sidebar-seams.swift`、`sidebar-seams-alignment.csv`。本轮仅改 UIKit 背景和裁切，未重跑 Web 测试；其他尺寸、横屏与深色模式未在本轮复测。最终模拟器保持修复后的侧栏展开。

2026-10-17 接入系统原生柔和滚动边缘：iOS 26 及以上使用 SwiftUI `scrollEdgeEffectStyle(.soft, for: [.top, .bottom])`、`safeAreaBar`，同时明确设置 WKWebView 公开滚动视图的上下 `EdgeEffect.style = .soft`。非编辑页面延伸到系统栏下方，由系统绘制过渡；没有手绘白色渐变或自定义模糊。按原生 GeometryReader 的安全区尺寸传入 `--ios-top`／`--ios-bottom`，只为非编辑页面的 Web 滚动容器保留起止留白，编辑器维持原有边界与实现。没有替换 HTML 滚动容器或重建 WKWebView；仅在安全区变化和页面加载完成时更新 CSS 尺寸，不监听每帧滚动。旧系统保留原 `safeAreaInset` 布局。接口依据：[Apple ScrollEdgeEffectStyle](https://developer.apple.com/documentation/swiftui/scrolledgeeffectstyle)、[Apple UIKit 新设计说明](https://developer.apple.com/videos/play/wwdc2025/284/?time=680)。

最终 Web 构建、iOS／Mac 构建、12 项原生桥接测试与资源预算检查通过（`/tmp/memocard-ui-scroll-edge-build.log`、`/tmp/memocard-ios-scroll-edge-final-build.log`、`/tmp/memocard-mac-scroll-edge-final-build.log`、`/tmp/memocard-scroll-edge-bridge-tests.log`、`/tmp/memocard-scroll-edge-bundle.log`）。未提高既有预算；首次检查发现新增样式使原本接近上限的路由超标，精简选择器和 CSS 变量后所有路由通过。iPhone 18 Pro / iOS 27.0 检查了首页留白、列表顶部文字与底部图片的柔和过渡、滚动至最后一张卡片完整可见、打开“设计细节”进入原编辑器及返回后保留列表位置。最终版本另行验证侧栏按钮、边缘右滑展开及左滑收起；原“…”与展开后的侧栏图标中心每轴偏差仍为 0.5 像素。10 篇 QA 笔记内容哈希未改变。模拟器输入连接偶发中断，恢复窗口连接后已按实际截图确认，不把未执行的调用记为通过。截图：`build/verification/ios-preview/native-scroll-edge-home.png`、`native-scroll-edge-list-top.png`、`native-scroll-edge-soft.png`、`native-scroll-edge-editor-regression.png`、`native-scroll-edge-sidebar-open.png`；测量结果：`native-scroll-edge-alignment.csv`。最终模拟器停留在列表滚动后的柔和效果画面。此轮未重跑全量 Web 测试，也未实测旧系统、深色模式、其他设备、横屏或编辑键盘输入。

2026-10-17 补充体验数据并首次安装到物理 iPhone 16 Pro / iOS 27.0.1。模拟器原 QA 库新增 40 篇以「体验 · 」命名的合成笔记，共 50 篇，原有 10 篇内容哈希未改变。新增内容覆盖 30 个标签路径、三级标签、长短文、任务清单、表格、代码、链接、中英文与 Emoji、无标签笔记，以及 11 处本地图片引用；ID 唯一、图片引用有效。手机独立体验库只包含新增 40 篇，使用独立的笔记库 ID，未复制模拟器本机缓存、草稿或授权；两份测试库不会自动同步。生成脚本与清单位于忽略目录 `build/verification/ios-preview/device-qa/seed_notes.py`、`seed-manifest.json`。

真机构建使用既有 Apple Development 身份，日志为 `/tmp/memocard-ios-device-install-build.log`，产物位于 `build/apple-device/Build/Products/Debug-iphoneos/MemoCard.app`。构建、严格签名校验和 Info.plist 校验通过，配置包含目标设备；当前开发配置到期时间为北京时间 2026-10-24 14:23:47。新增 `UIFileSharingEnabled` 以便从系统「文件」选择 App Documents 内的体验库。安装成功后将体验库复制到 `Documents/MemoCard 体验库`，回读全部 48 个文件与本地 SHA-256 一致。首次启动被 iOS 开发者信任阻止，用户在手机完成信任后启动成功；真机投屏点击未生效，因此用户亲自通过「我的 iPhone → 记忆卡」选择体验库，实际截图确认已显示「MemoCard 体验库」、新增标签和笔记内容。截图：`build/verification/ios-preview/device-qa/iphone-qa-library.png`；安装、启动、回读记录均在同目录 JSON 中。此次没有通过删除旧 App 完成安装，没有改动编辑器、导航布局或侧滑；未宣称真机完整业务回归、中文写入／附图保存、iCloud 同步或长期性能验收通过。

2026-10-17 将 iOS 侧栏底部的笔记库入口移到 Logo 右侧，改为 44 点圆形设置齿轮，iOS 26 及以上使用原生交互玻璃效果；旧系统使用系统材质。点击仍发送既有 `vault` 动作，保留当前库、切换库、打开已有库、笔记库设置与回收站菜单。当前库名称保留在无障碍提示和菜单中，连接异常提示移至品牌行下方。移除底部固定行，让标签滚动区延伸到底部；外层 UIKit 容器、推移量、主页面工具栏和编辑器未改动。

5 项侧栏桥接测试、iOS 与 Mac 构建通过（`/tmp/memocard-ios-sidebar-settings-tests.log`、`/tmp/memocard-ios-sidebar-settings-build.log`、`/tmp/memocard-mac-sidebar-settings-build.log`）。iPhone 18 Pro / iOS 27.0 模拟器实际确认齿轮与 Logo 同行、底部入口消失、点击齿轮打开原笔记库菜单、关闭菜单返回侧栏、主页面按钮收起和边缘右滑展开。一次拖动调用因宿主窗口连接错误未执行，恢复窗口后重试通过。截图：`build/verification/ios-preview/native-sidebar-settings-header.png`。本轮未重复测量按钮对齐、验证其他尺寸或重跑全量 Web 测试，亦未将这次改动更新到物理手机。

2026-10-17 将搜索、新建笔记、主页、所有笔记、日历、快捷筛选和全部标签放入同一个 SwiftUI `ScrollView`，仅顶部 Logo 与设置按钮固定；笔记库异常提示也随内容滚动。保留原有行高、内边距、标签树、动作及外层 UIKit 推移容器，没有新增嵌套滚动或改动编辑器。iOS 构建通过（`/tmp/memocard-ios-sidebar-scroll-build.log`），`git diff --check` 通过。iPhone 18 Pro / iOS 27.0 模拟器实测整体内容上滑、滚回顶部、滚动后固定设置按钮打开笔记库菜单及关闭返回、左滑收起、边缘右滑展开和主页入口导航。截图：`build/verification/ios-preview/native-sidebar-scroll-top.png`、`native-sidebar-scroll-content.png`。此次纯原生布局调整未增加实现镜像测试，未重跑 Web 全量测试、其他尺寸或真机验收，未更新手机安装。

2026-10-17 为侧栏滚动区域接入 iOS 26 及以上的系统柔和边缘：品牌栏使用 `.safeAreaBar(edge: .top)`，底部通过同色 8 点安全区栏关联系统边缘，两端明确指定 `.scrollEdgeEffectStyle(.soft, for: [.top, .bottom])`。模糊过渡由系统绘制，没有增加手绘渐变、每帧滚动回调或替换 UIKit 侧滑容器。品牌栏移除原上方 8 点内边距，将其留白移到底部，保持内容区初始位置；Logo 与设置按钮向上移动 8 点，与主页面侧栏按钮对齐。旧系统保留普通滚动与固定品牌栏。接口依据：[Apple ScrollEdgeEffectStyle](https://developer.apple.com/documentation/swiftui/scrolledgeeffectstyle)、[Apple safeAreaBar](https://developer.apple.com/documentation/swiftui/view/safeareabar(edge:alignment:spacing:content:))。

最终 iOS 构建及 `git diff --check` 通过（`/tmp/memocard-ios-sidebar-edges-build.log`）。iPhone 18 Pro / iOS 27.0 模拟器已观察顶部滚动文字经过品牌栏时的模糊过渡、底部标签进入安全区时的模糊渐隐，以及末尾标签完整可见。设置齿轮与主页面侧栏图标的深色像素包围框垂直中心差 0.5 像素，通过 1 像素容差；Logo 与齿轮位于同一个居中 HStack。截图：`build/verification/ios-preview/native-sidebar-header-aligned.png`、`native-sidebar-edges-soft.png`、`native-sidebar-edges-bottom.png`，测量脚本及结果：`measure-sidebar-header.swift`、`sidebar-header-alignment.csv`；底部效果另有最终构建录屏 `native-sidebar-edges-check.mp4`。窗口输入连接多次报错或未执行，失败调用没有计为通过；本轮没有将最终版本的横向侧滑复测记为通过，外层手势与推移量代码没有改动。未重跑 Web 全量测试、其他设备、旧系统或真机验收。

2026-10-17 移除 iOS App 与 H5 移动端侧栏中的「搜索」「新建笔记」入口。共享 H5 侧栏仅在移动断点隐藏这两项，桌面端保留；iOS 原生导航的 `pages` 与动作回调同步去除两项。底部搜索与快速记录、页面操作菜单的新建笔记、快捷键及编辑器均保留原实现。侧栏现在从主页开始，原生固定品牌栏、滚动边缘与外层推移容器没有改动。

相关 47 项测试、定向 ESLint、Web 构建、资源预算检查与 iOS 构建通过。更新既有移动端集成用例，确认侧栏无重复入口、设置页可先回主页再打开底部搜索、新建笔记仍可从页面菜单进入并聚焦编辑器；原生测试覆盖底部搜索／快速记录、页面菜单新建／草稿及不可用状态。日志：`/tmp/memocard-sidebar-remove-entries-tests.log`、`/tmp/memocard-sidebar-remove-entries-lint.log`、`/tmp/memocard-sidebar-remove-entries-ui-build.log`、`/tmp/memocard-sidebar-remove-entries-bundle.log`、`/tmp/memocard-ios-remove-sidebar-entries-build.log`。H5 使用隔离模拟数据的 375 px 预览实际确认侧栏从主页开始，两项已消失；桌面端保留由组件测试覆盖。新构建已安装并启动 iPhone 18 Pro 模拟器，主页面底部两项仍可见；宿主窗口点击持续返回连接错误，重建控制会话后仍无法完成此次 App 侧栏画面复核，未将失败调用记为通过。未重跑全量测试、更新物理手机或发布线上版本。


2026-10-17 修复侧栏底部柔和边缘的横向硬条：原有 8 点同色栏会覆盖经过安全区的模糊文字，改为全宽透明标签，保留原生 `safeAreaBar` 与 `.soft` 效果。纯 `Color.clear` 在当前系统会被边缘形状识别忽略，经模拟器对照后使用透明标签；无新增手绘渐变或每帧回调。设置按钮的右侧内边距从固定 8 点改为外层 UIKit `systemMinimumLayoutMargins.trailing`，当前 iPhone 18 Pro 左移 8 点。外层推移量、手势和按钮纵向位置均未改动。

iOS 构建、`git diff --check` 通过（`/tmp/memocard-ios-sidebar-spacing-mask-build.log`）。iPhone 18 Pro / iOS 27.0 模拟器确认顶部模糊保持、底部标签连续模糊且不再出现实色横条、收起按钮可返回主页面。三处间距的图标像素测量约为 16.17／15.5／16.5 点，图标垂直中心差 0.5 像素，符合约 16 点留白与纵向对齐；图标绘制包围框存在半像素光学偏差。截图 `build/verification/ios-preview/native-sidebar-spacing-mask.png`、`native-sidebar-bottom-no-band.png`，测量脚本与结果 `measure-sidebar-settings-spacing.swift`、`sidebar-settings-spacing.csv`。部分横向拖动未生效或返回窗口连接错误，本轮不将侧滑复测记为通过；未重跑其他设备、Web 全量测试或更新物理手机。


2026-10-17 提交前审查修复两项回归：iOS 不挂载 H5 侧栏后，在原生外壳入口补回共享 `TagColorStyles`（含基础色值与按库覆盖样式），避免笔记列表、编辑器和快速记录丢失标签颜色；回收站预览撤销纯文本原生替换，继续复用原 Markdown 预览与附件路径，恢复仍使用实际预览版本的哈希。新增颜色切换／换库与 iOS 回收站预览恢复回归测试。原生搜索的上下键切换同时滚动至选中结果，保留首次打开及重开时原有滚动锚点；快速记录保留外接键盘 ⌘ Enter 提交入口。新 iOS 路由预算纳入颜色样式实际成本，既有 Web 路由限额不变。验证结果以本轮发布检查为准。

本轮提交前最终 `pnpm verify:release` 通过，包含 UI 1043 项、Swift 核心 126 项、MCP 16 项、原生 TCP 8 项、本机 HTTP 14 项、Swift 服务 8 项测试，以及 Web／Mac／iOS／服务构建和服务 App 严格签名校验。`pnpm audit --prod` 无已知漏洞，所有资源预算通过；Mac 与 iOS 产品中的 Web 资源逐文件哈希与打包源一致。ESLint 仅保留既有编辑器 Hook 依赖警告。日志：`/tmp/memocard-review-release-final.log`、`/tmp/memocard-review-audit.log`。本轮没有重复真机、iPad、旧系统与实际外接键盘验收。

PR CI 补充校验：将原生动作列表的长数组拼接拆为等价的有类型数组与追加操作，避免旧 Swift 类型检查器超时。本地 arm64／x86_64 iOS 通用模拟器构建通过（`/tmp/memocard-review-ios-universal.log`）。CI 在既有 macOS 15 runner 上显式选择预装 Xcode 26.3 并记录编译器版本，避免默认 Xcode 16.4 缺少 iOS 26 玻璃及滚动边缘 SDK；最低部署目标不变。镜像依据：[GitHub macOS 15 runner 软件清单](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)。

CI 的 UI 测试暴露既有 Mermaid 预览测试的异步等待竞态：按钮出现时，子组件 effect 可能尚未挂载 Shadow DOM。测试改为等待新图表内容并确认旧内容消失，不改 Mermaid 产品实现；本地 11 项 Mermaid 测试与定向 ESLint 通过（`/tmp/memocard-review-mermaid-test.log`）。

2026-10-17 将 iOS 侧栏的 SF Symbols 图形替换为 H5 同源 Lucide 矢量资源：主页 `House`、所有笔记 `Notebook`、日历 `CalendarDays`、标签／无标签 `Hash`、图片筛选 `Image`、链接筛选 `Link`、设置入口 `Settings2`，以及 `Search`、`X`、`ChevronRight`。资源由 `node scripts/generate-sidebar-icons.mjs` 从当前已安装的 `lucide-react` 导出到 `Assets.xcassets/Lucide-*.imageset`，保留默认 24 单位画布、2 单位描边和许可文本；升级 H5 图标依赖后可重新运行。原生按模板图像渲染以继承主题颜色，保留现有布局尺寸、Emoji 自定义图标、点击区域、玻璃效果、折叠状态与动作桥接。

iOS 构建、6 项侧栏桥接测试与 `git diff --check` 通过（`/tmp/memocard-ios-lucide-build.log`、`/tmp/memocard-ios-lucide-tests.log`）。新构建已安装并运行于 iPhone 18 Pro / iOS 27.0 模拟器，实际确认导航、标签和快捷筛选图标显示，以及标签收起、快捷筛选展开／收起、标签搜索打开／关闭、设置菜单打开及取消返回侧栏。首次打开侧栏的窗口操作返回连接状态错误，重连后确认侧栏已展开；失败返回未单独记为交互通过。最终停留在侧栏预览；本轮未重跑 Web 全量测试或验证其他设备、系统版本与深色模式。

侧栏开发预览位于 `apps/apple/Sources/NativeSidebar.swift` 底部。`#Preview("侧栏布局")` 使用 326×874 固定画布和 DEBUG 示例数据，覆盖导航、快捷筛选、选中标签、Emoji 与多层标签；`#Preview("侧栏行")` 聚焦普通行、选中且可展开的行、Emoji 行。预览使用生产组件，不复制布局。`NativeHost(previewSurfaces:)` 直接提供示例 surfaces；普通 `NativeHost()` 在 DEBUG 的 `XCODE_RUNNING_FOR_PREVIEWS=1` 环境下也跳过笔记库恢复，避免 App 入口的 `@StateObject` 打开真实笔记库。Release 路径不变。示例数据显式声明字符串与动作类型，避免 Preview 注入调试表达式后类型推断超时。

2026-10-18 在 Xcode 27.1 中恢复了 Canvas 的逐元素源码定位。最小对照证明：直接传入函数引用的 `Button(action: action)` 无法选择内部文字，改为等价的 `Button { action() } label: { … }` 后恢复；侧栏文件中两个 `send: send` 也改为显式调用闭包后，完整预览恢复定位。保留原视图层次、尺寸、按钮样式、无障碍信息和动作行为。这是当前 Xcode Preview 的兼容处理；没有证据表明由视图层级深度或 App 渲染性能导致。诊断用文件、额外组件拆分与执行模式实验均已撤回，保留默认 JIT。

实际验证：在「侧栏布局」预览开启 Selectable 后，双击「主页」选中 `Text(title ?? item.title)…`，双击主页 Lucide 图标定位 `Image` 的资源表达式，双击品牌文字选中 `MemoCard`；相同生产组件的多个实例会一起出现选中边框。调布局时修改 `NativeSidebarItem` 的 `frame(minHeight: 48)`、`HStack(spacing: 8)`，或 `NativeSidebarIcon` 默认大小 16、子标签缩进 24，Canvas 会重新渲染。已临时验证行高 48→56→48 的联动并恢复原值。Live 模式用于折叠与搜索；真实页面动作在 App 中验证。

当前 Xcode 的检查器仅实际观察到 File／History／Quick Help，源码菜单未出现旧教程中的 Show SwiftUI Inspector，不能承诺通过该面板拖动或修改尺寸。[Apple 当前 Canvas 文档](https://developer.apple.com/documentation/xcode/interacting-with-previews-in-the-canvas)描述的可用流程是 Selectable 后双击元素定位源码，编辑源码并观察预览。

性能基准、复跑命令及指标限制见 `apps/apple/Tests/README.md`。本轮建立 Release 启动、侧栏展开／收起与滚动基线，并检查启动 Time Profiler；尚无测量证据支持侧栏运行时瓶颈，因此没有进行推测性的性能重构，也不宣称 App 已提速。

最终验证：iOS Debug 构建与 Mac Debug 构建通过；两项 Release 展开／收起、滚动回归通过（0 失败、0 跳过），`git diff --check` 通过。最终 Debug App 已安装并运行在 iPhone 18 Pro / iOS 27.0，实际确认侧栏布局与 Lucide 图标、三级标签「产品/体验/反馈」导航、选中状态及主页行返回。截图位于 `build/verification/ios-preview/native-sidebar-source-selection.jpg` 和 `native-sidebar-selection-final-simulator.jpg`。本轮未验证真机、iPad 或其他系统版本，未发布。
