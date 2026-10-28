/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { noteHeadings, noteLineHeights, REFERENCE_ROOT_SIZE } from './scale';
import { defaults, measurePresets, parseTypography, STORAGE_KEY, type Typography } from './preferences';

const Context = createContext<{ value: Typography; save: (next: Typography) => void; error: string }>({ value: defaults, save: () => {}, error: '' });
export const useTypography = () => useContext(Context);
// Keep the persisted choices and emitted CSS contract separate from React lifecycle work.
export function resolveTypography(value: Typography) {
  const headings = noteHeadings[value.size], line = noteLineHeights[value.size][value.leading];
  return {
    '--note-size': value.size === '14' ? 'var(--font-size-sm)' : 'var(--font-size-base)',
    '--note-h1-size': `${headings[0][0] / REFERENCE_ROOT_SIZE}rem`,
    '--note-h1-line-height': `${headings[0][1] / REFERENCE_ROOT_SIZE}rem`,
    '--note-h2-size': `${headings[1][0] / REFERENCE_ROOT_SIZE}rem`,
    '--note-h2-line-height': `${headings[1][1] / REFERENCE_ROOT_SIZE}rem`,
    '--note-h3-size': `${headings[2][0] / REFERENCE_ROOT_SIZE}rem`,
    '--note-h3-line-height': `${headings[2][1] / REFERENCE_ROOT_SIZE}rem`,
    '--note-summary-size': 'var(--font-size-sm)',
    '--note-leading': `${line / Number(value.size)}`,
    '--note-line-height': `${line / REFERENCE_ROOT_SIZE}rem`,
    '--note-flow': value.flow.endsWith('em') ? `${parseFloat(value.flow) * Number(value.size) / REFERENCE_ROOT_SIZE}rem` : value.flow,
    '--note-measure': `${measurePresets[value.measure].factor * REFERENCE_ROOT_SIZE}px`,
  };
}
export function TypographyProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState(() => { try { return parseTypography(localStorage.getItem(STORAGE_KEY)); } catch { return { ...defaults }; } });
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY), previous = JSON.parse(stored ?? 'null');
      if (previous?.size === '15' || previous?.size === '18') localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, size: '16' }));
    } catch { /* The active layout remains available when local storage cannot be written. */ }
  }, []);
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
  function save(next: Typography) {
    const validated = parseTypography(JSON.stringify(next));
    setValue(validated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(validated)); setError(''); }
    catch { setError('无法保存设置；当前已生效，重开后可能恢复默认。'); }
  }
  return <Context.Provider value={{ value, save, error }}>{children}</Context.Provider>;
}
