import { useEffect, useLayoutEffect, useRef } from 'react';
import { Extension, Node, useEditor, type Editor } from '@tiptap/react';
import { closeHistory, history, redo, undo } from '@tiptap/pm/history';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { RichInlineTags } from './rich-inline-tags';

// Keep quick capture's plain Markdown source, with the page editor's editable tag decorations.
const CaptureDocument=Node.create({name:'doc',topNode:true,content:'text*',whitespace:'pre'});
const CaptureText=Node.create({name:'text',group:'inline'});
const CaptureEditing=Extension.create({
  name:'captureEditing',
  addProseMirrorPlugins:()=>[history()],
  addCommands(){return {
    undo:()=>({state,dispatch})=>undo(state,dispatch),
    redo:()=>({state,dispatch})=>redo(state,dispatch),
  };},
  addKeyboardShortcuts(){return {
    Enter:()=>this.editor.commands.insertContent({type:'text',text:'\n'}),
    'Mod-z':()=>undo(this.editor.state,this.editor.view.dispatch),
    'Shift-Mod-z':()=>redo(this.editor.state,this.editor.view.dispatch),
    'Mod-y':()=>redo(this.editor.state,this.editor.view.dispatch),
  };},
});

export type CaptureEditorProps = {
  value:string; tags:string[]; resetKey:string; disabled:boolean; field:React.RefObject<HTMLDivElement | null>; editorRef:React.RefObject<Editor | null>;
  onChange:(value:string)=>void; onSave:()=>void;
};

export function useCaptureEditor({value,resetKey,disabled,field,editorRef,onChange,onSave,className='quick-capture-textarea quick-capture-editor-content'}: CaptureEditorProps & {className?:string}) {
  const latest=useRef({onChange,onSave});latest.current={onChange,onSave};
  const identity=useRef(resetKey);
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[CaptureDocument,CaptureText,CaptureEditing,RichInlineTags],
    content:{type:'doc',content:value ? [{type:'text',text:value}] : []},
    editable:!disabled,
    editorProps:{
      attributes:{role:'textbox','aria-label':'快速输入内容','aria-multiline':'true',class:className},
      handleKeyDown(view,event){
        if(event.isComposing || event.keyCode===229 || view.composing)return false;
        if(!event.repeat && (event.metaKey || event.ctrlKey) && event.key==='Enter'){event.preventDefault();latest.current.onSave();return true;}
        return false;
      },
      handlePaste(view,event){
        const text=event.clipboardData?.getData('text/plain');
        if(!text)return false;
        view.dispatch(closeHistory(view.state.tr).insertText(text).scrollIntoView().setMeta('uiEvent','paste'));
        return true;
      },
    },
    onUpdate:({editor})=>latest.current.onChange(editor.state.doc.textContent),
  });
  useLayoutEffect(()=>{
    if(!editor)return;
    field.current=editor.view.dom as HTMLDivElement;editorRef.current=editor;
    return()=>{field.current=null;editorRef.current=null;};
  },[editor,field,editorRef]);
  useLayoutEffect(()=>{
    if(!editor)return;
    if(identity.current!==resetKey){
      identity.current=resetKey;
      const doc=editor.schema.nodeFromJSON({type:'doc',content:value ? [{type:'text',text:value}] : []});
      editor.view.updateState(EditorState.create({doc,plugins:editor.state.plugins}));
      return;
    }
    if(editor.state.doc.textContent===value)return;
    const tr=closeHistory(editor.state.tr).replaceWith(0,editor.state.doc.content.size,value ? editor.schema.text(value) : []);
    tr.setSelection(TextSelection.create(tr.doc,Math.min(editor.state.selection.from,tr.doc.content.size)));
    editor.view.dispatch(tr.setMeta('preventUpdate',true));
  },[editor,value,resetKey]);
  useEffect(()=>{if(editor){editor.setEditable(!disabled,false);editor.view.dom.setAttribute('aria-disabled',String(disabled));}},[editor,disabled]);
  return editor;
}
