import type { NoteProperty, PropertyDefinition, PropertyOption, PropertyType } from '@memocard/contracts';
import { BrowserVaultError } from './browser-files';
import { propertyTypeChange } from './property-type-change';

export const propertyDefinitionPath = '.memocard/property-definitions.json';
const types = ['text','list','date','checkbox','select','multiSelect'];
const colors = ['default','brown','orange','yellow','green','blue','purple','pink','red'];
export function validPropertyDefinition(value:unknown): value is PropertyDefinition {
  if (!value || typeof value !== 'object') return false;
  const {type,options} = value as PropertyDefinition;
  return types.includes(type) && (type === 'select' || type === 'multiSelect' ? Array.isArray(options) && options.length <= 200 && options.every(option => option && typeof option.name === 'string' && option.name.trim() === option.name && option.name.length > 0 && option.name.length <= 100 && ![...option.name].some(character => character.charCodeAt(0) < 32) && colors.includes(option.color)) && new Set(options.map(option => option.name)).size === options.length : options === undefined);
}
export function parsePropertyDefinitions(raw:string):Record<string,PropertyDefinition> {
  const value:unknown = JSON.parse(raw || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.entries(value).every(([name,definition]) => name.length > 0 && !['id','createdAt','updatedAt','deletedAt','tags'].includes(name) && validPropertyDefinition(definition))) throw new Error('属性定义配置无法读取。');
  return Object.assign(Object.create(null),value) as Record<string,PropertyDefinition>;
}
export function mergedPropertyOptions(properties:NoteProperty[]):PropertyOption[] {
  const options:PropertyOption[] = [];
  for (const property of properties) for (const option of property.options ?? []) if (!options.some(item => item.name === option.name)) options.push(option);
  return options;
}
export function convertedProperty(property:NoteProperty, definition:PropertyDefinition, rename?:{from:string;to:string}):NoteProperty {
  const value = rename ? Array.isArray(property.value) ? property.value.map(value => value === rename.from ? rename.to : value) : property.value === rename.from ? rename.to : property.value : property.value;
  const change = propertyTypeChange({...property,value},definition.type);
  if (definition.type === 'select' || definition.type === 'multiSelect') {
    const selected = (Array.isArray(change.value) ? change.value : change.value ? [String(change.value)] : []).filter(value => definition.options!.some(option => option.name === value));
    change.value = definition.type === 'select' ? selected[0] ?? '' : [...new Set(selected)];
  }
  return {name:property.name,type:definition.type,value:change.value!,editable:property.editable,...(definition.options ? {options:definition.options} : {})};
}
export function newPropertyDefinition(properties:NoteProperty[], type:PropertyType, options?:PropertyOption[], includeValues = false):PropertyDefinition {
  if (type !== 'select' && type !== 'multiSelect') return {type};
  const next = [...(options ?? mergedPropertyOptions(properties))];
  if (includeValues) for (const property of properties) {
    const values = Array.isArray(property.value) ? property.value : property.value === '' ? [] : [String(property.value)];
    const options = [...(property.options ?? []),...values.map(name => ({name:name.trim(),color:'default' as const})).filter(option => option.name.length > 0 && option.name.length <= 100 && ![...option.name].some(character => character.charCodeAt(0) < 32))];
    for (const option of options) if (!next.some(item => item.name === option.name)) next.push(option);
  }
  return {type,options:next};
}

// Preview and first save share the same library schema, never another note's values.
export function inheritedProperties(properties:NoteProperty[], stored:Record<string,PropertyDefinition>):NoteProperty[] {
  const definitions:Record<string,PropertyDefinition> = Object.assign(Object.create(null),stored);
  for (const property of properties) if (property.editable && property.type !== 'unsupported' && !definitions[property.name]) {
    definitions[property.name] = newPropertyDefinition(properties.filter(item => item.name === property.name),property.type);
  }
  return Object.keys(definitions).sort().map(name => {
    const definition = definitions[name];
    if (!validPropertyDefinition(definition)) throw new BrowserVaultError('INVALID_PROPERTY','属性定义无效，最多支持 200 个选项。');
    const value = definition.type === 'checkbox' ? false : definition.type === 'list' || definition.type === 'multiSelect' ? [] : '';
    return {name,...definition,value,editable:true};
  });
}
