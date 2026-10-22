import theme from "tailwindcss/theme.css?raw";
import capture from "../src/quick-capture.css?raw";
import sheet from "../src/components/ui/sheet.tsx?raw";
import sidebar from "../src/components/ui/sidebar.tsx?raw";
import swipe from "../src/components/ui/sheet-swipe.css?raw";
import images from "../src/import-layout.css?raw";
import globalCSS from "../src/styles.css?raw";

function read(source: string, pattern: RegExp, label: string, group = 1) {
  const value = source.match(pattern)?.[group];
  if (!value) throw new Error(`Missing motion definition: ${label}`);
  return value.trim();
}

const captureTransition = /transition:\s*box-shadow\s+(\S+)\s+([^;]+);/;
const swipeTransition = /transition:\s*translate\s+(\S+)\s+([^;]+);/;
const imageAnimation = /animation:\s*pulse\s+(\S+)\s+(cubic-bezier\([^)]*\))\s+infinite/;
const sheetEaseName = read(sheet, /\btransition\s+(ease-[\w-]+)\s+data-/, "Sheet easing");
const sheetEase = read(theme, new RegExp(`--${sheetEaseName}:\\s*([^;]+);`), "Tailwind Sheet easing");

export const motionCases = [
  { name: "默认过渡", duration: read(theme, /--default-transition-duration:\s*([^;]+);/, "default duration"), easing: read(theme, /--default-transition-timing-function:\s*([^;]+);/, "default easing"), source: "Tailwind" },
  { name: "快速记录聚焦", duration: read(capture, captureTransition, "capture duration"), easing: read(capture, captureTransition, "capture easing", 2), source: "quick-capture.css" },
  { name: "抽屉进入", duration: `${read(sheet, /data-\[open\]:duration-(\d+)/, "Sheet enter")}ms`, easing: sheetEase, source: "sheet.tsx · Tailwind" },
  { name: "抽屉退出", duration: `${read(sheet, /data-\[closed\]:duration-(\d+)/, "Sheet exit")}ms`, easing: sheetEase, source: "sheet.tsx · Tailwind" },
  { name: "侧栏展开 / 收起", duration: `${read(sidebar, /duration-(\d+) ease-linear/, "sidebar duration")}ms`, easing: "linear", source: "sidebar.tsx" },
  { name: "手势回弹", duration: read(swipe, swipeTransition, "swipe duration"), easing: read(swipe, swipeTransition, "swipe easing", 2), source: "sheet-swipe.css" },
  { name: "图片加载", duration: read(images, imageAnimation, "image duration"), easing: read(images, imageAnimation, "image easing", 2), source: "import-layout.css" },
];

export const reducedMotionRules = {
  animation: read(globalCSS, /animation-duration:\s*([^;!]+)\s*!important/, "reduced animation"),
  transition: read(globalCSS, /transition-duration:\s*([^;!]+)\s*!important/, "reduced transition"),
  scroll: read(globalCSS, /scroll-behavior:\s*([^;!]+)\s*!important/, "reduced scroll"),
  capture: read(capture, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*transition:\s*([^;]+);/, "reduced capture"),
  swipe: read(swipe, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*transition:\s*([^;]+);/, "reduced swipe"),
  image: read(images, /@media\s*\(prefers-reduced-motion:\s*reduce\)[^\n]*animation:\s*([^;]+);/, "reduced image"),
};
