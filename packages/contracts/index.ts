export type Note = {id:string; body:string; tags:string[]; createdAt:string; updatedAt:string; deletedAt?:string; contentHash:string; relativePath:string; sourceUrl:string};
export type Coverage = {complete:boolean; indexed:number; pending:number; issues:number; indexedAt:string|null};
export type VaultStatus = {connected:boolean; vaultId:string|null; vaultName:string|null; coverage:Coverage; phase:string; syncState:string; capabilities:string[]};
export type NoteQuery = {query?:string; tags?:string[]; from?:string; to?:string; limit?:number; cursor?:string; deleted?:boolean};
export type NotePage = {notes:Note[]; nextCursor:string|null; coverage:Coverage};
export type BridgeRequest = {version:1; requestId:string; operation:string; params:Record<string,unknown>};
export type BridgeError = {code:string;message:string;retryable:boolean};
export type BridgeResponse<T = unknown> = {ok:true;data:T}|{ok:false;error:BridgeError};
export type ConnectionConfig = {version:1;host:'127.0.0.1';port:number;token:string;instanceId:string;vaultId:string};
