import TagColorMenu from './TagColorMenu';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TagPill from './TagPill';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createTagPropertyEditor } from "./TagPropertyEditor.core";
export default createTagPropertyEditor({ TagColorMenu, X, Button, TagPill, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger });
