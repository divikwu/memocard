import { ImagePlus, MoreHorizontal, Maximize, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ImageViewer from './ImageViewer';
import { createImagePropertyEditor } from "./ImagePropertyEditor.core";
export default createImagePropertyEditor({ ImagePlus, MoreHorizontal, Maximize, Trash2, Button, Skeleton, Popover, PopoverContent, PopoverTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ImageViewer });
