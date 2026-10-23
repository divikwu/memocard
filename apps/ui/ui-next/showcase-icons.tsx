// Maps the official preview-02 icon placeholders to direct Hugeicons imports.
import type { ComponentProps } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Activity01Icon from "@hugeicons/core-free-icons/Activity01Icon";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import AnalyticsUpIcon from "@hugeicons/core-free-icons/AnalyticsUpIcon";
import ArrowDataTransferHorizontalIcon from "@hugeicons/core-free-icons/ArrowDataTransferHorizontalIcon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import AudioWave01Icon from "@hugeicons/core-free-icons/AudioWave01Icon";
import BankIcon from "@hugeicons/core-free-icons/BankIcon";
import BookOpen02Icon from "@hugeicons/core-free-icons/BookOpen02Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Camera01Icon from "@hugeicons/core-free-icons/Camera01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Car01Icon from "@hugeicons/core-free-icons/Car01Icon";
import ChartBarLineIcon from "@hugeicons/core-free-icons/ChartBarLineIcon";
import Clock03Icon from "@hugeicons/core-free-icons/Clock03Icon";
import CloudUploadIcon from "@hugeicons/core-free-icons/CloudUploadIcon";
import Coffee01Icon from "@hugeicons/core-free-icons/Coffee01Icon";
import CreditCardIcon from "@hugeicons/core-free-icons/CreditCardIcon";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import File02Icon from "@hugeicons/core-free-icons/File02Icon";
import Globe02Icon from "@hugeicons/core-free-icons/Globe02Icon";
import HelpCircleIcon from "@hugeicons/core-free-icons/HelpCircleIcon";
import Image01Icon from "@hugeicons/core-free-icons/Image01Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import Message01Icon from "@hugeicons/core-free-icons/Message01Icon";
import MoreHorizontalCircle01Icon from "@hugeicons/core-free-icons/MoreHorizontalCircle01Icon";
import MoreVerticalCircle01Icon from "@hugeicons/core-free-icons/MoreVerticalCircle01Icon";
import Notification03Icon from "@hugeicons/core-free-icons/Notification03Icon";
import PaintBoardIcon from "@hugeicons/core-free-icons/PaintBoardIcon";
import PieChartIcon from "@hugeicons/core-free-icons/PieChartIcon";
import PlusSignCircleIcon from "@hugeicons/core-free-icons/PlusSignCircleIcon";
import RepeatIcon from "@hugeicons/core-free-icons/RepeatIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import ShoppingCart01Icon from "@hugeicons/core-free-icons/ShoppingCart01Icon";
import SidebarLeftIcon from "@hugeicons/core-free-icons/SidebarLeftIcon";
import SquareLock02Icon from "@hugeicons/core-free-icons/SquareLock02Icon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import Target02Icon from "@hugeicons/core-free-icons/Target02Icon";
import ThermometerWarmIcon from "@hugeicons/core-free-icons/ThermometerWarmIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import Tv01Icon from "@hugeicons/core-free-icons/Tv01Icon";
import UnfoldMoreIcon from "@hugeicons/core-free-icons/UnfoldMoreIcon";
import UserIcon from "@hugeicons/core-free-icons/UserIcon";
import VolumeHighIcon from "@hugeicons/core-free-icons/VolumeHighIcon";
import Wallet01Icon from "@hugeicons/core-free-icons/Wallet01Icon";

const icons = {
  ActivityIcon: Activity01Icon,
  Add01Icon: Add01Icon,
  AlertCircleIcon: AlertCircleIcon,
  AnalyticsUpIcon: AnalyticsUpIcon,
  ArrowDataTransferHorizontalIcon: ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon: ArrowDown01Icon,
  ArrowDownIcon: ArrowDown01Icon,
  ArrowLeftIcon: ArrowLeft01Icon,
  ArrowRight01Icon: ArrowRight01Icon,
  ArrowRightIcon: ArrowRight01Icon,
  ArrowUp01Icon: ArrowUp01Icon,
  AudioWave01Icon: AudioWave01Icon,
  BankIcon: BankIcon,
  BookOpen02Icon: BookOpen02Icon,
  Calendar03Icon: Calendar03Icon,
  Camera01Icon: Camera01Icon,
  Cancel01Icon: Cancel01Icon,
  Car01Icon: Car01Icon,
  ChartBarLineIcon: ChartBarLineIcon,
  Clock03Icon: Clock03Icon,
  CloudUploadIcon: CloudUploadIcon,
  CoffeeIcon: Coffee01Icon,
  CreditCardIcon: CreditCardIcon,
  DashboardSquare01Icon: DashboardSquare01Icon,
  File02Icon: File02Icon,
  Globe02Icon: Globe02Icon,
  HelpCircleIcon: HelpCircleIcon,
  Image01Icon: Image01Icon,
  Loading03Icon: Loading03Icon,
  Message01Icon: Message01Icon,
  MoreHorizontalCircle01Icon: MoreHorizontalCircle01Icon,
  MoreVerticalCircle01Icon: MoreVerticalCircle01Icon,
  Notification03Icon: Notification03Icon,
  PaintBoardIcon: PaintBoardIcon,
  PieChartIcon: PieChartIcon,
  PlusSignCircleIcon: PlusSignCircleIcon,
  RepeatIcon: RepeatIcon,
  Search01Icon: Search01Icon,
  Settings01Icon: Settings01Icon,
  ShieldIcon: Shield01Icon,
  ShoppingCart01Icon: ShoppingCart01Icon,
  SidebarLeftIcon: SidebarLeftIcon,
  SquareLock02Icon: SquareLock02Icon,
  Sun03Icon: Sun03Icon,
  Target02Icon: Target02Icon,
  ThermometerWarmIcon: ThermometerWarmIcon,
  Tick02Icon: Tick02Icon,
  Tv01Icon: Tv01Icon,
  UnfoldMoreIcon: UnfoldMoreIcon,
  UserIcon: UserIcon,
  VolumeHighIcon: VolumeHighIcon,
  Wallet01Icon: Wallet01Icon,
};

type IconPlaceholderProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon" | "strokeWidth"> & {
  hugeicons: keyof typeof icons;
  strokeWidth?: ComponentProps<"svg">["strokeWidth"];
  lucide?: string;
  tabler?: string;
  phosphor?: string;
  remixicon?: string;
};

export function IconPlaceholder({ hugeicons, strokeWidth = 2, ...props }: IconPlaceholderProps) {
  const svgProps = { ...props };
  delete svgProps.lucide;
  delete svgProps.tabler;
  delete svgProps.phosphor;
  delete svgProps.remixicon;
  return <HugeiconsIcon {...svgProps} icon={icons[hugeicons]} strokeWidth={typeof strokeWidth === "number" ? strokeWidth : Number(strokeWidth)} aria-hidden={props.role === "status" ? props["aria-hidden"] : true} />;
}
