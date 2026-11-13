import { Drawer, Loupe, Plug, Query, Rail, Sieve } from "@lucasmarkes/hairline/react";
import { usePreviewMode } from "../preview-mode";
import "./EmptyIllustration.css";

const illustrations = {
  drawer: { Artwork: Drawer, label: "空的分类抽屉" },
  loupe: { Artwork: Loupe, label: "在空白纸上寻找的放大镜" },
  sieve: { Artwork: Sieve, label: "没有留下内容的筛网" },
  plug: { Artwork: Plug, label: "尚未连接的插头与插座" },
  query: { Artwork: Query, label: "表示笔记不存在的问号" },
  rail: { Artwork: Rail, label: "等待挂上内容的空衣架" },
};

export type EmptyIllustrationKind = keyof typeof illustrations;

export default function EmptyIllustrationArt({ kind }: { kind: EmptyIllustrationKind }) {
  const theme = usePreviewMode();
  const { Artwork, label } = illustrations[kind];
  return <Artwork className="ui-hairline ui-empty-illustration w-full" theme={theme} intensity={0.5} label={label} />;
}
