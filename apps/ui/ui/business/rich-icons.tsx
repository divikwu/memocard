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
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import Refresh01Icon from "@hugeicons/core-free-icons/Refresh01Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import MessageSquareQuoteIcon from "@hugeicons/core-free-icons/MessageSquareQuoteIcon";
import Link01Icon from "@hugeicons/core-free-icons/Link01Icon";
import HighlighterIcon from "@hugeicons/core-free-icons/HighlighterIcon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import TextSuperscriptIcon from "@hugeicons/core-free-icons/TextSuperscriptIcon";
import TextSubscriptIcon from "@hugeicons/core-free-icons/TextSubscriptIcon";
import KeyboardIcon from "@hugeicons/core-free-icons/KeyboardIcon";
import InformationCircleIcon from "@hugeicons/core-free-icons/InformationCircleIcon";
import TextStrikethroughIcon from "@hugeicons/core-free-icons/TextStrikethroughIcon";
import Unlink01Icon from "@hugeicons/core-free-icons/Unlink01Icon";
import RemoveFormattingIcon from "@hugeicons/core-free-icons/RemoveFormattingIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";

const icon = (data: HugeiconsIconProps["icon"]): RichIcon => props => <HugeiconsIcon icon={data} strokeWidth={2} {...props} />;

export const richIcons = {
  Plus: icon(Add01Icon),
  GripVertical: icon(DragDropVerticalIcon),
  Type: icon(TextFontIcon),
  Heading: icon(HeadingIcon),
  List: icon(LeftToRightListBulletIcon),
  ListOrdered: icon(LeftToRightListNumberIcon),
  ListTodo: icon(ListTodoIcon),
  Quote: icon(QuoteDownIcon),
  Code: icon(SourceCodeIcon),
  Minus: icon(MinusSignIcon),
  Table: icon(Table02Icon),
  Sigma: icon(SigmaIcon),
  ImageIcon: icon(Image01Icon),
  Search: icon(Search01Icon),
  ArrowUp: icon(ArrowUp01Icon),
  ArrowDown: icon(ArrowDown01Icon),
  Copy: icon(Copy01Icon),
  Trash2: icon(Delete02Icon),
  RefreshCw: icon(Refresh01Icon),
  Check: icon(Tick02Icon),
  ChevronRight: icon(ArrowRight01Icon),
  MessageSquareQuote: icon(MessageSquareQuoteIcon),
  Link: icon(Link01Icon),
  Highlighter: icon(HighlighterIcon),
  MoreHorizontal: icon(MoreHorizontalIcon),
  Superscript: icon(TextSuperscriptIcon),
  Subscript: icon(TextSubscriptIcon),
  Keyboard: icon(KeyboardIcon),
  Info: icon(InformationCircleIcon),
  Strikethrough: icon(TextStrikethroughIcon),
  Unlink: icon(Unlink01Icon),
  RemoveFormatting: icon(RemoveFormattingIcon),
  FileText: icon(File01Icon),
  X: icon(Cancel01Icon),
};
