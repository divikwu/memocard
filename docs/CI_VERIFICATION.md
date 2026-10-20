# CI 验证与耗时

完整验证按依赖拆分；`release` 仍是最终门禁，任一适用任务失败、取消或意外跳过都不能通过。

```text
changes ─┬─ release-web (Ubuntu) ── native-build [mac | ios | service]
         ├─ release-native (macOS: Swift / 协议 / 服务 / 索引)
         └─ native-surfaces (独立 macOS: 工程漂移 / Simulator)
design (Ubuntu: Storybook 全部验证)
         └─ release 等待上述所有适用任务
```

- `verify:web`：清单、token、UI primitive、CI/构建脚本回归、Web/MCP 类型/lint/单测/构建与 bundle 预算；依赖审计在 Web CI job 执行。
- `verify:native`：Swift 核心、真实 TCP 和 HTTP 契约；原生 CI job 另执行服务与侧栏索引；工程漂移和真实 Simulator 探针在独立 runner 执行，避免运行中的模拟器与 TCP/HTTP 边界测试争用同一机器资源。
- `pnpm verify` 组合 Web 与原生核心；`pnpm verify:release` 本地始终保留完整检查与三种构建。
- 三种原生构建分别使用独立 runner，每个 checkout 仅准备一次 Web 资源和工程。Debug macOS、Debug iOS Simulator、Release Service/CLI 的配置及签名检查保持不变；不在共享资源目录或 DerivedData 上并发写入。
- Web job 成功后发布当前 run 和提交 SHA 专属产物，包含完整文件列表及 SHA256。每个构建在恢复资源前验证 checkout、提交和全部文件；缺失、增加、损坏、符号链接或错提交均失败，不能回退到未经验证的本机旧 bundle。
- 产物名称不包含 run attempt，以支持仅重跑失败的原生任务；重跑全部任务会覆盖同一 run 的产物。Web 产物保留 1 天，过期后需要重新运行 Web job，不能跳过校验。
- 独立探针 job 在工程漂移检查后立即运行探针，不安装 Node 依赖或执行其他单测，尽早暴露冷启动失败。不再单独启动、关闭预检设备；探针内部在编译前检查 runtime 并启动一次，持续使用同一设备至安装和断言结束。独立 `--prepare-only` 仍保留本地清理；命令期限、失败诊断、60 秒断言预算和探针卸载/自建设备清理不变。
- `changes` 始终执行 CI 路由、Web 产物和环境控制脚本单测。main push 始终完整验证；PR 只对完整累计差异内的 Storybook/文档允许快速通道，适用范围见 README。快速通道要求 Web、原生核心测试、探针和全部原生构建均明确跳过，design 仍须成功。

## 改造前基线

来源：[main eeb60ec 的实际 CI](https://github.com/divikwu/memocard/actions/runs/39402690640)，不是估算。

| 阶段 | 耗时 |
| --- | --- |
| release-native 总计 | 20m23s |
| 独立 Simulator 预检 | 2m51s |
| 混合 Web/原生核心 verify | 4m33s |
| Simulator 探针步骤 | 4m35s |
| macOS 构建 | 1m53s |
| iOS 构建 | 1m50s |
| Service 构建 | 2m37s |

该次预检 boot 102.787s、随后 shutdown 57.872s；探针再次 boot 34.417s。探针构建 53.225s，App 内断言 19.304s；安装、启动和卸载另计。这些数据不能推断 App FPS 或真机性能。

改造后比较整个 run 的墙钟耗时、各 job 执行/排队时间、Simulator 阶段以及全部 runner 分钟；并行缩短关键路径但增加机器数量，冷启动或配额排队可能抵消收益。一次运行仅是样本，不承诺固定加速比例。验收必须包含完整 CI、三种构建、签名和门禁回归，不以局部单测替代。
