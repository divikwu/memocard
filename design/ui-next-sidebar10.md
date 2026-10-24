# Web/H5 Sidebar-10 对齐与验收

2026-10-23。**状态：本轮本地 Web/H5 改造及最终对照验收完成；真机/真实系统文件选择器仍在边界之外。** 本轮修正上一轮对页面来源的判断：旧版主框架确实改自 shadcn `new-york-v4/sidebar-10`。本轮以模板槽位与旧版已存在的业务适配为基线，用 UI-next token / Base UI / Luma / Typeset 实现；不重写业务控制器，不改原生端。

## 基线与允许差异

- 官方快照：[sidebar-10.json](../docs/ui-reference/sidebar-10.json)、[manifest.json](../docs/ui-reference/manifest.json)。保留 `SidebarProvider → AppSidebar + SidebarInset`，Header 的 Trigger / Separator / Breadcrumb / NavActions 关系。
- 旧版当前行为：[App.tsx](../apps/ui/src/App.tsx)、[app-sidebar.tsx](../apps/ui/src/components/app-sidebar.tsx)、[styles.css](../apps/ui/src/styles.css)。不要把09-29历史验收的尺寸当成当前源码。
- 官方默认 Header56 / Sidebar256 / 内容768 / px16 py40；MemoCard 现有业务例外继续保留：桌面展开时Trigger在侧栏品牌行，H5三列88/1fr/88、主页/设置768、notes1280、detail720及48操作轨道；列表上下24/32、容器侧距16/24/32，移动抽屉85vw且最多360。
- 新字体/颜色/圆角与 Luma 控件视觉是已确认迁移范围。没有恢复旧 Neutral/Geist 值，没有装回 Radix 或加载旧样式；官方灰色占位块不作为业务内容。

## 差异关闭矩阵

| 差异 | 本轮处理 | 验证 |
| --- | --- | --- |
| 新Header72px、底边框、常驻大搜索 | 恢复56px/px12、Breadcrumb与条件Trigger/Separator、右侧页面操作；搜索保留原侧栏/快捷键/H5底部入口 | 新旧桌面/H5 DOM几何；WebApp回归 |
| 自增主页hero、H5重复标题/数量、空库大虚线框 | 恢复原mascot/页面标题层级、隐藏H5重复标题、卡片式授权引导与权限说明 | 新旧页面源码、空库回归、截图 |
| 页面宽度/留白和detail轴线变化 | 恢复旧容器规则、720文档轴和页面外操作轨道；保留新排版值 | 新旧1440/390几何、320详情、浏览器空白续写 |
| 侧栏品牌/入口/树形变化 | 恢复favicon/正文品牌、desktop-only搜索新建、原标签箭头/计数/hover操作分配 | 新Sidebar与primitive16测试、抽屉实测 |
| 抽屉尺寸、关闭后焦点与断点状态 | 恢复85vw/max360、inert、编辑区快捷键guard、跨断点关闭；vault手势与working保护 | 390=331.5、320=272；手势186px关闭与回焦；旧188测试 |
| H5集合重复工具栏/布局切换 | 恢复Header视图菜单与底栏入口，主页tabs等分；不改独立组件展示页 | 320/390真实页面及回归 |
| 卡片列宽和窄列metadata变化 | 恢复320px最小列宽；容器<768隐藏列表metadata且行高44 | 发布Story play：1280/768/767/390/320 |
| 回收站整卡点击范围缩小 | 恢复卡片空白打开、独立恢复/删除操作、焦点和disabled | 发布Story play命中/取消/回焦/恢复；旧Trash8测试 |
| 设置页新增大标题、卡片内标题/两列字段 | 恢复外置H2/分隔行、桌面横排/H5堆叠；保持新字体/圆角选择及反馈；H2继续使用heading token | 类型/单测；生产320外观切换及刷新 |
| 编辑器遗漏业务class标记 | 恢复`.note-editor`与`.note-page-scroll`行为hook，样式继续隔离 | 标题侧拖选先红后绿；真实空白续写/撤销/重做/保存读回 |
| H5页面操作仍只有32px | 用语义button命中规则保证44px，两个右侧操作正好落88px列 | 320详情三个操作均44×44 |
| Web产物被Lint当源码扫描 | 将已有独立dist-web-next输出加入Lint忽略项 | 完整Lint 0 errors，保留7项既有warnings |

## 用户截图触发的第二轮细节复核

用户追加截图后重新打开真实旧 App，与新版按同数据、同视口、同状态逐项比较。第一轮测试通过没有覆盖这些视觉缺陷；本节补充关闭记录，前一轮截图不作为最终侧栏证据。

| 项目 | 修正与最终检查 |
| --- | --- |
| 嵌套子项文字偏中 | 新原语为button且label flex-1，缺少text-left；补回左对齐，并用Range测真实文字起点而不只测span矩形。桌面32px、H5 48px；文字到图标8px；嵌套选中500/未选400。 |
| Sidebar底色错误 | 独立sidebar语义角色，light neutral50 #fafafa / dark neutral900 #171717；consumer全部使用bg-sidebar，不改body/surface或其他palette值。 |
| 展开按钮常驻灰底 | 保留aria-expanded真状态，覆盖ghost通用展开底色；静止透明、真实hover反馈、移开透明。树展开按钮同规则。 |
| focus边缘被裁切 | 移除展开panel的永久overflow-hidden。原生Tab核对新旧焦点均2px outline；新行right247、外层right255，轮廓能完整显示。 |
| H5树图标消失 | 手机右侧箭头始终显示，左侧图标也应保留；补足手机规则优先级，避免桌面hover/focus规则盖过。Story增加focused展开时实际opacity检查。 |
| H5菜单及关闭控件 | 菜单16px字/20px图标、至少48px命中、36px关闭。标题栏关闭规则限定sheet-header，避免SheetClose同槽位把所有菜单行压到36px；新增320/390全宽断言及关闭回焦。 |
| H5操作按钮视觉 | 保留原圆形边框/背景/阴影层级，使用新body/border/shadow角色；桌面维持ghost。两枚44px右侧动作在88px列内采用gap0；旧gap8会超出该列。 |
| H5主页标签栏 | 恢复分段底板、无underline；新44px可点击按钮放在52px list与60px外框中。实测clientHeight=scrollHeight，原生焦点轮廓在外框内。保留新版token圆角/底色。 |
| 标签方向键切换 | 业务TabsList显式activateOnFocus，恢复旧版方向键聚焦即切内容，新增回归并对照真实键盘。 |
| 标签编辑Sheet | 恢复顶部X、下拖关闭、关闭回焦；保存中X/手势/Escape均不能关闭。浏览器实际下拖180px关闭；不写入真实标签。 |
| 外观设置遗漏 | 恢复8种强调色、2种中性色、高级外观、恢复默认；新key缺失时兼容旧外观key，保留旧有效字体与实际圆角尺寸。仅显式彩色/Slate选择覆盖新角色，默认仍Luma/Noto/8px。 |
| 内容风格遗漏 | 复用旧Typography Provider/存储与解析器，接入新字体loader和Typeset adapter；七项偏好、随机/重置、实时预览恢复。正式构建刷新实测字体、18px/34.2px行高/36px段距/504px行宽，UI字体独立。 |
| 固定与状态反馈 | 恢复未保存原因Tooltip、固定填充图标、刷新旋转；装饰Spinner隐藏于辅助技术。补回详情失败/初次超时alert和连接状态status及错误图标；不支持trash分支保留h1。 |
| 长内容与disabled | Trash标题/路径恢复单行ellipsis及完整title；卡片原生disabled使用新disabled token；QuickCapture保留isolation并恢复z10。 |

本地只读交叉审查原始记录（未入库）：`sidebar-detail-audit.md`、`content-detail-audit.md`、`h5-title-tabs-audit.md`、`visual-role-audit.md`、`appearance-restoration.md`。这些记录保留发现时的“待验”文字，以本页和最终浏览器JSON作为关闭状态，不把旧snapshot重写成从未有过问题。

允许的迁移差异：新版Luma hover/selected用语义实色而旧版用透明tint叠加；字体、图标库、圆角及控件配方采用已确认新系统。H5点击目标从旧主页32px提高到44px，因此该局部高度增加。没有新增页面骨架、导航入口或改业务控制器。设置使用新版NativeSelect，保留原生键盘/手机选择行为。

## 验证证据

[仓库内精选证据](verification/2026-10-23/sidebar10-alignment/)保留本页引用的截图与测量 JSON；原始日志位于本地 `build/verification/sidebar10-alignment/`，不入库。这是同种子内存夹具验收，不连接真实笔记库。

- 新版全量：34 suites / **272 tests**，`ui-next-final.log`。
- 旧版相关：11 files / **188 tests**，`legacy-regression.log`；旧Trash8项和新Collection6项另有focused记录。
- 旧Typography Provider可选字体loader的兼容面另有2文件/9项回归；默认行为不变。
- TypeScript通过；完整ESLint 0 errors / 7个既有warnings（生成产物忽略修正前的日志单独保留）。
- 独立Web与Storybook生产构建通过（Storybook 156 entries），最终日志 `web-build-final.log`、`storybook-build-final.log`。既有大chunk提示保留，未扩大本轮优化范围。
- [browser-geometry.json](verification/2026-10-23/sidebar10-alignment/browser-geometry.json)区分初次测量与`*-final`结果；JSON按原始记录保留，以final复验项判断当前结果。1440桌面最终新旧均Header56、Sidebar256、home768、sidegutter32，快速记录top264；notes可用1120，三列。
- H5：390/320无横向页面溢出、Header56、内容358/288、底栏68；drawer331.5/272。H5详情无底栏，返回/固定/页面操作均44px。
- 真实UI已验证：标签导航关闭drawer；菜单切换列表；库底部面板下拉关闭及焦点返回；跨桌面/H5断点重置drawer；搜索→详情→返回保留关键词；快速记录保存并打开读回；正文下方空白续写、撤销/重做及返回后读回；生产外观切换并刷新保留。
- 生产320设置：select均44px高/16px字，无横向溢出；dark、Large、Inter标题、Geist正文刷新后实际CSS生效，随后恢复验收前偏好。圆角选项是基础值，各组件按Luma语义倍率映射。
- 320草稿弹层实测宽288/高708（视口740），列表1888px在470px内滚动，无溢出按钮；权限页重授权入口可达。保存失败场景点击返回仍留在编辑页，正文保留并提供重试保存。
- 发布Story `ui-next-sidebar10-business-parity--layout-and-card-actions` 的最终恢复状态可见，前置列宽/metadata/命中/回焦/取消断言均完成。首次fixture依赖seed顺序已修为按标题选择；重建产生的旧hash缓存已在禁用缓存重载后清除，历史错误不冒充产品故障。

## 可见预览与边界

- 新版：[Web/H5 Storybook](http://127.0.0.1:6016/?path=/story/ui-next-web--workspace)。
- 旧版同数据：[Legacy reference](http://127.0.0.1:6006/?path=/story/sidebar10-legacy-workspace--workspace)。新增reference Story使用真实旧App，隔离旧样式。
- 官方模板有独立快照/实时页面证据；官方没有编辑器、设置或笔记库业务，不能把业务页称为官方模板逐像素复刻。
- 浏览器为桌面环境下的320/390视口与指针手势模拟，不替代iOS真机软键盘、系统文件选择器、原生手势验收。iOS/Mac适配仍后置。
- 夹具不提供真正的重命名/系统文件选择/跨库切换/图片picker；这些真实文件系统边界没有在本轮写入验收。保留共享controller与相应自动化契约，未发布、未安装替换客户端、未向真实笔记库写入。

## 截图

- [最终新版桌面集合](verification/2026-10-23/sidebar10-alignment/sidebar10-web-notes-final.png) / [最终旧版同数据](verification/2026-10-23/sidebar10-alignment/sidebar10-legacy-notes-final.png)
- [最终390px抽屉](verification/2026-10-23/sidebar10-alignment/sidebar10-h5-sidebar-final-390.png) / [最终320px抽屉](verification/2026-10-23/sidebar10-alignment/sidebar10-h5-sidebar-final-320.png)
- [H5菜单宽度修正](verification/2026-10-23/sidebar10-alignment/sidebar10-h5-vault-fixed-390.png) / [H5标签编辑](verification/2026-10-23/sidebar10-alignment/sidebar10-h5-tag-editor-320.png) / [H5主页焦点](verification/2026-10-23/sidebar10-alignment/sidebar10-h5-home-selected-new-320.png)
- [侧栏明色默认新版](verification/2026-10-23/sidebar10-alignment/sidebar10-sidebar-default-new.png) / [旧版](verification/2026-10-23/sidebar10-alignment/sidebar10-sidebar-default-old.png)；[深色新版](verification/2026-10-23/sidebar10-alignment/sidebar10-sidebar-dark-new.png) / [旧版](verification/2026-10-23/sidebar10-alignment/sidebar10-sidebar-dark-old.png)
- [320px草稿](verification/2026-10-23/sidebar10-alignment/sidebar10-drafts-320.png) / [保存失败保护](verification/2026-10-23/sidebar10-alignment/sidebar10-save-failure-320.png)
- [320px暗色设置](verification/2026-10-23/sidebar10-alignment/sidebar10-settings-dark-320.png)

最终逐状态测量见 [sidebar-detail-browser.json](verification/2026-10-23/sidebar10-alignment/sidebar-detail-browser.json)，包括浅色/深色、默认/hover/selected/focus、H5菜单、主页标签和正式Web偏好读回。QuickCapture末尾标签建议真实命中验证通过（z10，选择后读回#阅读，随后清空内存测试输入）；H5标签编辑实际下拖180px并回焦。合成userEvent.hover不驱动浏览器CSS :hover，故Story保留几何/ARIA断言，hover与focus-visible结论取自真实pointer/Tab。Storybook使用隔离内存偏好，刷新会重置；持久化结论仅来自正式Web构建。真机与系统文件边界不在此结论范围内。

最终静态验收完成后已停止本轮临时6017/5181服务，保留6006旧版和6016新版可见预览；另保留用户当前选择的旧版空库状态。构建中短暂404、重建hash过期与旧字体模块错误日志保留，重载最终模块后未再现；不把这些中间态当成功或当前产品回归。全树diff --check还报告旧共享sheet-swipe.tsx既有EOF空行，本轮未作相邻清理。

## 后续同状态验收

编辑器、搜索、设置、回收站与卡片/列表的继续复核及修复见 [2026-10-23 同状态对照](ui-state-parity-2026-10-23.md)。该记录补充搜索与卡片的旧业务样式配方、新 token/组件应用、实际指针与键盘路径，以及成对截图；当前保留的新旧页面已切到相同数据和状态。
