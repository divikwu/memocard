# 基础规范

现行产品采用 Luma / Base UI / Tailwind CSS 4，保留 Sidebar-10 页面骨架。默认浅色、黑白强调色、Neutral、Noto Sans 和 8px 控件圆角。定义来源见 [token 规范](token-system.md)，完整清单见 [覆盖目录](token-coverage.generated.md)。

## 颜色与状态

主题使用 `--color-background-*`、`--color-text-*`、`--color-icon-*`、`--color-border*` 等语义角色。WebAppearance 管理明暗/系统、强调色、中性色与本机偏好；PreviewModeProvider 应用已解析的字体、圆角和明暗模式。原生自定义表面消费同一主题解析后的 palette，系统控件的文字、材质和内部布局继续由平台拥有。

悬停、按下、选中、键盘焦点、禁用、只读和危险操作分别表达。真实 disabled、ARIA、错误说明和确认行为不能由视觉颜色代替。数据色、syntax 和 brand 定义不等于业务使用情况；待配置或保留状态要明确登记。

## 排版与布局

UI 字体、字号、字重、行高由 [theme.css](../apps/ui/ui/theme.css) 拥有。笔记默认正文 Noto Sans、标题跟随正文、代码 Geist Mono；正文配置只影响阅读与编辑区域。原生使用系统字体与现有 Dynamic Type 映射。详见 [Typography](typography.md) 和[原生排版](native-typography.md)。

间距基础为 `.25rem`，控件高度、图标视觉框、触摸命中目标和容器留白分别维护。常规控件圆角可选 0 / 7.2 / 8 / 10 / 14px 的 16px 根字号基准；旧设备圆角仅作兼容值保留。实际圆角由角色派生，不能把所有菜单、按钮和内容卡片都视为同一形状。

当前 Web 侧栏桌面最小 36px，H5 最小 44px；原生侧栏为 48pt 基准；文字放大时允许增长，完整名称仍向辅助技术提供。导航断点为 768px，业务容器可有自己的断点。产品至少支持 320px 宽度，不用固定设计稿尺寸覆盖原生安全区和系统边距。

## 图标、材质和动效

当前 Web 控件使用 Hugeicons。原生自定义侧栏继续消费既有 Lucide 导出资源，系统菜单与工具栏使用 SF Symbols；图标生成目录只列其实际负责的资源。图标按钮必须有可访问名称，Emoji 保留用户设置。

主题统一时长与缓动，组件拥有具体动画属性和手势阈值。遵循减少动态设置，保留 Base UI 的键盘/焦点/Portal 行为及 UIKit 原生手势。展开、导航与菜单操作不串动作，关闭浮层后恢复合理焦点。

## 验收边界

真实组件在唯一 Storybook 验证，整页状态在隔离 Preview 验证；产品浏览器流程验证真实路由和沙盒文件写入。原生 Preview、surface 协议 probe、WKWebView 与真机分别记录，不把内存 fixture 或编译成功当作真实文件、系统 picker、IME、同步或性能验收。

尺寸和平台例外见[组件归属](component-ownership.md)及[侧栏规格](components/sidebar.md)。历史设计与迁移报告保留来源证据，现行入口从[设计维护目录](README.md)进入。
