import { expect, it } from 'vitest';
import { insertCaptureTag, removeCaptureTags, restoreCaptureTags } from './quick-capture-tags';

it('inserts a tag at the selection without losing surrounding text',()=>{
  expect(insertCaptureTag('前文 后文','project/yami',3)).toEqual({text:'前文 #project/yami 后文',caret:17});
  expect(insertCaptureTag('前文 #pro 后文','project/yami',3,7).text).toBe('前文 #project/yami 后文');
});
it('removes exact body tags while preserving children, code and other text',()=>{
  expect(removeCaptureTags('正文 #work #work/child `#work` #Work','work')).toBe('正文  #work/child `#work` ');
  expect(removeCaptureTags('#work #life').trim()).toBe('');
});
it('restores legacy separate tags into the body without duplicating existing tokens',()=>{
  const restored=restoreCaptureTags({id:'a',text:'正文 #work',tags:['work','project/yami'],images:[],relativePath:'a.md'});
  expect(restored.text).toBe('正文 #work #project/yami ');
  expect(restored.tags).toEqual(['work','project/yami']);
  expect(restoreCaptureTags(restored)).toEqual(restored);
});
