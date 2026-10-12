import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { ThemeProvider } from '../src/features/theme/ThemeProvider';
import { getScenario } from './catalog';
import { mock } from './bridge';
import './styles.css';

const scenario=getScenario(new URLSearchParams(location.search).get('scenario'));
// Storage is per iframe lifetime, including preferences. Nothing survives a scenario reset.
const storage = new Map<string,string>();
Object.defineProperty(window,'localStorage',{value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{
  if(scenario.id === 'theme-storage-error')throw new Error('模拟存储不可用');
  storage.set(key,String(value));
},removeItem:(key:string)=>storage.delete(key),clear:()=>storage.clear(),key:(i:number)=>[...storage.keys()][i]??null,get length(){return storage.size;}}});
if(scenario.id === 'font-error') Object.defineProperty(window,'FontFace',{value:class {load(){return Promise.reject(new Error('模拟字体加载失败'));}}});
// Switching scenarios discards only this iframe's in-memory edits, without a real-data leave prompt.
window.addEventListener('beforeunload',event=>event.stopImmediatePropagation(),true);
createRoot(document.getElementById('root')!).render(<ThemeProvider><App /></ThemeProvider>);

// These handlers live only in the preview entry and never load in the installed app.
document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest('a,button'):null;
  if(target instanceof HTMLAnchorElement){event.preventDefault();}
  if(target?.textContent?.includes('重试') || target?.textContent === '重新加载') mock.retry();
},true);
const auto=scenario.auto ?? (['属性','确认'].includes(scenario.group)?'属性':undefined);
if(auto){
  const observer=new MutationObserver(()=>{
    if(auto === 'search'){
      const input=document.querySelector<HTMLInputElement>('input[aria-label="搜索当前视图笔记"]');
      if(!input || input.disabled)return;
      observer.disconnect();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'不存在的关键词');
      input.dispatchEvent(new Event('input',{bubbles:true}));
    } else {
      const button=[...document.querySelectorAll<HTMLButtonElement>('button')].find(item=>item.textContent === auto);
      if(!button)return;
      observer.disconnect();button.click();
    }
  });
  observer.observe(document.getElementById('root')!,{childList:true,subtree:true});
}
