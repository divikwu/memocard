import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import type { RichIcon } from "../../src/rich-editor-core";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import DragDropVerticalIcon from "@hugeicons/core-free-icons/DragDropVerticalIcon";
import TextFontIcon from "@hugeicons/core-free-icons/TextFontIcon";
import HeadingIcon from "@hugeicons/core-free-icons/HeadingIcon";
import LeftToRightListBulletIcon from "@hugeicons/core-free-icons/LeftToRightListBulletIcon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import ListTodoIcon from "@hugeicons/core-free-icons/ListTodoIcon";
import QuoteDownIcon from "@hugeicons/core-free-icons/QuoteDownIcon";
import SourceCodeIcon from "@hugeicons/core-free-icons/SourceCodeIcon";
import MinusSignIcon from "@hugeicons/core-free-icons/MinusSignIcon";
import Table02Icon from "@hugeicons/core-free-icons/Table02Icon";
import SigmaIcon from "@hugeicons/core-free-icons/SigmaIcon";
import Image01Icon from "@hugeicons/core-free-icons/Image01Icon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import Refresh01Icon from "@hugeicons/core-free-icons/Refresh01Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import MessageSquareQuoteIcon from "@hugeicons/core-free-icons/MessageSquareQuoteIcon";
import Link01Icon from "@hugeicons/core-free-icons/Link01Icon";
import HighlighterIcon from "@hugeicons/core-free-icons/HighlighterIcon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";

export const richIcon = (data: HugeiconsIconProps["icon"]): RichIcon => props => <HugeiconsIcon icon={data} strokeWidth={2} {...props} />;

export const richIcons = {
  Plus: richIcon(Add01Icon),
  GripVertical: richIcon(DragDropVerticalIcon),
  Type: richIcon(TextFontIcon),
  Heading: richIcon(HeadingIcon),
  List: richIcon(LeftToRightListBulletIcon),
  ListOrdered: richIcon(LeftToRightListNumberIcon),
  ListTodo: richIcon(ListTodoIcon),
  Quote: richIcon(QuoteDownIcon),
  Code: richIcon(SourceCodeIcon),
  Minus: richIcon(MinusSignIcon),
  Table: richIcon(Table02Icon),
  Sigma: richIcon(SigmaIcon),
  ImageIcon: richIcon(Image01Icon),
  Search: richIcon(Search01Icon),
  ArrowUp: richIcon(ArrowUp01Icon),
  ArrowDown: richIcon(ArrowDown01Icon),
  Copy: richIcon(Copy01Icon),
  Pencil: richIcon(PencilEdit02Icon),
  Trash2: richIcon(Delete02Icon),
  RefreshCw: richIcon(Refresh01Icon),
  Check: richIcon(Tick02Icon),
  ChevronRight: richIcon(ArrowRight01Icon),
  MessageSquareQuote: richIcon(MessageSquareQuoteIcon),
  Link: richIcon(Link01Icon),
  Highlighter: richIcon(HighlighterIcon),
  MoreHorizontal: richIcon(MoreHorizontalIcon),
  FileText: richIcon(File01Icon),
  X: richIcon(Cancel01Icon),
};
