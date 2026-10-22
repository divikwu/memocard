/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { REFERENCE_ROOT_SIZE } from './scale';
import { FONT_FAMILIES } from '@/lib/font-options';
import { loadFonts } from '@/features/theme/font-loader';
import { defaults, measurePresets, parseTypography, STORAGE_KEY, type Typography } from './preferences';

const Context = createContext<{ value: Typography; save: (next: Typography) => void; error: string }>({ value: defaults, save: () => {}, error: '' });
export const useTypography = () => useContext(Context);
// Keep the persisted choices and emitted CSS contract separate from React lifecycle work.
export function resolveTypography(value: Typography) {
  return {
    '--note-body-font': FONT_FAMILIES[value.body],
    '--note-heading-font': FONT_FAMILIES[value.heading === 'inherit' ? value.body : value.heading],
    '--note-mono-font': FONT_FAMILIES[value.mono],
    '--note-size': value.size === '15' ? '0.9375rem' : value.size === '14' ? 'var(--font-size-sm)' : value.size === '18' ? 'var(--font-size-lg)' : 'var(--font-size-base)',
    '--note-scale': `${Number(value.size) / REFERENCE_ROOT_SIZE}`,
    '--note-summary-size': Number(value.size) > 16 ? 'var(--font-size-base)' : 'var(--font-size-sm)',
    '--note-leading': value.leading,
    '--note-flow': value.flow,
    '--note-measure': `${measurePresets[value.measure].factor * Number(value.size)}px`,
  };
}
export function TypographyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(() => { try { return parseTypography(localStorage.getItem(STORAGE_KEY)); } catch { return { ...defaults }; } });
  const [error, setError] = useState('');
  const [fontError, setFontError] = useState('');
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) setValue(parseTypography(event.key === null ? null : event.newValue)); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    const vars = resolveTypography(value);
    for (const [key, val] of Object.entries(vars)) style.setProperty(key, val);
    return () => { for (const key of Object.keys(vars)) style.removeProperty(key); };
  }, [value]);
  useEffect(() => {
    let current = true;
    if (typeof FontFace !== 'undefined') void loadFonts([value.body, value.heading === 'inherit' ? value.body : value.heading, value.mono]).then(() => { if (current) setFontError(''); }).catch(() => { if (current) setFontError('字体加载失败，暂时使用系统字体。'); });
    return () => { current = false; };
  }, [value.body, value.heading, value.mono]);
  function save(next: Typography) {
    const validated = parseTypography(JSON.stringify(next));
    setValue(validated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(validated)); setError(''); }
    catch { setError('无法保存设置；当前已生效，重开后可能恢复默认。'); }
  }
  return <Context.Provider value={{ value, save, error: error || fontError }}>{children}</Context.Provider>;
}
