import { ArgTypes, Canvas, Description, Markdown, Stories, Title } from "@storybook/addon-docs/blocks";

type ComponentDocsPageProps = {
  usage: string;
  anatomy: string;
  guidelines: string;
  accessibility: string;
  platform: string;
  api: string;
  apiArgs?: string[];
  exampleArgs?: string[];
};

// Opt in from component stories; examples keep the existing isolated iframe renderer.
export function ComponentDocsPage({ usage, anatomy, guidelines, accessibility, platform, api, apiArgs, exampleArgs }: ComponentDocsPageProps) {
  return <>
    <Title />
    <Description />
    <h2>默认示例与用法</h2>
    <Canvas source={{ code: usage, language: "tsx" }} sourceState="shown" story={{ __primary: true }} />
    <p>示例可手动操作；完整交互检查在 Canvas 中运行，Controls 用于调整示例参数。</p>
    <h2>组成</h2>
    <Markdown>{anatomy}</Markdown>
    <h2>使用建议</h2>
    <Markdown>{guidelines}</Markdown>
    <Stories title="变体与状态" includePrimary={false} />
    <h2>API 与组合契约</h2>
    <Markdown>{api}</Markdown>
    {apiArgs && <ArgTypes include={apiArgs} />}
    {exampleArgs && <>
      <h3>示例控制项</h3>
      <p>以下参数属于 Storybook 示例包装器，用于构造和观察场景；生产组件接口以上方契约为准。</p>
      <ArgTypes include={exampleArgs} />
    </>}
    <h2>交互与无障碍</h2>
    <Markdown>{accessibility}</Markdown>
    <h2>平台差异</h2>
    <Markdown>{platform}</Markdown>
  </>;
}
