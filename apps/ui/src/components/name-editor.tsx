import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { X } from "lucide-react";
import { createNameEditor } from "./name-editor.core";
export const NameEditor = createNameEditor({Popover,PopoverContent,Button,Input,Sheet,SheetClose,SheetContent,SheetHeader,SheetTitle,X});
