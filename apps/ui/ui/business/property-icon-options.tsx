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
import StickyNote01Icon from "@hugeicons/core-free-icons/StickyNote01Icon";
import NotebookTabsIcon from "@hugeicons/core-free-icons/NotebookTabsIcon";
import Files01Icon from "@hugeicons/core-free-icons/Files01Icon";
import Archive02Icon from "@hugeicons/core-free-icons/Archive02Icon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import ListChecksIcon from "@hugeicons/core-free-icons/ListChecksIcon";
import Grid2x2Icon from "@hugeicons/core-free-icons/Grid2x2Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
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
import Briefcase01Icon from "@hugeicons/core-free-icons/Briefcase01Icon";
import Presentation01Icon from "@hugeicons/core-free-icons/Presentation01Icon";
import PaintBrush01Icon from "@hugeicons/core-free-icons/PaintBrush01Icon";
import ArtificialIntelligence01Icon from "@hugeicons/core-free-icons/ArtificialIntelligence01Icon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import ShoppingBag01Icon from "@hugeicons/core-free-icons/ShoppingBag01Icon";
import Rocket01Icon from "@hugeicons/core-free-icons/Rocket01Icon";
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
import Video01Icon from "@hugeicons/core-free-icons/Video01Icon";
import Dumbbell01Icon from "@hugeicons/core-free-icons/Dumbbell01Icon";
import GameController01Icon from "@hugeicons/core-free-icons/GameController01Icon";
import Wallet01Icon from "@hugeicons/core-free-icons/Wallet01Icon";
import Restaurant01Icon from "@hugeicons/core-free-icons/Restaurant01Icon";
import HeartAddIcon from "@hugeicons/core-free-icons/HeartAddIcon";
import LaptopMinimalIcon from "@hugeicons/core-free-icons/LaptopMinimalIcon";
import SmartPhone01Icon from "@hugeicons/core-free-icons/SmartPhone01Icon";

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
    ["sticky-note", "便签", StickyNote01Icon],
    ["notebook", "笔记本", NotebookTabsIcon],
    ["files", "多个文件", Files01Icon],
    ["archive", "归档", Archive02Icon],
    ["pin", "图钉", PinIcon],
    ["checklist", "清单", ListChecksIcon],
    ["grid", "网格", Grid2x2Icon],
    ["layers", "图层", Layers01Icon],
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
    ["briefcase", "公文包", Briefcase01Icon],
    ["presentation", "演示", Presentation01Icon],
    ["brush", "画笔", PaintBrush01Icon],
    ["ai", "人工智能", ArtificialIntelligence01Icon],
    ["settings", "设置", Settings01Icon],
    ["wrench", "扳手", Wrench01Icon],
    ["shopping-bag", "购物袋", ShoppingBag01Icon],
    ["rocket", "火箭", Rocket01Icon],
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
    ["video", "视频", Video01Icon],
    ["dumbbell", "健身", Dumbbell01Icon],
    ["game", "游戏", GameController01Icon],
    ["wallet", "钱包", Wallet01Icon],
    ["restaurant", "餐饮", Restaurant01Icon],
    ["health", "健康", HeartAddIcon],
    ["laptop", "笔记本电脑", LaptopMinimalIcon],
    ["phone", "手机", SmartPhone01Icon],
  ],
};

const icons = new Map(Object.values(propertyIconGroups).flat().map(([name, , icon]) => [`icon:${name}`, icon]));

export function CatalogIcon({ value, fallback, className }: { value: string; fallback: React.ReactNode; className?: string }) {
  const icon = icons.get(value);
  return icon ? <HugeiconsIcon icon={icon} className={className} strokeWidth={2} aria-hidden="true" /> : fallback;
}
