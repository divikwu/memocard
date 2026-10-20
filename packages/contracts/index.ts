export type Note = {id:string; title?:string; body:string; tags:string[]; createdAt:string; updatedAt:string; deletedAt?:string; contentHash:string; relativePath:string; sourceUrl:string};
export type TrashItem = {trashKey:string; id:string; title?:string; relativePath:string; deletedAt:string; contentHash:string; preview:string};
export type TrashNote = {trashKey:string; deletedAt:string; note:Note};
export type TrashList = {notes:TrashItem[]; issues:{path:string; message:string}[]};
export type Coverage = {complete:boolean; indexed:number; pending:number; issues:number; indexedAt:string|null};
export type IndexingProgress = {phase:"reading" | "indexing"; processed:number; total:number|null};
export type VaultStatus = {connected:boolean; vaultId:string|null; vaultName:string|null; coverage:Coverage; indexing?:IndexingProgress; phase:string; syncState:string; capabilities:string[]};
export type NoteQuickFilter = "untagged" | "images" | "links";
export type NoteFilterCounts = Record<NoteQuickFilter, number>;
export type NoteQuery = {query?:string; tags?:string[]; quickFilter?:NoteQuickFilter; from?:string; to?:string; limit?:number; cursor?:string; deleted?:boolean; sort?:'createdAt' | 'updatedAt' | 'pinnedAt'; pinned?:boolean};
export type TagPreferences = {pinned:string[]; icons:Record<string,string>};
export type TagPreferenceState = TagPreferences & {contentHash:string; initialized:boolean};
export type NotePins = {pins:Record<string,string>; contentHash:string};
export type NotePage = {notes:Note[]; nextCursor:string|null; coverage:Coverage; filterCounts?:NoteFilterCounts};
export type BridgeRequest = {version:1; requestId:string; operation:string; params:Record<string,unknown>};
export type BridgeError = {code:string;message:string;retryable:boolean};
export type BridgeResponse<T = unknown> = {ok:true;data:T}|{ok:false;error:BridgeError};
export type ConnectionConfig = {version:1;host:'127.0.0.1';port:number;token:string;instanceId:string;vaultId:string};
// `list` is a legacy parsing/definition value and the reserved tags transport only.
// Custom properties expose multiSelect instead.
export type PropertyType = 'text' | 'list' | 'number' | 'date' | 'checkbox' | 'select' | 'multiSelect' | 'image';
export type PropertyOption = {name:string; color:'default' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'};
export type PropertyLabels = {labels:Record<string,string>; contentHash:string};
export type PropertyDefinition = {type:PropertyType; options?:PropertyOption[]};
export type NoteProperty = {name:string; type:PropertyType | 'unsupported'; value:string | string[] | boolean; editable:boolean; options?:PropertyOption[]};
export type NoteProperties = {properties:NoteProperty[]; tagProperty?:NoteProperty; contentHash:string; writable:boolean; definitionHash?:string};
export type PropertyUpdateResult = Note & {propertyData?:NoteProperties};
export type PropertyChange = {definition?:boolean; definitionHash?:string; optionRename?:{from:string;to:string}; name:string; renameTo?:string; copyFrom?:string; type?:PropertyType; value?:string | string[] | boolean; remove?:boolean; create?:boolean; options?:PropertyOption[]};
