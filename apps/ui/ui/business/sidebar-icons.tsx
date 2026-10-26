import { HugeiconsIcon } from "@hugeicons/react";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import AiSketchIcon from "@hugeicons/core-free-icons/AiSketchIcon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import FolderAddIcon from "@hugeicons/core-free-icons/FolderAddIcon";
import FolderOpenIcon from "@hugeicons/core-free-icons/FolderOpenIcon";
import HashIcon from "@hugeicons/core-free-icons/HashIcon";
import HelpCircleIcon from "@hugeicons/core-free-icons/HelpCircleIcon";
import Image01Icon from "@hugeicons/core-free-icons/Image01Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import Link01Icon from "@hugeicons/core-free-icons/Link01Icon";
import MoreHorizontalCircle01Icon from "@hugeicons/core-free-icons/MoreHorizontalCircle01Icon";
import Note04Icon from "@hugeicons/core-free-icons/Note04Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { cn } from "../lib/utils";

const icons = { add: Add01Icon, down: ArrowDown01Icon, right: ArrowRight01Icon, notebook: Note04Icon, calendar: Calendar03Icon, close: Cancel01Icon, trash: Delete02Icon, folderAdd: FolderAddIcon, folder: FolderOpenIcon, hash: HashIcon, help: HelpCircleIcon, home: AiSketchIcon, image: Image01Icon, layers: Layers01Icon, link: Link01Icon, more: MoreHorizontalCircle01Icon, search: Search01Icon, settings: Settings01Icon, shield: Shield01Icon, check: Tick02Icon };

export function SidebarIcon({ name, className }: { name: keyof typeof icons; className?: string }) {
  return <HugeiconsIcon icon={icons[name]} strokeWidth={2} aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
}
