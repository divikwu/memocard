import { expect, it } from 'vitest';
import { parseDocument } from 'yaml';
import { patchProperty, readProperties } from './note-properties';
import { encodeBrowserNote } from './browser-files';

it('round trips numbers without rounding on body saves, and retains the type when cleared',()=>{
  let source = 'Body #keep';
  source = patchProperty(source,{name:'weight',type:'number',value:'',create:true});
  for (const value of ['0','-3','3.2','9007199254740993','3.0000000000000001','1e3','']) {
    source = patchProperty(source,{name:'weight',type:'number',value});
    expect(readProperties(source,'hash').properties[0]).toMatchObject({type:'number',value,editable:true});
    const doc = parseDocument(source.split('---\n')[1]!,{schema:'yaml-1.1'});
    const saved = new TextDecoder().decode(encodeBrowserNote(doc,'Edited body'));
    expect(readProperties(saved,'hash').properties[0]).toMatchObject({type:'number',value});
  }
  for (const value of ['NaN','Infinity','1e999','01','hello','1,000','0xFF']) expect(()=>patchProperty(source,{name:'weight',type:'number',value})).toThrow('数字');
});
it('retains complete timestamps, date-shaped text and empty dates across reload',()=>{
  let source = 'Body';
  for (const value of ['2026-10-13T09:30:42.123+08:00','2026-10-13T01:30:42.123Z','2026-10-13','']) {
    source = patchProperty(source,{name:'due',type:'date',value,...(!source.startsWith('---') ? {create:true} : {})});
    const saved = new TextDecoder().decode(encodeBrowserNote(parseDocument(source.split('---\n')[1]!,{schema:'yaml-1.1'}),'Edited'));
    expect(readProperties(saved,'hash').properties[0]).toMatchObject({type:'date',value});
  }
  source = patchProperty(source,{name:'due',type:'text',value:'2026-10-13T09:30:42.123+08:00'});
  expect(readProperties(source,'hash').properties[0].type).toBe('text');
  for (const value of ['2026-02-30T09:30:00Z','2026-10-13T24:00:00Z']) expect(()=>patchProperty(source,{name:'due',type:'date',value})).toThrow('日期');
});

it('edits one YAML property while preserving unknown fields, comments, BOM, CRLF and body bytes', () => {
  const source = '\uFEFF---\r\n# keep header\r\nsummary: old # original\r\n# keep unknown\r\nunknown:\r\n  nested: [1, two]\r\naliases: ["One", "Two"]\r\n---\r\n# Body\r\n\r\n<!-- literal -->\r\n';
  const updated = patchProperty(source, {name:'summary',type:'text',value:'新摘要: #literal'});
  expect(updated).toContain('# keep unknown\r\nunknown:\r\n  nested: [1, two]\r\naliases: ["One", "Two"]');
  expect(updated.startsWith('\uFEFF---\r\n# keep header\r\n')).toBe(true);
  expect(updated.split('---\r\n').at(-1)).toBe(source.split('---\r\n').at(-1));
  const values = readProperties(updated, 'hash');
  expect(values.properties.find(item => item.name === 'summary')).toMatchObject({type:'text',value:'新摘要: #literal',editable:true});
  expect(values.properties.find(item => item.name === 'unknown')?.editable).toBe(false);
});
it('round trips all four types and deletes only the selected property', () => {
  let source = '# Plain\nbody #tag\n';
  for (const change of [
    {name:'摘要',type:'text' as const,value:'yes'}, {name:'aliases',type:'multiSelect' as const,value:['One','two: #literal']},
    {name:'due',type:'date' as const,value:'2026-10-12'}, {name:'done',type:'checkbox' as const,value:false},
  ]) source = patchProperty(source, {...change,create:true});
  const values = readProperties(source, 'hash').properties;
  expect(values.map(value => value.type)).toEqual(['text','multiSelect','date','checkbox']);
  source = patchProperty(source, {name:'done',type:'checkbox',value:true});
  expect(readProperties(source, 'hash').properties.at(-1)?.value).toBe(true);
  source = patchProperty(source, {name:'due',remove:true});
  expect(readProperties(source, 'hash').properties.map(value => value.name)).toEqual(['摘要','aliases','done']);
  expect(source.endsWith('# Plain\nbody #tag\n')).toBe(true);
});
it('rejects reserved keys, duplicates, invalid dates and advanced YAML without changing source', () => {
  const source = '---\nsummary: old\nid: user-data\n---\nbody';
  for (const change of [{name:'id',type:'text' as const,value:'new'}, {name:'summary',create:true,type:'text' as const,value:'new'}, {name:'date',create:true,type:'date' as const,value:'2026-02-30'}]) expect(() => patchProperty(source,change)).toThrow();
  const advanced = '---\nfirst: &ref value\nsecond: *ref\n---\nbody';
  expect(readProperties(advanced,'hash').writable).toBe(false);
  expect(() => patchProperty(advanced,{name:'third',create:true,type:'text',value:'new'})).toThrow();
});
it('edits only YAML tags, normalizes names and preserves body tags and source formatting', () => {
  const source = '\uFEFF---\r\n# keep\r\nsummary: old\r\ntags: [共享]\r\nunknown: {nested: value}\r\n---\r\n正文 #共享 #正文/分类\r\n';
  const saved = patchProperty(source, {name:'tags',type:'list',value:['#共享',' 属性/分类 ','共享']});
  expect(readProperties(saved,'hash').tagProperty).toEqual({name:'tags',type:'list',value:['共享','属性/分类'],editable:true});
  expect(saved).toContain('summary: old\r\n');
  expect(saved).toContain('unknown: {nested: value}\r\n');
  expect(saved.split('---\r\n').at(-1)).toBe(source.split('---\r\n').at(-1));
  const cleared = patchProperty(saved,{name:'tags',type:'list',value:[]});
  expect(readProperties(cleared,'hash').tagProperty?.value).toEqual([]);
  expect(cleared).toContain('正文 #共享 #正文/分类\r\n');
  expect(readProperties(patchProperty('Body #正文',{name:'tags',type:'list',value:['新增']}),'hash').tagProperty?.value).toEqual(['新增']);
});
it('keeps malformed or advanced YAML tags read-only and rejects invalid tag mutations', () => {
  for (const yaml of ['tags: [valid, 123]', 'tags: {nested: value}', 'tags: |\n  value', 'tags: &ref [valid]']) {
    const source = `---\n${yaml}\n---\n正文 #保留`;
    expect(readProperties(source,'hash').tagProperty?.editable).toBe(false);
    expect(() => patchProperty(source,{name:'tags',type:'list',value:['覆盖']})).toThrow();
  }
  for (const value of [['two words'],['123'],['bad/'],[''],[false]]) expect(() => patchProperty('Body',{name:'tags',type:'list',value:value as string[]})).toThrow();
  expect(() => patchProperty('Body',{name:'tags',type:'text',value:'not a list'})).toThrow();
});

it('creates empty properties and preserves the date type through fill, clear, reload and deletion', () => {
  let source = '\uFEFF---\r\n# keep\r\nunknown: null # user comment\r\n---\r\nBody #keep\r\n';
  for (const change of [
    {name:'empty text',type:'text' as const,value:''}, {name:'empty list',type:'multiSelect' as const,value:[]},
    {name:'empty date',type:'date' as const,value:''}, {name:'unchecked',type:'checkbox' as const,value:false},
  ]) source = patchProperty(source, {...change,create:true});
  expect(readProperties(source,'hash').properties.slice(1)).toEqual([
    {name:'empty text',type:'text',value:'',editable:true}, {name:'empty list',type:'multiSelect',value:[],editable:true,options:[]},
    {name:'empty date',type:'date',value:'',editable:true}, {name:'unchecked',type:'checkbox',value:false,editable:true},
  ]);
  source = patchProperty(source,{name:'empty date',type:'date',value:'2028-02-29'});
  expect(readProperties(source,'hash').properties.find(item=>item.name==='empty date')).toMatchObject({type:'date',value:'2028-02-29'});
  source = patchProperty(source,{name:'empty date',type:'date',value:''});
  expect(source).toContain('"empty date": null # memocard:type=date\r\n');
  expect(source).toContain('unknown: null # user comment\r\n');
  expect(readProperties(source,'hash').properties[0]).toMatchObject({type:'unsupported',editable:false});
  source = patchProperty(source,{name:'empty date',remove:true});
  expect(readProperties(source,'hash').properties.some(item=>item.name==='empty date')).toBe(false);
  expect(source).not.toContain('memocard:type=date');
  expect(source.endsWith('Body #keep\r\n')).toBe(true);
});
it('recognizes only a null scalar with the exact empty-date comment', () => {
  for (const field of ['due: null', 'due: null # memocard:type=text', 'due: null # memocard:type=date extra', 'due: 123 # memocard:type=date', 'due: "" # memocard:type=date']) {
    expect(readProperties(`---\n${field}\n---\nBody`,'hash').properties[0]?.type).not.toBe('date');
  }
});

it('preserves the empty date type when browser body saves serialize YAML', () => {
  const source=patchProperty('Body',{name:'due',type:'date',value:'',create:true});
  const yaml=source.split('---\n')[1]!;
  const serialized=parseDocument(yaml,{schema:'yaml-1.1'}).toString({lineWidth:0});
  expect(readProperties(`---\n${serialized}---\nEdited body`,'hash').properties[0]).toMatchObject({type:'date',value:'',editable:true});
});

it('persists select and multi-select definitions, colors and empty values without retyping lists', () => {
  const options = [{name:'设计',color:'blue' as const},{name:'2026-10-12',color:'green' as const}];
  let source = '\uFEFF---\r\naliases: [old]\r\n# keep\r\n---\r\nBody #keep\r\n';
  source = patchProperty(source,{name:'阶段',type:'select',value:'',options,create:true});
  source = patchProperty(source,{name:'领域',type:'multiSelect',value:[],options,create:true});
  expect(readProperties(source,'hash').properties.map(property => property.type)).toEqual(['list','select','multiSelect']);
  source = patchProperty(source,{name:'阶段',type:'select',value:'2026-10-12'});
  source = patchProperty(source,{name:'领域',type:'multiSelect',value:['设计','2026-10-12']});
  let properties = readProperties(source,'hash').properties;
  expect(properties[1]).toMatchObject({type:'select',value:'2026-10-12',options});
  expect(properties[2]).toMatchObject({type:'multiSelect',value:['设计','2026-10-12'],options});
  source = patchProperty(source,{name:'阶段',type:'select',value:''});
  source = patchProperty(source,{name:'领域',type:'multiSelect',value:[]});
  properties = readProperties(source,'hash').properties;
  expect(properties[1]).toMatchObject({type:'select',value:'',options});
  expect(properties[2]).toMatchObject({type:'multiSelect',value:[],options});
  expect(source).toContain('# keep\r\n');
  expect(source).toMatch(/Body #keep\r\n$/);
  const doc = parseDocument(source.slice(source.indexOf('---\r\n') + 5,source.lastIndexOf('---\r\n')));
  expect(readProperties(`---\n${doc.toString({lineWidth:0})}---\nBody`,'hash').properties[2]).toMatchObject({type:'multiSelect',options});
});
it('rejects unknown selections, duplicate options and invalid colors; corrupt metadata stays read-only', () => {
  const change = {name:'选择',type:'select' as const,value:'unknown',options:[],create:true};
  expect(()=>patchProperty('Body',change)).toThrow('选项');
  expect(()=>patchProperty('Body',{...change,value:'',options:[{name:'a',color:'blue'},{name:'a',color:'red'}]})).toThrow('选项');
  expect(()=>patchProperty('Body',{...change,value:'',options:[{name:'a',color:'bogus' as 'blue'}]})).toThrow('选项');
  const source = '---\nchoice: "a" # memocard:choice={bad}\n---\nBody';
  expect(readProperties(source,'hash').properties[0]).toMatchObject({type:'unsupported',editable:false});
  expect(()=>patchProperty(source,{name:'choice',type:'text',value:'changed'})).toThrow('源文件');
  expect(()=>patchProperty('Body',{name:'多选',type:'multiSelect',value:['a','a'],options:[{name:'a',color:'blue'}],create:true})).toThrow('选项');
});

it('keeps marker-looking text and YAML punctuation in option names as plain strings',()=>{
 const options = [{name:'AI !important # memocard:choice=literal',color:'blue' as const}];
 const source=patchProperty('Body',{name:'选项',type:'select',value:options[0]!.name,options,create:true});
 expect(readProperties(source,'hash').properties[0]).toMatchObject({type:'select',editable:true,value:options[0]!.name,options});
});

it('renames only a YAML key, preserving quoting-sensitive values, choice metadata, comments and body', () => {
  const source = '\uFEFF---\r\n"old: name"  : "设计" # memocard:choice={"type":"select","options":[{"name":"设计","color":"purple"}]}\r\n# keep\r\naliases:\r\n  - "One" # item\r\n  - Two\r\nempty: null # memocard:type=date\r\n---\r\nBody #old\r\n';
  const renamed = patchProperty(source, {name:'old: name',renameTo:'新名称: "引用"'});
  expect(renamed).toBe(source.replace('"old: name"',JSON.stringify('新名称: "引用"')));
  expect(readProperties(renamed,'hash').properties[0]).toMatchObject({name:'新名称: "引用"',type:'select',value:'设计',options:[{name:'设计',color:'purple'}]});
  const list = patchProperty(renamed,{name:'aliases',renameTo:'别名'});
  expect(list).toBe(renamed.replace('aliases:', '"别名":'));
  const date = patchProperty(list,{name:'empty',renameTo:'日期'});
  expect(readProperties(date,'hash').properties.at(-1)).toMatchObject({name:'日期',type:'date',value:''});
});
it('rejects colliding, reserved, invalid and mixed rename operations without changing source', () => {
  const source = '---\na: value\nb: other\ntags: [work]\ncomplex: {nested: value}\n---\nBody';
  for (const change of [
    {name:'a',renameTo:'b'}, {name:'a',renameTo:'id'}, {name:'a',renameTo:'tags'},
    {name:'a',renameTo:' '}, {name:'a',renameTo:'bad\u0000name'}, {name:'missing',renameTo:'new'},
    {name:'tags',renameTo:'new'}, {name:'complex',renameTo:'new'}, {name:'a',renameTo:'new',remove:true},
    {name:'a',renameTo:'new',type:'text' as const,value:'changed'},
  ]) expect(() => patchProperty(source,change)).toThrow();
  expect(readProperties(source,'hash').properties[0]).toMatchObject({name:'a',value:'value'});
});

it('persists a date-shaped text value through type switching and YAML serialization', () => {
 const original='---\nfield: 2028-02-29\nother: keep\n---\nBody';
 const text=patchProperty(original,{name:'field',type:'text',value:'2028-02-29'});
 expect(text).toContain('"field": "2028-02-29" # memocard:type=text');
 expect(readProperties(text,'hash').properties[0]).toMatchObject({type:'text',value:'2028-02-29'});
 const yaml=text.split('---\n')[1]!;
 const serialized=parseDocument(yaml,{schema:'yaml-1.1'}).toString({lineWidth:0});
 expect(readProperties(`---\n${serialized}---\nNew body`,'hash').properties[0]?.type).toBe('text');
 const date=patchProperty(text,{name:'field',type:'date',value:'2028-02-29'});
 expect(readProperties(date,'hash').properties[0]?.type).toBe('date');
 expect(date).not.toContain('memocard:type=text');
});


it('round trips an empty image, a relative image and clearing without changing body or unknown fields', () => {
  const original = '\uFEFF---\r\nunknown: {nested: value} # keep\r\n---\r\nBody #keep\r\n';
  let source = patchProperty(original,{name:'封面',type:'image',value:'',create:true});
  for (const value of ['../assets/cover.png','../assets/replaced.jpg','']) {
    source = patchProperty(source,{name:'封面',type:'image',value});
    expect(readProperties(source,'hash').properties.find(item => item.name === '封面')).toMatchObject({type:'image',value,editable:true});
    expect(source).toContain('unknown: {nested: value} # keep\r\n');
    expect(source.endsWith('Body #keep\r\n')).toBe(true);
    const yaml = parseDocument(source.split('---\r\n')[1]!,{schema:'yaml-1.1'}).toString({lineWidth:0});
    expect(readProperties(`---\n${yaml}---\nEdited body`,'hash').properties.find(item => item.name === '封面')).toMatchObject({type:'image',value});
  }
});
it.each(['https://example.com/a.png','data:image/png;base64,abc','/tmp/a.png','assets/.hidden.png','assets/a.txt','assets/%2e%2e/a.png','assets/%2fetc.png'])('rejects an invalid image reference %s without reinterpreting it as editable', value => {
  expect(() => patchProperty('Body',{name:'cover',type:'image',value,create:true})).toThrow();
  expect(readProperties(`---\ncover: ${JSON.stringify(value)} # memocard:type=image\n---\nBody`,'hash').properties[0]).toMatchObject({type:'unsupported',editable:false});
});
