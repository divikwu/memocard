import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { bindNoteImage } from './note-image';
import { isBrowserVault } from './client-mode';
import { getBrowserVaultBinding } from './browser-runtime';

const imageDimensions = new Map<string, { binding: ReturnType<typeof getBrowserVaultBinding>; width: number; height: number }>();

// Both renderers preserve decoded geometry without reusing URLs across vault bindings.
export function useNoteImage(source: string, lazy = false) {
  const ref = useRef<HTMLImageElement>(null);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  const cached = imageDimensions.get(source);
  const dimensions = cached?.binding === binding ? cached : undefined;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ source: string; binding: typeof binding; attempt: number; state: 'loaded' | 'failed' }>();
  const state = result?.source === source && result.binding === binding && result.attempt === attempt ? result.state : 'loading';
  const onLoaded = useCallback(() => {
    const image = ref.current;
    if (image?.naturalWidth) {
      imageDimensions.set(source, { binding, width: image.naturalWidth, height: image.naturalHeight });
      if (imageDimensions.size > 128) imageDimensions.delete(imageDimensions.keys().next().value!);
    }
    setResult({ source, binding, attempt, state: 'loaded' });
  }, [source, binding, attempt]);
  const onFailed = useCallback(() => setResult({ source, binding, attempt, state: 'failed' }), [source, binding, attempt]);
  useLayoutEffect(() => {
    const image = ref.current;
    if (!image) return;
    const release = bindNoteImage(image, source, onFailed, { lazy });
    if (!isBrowserVault && !source.startsWith('memocard-resolve:') && image.complete && image.naturalWidth > 0) onLoaded();
    return release;
  }, [source, binding, lazy, onLoaded, onFailed]);
  return { ref, state, dimensions, onLoaded, onFailed, retry: () => {
    // Explicit retry must reassign even the same native/local URL after failure.
    ref.current?.removeAttribute('src');
    setAttempt(value => value + 1);
  } };
}
