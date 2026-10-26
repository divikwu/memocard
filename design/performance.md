# 侧栏索引与原生状态订阅

2026-10-18，以 PR #48 的 `a53fb0a1992ca66fcc01d007475c1a05617e3f0a` 为旧实现。先保存源码与正常 App 基线，再测优化工作区；原始记录用源码 SHA 标识实现，不把测量时尚未提交的工作区误记为旧 HEAD。机器为 Apple M4、16 GB，Node 24.18.0、Xcode 27.1 / Swift 6.4。以下三种计时范围不同，不能横向比较 Web 与 Swift 的绝对速度。

## 实现与行为约束

- Web 根据 `tags` 引用用 `useMemo` 建立 roots、直接子项和首个同名标签索引；每次渲染用 Set 查置顶状态。原数组仍决定展示顺序，搜索保留一次全路径扫描。
- Swift 在一次 `scrollContent` 计算内捕获当前 actions 并建立路径到位置的索引，整棵树共用。没有额外缓存或异步更新时序；重排、删除、计数、图标和 selected 都来自同一份当前数组。
- 两端均保留缺父节点、重复路径、空路径与各端既有字符串语义，不补齐或排序路径；置顶分支、搜索平铺与每行展开状态不变。建表成本随路径总长度增长，之后查询直接子项；实际遍历量包含置顶区重复显示的条目。
- iOS 的 surface 内容离开 Host 全字典发布，改为稳定的每 id 订阅对象。外层仅观察展示身份、开合、alert、capture busy/summary 及主题/palette；`showPicker` 继续由 Host 发布。同值 payload 跳过通知，实例校验、snapshot、resetKey 与输入确认逻辑保留。

## Web 标签树

真实 `TagNavigation` / `TagBranch` 通过 SSR 执行，仅替换展示 primitives 与存储；这是组件树计算，包含 React/字符串输出，不含 DOM、布局或绘制。旧、新实现串行执行相同 fixture，各 2 次 warmup、11 次冷挂载，保留全部样本。P95 使用 nearest rank，在 11 个样本时等于最大值。

| 形态 | 标签数 | 旧 median / P95 ms | 新 median / P95 ms |
| --- | ---: | ---: | ---: |
| 平铺 | 1,000 | 22.300 / 23.260 | 11.692 / 13.662 |
| 平铺 | 5,000 | 324.270 / 392.213 | 55.966 / 121.686 |
| 平铺 | 10,000 | 1155.861 / 1218.743 | 111.432 / 183.759 |
| 分支 | 1,000 | 30.001 / 30.551 | 11.146 / 64.416 |
| 分支 | 5,000 | 613.613 / 621.208 | 57.046 / 57.928 |
| 分支 | 10,000 | 2058.996 / 2106.570 | 114.484 / 174.344 |
| 缺父路径 | 1,000 | 10.638 / 11.395 | 3.454 / 4.658 |
| 缺父路径 | 5,000 | 209.606 / 270.182 | 17.536 / 19.332 |
| 缺父路径 | 10,000 | 803.172 / 857.519 | 35.279 / 94.325 |

1 万个完整展开节点的原数组元素访问由 **150,025,000 → 10,000**；缺父路径场景由 45,014,000 → 10,000。操作次数是确定性回归依据。仅选择变化不重扫原数组，但仍会遍历已挂载 React 条目。

1k 分支的新 P95 包含一个未归因的 64.416ms 长尾，其余 10 个样本为 10.979–12.455ms。原始值不删除，不把所有规模的尾部都描述为改善。完整数据与四份源码指纹见 [sidebar-web-tags.json](performance/sidebar-web-tags.json)。

为复核该尾部，保持生产和测量源码不变，用现有 runner 的 `MEMOCARD_TAG_BENCH_SIZES=1000` 连续执行 10 轮独立前后对照。每种形态、每个版本合计 110 个样本全部保留；分支场景 median/P95 为 **29.993/31.028 → 11.704/12.802ms**，新最大值 13.457ms。独立 1k 场景未稳定复现原长尾，但没有原 full matrix 的 10k 前缀，不能宣称长尾已消除或将它归因于 GC。各轮统计、全部样本和原长尾记录见 [sidebar-web-tail.json](performance/sidebar-web-tail.json)。

## Swift 标签树

`swiftc -O -swift-version 5` 编译生产索引及从旧提交自动提取的真实 getter。同一可执行文件、同一组中文层级路径，逐轮交替前后执行顺序；各 3 次 warmup、15 次采样。新路径包含建表、映射当前 actions 及完整遍历，旧路径每行只计算一次 children，是实际旧 View 重复求值的保守下界。这里不含 SwiftUI 布局或 bridge 解码。

| 标签数 | 旧 median / P95 ms | 新 median / P95 ms |
| --- | ---: | ---: |
| 1,000 | 159.307 / 164.931 | 0.458 / 0.508 |
| 5,000 | 4208.236 / 4258.991 | 2.557 / 2.661 |
| 10,000 | 15826.353 / 15931.518 | 5.210 / 5.407 |

源码指纹、环境与各档统计见 [sidebar-native-tags.json](performance/sidebar-native-tags.json)。Swift 字符串边界另由 1,340 路径的差分回归验证。

## iOS 通知范围

隔离的 Debug Simulator probe 编译真实 App 源码，经 `NativeHost.handle` 注入同输入；预览初始化不读取真实笔记库。统计的是 publisher 通知，不能等同于 SwiftUI body 执行或帧数。

| 输入 | 旧实现 | 新实现 |
| --- | --- | --- |
| 相同 navigation 重放 100 次 | Host 与各观察者均 100 次 | 全部 0 次 |
| search 内容更新 100 次 | Host、导航、Chrome、其他面板均 100 次 | 只有 search 100 次 |
| Chrome 标题更新 100 次 | Host 与各观察者均 100 次 | 只有 chrome 100 次 |
| 1,000 标签的 navigation 重放 20 次 | Host 与各观察者均 20 次 | 全部 0 次 |
| 过期实例移除 | 忽略 | 忽略 |
| 有效导航实例移除 | Host 与各观察者均 1 次 | navigation 与 presentation 各 1 次 |

大载荷的 JSON 解析、比较与更新总耗时为 **49.743 → 52.927ms / 20 次**，观察差值约 **0.159ms / 次**。这是单组采样，既不推断统计显著性或将差值全部归因于比较，也不把通知减少直接换算为 App 耗时改善。42 个独立字段变化、同值重放、实例替换/移除、reload、稳定订阅对象、picker、主题/palette 和展示投影均有断言。记录与源码指纹见 [sidebar-subscriptions.json](performance/sidebar-subscriptions.json)。

后续真实输入回归发现：Return/失焦可把已确认的同值文本重新写成本地覆盖值，原来依赖全局通知偶然清理。setter 改为只在输入实际变化时写覆盖值，仍发送原有事件。相同 harness 在冻结的未修正优化版复现 `text=A`、`placeholder=Cleared query`；修正后 Return、失焦、在途 B 保留到 ACK 后再接受 C 共 3 个真实 UIKit 场景通过。`finalValidation` 保留最终源码指纹及 42 字段/6 场景复跑，原计时快照及原始指纹不替换；后续复跑不是新的时延对照。

## Release Simulator 场景

iPhone 18 Pro / iOS 27.0，同一 `MemoCard iOS QA` 库，前后各 5 个 XCTest 场景全部通过、0 跳过。没有编辑笔记；先冻结旧版产物，再分开安排编译、算法基准与 UI 采样。各性能项在 warmup 后测 5 次。

| 指标 | 旧 mean s / RSD | 新 mean s / RSD |
| --- | ---: | ---: |
| 首帧可响应 | 2.664 / 2.572% | 2.632 / 1.690% |
| 侧栏开合 | 4.288 / 10.728% | 3.748 / 0.369% |
| 两次快速滑动 | 2.574 / 0.521% | 2.574 / 0.507% |

开合包含 XCTest 的点击、查询与 idle 等待；旧基线波动较大，不能据此宣称提速。滚动时长不是 FPS 或卡顿率，首帧可响应不代表 Web 内容已完成加载。完整样本见 [sidebar-simulator.json](performance/sidebar-simulator.json)；本机 `.xcresult` 保留在 `build/verification/sidebar-performance/`。

## 复跑与持续检查

```sh
pnpm bench:sidebar:web
pnpm bench:sidebar:native
pnpm test:sidebar-native
pnpm test:native-surfaces
pnpm verify:design
```

当前 `bench:sidebar:web` 默认比较已发布 UI-next 起点 `de51cec` 与工作树 TagNavigation 模块；可用 `node scripts/benchmark-sidebar-tags.mjs [baseline-ref] [output-directory]` 指定来源，显式 ref 必须包含该 UI-next 模块。两组统一使用当前共享 helpers 与展示层/存储 mock，执行 SSR 冷挂载；不重建完整历史 App，也不测 DOM/FPS。`bench:sidebar:native` 仍默认比较旧提交 `a53fb0a`，支持显式 ref；需要先取得对应提交。上文 Web 表格保留其当时旧算法基线，不能作为当前默认命令的新结果。基准运行时暂停 Preview、编译、浏览器测试及其它性能进程。macOS `verify:release` 运行 Swift 索引语义和真实 Host probe，设计 CI 检查 Storybook；它们对确定性操作/通知和行为断言设门槛，不对机器相关的毫秒值设门槛。

本轮未测真机、旧 OS、功耗、SwiftUI body 次数、真实大库 DOM/布局与帧率，也未实现虚拟滚动。1 万节点 Web SSR 仍约 111–114ms，不能据此承诺交互帧预算。默认外观、原生控件、手势与动作协议保持原实现。

依赖收敛与缓存原则参考 [Apple SwiftUI 性能文档](https://developer.apple.com/documentation/xcode/understanding-and-improving-swiftui-performance) 和 [React useMemo](https://react.dev/reference/react/useMemo)。`useMemo` 只节省计算，不作为业务状态来源。
