import { inlineTagMatches, inlineTags, normalizePropertyTag } from './inline-tags';
import type { Capture } from './quick-capture-draft';

export function restoreCaptureTags(capture:Capture):Capture {
  let text=capture.text;
  for (const value of capture.tags) {
    const tag=normalizePropertyTag(value);
    if (tag && !inlineTags(text).includes(tag)) text+=`${text && !/\s$/.test(text) ? ' ' : ''}#${tag} `;
  }
  return {...capture,text,tags:inlineTags(text)};
}

export function removeCaptureTags(text:string, tag?:string):string {
  for (const match of inlineTagMatches(text).reverse()) {
    if (!tag || match.tag===tag) text=text.slice(0,match.start)+text.slice(match.end);
  }
  return text;
}

export function insertCaptureTag(text:string, tag:string, from:number, to=from):{text:string;caret:number} {
  const before=text.slice(0,from),after=text.slice(to);
  const token=`${before && !/\s$/.test(before) ? ' ' : ''}#${tag}${/^\s/.test(after) ? '' : ' '}`;
  return {text:before+token+after,caret:before.length+token.length};
}
