import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { NoteProperties, NoteProperty, PropertyChange, PropertyType, PropertyOption } from '@memocard/contracts';
import { BrowserVaultError } from './browser-files';
import { normalizePropertyTag, propertyTags } from './inline-tags';
import { listAsMultiSelect } from './property-type-change';
import { validPropertyImage } from './property-image';
import { validPropertyDate } from './property-dates';
import { validPropertyNumber } from './property-numbers';

const choiceColors = new Set(['default','brown','orange','yellow','green','blue','purple','pink','red']);
function validOptions(value: unknown): value is PropertyOption[] {
  return Array.isArray(value) && value.length <= 200 && value.every(option => option && typeof option.name === 'string' && option.name === option.name.trim() && option.name.length > 0 && option.name.length <= 100 && ![...option.name].some(character => character.charCodeAt(0) < 32) && choiceColors.has(option.color)) && new Set(value.map(option => option.name)).size === value.length;
}
const reserved = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'tags']);
const invalid = (message: string): never => { throw new BrowserVaultError('INVALID_PROPERTY', message); };
const date = validPropertyDate;
export function propertySource(source: string) {
  const match = /^(\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const yaml = match?.[2] ?? '';
  const doc = parseDocument(yaml, { schema: 'yaml-1.1', uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length || (doc.contents && !isMap(doc.contents) && !(isScalar(doc.contents) && doc.contents.value === null))) invalid('无法安全读取 YAML 属性。');
  const lines = yaml.replace(/\r\n/g, '\n').split('\n');
  const pairs = isMap(doc.contents) ? doc.contents.items : [];
  if (pairs.some(pair => !isScalar(pair.key) || typeof pair.key.value !== 'string')) invalid('属性名必须是字符串。');
  const starts = pairs.map(pair => {
    const offset = (pair.key as {range?:number[]}).range?.[0] ?? -1;
    return { line: yaml.slice(0, offset).split('\n').length - 1, column: offset - (yaml.lastIndexOf('\n', offset - 1) + 1) };
  });
  // Anchors, aliases, explicit tags and flow mappings require source-mode editing.
  const syntax = yaml.replace(/"(?:\\.|[^"\\])*"|'(?:''|[^'])*'/g, '""');
  const writable = !/(?:^|[\s:[,{])[&*!][^\s]+/m.test(syntax) && starts.every(item => item.column === 0) && (!doc.contents || (isScalar(doc.contents) && doc.contents.value === null) || (isMap(doc.contents) && !doc.contents.flow));
  const entries = pairs.map((pair, index) => {
    const name = String((pair.key as {value:unknown}).value);
    const node = pair.value;
    let type: PropertyType | 'unsupported' = 'unsupported';
    let value: NoteProperty['value'] = '复杂 YAML 值';
    if (isScalar(node) && !['BLOCK_LITERAL', 'BLOCK_FOLDED'].includes(node.type ?? '')) {
      if (node.value === null && /:\s*null\s+#\s*memocard:type=date\s*$/.test(lines[starts[index]!.line] ?? '')) { type = 'date'; value = ''; }
      else if (node.value === null && node.comment?.trim() === 'memocard:type=number') { type = 'number'; value = ''; }
      else if (typeof node.value === 'boolean') { type = 'checkbox'; value = node.value; }
      else if (typeof node.value === 'number' && node.source && validPropertyNumber(node.source)) { type = 'number'; value = node.source; }
      else if (typeof node.value === 'string') { value = node.value; type = date(value) && node.comment?.trim() !== 'memocard:type=text' ? 'date' : 'text'; }
      else if (node.value instanceof Date && node.source && date(node.source)) { type = 'date'; value = node.source; }
      else value = node.source ?? String(node.value ?? '');
    } else if (isSeq(node) && node.items.every(item => isScalar(item) && typeof item.value === 'string')) {
      type = 'list'; value = node.items.map(item => (item as {value:string}).value);
    }
    let options: PropertyOption[] | undefined;
    if (node?.comment?.trim() === 'memocard:type=number' && type !== 'number') type = type === 'text' && validPropertyNumber(value as string) ? 'number' : 'unsupported';
    if (node?.comment?.trim() === 'memocard:type=image') type = type === 'text' && validPropertyImage(value as string) ? 'image' : 'unsupported';
    const metadata = /^memocard:choice=(.*)$/.exec(node?.comment?.trim() ?? '');
    if (metadata) {
      let choice;
      try { choice = JSON.parse(metadata[1]!); } catch { /* Invalid metadata stays read-only. */ }
      if (choice && ['select','multiSelect'].includes(choice.type) && validOptions(choice.options) && (choice.type === 'select' ? (type === 'text' || type === 'date') && (value === '' || choice.options.some((option:PropertyOption) => option.name === value)) : type === 'list')) { type = choice.type; options = choice.options; }
      else type = 'unsupported';
    }
    let end = starts[index + 1]?.line ?? lines.length;
    while (end > starts[index]!.line + 1 && /^(?:\s*#.*|\s*)$/.test(lines[end - 1]!)) end--;
    return { property: { name, type, value, editable: writable && type !== 'unsupported' && !reserved.has(name), ...(options ? {options} : {}) }, start: starts[index]!.line, end };
  });
  return { match, yaml, lines, entries, writable };
}
function tagProperty(parsed: ReturnType<typeof propertySource>): NoteProperty {
  const existing = parsed.entries.find(entry => entry.property.name === 'tags')?.property;
  const values = existing ? Array.isArray(existing.value) ? existing.value : [existing.value] : [];
  const valid = !existing || (['text', 'list'].includes(existing.type) && values.every(value => typeof value === 'string' && normalizePropertyTag(value)));
  return { name:'tags', type:valid ? 'list' : 'unsupported', value:valid ? propertyTags(values) : existing!.value, editable:parsed.writable && valid };
}
export function readProperties(source: string, contentHash: string): NoteProperties {
  const parsed = propertySource(source);
  return { properties: parsed.entries.filter(entry => !reserved.has(entry.property.name)).map(entry => entry.property), tagProperty:tagProperty(parsed), contentHash, writable: parsed.writable };
}
export function patchProperty(source: string, change: PropertyChange, updatedAt?: string, retainedValues?: string[]): string {
  const parsed = propertySource(source);
  const name = change.name?.trim();
  if (!name || name.length > 100 || [...name].some(character => character.charCodeAt(0) < 32) || (reserved.has(name) && name !== 'tags')) invalid('属性名为空、过长或属于系统保留字段。');
  if (!parsed.writable) invalid('此 YAML 使用高级语法，请在源文件中编辑。');
  const existing = parsed.entries.find(entry => entry.property.name === name);
  if (change.create && existing) invalid('属性已存在。');
  if (!change.create && !existing && name !== 'tags') invalid('属性已被移除，请重新加载。');
  if (name === 'tags' ? !tagProperty(parsed).editable : existing && !existing.property.editable) invalid('此属性只能在源文件中编辑。');
  const copied = parsed.entries.find(entry => entry.property.name === change.copyFrom);
  if (change.copyFrom !== undefined && (!change.create || change.remove || change.renameTo !== undefined || change.definition || reserved.has(name) || reserved.has(change.copyFrom) || !copied?.property.editable)) invalid('只能复制当前笔记中可编辑的自定义属性。');
  const original = copied?.property ?? existing?.property;
  let replacement: string[] = [];
  if (change.renameTo !== undefined) {
    const target = change.renameTo.trim();
    if (!existing || reserved.has(name) || change.create || change.remove || change.type !== undefined || change.value !== undefined || change.options !== undefined) invalid('重命名只能修改自定义属性名称。');
    if (!target || target.length > 100 || [...target].some(character => character.charCodeAt(0) < 32) || reserved.has(target)) invalid('属性名为空、过长或属于系统保留字段。');
    if (target !== name && parsed.entries.some(entry => entry.property.name === target)) invalid('属性已存在。');
    const key = /^(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|.+?)([ \t]*:(?:[ \t].*|$))$/.exec(parsed.lines[existing!.start]!);
    if (!key) invalid('此属性名请在源文件中编辑。');
    replacement = parsed.lines.slice(existing!.start, existing!.end);
    replacement[0] = JSON.stringify(target) + key![1];
  } else if (!change.remove) {
    const { type } = change;
    let { value } = change;
    if (name === 'tags') {
      if (type !== 'list' || !Array.isArray(value) || !value.every(item => typeof item === 'string' && normalizePropertyTag(item))) invalid('标签需为有效名称列表，不能包含空格、空值或纯数字。');
      value = propertyTags(value);
    }
    if (type === 'list' && name !== 'tags') invalid('文本列表已合并为多选。');
    if (type === 'checkbox' ? typeof value !== 'boolean' : ['list','multiSelect'].includes(type ?? '') ? !Array.isArray(value) || !value.every(item => typeof item === 'string') : !['text', 'number', 'date', 'select', 'image'].includes(type ?? '') || typeof value !== 'string') invalid('属性值与类型不匹配。');
    if (type === 'image' && !validPropertyImage(value as string)) invalid('图片属性需为笔记库中的图片路径。');
    if (type === 'number' && value !== '' && !validPropertyNumber(value as string)) invalid('请输入有效数字。');
    const options = change.options ?? (original ? listAsMultiSelect(original).options : undefined) ?? (type === 'multiSelect' && Array.isArray(value) ? listAsMultiSelect({name,type:'list',value,editable:true}).options : undefined) ?? [];
    if (type === 'select' || type === 'multiSelect') {
      const values = Array.isArray(value) ? value : value === '' ? [] : [value];
      // Renames supply values mapped from the verified source; copies read their source above.
      const previous = [...retainedValues ?? (Array.isArray(original?.value) ? original.value : [])];
      const retained = type === 'multiSelect' && (retainedValues !== undefined || ['list','multiSelect'].includes(original?.type ?? ''));
      const seen = new Set<unknown>();
      if (!validOptions(options) || !values.every(item => {
        const index = previous.indexOf(item as string);
        if (retained && index !== -1) { previous.splice(index,1); seen.add(item); return true; }
        if (seen.has(item) || !options.some(option => option.name === item)) return false;
        seen.add(item); return true;
      })) invalid('选项无效、重复或尚未创建。');
    }
    if (type === 'date' && value !== '' && !date(value as string)) invalid('请输入有效日期。');
    if (JSON.stringify(value).length > 65536) invalid('属性值过长。');
    replacement = [`${JSON.stringify(name)}: ${type === 'date' ? value === '' ? 'null # memocard:type=date' : JSON.stringify(value) : type === 'number' ? value === '' ? 'null # memocard:type=number' : `${value} # memocard:type=number` : JSON.stringify(value)}${type === 'select' || type === 'multiSelect' ? ` # memocard:choice=${JSON.stringify({type,options})}` : type === 'image' ? ' # memocard:type=image' : type === 'text' && date(value as string) ? ' # memocard:type=text' : ''}`];
  }
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  if (existing) parsed.lines.splice(existing.start, existing.end - existing.start, ...replacement);
  else { if (parsed.yaml) parsed.lines.push(...replacement); else parsed.lines = replacement; }
  let yaml = parsed.lines.join(newline);
  if (updatedAt) {
    // The legacy system timestamp is the only other field this operation changes.
    const current = propertySource(`---${newline}${yaml}${newline}---${newline}`);
    const timestamp = current.entries.find(entry => entry.property.name === 'updatedAt');
    if (timestamp) { current.lines.splice(timestamp.start, timestamp.end - timestamp.start, `updatedAt: ${JSON.stringify(updatedAt)}`); yaml = current.lines.join(newline); }
  }
  const header = `${parsed.match?.[1] ?? (source.startsWith('\uFEFF') ? '\uFEFF' : '')}---${newline}${yaml}${newline}---${newline}`;
  const result = header + source.slice(parsed.match?.[0].length ?? (source.startsWith('\uFEFF') ? 1 : 0));
  propertySource(result);
  return result;
}
