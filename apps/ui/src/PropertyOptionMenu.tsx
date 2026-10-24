import { Check, Hash, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import TagPill from './TagPill';
import { createPropertyOptionMenu } from "./PropertyOptionMenu.core";
export default createPropertyOptionMenu({ Check, Hash, MoreHorizontal, Trash2, Button, Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuSeparator, TagPill });
