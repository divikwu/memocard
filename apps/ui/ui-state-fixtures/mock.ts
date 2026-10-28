import type { Note, NoteProperties, VaultStatus, PropertyChange, TrashItem } from '@memocard/contracts';
import type { Draft, DraftList } from '../src/bridge';
import { noteId } from './catalog';
import { inlineTags, propertyTags } from '../src/inline-tags';
import { blockSpacingBody } from './block-spacing';

export class PreviewFailure extends Error {
  constructor(public code:string, message:string, public retryable=false) { super(message); }
}
export function createPreviewMock(scenario:string) {
  const browser = ['permission','folder-cancel','unsupported','image-read-error','image-loading','block-spacing'].includes(scenario);
  const capabilities = ['getStatus','getEnvironment','queryNotes','getNote','getDrafts','listTags','listFolders','saveNote','saveDraft','getNoteProperties','updateNoteProperty','getPropertyLabels','setPropertyLabels','dismissDraftReminder','selectVault','pickImage','resolveLink'];
  if (scenario === 'unsupported') capabilities.splice(0,capabilities.length,'getStatus','getEnvironment');
  if (scenario === 'permission') capabilities.push('reauthorizeVault');
  const note:Note = {id:noteId,title:'模拟笔记 · 产品验收',body:'这是一条模拟笔记，可以自由编辑。\n\n#验收\n\n所有修改只存在预览内存中。',tags:['验收'],contentHash:'preview-hash',relativePath:'notes/模拟笔记.md',sourceUrl:'',createdAt:'2026-10-12T01:00:00Z',updatedAt:'2026-10-12T08:00:00Z'};
  if (scenario === 'tables') { note.title = '表格点击与编辑'; note.body = '点击单元格即可编辑；Shift+F10 打开表格选项。\n\n| 属性 | 类型 | 用途 |\n| --- | --- | --- |\n| Title | 标题 | 文章标题 |\n| Slug | 文本 | URL 路径 |\n| Status | 选项 | 发布状态 |\n\n第二张表格\n\n| 项目 | 状态 |\n| --- | --- |\n| MemoCard | 进行中 |\n| 编辑交互 | 待验证 |\n\n表格后的正文。'; }
  if (scenario === 'block-spacing') { note.title = '内容块间距检查'; note.relativePath = 'notes/内容块间距检查.md'; note.body = blockSpacingBody; }
  if (scenario === 'loading') capabilities.push('getTrash','getTrashedNote','restoreNote');
  if (scenario === 'image-loading') note.body = '<img src="../assets/loading-preview.png" width="320" height="320" alt="加载预览图片" />\n\n' + note.body;
  if (scenario === 'image-read-error') note.body += '\n\n![无法读取的模拟图片](../assets/missing.png)';
  if (scenario === 'link-error') note.body += '\n\n[[缺失笔记]]';
  if (scenario === 'tag-tree') { note.body = note.body.replace('#验收', '#验收/移动端/导航'); note.tags = ['验收/移动端/导航']; }
  let notes = scenario === 'empty' ? [] : [note];
  if (scenario === 'loading') notes = ['产品验收', '界面布局', '加载反馈', '设计笔记', '移动端记录', '桌面端记录'].map((title, index) => ({...note,id:index === 0 ? noteId : `aaaaaaaa-bbbb-4ccc-8ddd-${String(index).padStart(12,'0')}`,title:`模拟笔记 · ${title}`}));
  const propertyTagValues = new Map(notes.map(item => [item.id, ['验收']]));
  let trash:TrashItem[] = [{trashKey:'preview-trash',id:note.id,title:'模拟已删除笔记',relativePath:note.relativePath,contentHash:note.contentHash,deletedAt:note.updatedAt,preview:'此记录只存在预览内存中。'}];
  const coverage = {complete:!['partial','partial-reading','combined','index-reading','index-writing'].includes(scenario),indexed:2,pending:['partial','partial-reading','combined'].includes(scenario)?3:0,issues:scenario === 'combined'?1:0,indexedAt:'2026-10-12T08:00:00Z'};
  const status:VaultStatus = {connected:!['permission','folder-cancel','unsupported'].includes(scenario),vaultId:'preview-only-vault',vaultName:'模拟笔记库 · 不连接真实文件',phase:'M1',syncState:'local',coverage,capabilities};
  if (scenario.startsWith('index-')) status.indexing = {phase:scenario === 'index-reading'?'reading':'indexing',processed:1280,total:scenario === 'index-reading'?null:10000};
  if (scenario === 'partial-reading') status.indexing = {phase:'reading',processed:2,total:null};
  const properties:NoteProperties = {contentHash:note.contentHash,definitionHash:'preview-definitions',writable:scenario !== 'readonly',tagProperty:{name:'tags',type:'list',value:['验收'],editable:true},properties:[
    {name:'摘要',type:scenario === 'readonly'?'unsupported':'text',value:scenario === 'readonly'?'嵌套 YAML 对象':'保留原始内容',editable:scenario !== 'readonly'},
    {name:'日期',type:'date',value:'2026-10-12',editable:true},
    {name:'阶段',type:'select',value:'进行中',editable:true,options:[{name:'进行中',color:'default'},{name:'完成',color:'green'}]},
  ]};
  const drafts:Draft[] = [];
  const count = scenario === 'draft-many'?6:scenario === 'draft-versions'?2:scenario === 'combined'?3:scenario.startsWith('draft-') && !['draft-directory','draft-save-error'].includes(scenario)?1:0;
  for (let i=0;i<count;i++) drafts.push({id:scenario === 'draft-versions'?noteId:`aaaaaaaa-bbbb-4ccc-8ddd-${String(i+1).padStart(12,'0')}`,title:i === 1?'一条较长的草稿标题，用于检查窄屏下的截断和按钮排列':`保留草稿 ${i+1}`,body:`模拟草稿 ${i+1}：这段内容尚未提交，可以继续编辑。\n这里包含第二段较长的正文，用于检查卡片内容如何换行和截断。`,tags:[],baseHash:scenario === 'draft-versions'?'preview-hash':null,draftKey:`preview-draft-${i}`,revision:`preview-revision-${i}`,unscoped:scenario !== 'draft-versions',reminderDismissed:scenario === 'draft-dismissed',updatedAt:`2026-10-${String(10-i).padStart(2,'0')}T08:30:00Z`,...(scenario === 'draft-versions'?{pendingProperties:[{name:'摘要',type:'text',value:`客户端 ${i+1} 待保存内容`}]}:{})});
  const editorFailures:Record<string,[string,string]> = {
    'save-error':['IO_ERROR','文件操作未完成，请检查目录权限和文件可用性。'],
    'draft-restore-error':['IO_ERROR','文件操作未完成，请检查目录权限和文件可用性。'],
    'draft-save-error':['IO_ERROR','本机草稿暂时无法保存，请检查本机目录权限和可用空间。'],
    conflict:['HASH_CONFLICT','文件已在其他位置修改，原文未被覆盖。请保留草稿并重新读取。'],
    'source-deleted':['NOTE_NOT_FOUND','原文件已移除，不能从旧缓存恢复。'],
    'source-conflict':['SOURCE_CONFLICT','文件存在未解决的 iCloud 版本冲突，原版本均已保留。'],
    'transaction-error':['RENAME_RECOVERY_REQUIRED','保存事务期间文件被外部修改，事务记录和草稿已保留，请先处理恢复记录。'],
  };
  if (editorFailures[scenario]) drafts.push({id:noteId,title:note.title,body:note.body+'\n\n模拟未保存修改。',tags:note.tags,baseHash:note.contentHash,relativePath:note.relativePath,updatedAt:'2026-10-12T08:01:00Z'});
  let failureActive = true;
  let saves = 0;
  let queries = 0;
  const calls:string[] = [];
  async function request<T>(operation:string, params:Record<string,unknown>={}):Promise<T> {
    calls.push(operation);
    const fail = (code:string,message:string,retryable=false):never => { throw new PreviewFailure(code,message,retryable); };
    const currentCoverage = scenario === 'partial' && !failureActive ? {...coverage,complete:true,pending:0} : coverage;
    let result:unknown;
    switch (operation) {
      case 'getEnvironment':result={platform:browser?'web':'mac',storage:browser?'browser':'local-web',phase:'M1',mcpEnabled:false,capabilities};break;
      case 'getStatus':
        if (['disconnected','unauthorized'].includes(scenario)) return fail(scenario === 'disconnected'?'BRIDGE_UNAVAILABLE':'WEB_UNAUTHORIZED',scenario === 'disconnected'?'此页面连接的 MemoCard 本机服务已停止。请重新打开本机 Web；编辑中的内容仍保留在此页面。':'此页面的本机 Web 授权已失效。请重新打开本机 Web；编辑中的内容仍保留在此页面。');
        result={...status,coverage:currentCoverage};break;
      case 'queryNotes':
        queries++;
        if ((scenario === 'timeout' || scenario === 'refresh-timeout' && queries > 1) && failureActive) return fail('TIMEOUT','操作暂未完成。内容仍保留在编辑器中，请稍后重试。',true);
        result={notes:scenario === 'filter-empty' ? [] : params.query ? scenario === 'loading' ? notes.filter(item=>`${item.title ?? ''}\n${item.body}`.toLocaleLowerCase().includes(String(params.query).trim().toLocaleLowerCase())) : [] : notes,nextCursor:null,coverage:currentCoverage};break;
      case 'getNote':
        if (scenario === 'detail-loading') return new Promise<T>(() => {});
        if (scenario === 'detail-missing') return fail('NOTE_NOT_FOUND','找不到此笔记。');
        if (scenario === 'detail-error' && failureActive) return fail('NOTE_UNAVAILABLE','部分文件尚不可读取，暂时无法确认此笔记。',true);
        result=notes.find(item => item.id === params.id) ?? {...note,id:String(params.id)};break;
      case 'getDrafts':result={drafts:drafts.filter(item=>!item.unscoped),unscopedDrafts:drafts.filter(item=>item.unscoped),issues:['draft-corrupt','draft-directory','combined'].includes(scenario)?[{code:'CORRUPT_DRAFT',message:scenario === 'draft-directory'?'此恢复目录暂时无法读取，原记录已保留。':'此草稿无法读取或格式无效，原文件已保留，可从此路径检查或备份。',path:'/模拟目录/MemoCard/drafts/历史恢复目录/一条较长的损坏草稿记录.json'}]:[]} satisfies DraftList;break;
      case 'dismissDraftReminder':
        if (scenario === 'draft-reminder-error') return fail('DRAFT_CHANGED','草稿已变化，请重新查看后再选择是否提醒。',true);
        drafts.forEach(item=>{if(item.draftKey === params.draftKey)item.reminderDismissed=true;});result={reminderDismissed:true};break;
      case 'saveDraft': {
        if (scenario === 'draft-save-error' && failureActive) return fail(...editorFailures[scenario]);
        const index=drafts.findIndex(item=>item.id === params.id && item.draftKey === params.draftKey);
        const value={...structuredClone(params),updatedAt:'2026-10-12T08:40:00Z'} as Draft;
        if(index<0) drafts.push(value);else drafts[index]=value;
        result=value;break;
      }
      case 'saveNote': {
        if (editorFailures[scenario] && scenario !== 'draft-save-error' && (params.id === noteId || scenario === 'draft-restore-error') && failureActive) return fail(...editorFailures[scenario]);
        if (status.indexing) return fail('INDEXING','正在完成首次校验，内容已保留在本机草稿，校验后会自动保存。',true);
        const saved={...note,...structuredClone(params),contentHash:`preview-save-${++saves}`} as Note;
        const values = propertyTagValues.get(saved.id) ?? propertyTags(params.inheritedTags);
        propertyTagValues.set(saved.id, values);
        saved.tags = [...new Set([...values, ...inlineTags(saved.body)])];
        notes=[saved,...notes.filter(item=>item.id !== saved.id)];result=saved;break;
      }
      case 'getNoteProperties':
        if(scenario === 'property-loading') return new Promise<T>(() => {});
        if(scenario === 'property-read-error' && failureActive)return fail('INVALID_PROPERTY','属性定义配置无法读取，请检查 .memocard/property-definitions.json。');
        result={...properties,tagProperty:{...properties.tagProperty,value:propertyTagValues.get(String(params.id)) ?? []},contentHash:notes.find(item=>item.id === params.id)?.contentHash ?? properties.contentHash};break;
      case 'getPropertyLabels':result={labels:{},contentHash:'preview-labels'};break;
      case 'setPropertyLabels':result={labels:{[String(params.key)]:String(params.label)},contentHash:'preview-labels-updated'};break;
      case 'updateNoteProperty': {
        if(scenario === 'lossy-conversion' && params.definition)return fail('LOSSY_PROPERTY_CONVERSION','「notes/模拟笔记.md」的「摘要」无法无损转换。笔记库未修改，请先保留或调整原值。');
        if(['property-save-error','tag-failure'].includes(scenario) && failureActive)return fail('IO_ERROR','文件操作未完成，请检查目录权限和文件可用性。',true);
        const change=params as PropertyChange;
        if (change.name === 'tags') {
          const current = notes.find(item => item.id === params.id) ?? note;
          const values = propertyTags(change.value);
          propertyTagValues.set(current.id, values);
          const saved = {...current,tags:[...new Set([...values,...inlineTags(current.body)])],contentHash:`preview-save-${++saves}`};
          notes = notes.map(item => item.id === saved.id ? saved : item);
          result = {...saved,propertyData:{...properties,contentHash:saved.contentHash,tagProperty:{...properties.tagProperty,value:values}}};break;
        }
        properties.properties=change.remove?properties.properties.filter(item=>item.name !== change.name):properties.properties.map(item=>item.name === change.name?{...item,...change}:item);
        result={...note,contentHash:`preview-save-${++saves}`,propertyData:properties};break;
      }
      case 'listTags': {
        const counts = new Map<string, number>();
        for (const item of notes) if (!item.deletedAt) {
          const names = new Set(item.tags.flatMap(tag => tag.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))));
          for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        result={tags:[...counts].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([name,count]) => ({name,count}))};break;
      }
      case 'listFolders':result={folders:['notes']};break;
      case 'getTrash':result={notes:trash,issues:[]};break;
      case 'getTrashedNote':result={note,trashKey:'preview-trash'};break;
      case 'restoreNote':trash=[];result=note;break;
      case 'selectVault':
        if (scenario === 'folder-cancel' && !failureActive) { status.connected=true;result={vaultId:status.vaultId}; }
        else result={cancelled:true,diagnostic:'模拟：未授予文件夹访问权限'};break;
      case 'reauthorizeVault':status.connected=true;capabilities.splice(capabilities.indexOf('reauthorizeVault'),1);result={vaultId:status.vaultId};break;
      case 'pickImage':return fail('INVALID_ARGUMENT','图片不能超过 20 MB。');
      case 'resolveLink':return fail('NOTE_NOT_FOUND',scenario === 'image-read-error'?'附件尚未下载。':'找不到此笔记。');
      // Never open a real app, URL, file picker, or native operation from the preview.
      default:return fail('PREVIEW_ONLY','此操作在模拟预览中未启用。');
    }
    return structuredClone(result) as T;
  }
  return {request,calls,browser,retry:()=>{failureActive=false;},snapshot:()=>structuredClone({notes,drafts,properties})};
}
