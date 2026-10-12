import { expect,it } from 'vitest';
import { errorMessage } from './error-messages';
it.each([
  ['操作暂未完成。内容仍保留在编辑器中，请稍后重试。','操作超时，请重试。'],
  ['草稿已变化，请重新查看后再选择是否提醒。','草稿已更新，请刷新列表后重试。'],
  ['原文件已移除，不能从旧缓存恢复。','原文件已移除，可将当前内容另存副本。'],
])('simplifies %s while preserving its recovery action',(message,expected)=>{
  expect(errorMessage(new Error(message))).toBe(expected);
});
it('retains the file, property and no-write guarantee for lossy conversions',()=>{
  expect(errorMessage(new Error('「notes/a.md」的「摘要」无法无损转换。笔记库未修改，请先保留或调整原值。'))).toBe('「notes/a.md」的「摘要」转换会丢失值，笔记库未修改。请先调整原值。');
});
it.each(['已更新 3/8 篇笔记，重命名已停止。文件 a.md 无法读取。','目标文件已存在，原文未被覆盖。','属性定义已修改，请重新保存。','保存事务恢复记录不属于当前笔记库。','权限不足：/notes/private.md'])('keeps specific and unfamiliar causes intact: %s',message=>{
  expect(errorMessage(Object.assign(new Error(message),{code:'HASH_CONFLICT'}))).toBe(message);
});
it('does not claim that content was saved when the cause is unknown',()=>{
  expect(errorMessage(null)).toBe('操作未完成，请重试。');
});
