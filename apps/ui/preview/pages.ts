import { scenarios } from './catalog';

export const previewPages = [
  {file:'errors.html',title:'异常状态',description:'检查错误提示、草稿恢复、冲突处理和加载反馈。',scenarios:scenarios.filter(item=>item.group !== '空状态')},
  {file:'empty.html',title:'空状态',description:'检查空笔记库、搜索无结果和筛选无结果。',scenarios:scenarios.filter(item=>item.group === '空状态')},
];
