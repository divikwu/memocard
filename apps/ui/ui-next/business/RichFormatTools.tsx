import type { ComponentProps } from 'react';
import { createRichFormatTools } from '../../src/rich-format-core';
import { Dialog, DialogContent, DialogTitle } from '../components/dialog';
import { Input } from '../components/input';
import { Button } from '../components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/select';
import { cnState } from '../lib/utils';
import { richIcons } from './rich-icons';

function RichSelectContent({ className, ...props }: ComponentProps<typeof SelectContent>) {
  return <SelectContent {...props} className={cnState(className, 'next-rich-ui')} />;
}

export const RichFormatTools = createRichFormatTools({
  icons: richIcons, uiClassName: 'next-rich-ui',
  Dialog, DialogContent, DialogTitle, Input, Button, Select, SelectContent: RichSelectContent, SelectItem, SelectTrigger, SelectValue,
});
