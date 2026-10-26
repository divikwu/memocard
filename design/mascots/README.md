# 吉祥物素材与创作档案

现行 [MemoCard UI 吉祥物预览](http://127.0.0.1:5182/mascots.html) 展示 13 个实例，使用 11 对方向／表情图集；两项渐隐变体复用原图。唯一运行时目录为 `apps/ui/mascot-fixtures`，其 `catalog.ts` 静态引用 22 张 WebP，许可证保留在同目录。

## 文件归属

| 目录 | 内容 | 是否进入运行时 |
| --- | --- | --- |
| `characters/` | 215 份原始参考、生成图、对齐帧、构建脚本和设计过程记录 | 否 |
| `history/runtime-sheets/` | 19 张早期迭代图集及原许可证 | 否 |
| `../../apps/ui/mascot-fixtures/` | 现行 22 张方向／表情图集、catalog 与许可证 | 由新版 Preview 显式导入 |

创作资料与历史图集从退役入口迁出时保留原始二进制字节。子目录中的旧验证记录仅说明当时检查结果，不代表当前全设备覆盖。原型说明另存于 `design/prototypes/`；不保留旧版运行页面或服务。

## 重建

从仓库根目录使用已有的 `build/mascot-tools/bin/python` 环境运行对应脚本。脚本依赖 Pillow、NumPy 和 SciPy，不自动安装依赖，也不自动生成缺失的原始图像。

- `characters/memocard-primary/build.py`、`memocard-final/build.py`、`memocard-final-black-pen/build.py`、`memocard-idea/build.py` 将现行图集写入 `apps/ui/mascot-fixtures`。
- Primary 的历史 coffee-swapped 参考图从 `history/runtime-sheets` 读取；输出仍为现行 Primary 图集。
- 其他历史构建脚本只向 `history/runtime-sheets` 输出，不覆盖现行目录。`pack-thin-directions.py` 仍需事先生成 `build/mascot-thin` 中的输入图集。
- 仅做源图预处理的 `prepare.py` 继续把结果写入自身源资料目录。部分探索分支只保存了参考图；重建前需先补齐其记录中所需的 raw 图像。

例如：

```sh
build/mascot-tools/bin/python design/mascots/characters/memocard-primary/build.py
build/mascot-tools/bin/python design/mascots/characters/memocard-final-black-pen/build.py
```

这些重建命令会更新源目录中的对齐帧和目标 WebP，属于有意的素材变更；仅审查或迁移目录时无需运行。
