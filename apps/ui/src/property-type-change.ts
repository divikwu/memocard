import type { NoteProperty, PropertyChange, PropertyOption, PropertyType } from '@memocard/contracts';
import { validPropertyImage } from './property-image';
import { validPropertyDate } from './property-dates';
import { validPropertyNumber } from './property-numbers';

// `list` is only a legacy storage type; custom properties use the multi-select editor.
export function listAsMultiSelect(property:NoteProperty):NoteProperty {
  if (property.type !== 'list') return property;
  const values = Array.isArray(property.value) ? property.value : [];
  const options = [...new Set(values)].filter(name => name.length > 0 && name.length <= 100 && name === name.trim() && ![...name].some(character => character.charCodeAt(0) < 32)).slice(0,200).map(name => ({name,color:'default' as const}));
  return {...property,type:'multiSelect',options};
}

export function propertyTypeChange(property:NoteProperty, type:PropertyType): PropertyChange {
  const source = property.value;
  const values = Array.isArray(source) ? source : source === '' ? [] : [String(source)];
  const choice = type === 'select' || type === 'multiSelect';
  let value:PropertyChange['value'];
  let options:PropertyOption[] | undefined;
  if (type === 'text') value = values.join('\n');
  else if (type === 'number') value = values.length === 1 && validPropertyNumber(values[0]!) ? values[0]! : '';
  else if (type === 'image') value = values.length === 1 && validPropertyImage(values[0]!) ? values[0]! : '';
  else if (type === 'list') value = values;
  else if (choice) {
    const normalized = [...new Set(values.map(item => item.trim()).filter(item => item.length > 0 && item.length <= 100 && ![...item].some(character => character.charCodeAt(0) < 32)))];
    options = [...(property.options ?? [])];
    for (const name of normalized) if (!options.some(option => option.name === name) && options.length < 200) options.push({name,color:'default'});
    const selected = normalized.filter(name => options!.some(option => option.name === name));
    value = type === 'select' ? selected[0] ?? '' : selected;
  } else if (type === 'date') {
    value = values.length === 1 && validPropertyDate(values[0]!) ? values[0]! : '';
  } else {
    value = typeof source === 'boolean' ? source : values.length === 1 && values[0] === 'true';
  }
  return {name:property.name,type,value,...(options ? {options} : {})};
}
