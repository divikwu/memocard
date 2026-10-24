import { Link, Highlighter, MoreHorizontal, Superscript, Subscript, Keyboard, Info, Check, Minus, Code, Strikethrough, Unlink, RemoveFormatting, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { createRichFormatTools } from './rich-format-core';
import './rich-format-tools.css';

export const RichFormatTools = createRichFormatTools({
  icons: { Link, Highlighter, MoreHorizontal, Superscript, Subscript, Keyboard, Info, Check, Minus, Code, Strikethrough, Unlink, RemoveFormatting, FileText, X },
  Dialog, DialogContent, DialogTitle, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
});
