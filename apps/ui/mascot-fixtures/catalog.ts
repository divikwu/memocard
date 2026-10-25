import blackPenDirections from "./memocard-final-black-pen-directions.webp";
import blackPenReactions from "./memocard-final-black-pen-reactions.webp";
import finalDirections from "./memocard-final-directions.webp";
import finalReactions from "./memocard-final-reactions.webp";
import primaryDirections from "./memocard-primary-directions.webp";
import primaryReactions from "./memocard-primary-reactions.webp";
import ideaDirections from "./memocard-idea-directions.webp";
import ideaReactions from "./memocard-idea-reactions.webp";
import crtDirections from "./crt-directions.webp";
import crtReactions from "./crt-reactions.webp";
import droneDirections from "./drone-directions.webp";
import droneReactions from "./drone-reactions.webp";
import gearbotDirections from "./gearbot-directions.webp";
import gearbotReactions from "./gearbot-reactions.webp";
import knightDirections from "./knight-directions.webp";
import knightReactions from "./knight-reactions.webp";
import radioDirections from "./radio-directions.webp";
import radioReactions from "./radio-reactions.webp";
import scoutDirections from "./scout-directions.webp";
import scoutReactions from "./scout-reactions.webp";
import toasterDirections from "./toaster-directions.webp";
import toasterReactions from "./toaster-reactions.webp";

// Shared artwork fixtures; both preview generations use the same unchanged sheets.
export const mascots = [
  { id: "memocard-final-black-pen", name: "MemoCard · 黑笔最终版", description: "腮红招手 · 黑银色笔与圆脚", directions: blackPenDirections, reactions: blackPenReactions },
  { id: "memocard-final-black-pen", name: "MemoCard · 黑笔渐隐版", description: "底部柔化 · 渐隐融入页面", directions: blackPenDirections, reactions: blackPenReactions, fade: true },
  { id: "memocard-final", name: "MemoCard · 最终版", description: "闭眼招手 · 铅笔与圆脚", directions: finalDirections, reactions: finalReactions },
  { id: "memocard-primary", name: "MemoCard", description: "记录与陪伴 · 铅笔与咖啡", directions: primaryDirections, reactions: primaryReactions },
  { id: "memocard-primary", name: "MemoCard · 渐隐版", description: "底部柔化 · 渐隐融入页面", directions: primaryDirections, reactions: primaryReactions, fade: true },
  { id: "memocard-idea", name: "MemoCard · 带脚版", description: "灵感陪伴 · 铅笔与灯泡", directions: ideaDirections, reactions: ideaReactions },
  { id: "crt", name: "CRT", description: "复古显示器", directions: crtDirections, reactions: crtReactions },
  { id: "drone", name: "Drone", description: "紫色机器人", directions: droneDirections, reactions: droneReactions },
  { id: "gearbot", name: "Gearbot", description: "齿轮机器人", directions: gearbotDirections, reactions: gearbotReactions },
  { id: "knight", name: "Knight", description: "蓝羽骑士", directions: knightDirections, reactions: knightReactions },
  { id: "radio", name: "Radio", description: "复古收音机", directions: radioDirections, reactions: radioReactions },
  { id: "scout", name: "Scout", description: "侦察机器人", directions: scoutDirections, reactions: scoutReactions },
  { id: "toaster", name: "Toaster", description: "吐司机机器人", directions: toasterDirections, reactions: toasterReactions },
];
