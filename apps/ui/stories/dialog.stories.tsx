import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ComponentDocsPage } from "../.storybook/component-docs";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../src/components/ui/dialog";
import { Input } from "../src/components/ui/input";

const usage = `import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// onSave 是本例的内存回调，不是 Dialog 的 prop，也不会写入笔记。
export function EditTitleDialog({ onSave }: { onSave: () => void }) {
  const titleId = useId();
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">编辑笔记标题</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑标题</DialogTitle>
          <DialogDescription>保存后继续编辑当前笔记。</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor={titleId} className="text-sm font-medium">笔记标题</label>
          <Input id={titleId} defaultValue="侧栏使用指南" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消</Button>} />
          <DialogClose render={<Button onClick={onSave}>保存</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}`;

const anatomy = `- **Dialog**：组织开关状态及模态行为；默认由组件内部管理状态。
- **DialogTrigger**：打开入口，通过 \`render\` 与生产 Button 组合，形成一个按钮。
- **DialogContent**：居中的内容面板，内部提供 Portal、Overlay 和默认右上角关闭按钮。
- **DialogHeader / DialogTitle / DialogDescription**：组织标题与说明，并为弹窗建立可访问名称和描述。
- **DialogFooter / DialogClose**：组织业务操作与关闭入口；Footer 本身不提交表单，也不保存数据。`;

const guidelines = `- 用于需要暂时聚焦的短任务，例如编辑标题、查看信息；较长编辑流程保留在笔记页面中。
- 标题说明当前任务，说明文字交代操作影响；主要操作使用具体动词，取消入口保持可见。
- 通过 \`DialogTrigger render={<Button ... />}\` 和 \`DialogClose render={<Button ... />}\` 组合按钮。
- 本例的“保存”仅调用 \`onSave\` 并关闭弹窗，没有持久化、校验或异步保存逻辑。
- 接入异步业务时使用受控 \`open / onOpenChange\`，由业务在保存成功后关闭，在失败时保留输入并展示错误；提交按钮直接使用 Button，关闭时机由业务控制。`;

const accessibility = `- 为每个弹窗提供 DialogTitle，并用 DialogDescription 解释任务；表单字段使用关联的 label 与唯一 id。
- 模态焦点、键盘关闭及返回触发器由 Base UI 管理；可通过 Content 继承的 \`initialFocus / finalFocus\` 调整特殊场景的焦点目标。
- 若关闭 Content 的默认关闭按钮，仍需提供有明确名称、可通过键盘访问的关闭入口。
- 当前交互检查覆盖默认输入值、示例保存回调次数、关闭与 Escape 后焦点返回；屏幕阅读器及真实触摸体验需要另外验收。`;

const platform = `- **Web / H5**：使用同一生产 Dialog 组合，沿用现有响应式宽度、内容滚动和主题样式。
- **Mac**：Web 界面使用该 React 组件家族。
- **iOS**：应用层确认与弹窗继续使用现有原生组件、系统布局和交互；此 Web 示例不替代对应的 Xcode Preview 或设备验收。`;

const api = `生产入口：\`@/components/ui/dialog\`。以下是本地封装的契约，\`onSave\` 仅属于本页 DialogExample 示例。

| 生产组件 | 本地契约与继承接口 |
| --- | --- |
| Dialog | 对应 Base UI Root；继承 \`open\`、\`defaultOpen\`、\`onOpenChange(open, eventDetails)\`、\`modal\` 等。受控时同步提供 \`open\` 与 \`onOpenChange\`；默认非受控。 |
| DialogTrigger | 继承 Trigger，包括 \`render\` 和按钮属性；\`render={<Button ... />}\` 将触发行为组合到该 Button。 |
| DialogContent | 继承 Popup，包括 \`initialFocus\`、\`finalFocus\`、\`className\`、\`style\`；新增 \`showCloseButton?: boolean\`，默认 **true**。内部已提供 Portal 和 Overlay；默认关闭按钮名称为“Close”。 |
| DialogTitle / DialogDescription | 分别继承 Title / Description；传入标题及说明内容，建立弹窗名称与描述关系。 |
| DialogClose | 继承 Close，包括 \`render\` 和按钮属性；只负责请求关闭，不执行数据保存。 |
| DialogHeader | 普通 div 属性及 \`className\`、\`children\`；提供标题区域的布局。 |
| DialogFooter | 普通 div 属性及 \`className\`、\`children\`；新增 \`showCloseButton?: boolean\`，默认 **false**；设为 true 会追加一个文案为“Close”的 outline 关闭按钮。 |
| DialogPortal / DialogOverlay | 分别继承 Portal / Backdrop；DialogContent 已在内部使用它们，常规组合直接使用 Content。 |

完整继承参数与事件类型见 [Base UI Dialog API](https://base-ui.com/react/components/dialog#api-reference)。本地新增的 \`showCloseButton\` 以以上两个默认值为准。`;

function DialogExample({ onSave }: { onSave: () => void }) {
  const titleId = useId();
  return <Dialog>
    <DialogTrigger render={<Button variant="outline">编辑笔记标题</Button>} />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>编辑标题</DialogTitle>
        <DialogDescription>保存后继续编辑当前笔记。</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <label htmlFor={titleId} className="text-sm font-medium">笔记标题</label>
        <Input id={titleId} defaultValue="侧栏使用指南" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">取消</Button>} />
        <DialogClose render={<Button onClick={onSave}>保存</Button>} />
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

const meta = {
  title: "components/dialog",
  component: DialogExample,
  globals: desktopGlobals,
  parameters: {
    layout: "centered",
    docs: {
      description: { component: "Dialog 将一个短任务放在页面上方，适合编辑标题或查看补充信息。此页使用生产组件组合，保存操作仅触发内存回调；iOS 应用层弹窗保留原生实现。" },
      page: () => <ComponentDocsPage usage={usage} anatomy={anatomy} guidelines={guidelines} accessibility={accessibility} platform={platform} api={api} exampleArgs={["onSave"]} />,
    },
  },
  argTypes: {
    onSave: { description: "示例控制项：点击保存后触发的内存回调；不是 Dialog 生产 API，不写入笔记。", control: false },
  },
  args: { onSave: fn() },
} satisfies Meta<typeof DialogExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "编辑笔记标题" });
    await userEvent.click(trigger);
    const dialog = await page.findByRole("dialog", { name: "编辑标题" });
    await expect(within(dialog).getByRole("textbox", { name: "笔记标题" })).toHaveValue("侧栏使用指南");
    await userEvent.click(within(dialog).getByRole("button", { name: "保存" }));
    await expect(args.onSave).toHaveBeenCalledOnce();
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await page.findByRole("dialog", { name: "编辑标题" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onSave).toHaveBeenCalledOnce();
  },
};
