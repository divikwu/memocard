import { expect, it } from 'vitest';
import type { NoteProperty, PropertyType } from '@memocard/contracts';
import { propertyTypeChange } from './property-type-change';

const property = (type:NoteProperty['type'],value:NoteProperty['value'],options?:NoteProperty['options']):NoteProperty => ({name:'字段',type,value,editable:true,...(options ? {options} : {})});
it.each([
  ['text','hello','list',['hello']], ['text','','list',[]],
  ['list',['One','Two'],'text','One\nTwo'], ['checkbox',true,'text','true'],
  ['checkbox',false,'list',['false']], ['text','2028-02-29','date','2028-02-29'],
  ['date','2028-02-29','text','2028-02-29'], ['list',['2028-02-29'],'date','2028-02-29'],
  ['text','true','checkbox',true], ['text','false','checkbox',false],
  ['text','','checkbox',false], ['list',[],'date',''],
  ['text','3.2','number','3.2'], ['number','0','text','0'], ['text','bad','number',''],
  ['text','2026-10-13T09:30:42.123+08:00','date','2026-10-13T09:30:42.123+08:00'],
] as const)('preserves compatible %s values when switching to %s', (from,value,to,expected) => {
  const result = propertyTypeChange(property(from,Array.isArray(value) ? [...value] : value as string | boolean),to);
  expect(result).toEqual({name:'字段',type:to,value:expected});
});
it('retains option definitions and colors between single and multiple choice', () => {
  const options = [{name:'设计',color:'purple' as const},{name:'开发',color:'blue' as const}];
  expect(propertyTypeChange(property('select','设计',options),'multiSelect')).toEqual({name:'字段',type:'multiSelect',value:['设计'],options});
  const result = propertyTypeChange(property('multiSelect',['设计','开发'],options),'select');
  expect(result).toEqual({name:'字段',type:'select',value:'设计',options});
  expect(options).toEqual([{name:'设计',color:'purple'},{name:'开发',color:'blue'}]);
});
it('creates neutral options without dropping unselected values on conversion to single choice', () => {
  const result = propertyTypeChange(property('list',['One','Two']),'select');
  expect(result).toEqual({name:'字段',type:'select',value:'One',options:[{name:'One',color:'default'},{name:'Two',color:'default'}]});
});
it('normalizes choice values, removes unused definitions and caps option counts', () => {
  const result = propertyTypeChange(property('list',[' One ','One','','two\nlines','x'.repeat(101)]),'multiSelect');
  expect(result.value).toEqual(['One']);
  for (const type of ['text','list','date','checkbox'] as PropertyType[]) {
    expect(propertyTypeChange(property('select','设计',[{name:'设计',color:'purple'}]),type).options).toBeUndefined();
  }
  const overflow = propertyTypeChange(property('list',Array.from({length:201},(_,index)=>String(index))),'multiSelect');
  expect(overflow.options).toHaveLength(200);
});
it.each([['date','2026-02-30',''],['date','hello',''],['checkbox','hello',false]] as const)('clears an incompatible %s value according to the conversion rules', (type,value,expected) => {
  const result = propertyTypeChange(property('text',value),type);
  expect(result.value).toBe(expected);
});

it('preserves one local image reference and lets loss checks reject incompatible conversions', () => {
  expect(propertyTypeChange(property('text','../assets/cover.png'),'image').value).toBe('../assets/cover.png');
  expect(propertyTypeChange(property('image','../assets/cover.png'),'text').value).toBe('../assets/cover.png');
  expect(propertyTypeChange(property('multiSelect',['assets/a.png','assets/b.png']),'image').value).toBe('');
  expect(propertyTypeChange(property('text','https://example.com/a.png'),'image').value).toBe('');
});
