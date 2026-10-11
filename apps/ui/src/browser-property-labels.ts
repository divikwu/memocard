import type { PropertyLabels } from '@memocard/contracts';
import { BrowserVaultError, readBytes, sha256, type BrowserDirectoryHandle, type ParsedBrowserNote } from './browser-files';
import { defaultPropertyLabel, parsePropertyLabels, systemPropertyLabels, validPropertyLabel } from './property-labels';
import { readProperties } from './note-properties';

async function read(root:BrowserDirectoryHandle) {
  try { return await readBytes(await (await root.getDirectoryHandle('.memocard')).getFileHandle('property-labels.json')); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return new Uint8Array(); throw error; }
}
export async function propertyLabelOperation(operation:string, params:Record<string,unknown>, root:BrowserDirectoryHandle, active:()=>Promise<unknown>, scan:()=>Promise<{parsed:ParsedBrowserNote[]; coverage:{complete:boolean}}>):Promise<PropertyLabels> {
  await active();
  const before = await read(root), contentHash = await sha256(before);
  let labels:PropertyLabels['labels'];
  try { labels = parsePropertyLabels(new TextDecoder('utf-8',{fatal:true}).decode(before)); }
  catch { throw new BrowserVaultError('INVALID_PROPERTY','属性名称配置无法读取，请检查 .memocard/property-labels.json。'); }
  await active();
  if (operation === 'getPropertyLabels') return {labels,contentHash};
  const key = typeof params.key === 'string' ? params.key : '', label = typeof params.label === 'string' ? params.label.trim() : '';
  if (!validPropertyLabel(label)) throw new BrowserVaultError('INVALID_PROPERTY','属性名不能为空、超过 100 字或包含控制字符。');
  const snapshot = await scan();
  if (!snapshot.coverage.complete) throw new BrowserVaultError('SCAN_INCOMPLETE','笔记库尚未完整读取，无法安全修改属性名称。');
  const keys = new Set(Object.keys(systemPropertyLabels));
  for (const item of snapshot.parsed) for (const property of readProperties(item.source ?? `---\n${item.frontmatter.toString()}---\n`,item.note.contentHash).properties) keys.add(`property:${property.name}`);
  if (!keys.has(key)) throw new BrowserVaultError('INVALID_PROPERTY','属性已被移除，请重新加载。');
  if ([...new Set([...keys,...Object.keys(labels)])].some(other => other !== key && (labels[other] ?? defaultPropertyLabel(other)) === label)) throw new BrowserVaultError('INVALID_PROPERTY','属性名称已存在。');
  if (contentHash !== params.baseHash) throw new BrowserVaultError('HASH_CONFLICT','属性名称已在其他位置修改，请重新打开后重试。');
  if (label === defaultPropertyLabel(key)) delete labels[key]; else labels[key] = label;
  const bytes = new TextEncoder().encode(JSON.stringify(labels));
  const directory = await root.getDirectoryHandle('.memocard',{create:true});
  const file = await directory.getFileHandle('property-labels.json',{create:true});
  const stream = await file.createWritable({mode:'exclusive'});
  try {
    const verify = async () => { await active(); if (!await (await directory.getFileHandle('property-labels.json')).isSameEntry(file) || await sha256(await read(root)) !== contentHash) throw new BrowserVaultError('HASH_CONFLICT','属性名称已在其他位置修改，请重新打开后重试。'); };
    await verify(); await stream.write(bytes); await verify(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  return {labels,contentHash:await sha256(bytes)};
}
