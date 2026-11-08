import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import Note04Icon from "@hugeicons/core-free-icons/Note04Icon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import FolderOpenIcon from "@hugeicons/core-free-icons/FolderOpenIcon";
import BookOpen01Icon from "@hugeicons/core-free-icons/BookOpen01Icon";
import Bookmark01Icon from "@hugeicons/core-free-icons/Bookmark01Icon";
import Task01Icon from "@hugeicons/core-free-icons/Task01Icon";
import CheckmarkCircle02Icon from "@hugeicons/core-free-icons/CheckmarkCircle02Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import Flag01Icon from "@hugeicons/core-free-icons/Flag01Icon";
import StarIcon from "@hugeicons/core-free-icons/StarIcon";
import Target01Icon from "@hugeicons/core-free-icons/Target01Icon";
import UserIcon from "@hugeicons/core-free-icons/UserIcon";
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon";
import Mail01Icon from "@hugeicons/core-free-icons/Mail01Icon";
import Comment01Icon from "@hugeicons/core-free-icons/Comment01Icon";
import Link01Icon from "@hugeicons/core-free-icons/Link01Icon";
import HashtagIcon from "@hugeicons/core-free-icons/HashtagIcon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import BulbIcon from "@hugeicons/core-free-icons/BulbIcon";
import ChartBarLineIcon from "@hugeicons/core-free-icons/ChartBarLineIcon";
import Database01Icon from "@hugeicons/core-free-icons/Database01Icon";
import CodeIcon from "@hugeicons/core-free-icons/CodeIcon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import Image01Icon from "@hugeicons/core-free-icons/Image01Icon";
import Camera01Icon from "@hugeicons/core-free-icons/Camera01Icon";
import MusicNote01Icon from "@hugeicons/core-free-icons/MusicNote01Icon";
import HeadphonesIcon from "@hugeicons/core-free-icons/HeadphonesIcon";
import TrophyIcon from "@hugeicons/core-free-icons/TrophyIcon";
import GiftIcon from "@hugeicons/core-free-icons/GiftIcon";
import Home01Icon from "@hugeicons/core-free-icons/Home01Icon";
import Location01Icon from "@hugeicons/core-free-icons/Location01Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import Airplane01Icon from "@hugeicons/core-free-icons/Airplane01Icon";
import Coffee01Icon from "@hugeicons/core-free-icons/Coffee01Icon";
import Leaf01Icon from "@hugeicons/core-free-icons/Leaf01Icon";
import PawPrintIcon from "@hugeicons/core-free-icons/PawPrintIcon";
import Sun01Icon from "@hugeicons/core-free-icons/Sun01Icon";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import FireIcon from "@hugeicons/core-free-icons/FireIcon";
import { SidebarIcon } from "./sidebar-icons";

type IconEntry = [name: string, label: string, icon: HugeiconsIconProps["icon"]];

export const propertyIconGroups: Record<string, IconEntry[]> = {
  "笔记与组织": [
    ["note", "笔记", Note04Icon],
    ["file", "文件", File01Icon],
    ["folder", "文件夹", FolderOpenIcon],
    ["book", "书籍", BookOpen01Icon],
    ["bookmark", "书签", Bookmark01Icon],
    ["task", "任务", Task01Icon],
    ["check", "完成", CheckmarkCircle02Icon],
    ["calendar", "日历", Calendar03Icon],
    ["clock", "时钟", Clock01Icon],
    ["flag", "旗帜", Flag01Icon],
    ["star", "星标", StarIcon],
    ["target", "目标", Target01Icon],
  ],
  "工作与沟通": [
    ["user", "人物", UserIcon],
    ["team", "团队", UserGroupIcon],
    ["mail", "邮件", Mail01Icon],
    ["comment", "评论", Comment01Icon],
    ["link", "链接", Link01Icon],
    ["tag", "标签", HashtagIcon],
    ["edit", "编辑", PencilEdit02Icon],
    ["idea", "灵感", BulbIcon],
    ["chart", "图表", ChartBarLineIcon],
    ["database", "数据库", Database01Icon],
    ["code", "代码", CodeIcon],
    ["shield", "安全", Shield01Icon],
  ],
  "媒体与生活": [
    ["image", "图片", Image01Icon],
    ["camera", "相机", Camera01Icon],
    ["music", "音乐", MusicNote01Icon],
    ["headphones", "耳机", HeadphonesIcon],
    ["trophy", "奖杯", TrophyIcon],
    ["gift", "礼物", GiftIcon],
    ["home", "家", Home01Icon],
    ["location", "地点", Location01Icon],
    ["globe", "地球", Globe02Icon],
    ["airplane", "旅行", Airplane01Icon],
    ["coffee", "咖啡", Coffee01Icon],
    ["leaf", "叶子", Leaf01Icon],
    ["paw", "动物", PawPrintIcon],
    ["sun", "太阳", Sun01Icon],
    ["moon", "月亮", Moon02Icon],
    ["fire", "火焰", FireIcon],
  ],
};

const icons = new Map(Object.values(propertyIconGroups).flat().map(([name, , icon]) => [`icon:${name}`, icon]));

export function PropertyIconGlyph({ value, fallback }: { value?: string; fallback: React.ReactNode }) {
  if (value?.startsWith("emoji:")) return <span aria-hidden="true" className="note-property-file-emoji">{value.slice(6)}</span>;
  const icon = value && icons.get(value);
  return icon ? <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" /> : fallback;
}

export function TagIcon({ value, fallback = <SidebarIcon name="hash" /> }: { value?: string; fallback?: React.ReactNode }) {
  if (!value) return fallback;
  if (!value.startsWith("icon:")) return <span className="ui-sidebar-emoji" aria-hidden="true">{value}</span>;
  const icon = icons.get(value);
  return icon ? <HugeiconsIcon icon={icon} className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" /> : fallback;
}
