import type { Coverage, Note, NoteProperty, PropertyChange, PropertyDefinition } from '@memocard/contracts';
import type { BrowserDirectoryHandle, ParsedBrowserNote } from './browser-files';
import type { BrowserVaultStorage } from './browser-storage';
import { BrowserVaultError, canonicalId, fileAt, readBytes, sha256, parseObsidianNote, parseBrowserNote } from './browser-files';
import { readProperties, patchProperty } from './note-properties';
import { inheritedProperties, convertedProperty, losslessPropertyConversion, mergedPropertyOptions, newPropertyDefinition, parsePropertyDefinitions, propertyDefinitionPath, validPropertyDefinition, resolvedPropertyDefinition } from './property-definitions';
import { listAsMultiSelect } from './property-type-change';
import { commitRename, commitSource, renameSource } from './browser-rename';

const bytes = (value:string) => new TextEncoder().encode(value);
const invalid = (message:string):never => { throw new BrowserVaultError('INVALID_PROPERTY',message); };
export async function propertyOperation(operation:string, params:Record<string,unknown>, binding:{handle:BrowserDirectoryHandle; vaultId:string; binding:string; directoryId:string}, compatible:boolean, storage:BrowserVaultStorage, active:()=>Promise<unknown>, scan:()=>Promise<{parsed:ParsedBrowserNote[]; duplicateIds:Set<string>; coverage:Coverage}>) {
  const {handle:root, vaultId, binding:vaultBinding} = binding;
  const scope = `${binding.directoryId}:${vaultId}`;
  const snapshot = await scan();
  const config = await renameSource(root,propertyDefinitionPath,compatible);
  let definitions:Record<string,PropertyDefinition>;
  try { definitions = parsePropertyDefinitions(config ?? ''); } catch { return invalid('属性定义配置无法读取，请检查 .memocard/property-definitions.json。'); }
  const definitionHash = await sha256(bytes(config ?? ''));
  const propertiesByPath = new Map(snapshot.parsed.filter(item => !item.note.deletedAt).sort((a,b) => a.note.relativePath.localeCompare(b.note.relativePath)).map(item => [item.note.relativePath,readProperties(item.source ?? `---\n${item.frontmatter.toString()}---\n`,item.note.contentHash).properties.map(listAsMultiSelect)]));
  const all = [...propertiesByPath.values()].flat();
  for (const [name,definition] of Object.entries(definitions)) definitions[name] = resolvedPropertyDefinition(definition,all.filter(property => property.name === name));
  if (operation === 'getNoteProperties' && params.id === undefined) {
    await active();
    return {properties:inheritedProperties(all,definitions),contentHash:'',writable:false,definitionHash};
  }
  const id = canonicalId(params.id);
  if (snapshot.duplicateIds.has(id)) throw new BrowserVaultError('DUPLICATE_ID', '笔记 ID 重复，无法修改属性。');
  const existing = snapshot.parsed.find(item => item.note.id === id)?.note;
  if (!existing || existing.deletedAt) throw new BrowserVaultError('NOTE_NOT_FOUND', '找不到可编辑的笔记。');
  if (operation === 'updateNoteProperty' && !snapshot.coverage.complete) throw new BrowserVaultError('SCAN_INCOMPLETE', '笔记库尚未完整读取，无法安全修改属性。');
  const path = existing.relativePath;
  const file = await fileAt(root, path, compatible ? 'vault' : 'notes');
  const before = await readBytes(file), hash = await sha256(before);
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(before);
  function effective(property:NoteProperty, library = all):NoteProperty {
    if (property.type === 'unsupported') return property;
    property = listAsMultiSelect(property);
    const definition = definitions[property.name];
    if (definition) return convertedProperty(property,definition);
    return property.options ? {...property,options:mergedPropertyOptions(library.filter(item => item.name === property.name))} : property;
  }
  function effectiveData(data:ReturnType<typeof readProperties>, library = all) {
    const names = new Set(data.properties.map(property => property.name));
    return {...data,properties:[...data.properties.map(property => effective(property,library)),...inheritedProperties(library,definitions).filter(property => !names.has(property.name)).map(property => ({...property,editable:data.writable}))],definitionHash};
  }
  await active();
  if (operation === 'getNoteProperties') {
    const data = readProperties(source,hash);
    return effectiveData(data);
  }
  if (hash !== params.baseHash) throw new BrowserVaultError('HASH_CONFLICT','文件已在其他位置修改，属性未被覆盖，请重新加载。');
  if (params.definitionHash !== undefined && params.definitionHash !== definitionHash) throw new BrowserVaultError('HASH_CONFLICT','属性定义已在其他位置修改，请重新打开后重试。');
  let change = { ...params, name: typeof params.name === 'string' ? params.name : '' } as PropertyChange;
  const raw = readProperties(source,hash);
  const current = effectiveData(raw).properties.find(property => property.name === change.name);
  if (change.definition || change.remove) {
    const removing = change.remove === true;
    if (!current?.editable || change.create || change.renameTo || change.copyFrom !== undefined || (!removing && !change.type)) return invalid('只有可编辑的自定义属性支持修改库级定义。');
    const properties = all.filter(property => property.name === change.name);
    if (properties.some(property => !property.editable)) return invalid('此属性包含只读值，库级修改未保存。');
    const typeChanged = effective(current).type !== change.type;
    const definition = newPropertyDefinition(properties,change.type ?? current.type as PropertyDefinition['type'],change.options,typeChanged);
    if (!removing && !validPropertyDefinition(definition)) return invalid('属性类型或选项定义无效，最多支持 200 个选项。');
    if (!removing && change.optionRename) {
      const previous = effective(current).options ?? [];
      const {from,to} = change.optionRename;
      if (typeChanged || !previous.some(option => option.name === from) || previous.some(option => option.name === to) || !definition.options?.some(option => option.name === to) || definition.options.some(option => option.name === from)) return invalid('选项重命名无效。');
    }
    const changes:import('./browser-storage').RenameJournal['changes'] = [];
    let saved:Note = existing;
    let savedSource = source;
    for (const item of snapshot.parsed.filter(item => !item.note.deletedAt)) {
      if (removing && !propertiesByPath.get(item.note.relativePath)?.some(property => property.name === change.name)) continue;
      const original = await renameSource(root,item.note.relativePath,compatible);
      if (original === null || await sha256(bytes(original)) !== item.note.contentHash) throw new BrowserVaultError('HASH_CONFLICT','笔记已在其他位置修改，库级属性未更新。');
      const stored = readProperties(original,item.note.contentHash).properties.find(property => property.name === change.name);
      const hasValue = Array.isArray(change.value) ? change.value.length > 0 : Boolean(change.value);
      const property = stored ?? (!removing && item.note.id === id && hasValue ? current : undefined);
      if (!property) continue;
      if (!property.editable) return invalid(`「${item.note.relativePath}」的此属性只读，库级修改未保存。`);
      const converted = removing ? property : convertedProperty(effective(property),definition,change.optionRename,!typeChanged);
      if (!removing && (typeChanged || listAsMultiSelect(property).type !== definition.type) && !losslessPropertyConversion(property,converted)) throw new BrowserVaultError('LOSSY_PROPERTY_CONVERSION',`「${item.note.relativePath}」的「${change.name}」无法无损转换。笔记库未修改，请先保留或调整原值。`);
      // A type switch converts each note independently; option actions can also change this note's selection.
      const value = item.note.id === id && !typeChanged && change.value !== undefined ? change.value : converted.value;
      const retainedValues = change.optionRename && Array.isArray(property.value) ? property.value.map(value => value === change.optionRename!.from ? change.optionRename!.to : value) : undefined;
      const after = patchProperty(original,removing ? {name:change.name,remove:true} : {name:change.name,...definition,value,...(!stored ? {create:true} : {})},compatible ? undefined : new Date().toISOString(),retainedValues);
      if (bytes(after).length > 8 * 1024 * 1024) throw new BrowserVaultError('NOTE_TOO_LARGE','单条 Markdown 最大支持 8 MiB。');
      const identity = {id:item.note.id,path:item.note.relativePath,hash:await sha256(bytes(after)),createdAt:item.note.createdAt};
      const parsed = compatible ? await parseObsidianNote(bytes(after),identity.path,vaultId,identity,Date.now()) : await parseBrowserNote(bytes(after),identity.path,vaultId);
      changes.push({path:identity.path,before:original,after});
      if (item.note.id === id) { saved = parsed.note; savedSource = after; }
    }
    if (removing) delete definitions[change.name];
    else definitions[change.name] = definition;
    const definitionSource = JSON.stringify(definitions);
    changes.push({path:propertyDefinitionPath,before:config,after:definitionSource});
    const data = readProperties(savedSource,saved.contentHash);
    const propertyData = {...effectiveData(data,removing ? all.filter(property => property.name !== change.name) : all),definitionHash:await sha256(bytes(definitionSource))};
    await commitRename(root,compatible,storage,scope,{changes,identities:await storage.identities(scope)},active,false);
    return {...saved,vaultBinding,propertyData};
  }
  const definition = definitions[change.name];
  if (definition && !change.remove && !change.renameTo) {
    if (change.type !== definition.type) return invalid('属性类型已变化，请重新打开后编辑。');
    if (change.options && !(change.create && change.options.length === 0) && JSON.stringify(change.options) !== JSON.stringify(definition.options)) return invalid('选项已变化，请重新打开后编辑。');
    change = {...change,...definition};
  }
  if (change.copyFrom && !raw.properties.some(property => property.name === change.copyFrom) && change.create) {
    const copied = effectiveData(raw).properties.find(property => property.name === change.copyFrom && property.editable);
    if (copied) change = {...change,type:copied.type as PropertyChange['type'],value:copied.value,options:copied.options,copyFrom:undefined};
  }
  if (!raw.properties.some(property => property.name === change.name) && current?.editable && !change.create && !change.renameTo) {
    if (change.type !== current.type) return invalid('属性类型已变化，请重新打开后编辑。');
    change = {...change,create:true,options:current.options};
  }
  const data = bytes(patchProperty(source,change,compatible ? undefined : new Date().toISOString()));
  if (data.length > 8 * 1024 * 1024) throw new BrowserVaultError('NOTE_TOO_LARGE','单条 Markdown 最大支持 8 MiB。');
  const identity = {id,path,hash:await sha256(data),createdAt:existing.createdAt};
  const saved = compatible ? await parseObsidianNote(data,path,vaultId,identity,Date.now()) : await parseBrowserNote(data,path,vaultId);
  const updated = readProperties(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data),identity.hash);
  const library = [...propertiesByPath].flatMap(([notePath,properties]) => notePath === path ? updated.properties.map(listAsMultiSelect) : properties);
  const propertyData = effectiveData(updated,library);
  await commitSource(root,compatible,storage,scope,{path,before:source,after:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data)},identity,active,async () => {
    const stream = await file.createWritable({mode:'exclusive'});
    try {
      const verify = async () => {
        await active();
        const current = await fileAt(root,path,compatible ? 'vault' : 'notes');
        if (!await current.isSameEntry(file) || await sha256(await readBytes(current)) !== hash || await renameSource(root,propertyDefinitionPath,compatible) !== config) throw new BrowserVaultError('HASH_CONFLICT','文件或属性定义已修改，请重新加载。');
      };
      await verify(); await stream.write(data); await verify(); await stream.close();
    } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  });
  return {...saved.note,vaultBinding,propertyData};
}
