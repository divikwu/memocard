// Image properties store portable local references, never data or remote URLs.
export function validPropertyImage(value:string):boolean {
  if (value === '') return true;
  const unsafe = (part:string) => /[\\:?#]/.test(part) || [...part].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (value.startsWith('/') || unsafe(value)) return false;
  const encoded = value.split('/');
  let parts:string[];
  try { parts = encoded.map(decodeURIComponent); } catch { return false; }
  return parts.every((part,index) => !!part && !part.includes('/') && !unsafe(part) && (part === '.' || part === '..' ? part === encoded[index] : !part.startsWith('.'))) && /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(parts.at(-1)!);
}
