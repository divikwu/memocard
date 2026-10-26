import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import Calendar03Icon from "@hugeicons/core-free-icons/Calendar03Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import FolderOpenIcon from "@hugeicons/core-free-icons/FolderOpenIcon";
import Search01Icon from "@hugeicons/core-free-icons/Search01Icon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";

type IconProps = Omit<HugeiconsIconProps, "icon">;
const icon = (data: HugeiconsIconProps["icon"]) => (props: IconProps) => <HugeiconsIcon icon={data} strokeWidth={2} {...props} />;

export const AddIcon = icon(Add01Icon);
export const ChevronDownIcon = icon(ArrowDown01Icon);
export const CalendarIcon = icon(Calendar03Icon);
export const CloseIcon = icon(Cancel01Icon);
export const CopyIcon = icon(Copy01Icon);
export const DeleteIcon = icon(Delete02Icon);
export const DocumentIcon = icon(File01Icon);
export const FolderIcon = icon(FolderOpenIcon);
export const SearchIcon = icon(Search01Icon);
export const SettingsIcon = icon(Settings02Icon);
export const CheckIcon = icon(Tick02Icon);
