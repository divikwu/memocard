import catalog from "../../../design/token-coverage.generated.json";
import capture from "../src/quick-capture.css?raw";
import swipe from "../src/components/ui/sheet-swipe.css?raw";
import images from "../src/import-layout.css?raw";
import globalCSS from "../src/styles.css?raw";

const tokens = catalog.css.filter(token => token.category === "motion" && token.layer !== "adapter");
export const motionDurationTokens = tokens.filter(token => token.type === "duration");
export const motionEasingTokens = tokens.filter(token => token.type === "cubicBezier");
function value(name: string) {
  const token = tokens.find(token => token.name === name);
  if (!token) throw new Error(`Missing motion token: ${name}`);
  return token.declarations[0].value;
}

export const motionCases = [
  { name: "默认过渡", durationToken: "--motion-duration-fast", easingToken: "--motion-ease-standard" },
  { name: "快速记录聚焦", durationToken: "--motion-duration-normal", easingToken: "--motion-ease-out" },
  { name: "抽屉进入", durationToken: "--motion-duration-panel", easingToken: "--motion-ease-standard" },
  { name: "抽屉退出", durationToken: "--motion-duration-panel", easingToken: "--motion-ease-standard" },
  { name: "侧栏展开 / 收起", durationToken: "--motion-duration-panel", easingToken: "--motion-ease-linear" },
  { name: "手势回弹", durationToken: "--motion-duration-normal", easingToken: "--motion-ease-rebound" },
  { name: "图片加载", durationToken: "--motion-duration-pulse", easingToken: "--motion-ease-pulse" },
  { name: "对话框进入 / 退出", durationToken: "--motion-duration-panel", easingToken: "--motion-ease-popup" },
  { name: "浮层 / 菜单 / 提示 / 遮罩", durationToken: "--motion-duration-fast", easingToken: "--motion-ease-popup" },
  { name: "加载占位", durationToken: "--motion-duration-pulse", easingToken: "--motion-ease-pulse" },
].map(item => ({ ...item, duration: value(item.durationToken), easing: value(item.easingToken) }));

function read(source: string, pattern: RegExp, label: string) {
  const expression = source.match(pattern)?.[1]?.trim();
  if (!expression) throw new Error(`Missing motion definition: ${label}`);
  return expression.replace(/var\((--motion-[\w-]+)\)/g, (_, name: string) => value(name));
}
export const reducedMotionRules = {
  animation: read(globalCSS, /animation-duration:\s*([^;!]+)\s*!important/, "reduced animation"),
  transition: read(globalCSS, /transition-duration:\s*([^;!]+)\s*!important/, "reduced transition"),
  scroll: read(globalCSS, /scroll-behavior:\s*([^;!]+)\s*!important/, "reduced scroll"),
  capture: read(capture, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*transition:\s*([^;]+);/, "reduced capture"),
  swipe: read(swipe, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*transition:\s*([^;]+);/, "reduced swipe"),
  image: read(images, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*animation:\s*([^;]+);/, "reduced image"),
};
