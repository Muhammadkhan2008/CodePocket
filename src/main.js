// CodePocket v2.0 - main.js
// Features: AI, FTP, Git, 10 Themes, Markdown, Debug, IndexedDB

// Global error handler - prevents white screen
window.onerror = (msg, url, line) => {
  const el = document.getElementById('error-overlay');
  if (el) { el.style.display='flex'; el.querySelector('p').textContent = msg + ' (line '+line+')'; }
  console.error('CodePocket Error:', msg, url, line);
};
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled Promise:', e.reason);
});

import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { vue } from '@codemirror/lang-vue';
import { xml } from '@codemirror/lang-xml';
import { less } from '@codemirror/lang-less';
import { sass } from '@codemirror/lang-sass';
import { oneDark } from '@codemirror/theme-one-dark';
import { Compartment } from '@codemirror/state';
import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { search } from '@codemirror/search';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import * as prettier from 'prettier/standalone';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginHtml from 'prettier/plugins/html';
import prettierPluginCss from 'prettier/plugins/postcss';
import prettierEstree from 'prettier/plugins/estree';
import { AIService } from './services/ai-service.js';
import { GitService } from './services/git-service.js';
import { DebugService } from './services/debug-service.js';
import { FTPService } from './services/ftp-service.js';
import { StorageService } from './services/storage-service.js';
import { ThemeService } from './services/theme-service.js';

const LANGUAGE_MAP={js:()=>javascript(),ts:()=>javascript({typescript:true}),jsx:()=>javascript({jsx:true}),tsx:()=>javascript({jsx:true,typescript:true}),html:()=>html(),css:()=>css(),cpp:()=>cpp(),c:()=>cpp(),py:()=>python(),python:()=>python(),json:()=>json(),md:()=>markdown(),markdown:()=>markdown(),java:()=>java(),rust:()=>rust(),rs:()=>rust(),go:()=>go(),php:()=>php(),sql:()=>sql(),yaml:()=>yaml(),yml:()=>yaml(),vue:()=>vue(),xml:()=>xml(),svg:()=>xml(),less:()=>less(),scss:()=>sass(),sass:()=>sass()};
function detectLanguage(f=''){const ext=(f.split('.').pop()||'').toLowerCase();return(LANGUAGE_MAP[ext]||LANGUAGE_MAP['js'])();}
const languageCompartment=new Compartment(),wrapCompartment=new Compartment(),themeCompartment=new Compartment();
// PRootPlugin - only available on Android native build
let PRootPlugin = null;
try {
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) {
    PRootPlugin = registerPlugin('PRootPlugin');
  }
} catch(e) { PRootPlugin = null; }
const isNative = () => { try { return Capacitor.isNativePlatform(); } catch(e) { return false; } };
function renderMarkdown(t){return t.replace(/^### (.+)$/gm,'<h3 style="color:var(--accent)">'+'$1'+'</h3>').replace(/^## (.+)$/gm,'<h2 style="color:var(--accent)">'+'$1'+'</h2>').replace(/^# (.+)$/gm,'<h1 style="color:var(--accent)">'+'$1'+'</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>'+'$1'+'</strong>').replace(/\*(.+?)\*/g,'<em>'+'$1'+'</em>').replace(/\n\n/g,'<br><br>');}
window.CodePocketAPI={version:'2.0',customRunHandler:null,ai:AIService,git:GitService,debug:DebugService,ftp:FTPService,storage:StorageService,theme:ThemeService,onRun(fn){this.customRunHandler=fn;},getCode(){return FileManager.getCurrentContent();},setCode(t){EditorManager.setContent(t,FileManager.activeFile);},print(t,type='system'){TerminalManager.print(t,type);},UI:{setTheme(c){for(const[k,v]of Object.entries(c))document.documentElement.style.setProperty(k,v);},addSidebarPanel(id,title,icon,htmlContent){const nav=document.querySelector('.activity-top');const btn=document.createElement('button');btn.className='activity-icon plugin-icon';btn.setAttribute('data-panel',id);btn.title=title;btn.innerHTML=icon;nav.appendChild(btn);const panel=document.createElement('div');panel.id='panel-'+id;panel.className='side-panel hidden';panel.innerHTML='<div class="panel-header"><span>'+title.toUpperCase()+'</span></div><div class="panel-content">'+htmlContent+'</div>';document.getElementById('secondary-panel').appendChild(panel);btn.addEventListener('click',()=>{document.querySelectorAll('.activity-icon').forEach(i=>i.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.side-panel').forEach(p=>p.classList.add('hidden'));panel.classList.remove('hidden');});}},Commands:{register(id,title,cb){UIManager.customCommands=UIManager.customCommands||{};UIManager.customCommands[id]=cb;const li=document.createElement('li');li.setAttribute('data-cmd',id);li.innerHTML='🔌 '+title;document.getElementById('palette-results').appendChild(li);}}};

// ═══ FILE MANAGER ═══
const FileManager={
  files:{},activeFile:'',fileStates:{},saveTimeout:null,
  async init(){
    await StorageService.init();
    const{files}=await StorageService.getAllFiles();
    if(Object.keys(files).length>0){this.files=files;}
    else{
      this.files={
        'index.html':'<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello CodePocket v2.0! \u{1F44B}</h1>\n  <script src="script.js"><\/script>\n</body>\n</html>',
        'style.css':'body{font-family:sans-serif;background:#1e1e2e;color:#cdd6f4;margin:20px;}\nh1{color:#89b4fa;}',
        'script.js':'// CodePocket v2.0\nconsole.log("Hello World!");\nfunction greet(n){return `Hello, ${n}!`;}\nconsole.log(greet("Developer"));'
      };
      for(const[p,c]of Object.entries(this.files))await StorageService.saveFile(p,c);
    }
    this.activeFile=Object.keys(this.files)[0]||'';
    this.renderSidebar();this._bindEvents();
  },
  _bindEvents(){
    const $=id=>document.getElementById(id);
    $('action-new-file')?.addEventListener('click',()=>this.promptNewFile());
    $('welcome-new-file')?.addEventListener('click',()=>this.promptNewFile());
    $('welcome-open-folder')?.addEventListener('click',()=>$('native-folder-picker').click());
    $('action-save')?.addEventListener('click',()=>this.save());
    $('action-close')?.addEventListener('click',()=>this.closeFile());
    $('action-open-folder')?.addEventListener('click',()=>{$('native-folder-picker').click();$('dots-dropdown').classList.add('hidden');});
    $('action-find-file')?.addEventListener('click',()=>{document.querySelector('[data-panel="search"]')?.click();$('dots-dropdown').classList.add('hidden');});
    $('action-settings-menu')?.addEventListener('click',()=>{document.querySelector('[data-panel="settings"]')?.click();$('dots-dropdown').classList.add('hidden');});
    $('action-palette')?.addEventListener('click',()=>{$('dots-dropdown').classList.add('hidden');const p=$('command-palette');p.classList.toggle('hidden');if(!p.classList.contains('hidden'))$('palette-input').focus();});
    $('action-exit')?.addEventListener('click',()=>{if(window.navigator.app)navigator.app.exitApp();$('dots-dropdown').classList.add('hidden');});
    $('native-folder-picker')?.addEventListener('change',e=>{Array.from(e.target.files).forEach((file,i)=>{const r=new FileReader();r.onload=async ev=>{this.files[file.name]=ev.target.result;await StorageService.saveFile(file.name,ev.target.result);this.renderSidebar();if(i===0)this.openFile(file.name);};r.readAsText(file);});});
  },
  async save(){
    if(!this.activeFile)return TerminalManager.print('No active file.','error');
    const content=this.files[this.activeFile]||'';
    try{
      // Always save to localStorage (reliable)
      const files=JSON.parse(localStorage.getItem('codepocket_files')||'{}');
      files[this.activeFile]=content;
      localStorage.setItem('codepocket_files',JSON.stringify(files));
      // Also try IndexedDB via StorageService
      await StorageService.saveFile(this.activeFile,content);
      TerminalManager.print('✅ Saved: '+this.activeFile,'success');
    }catch(e){
      // Final fallback - download file
      const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=this.activeFile;
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
      TerminalManager.print('Downloaded: '+this.activeFile,'success');
    }
  },
  _getIcon(name){const ext=(name.split('.').pop()||'').toLowerCase();return{js:'🟨',ts:'🔷',jsx:'⚛️',tsx:'⚛️',html:'🌐',css:'🎨',scss:'🎨',less:'🎨',py:'🐍',java:'☕',cpp:'⚙️',c:'⚙️',go:'🐹',rs:'🦀',php:'🐘',sql:'🗄️',json:'📋',md:'📝',yaml:'⚙️',vue:'💚',xml:'📄',txt:'📄'}[ext]||'📄';},
  renderSidebar(){
    const list=document.getElementById('file-list');if(!list)return;list.innerHTML='';
    for(const name in this.files){
      const el=document.createElement('div');el.className='file-item'+(name===this.activeFile?' active':'');el.style.cssText='display:flex;align-items:center;justify-content:space-between;';
      const ns=document.createElement('span');ns.textContent=this._getIcon(name)+' '+name;ns.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';ns.addEventListener('click',()=>this.openFile(name));
      const db=document.createElement('button');db.textContent='🗑️';db.style.cssText='background:none;border:none;cursor:pointer;padding:0 4px;font-size:11px;opacity:0.4;flex-shrink:0;';
      db.addEventListener('mouseenter',()=>db.style.opacity='1');db.addEventListener('mouseleave',()=>db.style.opacity='0.4');
      db.addEventListener('click',async e=>{e.stopPropagation();if(confirm('Delete '+name+'?')){delete this.files[name];delete this.fileStates[name];await StorageService.deleteFile(name);const rem=Object.keys(this.files);this.activeFile=rem.length?rem[0]:'';if(this.activeFile)EditorManager.setContent(this.files[this.activeFile],this.activeFile);else{EditorManager.setContent('','');document.getElementById('welcome-screen')?.classList.remove('hidden');}this.renderSidebar();TerminalManager.print('Deleted '+name,'success');}});
      el.appendChild(ns);el.appendChild(db);list.appendChild(el);
    }
    const an=document.getElementById('active-file-name');if(an)an.textContent=this.activeFile?'- '+this.activeFile:'';
    document.getElementById('welcome-screen')?.classList.toggle('hidden',!!this.activeFile);
  },
  openFile(name){
    if(this.files[name]===undefined)return;
    if(this.activeFile&&EditorManager.view)this.fileStates[this.activeFile]=EditorManager.view.state;
    this.activeFile=name;this.renderSidebar();
    const saved=this.fileStates[name];if(saved)EditorManager.view.setState(saved);else EditorManager.setContent(this.files[name],name);
  },
  promptNewFile(){
    const name=prompt('File name (e.g. script.js):');
    if(name&&name.trim()){
      const ext=(name.split('.').pop()||'').toLowerCase();
      const tpl={html:'<!DOCTYPE html>\n<html>\n<head><title>'+name+'</title></head>\n<body>\n</body>\n</html>',css:'/* '+name+' */\n',js:'// '+name+'\n',ts:'// '+name+'\n',py:'# '+name+'\n',md:'# '+name+'\n\nContent.\n',java:'public class '+name.replace('.java','')+'{\n  public static void main(String[] args){}\n}',cpp:'#include<iostream>\nusing namespace std;\nint main(){cout<<"Hello!";return 0;}'};
      this.files[name]=tpl[ext]||'// '+name+'\n';StorageService.saveFile(name,this.files[name]);this.openFile(name);
    }
    document.getElementById('dots-dropdown')?.classList.add('hidden');
  },
  closeFile(){this.activeFile='';this.renderSidebar();EditorManager.setContent('','');document.getElementById('welcome-screen')?.classList.remove('hidden');document.getElementById('dots-dropdown')?.classList.add('hidden');},
  async updateCurrentContent(content){if(!this.activeFile)return;this.files[this.activeFile]=content;if(this.saveTimeout)clearTimeout(this.saveTimeout);this.saveTimeout=setTimeout(async()=>{await StorageService.saveFile(this.activeFile,content);},1500);},
  getCurrentContent(){return this.activeFile?(this.files[this.activeFile]||''):'';},
};

// ═══ EDITOR MANAGER ═══
const EditorManager={
  view:null,wordWrapOn:false,
  init(){
    const ul=EditorView.updateListener.of(u=>{if(u.docChanged)FileManager.updateCurrentContent(u.state.doc.toString());});
    this.view=new EditorView({doc:'',extensions:[basicSetup,wrapCompartment.of([]),themeCompartment.of(oneDark),languageCompartment.of(javascript()),autocompletion({activateOnTyping:true,maxRenderedOptions:12}),closeBrackets(),lintGutter(),search({top:true}),ul],parent:document.getElementById('editor-container')});
    ThemeService.init(themeCompartment);
    this._bindPencilTools();
    document.addEventListener('keydown',e=>{
      if(e.ctrlKey&&e.key==='s'){e.preventDefault();FileManager.save();}
      if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();const p=document.getElementById('command-palette');p.classList.toggle('hidden');if(!p.classList.contains('hidden'))document.getElementById('palette-input').focus();}
      if(e.ctrlKey&&e.key==='b'){e.preventDefault();document.getElementById('left-sidebar')?.classList.toggle('hidden-mobile');}
    });
  },
  setContent(content,filename){const lang=filename?detectLanguage(filename):javascript();this.view.dispatch({changes:{from:0,to:this.view.state.doc.length,insert:content},effects:languageCompartment.reconfigure(lang)});},
  insertText(text){this.view.dispatch({changes:{from:this.view.state.selection.main.head,insert:text}});this.view.focus();},
  _bindPencilTools(){
    const dd=document.getElementById('pencil-dropdown');if(!dd)return;
    dd.addEventListener('click',async e=>{
      if(e.target.tagName!=='BUTTON')return;
      const action=e.target.getAttribute('data-action');
      if(action==='syntax'){const k=prompt('Language (js,ts,html,css,py,java,cpp,go,rs,php,sql,yaml,vue,xml,less,scss,md):');if(k&&LANGUAGE_MAP[k.toLowerCase()]){this.view.dispatch({effects:languageCompartment.reconfigure(LANGUAGE_MAP[k.toLowerCase()]())});TerminalManager.print('Syntax → '+k,'success');}}
      else if(action==='rename'){const n=prompt('Rename to:',FileManager.activeFile);if(n&&n!==FileManager.activeFile){FileManager.files[n]=FileManager.files[FileManager.activeFile];await StorageService.deleteFile(FileManager.activeFile);delete FileManager.files[FileManager.activeFile];FileManager.openFile(n);}}
      else if(action==='newline')this.insertText('\n');
      else if(action==='wordwrap'){this.wordWrapOn=!this.wordWrapOn;this.view.dispatch({effects:wrapCompartment.reconfigure(this.wordWrapOn?EditorView.lineWrapping:[])});TerminalManager.print('Word Wrap '+(this.wordWrapOn?'ON':'OFF'));}
      else if(action==='format')await this._formatCode();
      else if(action==='lint')this._runLint();
      else if(action==='color')document.getElementById('native-color-picker')?.click();
      else if(action==='markdown-preview')this._toggleMarkdownPreview();
      else if(action==='cut')document.execCommand('cut');
      else if(action==='copy'){const sel=this.view.state.sliceDoc(this.view.state.selection.main.from,this.view.state.selection.main.to);navigator.clipboard?.writeText(sel)||document.execCommand('copy');TerminalManager.print('Copied!');}
      else if(action==='paste')navigator.clipboard?.readText().then(t=>this.insertText(t));
      else if(action==='selectall')this.view.dispatch({selection:{anchor:0,head:this.view.state.doc.length}});
      else if(action==='metrics'){const m=DebugService.getMetrics(this.view.state.doc.toString());TerminalManager.print('\u{1F4CA} Lines:'+m.totalLines+' Code:'+m.codeLines+' Functions:'+m.functions+' '+m.rating);}
      dd.classList.add('hidden');
    });
    document.getElementById('native-color-picker')?.addEventListener('input',e=>this.insertText(e.target.value));
  },
  async _formatCode(){
    const active=FileManager.activeFile;const code=this.view.state.doc.toString();
    const ext=(active?.split('.').pop()||'js').toLowerCase();
    const pm={js:'babel',jsx:'babel',ts:'babel',tsx:'babel',html:'html',css:'css',scss:'css',less:'css',json:'json'};
    const parser=pm[ext];if(!parser)return TerminalManager.print('Format not supported for .'+ext,'error');
    const pluginMap={babel:[prettierPluginBabel,prettierEstree],html:[prettierPluginHtml],css:[prettierPluginCss],json:[prettierPluginBabel,prettierEstree]};
    try{const formatted=await prettier.format(code,{parser,plugins:pluginMap[parser],tabWidth:2,semi:true,singleQuote:true});this.view.dispatch({changes:{from:0,to:this.view.state.doc.length,insert:formatted}});TerminalManager.print('✅ Formatted!','success');}
    catch(err){TerminalManager.print('Format error: '+err.message,'error');}
  },
  _runLint(){
    const code=this.view.state.doc.toString();const ext=(FileManager.activeFile?.split('.').pop()||'js').toLowerCase();
    const{issues,summary}=DebugService.lint(code,ext);
    if(!issues.length)return TerminalManager.print('✅ No issues!','success');
    TerminalManager.print('\u{1F50D} '+summary.errors+' errors, '+summary.warnings+' warnings, '+summary.infos+' hints');
    issues.slice(0,10).forEach(i=>{const icon=i.type==='error'?'🔴':i.type==='warning'?'🟡':'🔵';TerminalManager.print(icon+' Line '+i.line+': '+i.message,i.type==='error'?'error':'system');});
  },
  _toggleMarkdownPreview(){
    const active=FileManager.activeFile;if(!active?.endsWith('.md'))return TerminalManager.print('Only for .md files','error');
    const existing=document.getElementById('md-preview-panel');if(existing){existing.remove();return;}
    const panel=document.createElement('div');panel.id='md-preview-panel';
    panel.style.cssText='position:absolute;top:0;right:0;width:50%;height:100%;background:var(--bg-panel);overflow-y:auto;padding:20px;z-index:5;border-left:1px solid var(--border);';
    panel.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:15px;"><strong style="color:var(--accent)">📝 Preview</strong><button onclick="document.getElementById(\'md-preview-panel\').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px;">✖</button></div><div id="md-content" style="line-height:1.7;color:var(--text-primary);font-family:var(--font-ui);"></div>';
    document.getElementById('editor-area')?.appendChild(panel);
    document.getElementById('md-content').innerHTML=renderMarkdown(this.view.state.doc.toString());
  },
};

// ═══ JS SHELL EMULATOR (works always, no Alpine needed) ═══
const JSShell={
  cwd:'/',history:[],histIndex:-1,inputBuf:'',aliases:{},
  env:{TERM:'xterm-256color',SHELL:'/bin/jsh',USER:'coder',HOME:'/home/coder',PWD:'/'},
  prompt(){return '\x1b[32mcoder@codepocket\x1b[0m:\x1b[34m'+this.cwd+'\x1b[0m$ ';},
  _resolve(name){
    if(name in FileManager.files)return name;
    const p=(this.cwd==='/'?'':this.cwd.replace(/^\//,'')+'/')+name;
    if(p in FileManager.files)return p;
    return null;
  },
  run(cmd,term){
    cmd=cmd.trim();if(!cmd)return;
    this.history.unshift(cmd);this.histIndex=-1;
    // alias expansion
    const firstWord=cmd.split(/\s+/)[0];
    if(this.aliases[firstWord])cmd=this.aliases[firstWord]+cmd.slice(firstWord.length);
    // pipe / chained support (simple ; splitting)
    if(cmd.includes(' && ')){cmd.split(' && ').forEach(c=>this.run(c,term));return;}
    const parts=cmd.match(/(?:[^\s"]+|"[^"]*")+/g)||[];
    const c=parts[0];const args=parts.slice(1).map(a=>a.replace(/^"|"$/g,''));
    let out='';
    switch(c){
      case 'ls':case 'dir':{
        const all=Object.keys(FileManager.files||{});
        const longFmt=args.includes('-l')||args.includes('-la')||args.includes('-al');
        if(!all.length){out='\x1b[90m(empty - use: touch file.js)\x1b[0m';break;}
        if(longFmt){out=all.map(f=>{const sz=(FileManager.files[f]||'').length;return '\x1b[90m-rw-r--r-- 1 coder coder '+String(sz).padStart(6)+'\x1b[0m \x1b[36m'+f+'\x1b[0m';}).join('\r\n');}
        else{out=all.map(f=>{const ext=(f.split('.').pop()||'').toLowerCase();const icons={js:'🟨',ts:'🔷',html:'🌐',css:'🎨',py:'🐍',java:'☕',cpp:'⚙️',c:'⚙️',md:'📝',json:'📋',go:'🐹',rs:'🦀',php:'🐘',sql:'🗄️',sh:'📜',vue:'💚'};return '\x1b[36m'+(icons[ext]||'📄')+' '+f+'\x1b[0m';}).join('  ');}break;}
      case 'pwd':out=this.cwd;break;
      case 'cd':{const d=args[0]||'/';if(d==='..'){this.cwd=this.cwd.split('/').slice(0,-1).join('/')||'/';}else if(d==='~'||d==='/'){this.cwd='/';}else{this.cwd=d.startsWith('/')?d:(this.cwd==='/'?'/':this.cwd+'/')+d;}this.env.PWD=this.cwd;out='';break;}
      case 'cat':{const fname=args[0]||'';const real=this._resolve(fname);if(real!==null)out=FileManager.files[real];else out='\x1b[31mcat: '+fname+': No such file\x1b[0m';break;}
      case 'echo':{
        let text=args.join(' ');
        text=text.replace(/\$(\w+)/g,(m,k)=>this.env[k]||'');
        if(args.includes('>')||args.includes('>>')){const idx=args.findIndex(a=>a==='>'||a==='>>');const fn=args[idx+1];const content=args.slice(0,idx).join(' ');if(fn){const append=args[idx]==='>>';FileManager.files[fn]=(append&&FileManager.files[fn]?FileManager.files[fn]+'\n':'')+content;FileManager.renderSidebar?.();out='\x1b[32mWrote to '+fn+'\x1b[0m';}}
        else out=text;break;}
      case 'touch':{const fn=args[0];if(!fn){out='\x1b[31mUsage: touch <file>\x1b[0m';break;}if(!(fn in FileManager.files))FileManager.files[fn]='';FileManager.renderSidebar?.();out='\x1b[32mCreated '+fn+'\x1b[0m';break;}
      case 'mkdir':{out='\x1b[90mmkdir: virtual FS is flat (files only)\x1b[0m';break;}
      case 'cp':{const[s,d]=args;const real=this._resolve(s);if(real===null){out='\x1b[31mcp: '+s+': not found\x1b[0m';break;}FileManager.files[d]=FileManager.files[real];FileManager.renderSidebar?.();out='\x1b[32mCopied '+s+' -> '+d+'\x1b[0m';break;}
      case 'mv':{const[s,d]=args;const real=this._resolve(s);if(real===null){out='\x1b[31mmv: '+s+': not found\x1b[0m';break;}FileManager.files[d]=FileManager.files[real];delete FileManager.files[real];FileManager.renderSidebar?.();out='\x1b[32mMoved '+s+' -> '+d+'\x1b[0m';break;}
      case 'rm':case 'del':{const f=args[0];if(!f){out='\x1b[31mUsage: rm <file>\x1b[0m';break;}const real=this._resolve(f);if(real!==null){delete FileManager.files[real];FileManager.renderSidebar?.();out='\x1b[32mDeleted '+f+'\x1b[0m';}else out='\x1b[31mrm: '+f+': not found\x1b[0m';break;}
      case 'grep':{const pat=args[0];const fn=args[1];if(!pat){out='\x1b[31mUsage: grep <pattern> [file]\x1b[0m';break;}const search=(name,txt)=>{const m=[];txt.split('\n').forEach((l,i)=>{if(l.includes(pat))m.push('\x1b[36m'+name+':'+(i+1)+'\x1b[0m: '+l.replace(pat,'\x1b[33m'+pat+'\x1b[0m'));});return m;};let res=[];if(fn){const real=this._resolve(fn);if(real!==null)res=search(fn,FileManager.files[real]);}else{Object.entries(FileManager.files).forEach(([n,t])=>res.push(...search(n,t)));}out=res.length?res.join('\r\n'):'\x1b[90m(no matches)\x1b[0m';break;}
      case 'wc':{const fn=args[0];const real=this._resolve(fn);if(real===null){out='\x1b[31mwc: '+fn+': not found\x1b[0m';break;}const t=FileManager.files[real];out='  '+t.split('\n').length+' lines  '+t.split(/\s+/).filter(Boolean).length+' words  '+t.length+' chars  '+fn;break;}
      case 'head':{const fn=args[args.length-1];const real=this._resolve(fn);if(real===null){out='\x1b[31mhead: not found\x1b[0m';break;}out=FileManager.files[real].split('\n').slice(0,10).join('\r\n');break;}
      case 'tail':{const fn=args[args.length-1];const real=this._resolve(fn);if(real===null){out='\x1b[31mtail: not found\x1b[0m';break;}out=FileManager.files[real].split('\n').slice(-10).join('\r\n');break;}
      case 'find':{const pat=args[0]||'';out=Object.keys(FileManager.files).filter(f=>f.includes(pat)).map(f=>'./'+f).join('\r\n')||'\x1b[90m(none)\x1b[0m';break;}
      case 'date':out=new Date().toString();break;
      case 'whoami':out='coder';break;
      case 'hostname':out='codepocket';break;
      case 'uname':out='CodePocket JSShell 2.0 ('+(isNative()?'Android':'Web')+')';break;
      case 'history':out=this.history.slice(0,20).map((h,i)=>'  '+(i+1)+'  '+h).join('\r\n');break;
      case 'alias':{if(!args.length){out=Object.entries(this.aliases).map(([k,v])=>k+'='+v).join('\r\n')||'\x1b[90m(no aliases)\x1b[0m';}else{const[k,...v]=args.join(' ').split('=');this.aliases[k.trim()]=v.join('=').replace(/^['"]|['"]$/g,'');out='\x1b[32malias set\x1b[0m';}break;}
      case 'export':{const[k,...v]=args.join(' ').split('=');if(k)this.env[k.trim()]=v.join('=');out='';break;}
      case 'env':case 'printenv':out=Object.entries(this.env).map(([k,v])=>k+'='+v).join('\r\n');break;
      case 'clear':case 'cls':term.clear();return;
      case 'echo-color':out='\x1b[31mR\x1b[32mG\x1b[33mY\x1b[34mB\x1b[35mM\x1b[36mC\x1b[0m';break;
      case 'node':case 'js':{
        const code=args.join(' ');
        if(!code){out='\x1b[33mUsage: node <code> | Example: node 2+2\x1b[0m';break;}
        try{const logs=[];const mockConsole={log:(...a)=>logs.push(a.map(x=>typeof x==='object'?JSON.stringify(x):String(x)).join(' ')),warn:(...a)=>logs.push('\x1b[33m⚠ '+a.join(' ')+'\x1b[0m'),error:(...a)=>logs.push('\x1b[31m❌ '+a.join(' ')+'\x1b[0m')};const fn=new Function('console','return (function(){'+(code.includes('return')||code.includes(';')||code.includes('console')?code:'return '+code)+'})()');const ret=fn(mockConsole);if(ret!==undefined&&logs.length===0)logs.push(typeof ret==='object'?JSON.stringify(ret,null,2):String(ret));out=logs.length?logs.join('\r\n'):'\x1b[90m(no output)\x1b[0m';}catch(e){out='\x1b[31m'+e.message+'\x1b[0m';}break;}
      case 'python':case 'python3':case 'py':out='\x1b[33m🐍 Python needs Alpine Linux (Android only). Falling back...\x1b[0m\r\n\x1b[90mUse: node for JavaScript execution\x1b[0m';break;
      case 'calc':case 'bc':{try{out='= '+new Function('return '+args.join(' '))();}catch(e){out='\x1b[31mInvalid expression\x1b[0m';}break;}
      case 'run':{const f=args[0]||FileManager.activeFile;if(!f){out='\x1b[31mNo file to run\x1b[0m';break;}document.getElementById('run-btn')?.click();out='\x1b[32m▶ Running '+f+'\x1b[0m';break;}
      case 'open':case 'edit':{const f=args[0];if(!f){out='\x1b[31mUsage: open <file>\x1b[0m';break;}const real=this._resolve(f);if(real!==null){FileManager.openFile(real);out='\x1b[32mOpened '+f+'\x1b[0m';}else out='\x1b[31m'+f+': not found\x1b[0m';break;}
      case 'save':{FileManager.save();out='\x1b[32m✅ Saved '+(FileManager.activeFile||'none')+'\x1b[0m';break;}
      case 'new':{const n=args[0];if(!n){out='\x1b[31mUsage: new <file>\x1b[0m';break;}FileManager.files[n]='';FileManager.openFile(n);out='\x1b[32mCreated '+n+'\x1b[0m';break;}
      case 'write':{const fn=args[0];const content=args.slice(1).join(' ');if(!fn){out='\x1b[31mUsage: write <file> <content>\x1b[0m';break;}FileManager.files[fn]=content;FileManager.renderSidebar?.();out='\x1b[32mWrote '+fn+'\x1b[0m';break;}
      case 'files':out=Object.keys(FileManager.files||{}).join('\r\n')||'\x1b[90m(no files)\x1b[0m';break;
      case 'theme':{const t=args[0];if(!t){out='Available: '+ThemeService.getList().map(x=>x.id).join(', ');break;}ThemeService.apply(t,EditorManager.view);out='\x1b[32m🎨 Theme: '+t+'\x1b[0m';break;}
      case 'git':{const sub=args[0];if(sub==='status')document.getElementById('git-status-btn')?.click();else if(sub==='push')document.getElementById('git-push-btn')?.click();out='\x1b[36mgit '+(sub||'')+' → check Git panel\x1b[0m';break;}
      case 'lint':{EditorManager._runLint?.();out='\x1b[36mLinting active file...\x1b[0m';break;}
      case 'fmt':case 'format':{EditorManager._runFormat?.();out='\x1b[36mFormatting...\x1b[0m';break;}
      case 'info':out=['\x1b[36m═══ CodePocket v2.0 ═══\x1b[0m','Files: '+Object.keys(FileManager.files||{}).length,'Active: '+(FileManager.activeFile||'none'),'Platform: '+(isNative()?'Android Native':'Web/Browser'),'Alpine: '+(TerminalManager.prootAvailable?'✅ Available':'❌ Using JSShell'),'Storage: localStorage + IndexedDB'].join('\r\n');break;
      case 'neofetch':out=['\x1b[36m   ___          _\x1b[0m','\x1b[36m  / __\\___   __| | ___\x1b[0m  \x1b[33mcoder@codepocket\x1b[0m','\x1b[36m / /  / _ \\ / _` |/ _ \\\x1b[0m  \x1b[90m─────────────────\x1b[0m','\x1b[36m/ /__| (_) | (_| |  __/\x1b[0m  OS: CodePocket v2.0','\x1b[36m\\____/\\___/ \\__,_|\\___|\x1b[0m  Shell: JSShell','                         Files: '+Object.keys(FileManager.files||{}).length].join('\r\n');break;
      case 'help':case '?':
        out=['\x1b[33m═══════ CodePocket Terminal Commands ═══════\x1b[0m',
          '\x1b[36mFiles:\x1b[0m  ls, cat, touch, rm, cp, mv, find, head, tail, wc, grep',
          '\x1b[36mEditor:\x1b[0m open, edit, new, save, write, run, lint, fmt',
          '\x1b[36mCode:\x1b[0m   node <js>, calc <expr>',
          '\x1b[36mSystem:\x1b[0m pwd, cd, echo, env, export, alias, date, whoami, history',
          '\x1b[36mTools:\x1b[0m  theme <name>, git status, clear, info, neofetch',
          '\x1b[90mTip: echo text > file.txt  |  node 2+2  |  grep word\x1b[0m'].join('\r\n');break;
      case 'exit':out='\x1b[90mTerminal stays open. Use the ✕ tab button to close.\x1b[0m';break;
      default:
        out='\x1b[31m'+c+': command not found\x1b[0m \x1b[90m(type help)\x1b[0m';
    }
    if(out!=='')term.writeln('\r\n'+out);
  },
};

// ═══ TERMINAL MANAGER ═══
const TerminalManager={
  panel:null,container:null,tabsContainer:null,terminals:{},activeSessionId:null,sessionCounter:0,
  prootAvailable:false,

  async init(){
    this.panel=document.getElementById('terminal-panel');
    this.container=document.getElementById('terminal-output');
    this.tabsContainer=document.getElementById('terminal-tabs');
    if(!this.container)return;
    this.container.innerHTML='';
    this.container.style.cssText='overflow:hidden;padding:0;';

    // Try to init PRoot (Android only)
    if(isNative()&&PRootPlugin){
      try{
        PRootPlugin.addListener('terminal_output',info=>{
          if(this.terminals[info.sessionId])
            this.terminals[info.sessionId].term.write(info.data);
        });
        await PRootPlugin.initEnvironment();
        this.prootAvailable=true;
      }catch(e){
        console.warn('PRoot not available:',e.message);
        this.prootAvailable=false;
      }
    }
    this.createTerminal();
    document.getElementById('add-terminal-btn')?.addEventListener('click',()=>this.createTerminal());
  },

  async createTerminal(){
    this.sessionCounter++;
    const sessionId='term_'+this.sessionCounter;
    const tabEl=document.createElement('button');
    tabEl.innerText='Term '+this.sessionCounter;
    tabEl.style.cssText='padding:5px 10px;border:none;background:transparent;color:var(--text-secondary);cursor:pointer;outline:none;font-size:12px;';
    const termContainer=document.createElement('div');
    termContainer.style.cssText='width:100%;height:100%;display:none;';
    this.tabsContainer?.appendChild(tabEl);
    this.container.appendChild(termContainer);

    const term=new Terminal({
      theme:{background:'#0d0d0d',foreground:'#f8f8f2',cursor:'#89b4fa',
             black:'#1e1e2e',brightBlack:'#45475a',
             red:'#f38ba8',brightRed:'#f38ba8',
             green:'#a6e3a1',brightGreen:'#a6e3a1',
             yellow:'#f9e2af',brightYellow:'#f9e2af',
             blue:'#89b4fa',brightBlue:'#89b4fa',
             cyan:'#94e2d5',brightCyan:'#94e2d5'},
      fontSize:14,fontFamily:'Fira Code, Consolas, monospace',
      cursorBlink:true,scrollback:5000,
      convertEol:true,
    });
    const fitAddon=new FitAddon();
    const webLinksAddon=new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(termContainer);

    // ── Input handling ──
    const shellData={inputBuf:'',histIndex:-1};

    term.onData(data=>{
      // If native + PRoot available → send to real shell
      if(isNative()&&PRootPlugin&&this.prootAvailable){
        try{PRootPlugin.writeData({sessionId,data});return;}catch(e){}
      }

      // JS Shell mode
      const code=data.charCodeAt(0);

      if(code===13){ // Enter
        term.write('\r\n');
        const cmd=shellData.inputBuf.trim();
        shellData.inputBuf='';
        if(cmd){
          JSShell.run(cmd,term);
        }
        term.write('\r\n'+JSShell.prompt());

      }else if(code===127||code===8){ // Backspace
        if(shellData.inputBuf.length>0){
          shellData.inputBuf=shellData.inputBuf.slice(0,-1);
          term.write('\b \b');
        }

      }else if(data==='\x1b[A'){ // Up arrow - history
        if(shellData.histIndex<JSShell.history.length-1){
          shellData.histIndex++;
          const prev=JSShell.history[shellData.histIndex]||'';
          // Clear current input
          term.write('\r'+JSShell.prompt()+' '.repeat(shellData.inputBuf.length+2));
          term.write('\r'+JSShell.prompt());
          shellData.inputBuf=prev;
          term.write(prev);
        }

      }else if(data==='\x1b[B'){ // Down arrow - history
        if(shellData.histIndex>0){
          shellData.histIndex--;
          const next=JSShell.history[shellData.histIndex]||'';
          term.write('\r'+JSShell.prompt()+' '.repeat(shellData.inputBuf.length+2));
          term.write('\r'+JSShell.prompt());
          shellData.inputBuf=next;
          term.write(next);
        }

      }else if(code>=32){ // Printable chars
        shellData.inputBuf+=data;
        term.write(data);
      }
    });

    this.terminals[sessionId]={term,fitAddon,tabEl,termContainer,shellData};
    tabEl.addEventListener('click',()=>this.switchTerminal(sessionId));
    this.switchTerminal(sessionId);

    // Welcome message
    if(isNative()&&PRootPlugin&&this.prootAvailable){
      try{
        await PRootPlugin.startSession({sessionId});
        // PRoot will send its own welcome message
      }catch(e){
        this.prootAvailable=false;
        this._showJSShellWelcome(term);
      }
    }else{
      this._showJSShellWelcome(term);
    }
  },

  _showJSShellWelcome(term){
    term.writeln('\x1b[32m╔═══════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[32m║    CodePocket v2.0 Terminal           ║\x1b[0m');
    term.writeln('\x1b[32m╚═══════════════════════════════════════╝\x1b[0m');
    term.writeln('\x1b[90mType \x1b[36mhelp\x1b[90m to see all commands\x1b[0m');
    term.writeln('\x1b[90mType \x1b[36mls\x1b[90m to list files, \x1b[36mcat file.js\x1b[90m to view\x1b[0m');
    term.writeln('');
    term.write(JSShell.prompt());
  },
  switchTerminal(sessionId){
    this.activeSessionId=sessionId;
    Object.entries(this.terminals).forEach(([id,t])=>{const a=id===sessionId;t.tabEl.style.color=a?'var(--accent)':'var(--text-secondary)';t.tabEl.style.borderBottom=a?'2px solid var(--accent)':'none';t.termContainer.style.display=a?'block':'none';if(a)setTimeout(()=>{t.fitAddon.fit();t.term.focus();},50);});
  },
  print(msg,type='system'){
    if(!this.activeSessionId||!this.terminals[this.activeSessionId])return;
    const term=this.terminals[this.activeSessionId].term;
    const c={system:'\x1b[36m',error:'\x1b[31m',success:'\x1b[32m',warning:'\x1b[33m'};
    term.writeln((c[type]||c.system)+'[IDE]\x1b[0m '+msg);this.show();
  },
  hide(){this.panel?.classList.add('hidden');},
  show(){this.panel?.classList.remove('hidden');if(this.activeSessionId&&this.terminals[this.activeSessionId])setTimeout(()=>{this.terminals[this.activeSessionId].fitAddon.fit();this.terminals[this.activeSessionId].term.focus();},50);}
};

// ═══ RUN BUTTON ═══
document.getElementById('run-btn')?.addEventListener('click',async()=>{
  if(window.CodePocketAPI.customRunHandler){window.CodePocketAPI.customRunHandler(FileManager.getCurrentContent());return;}
  const active=FileManager.activeFile;const content=FileManager.getCurrentContent();
  if(!active)return TerminalManager.print('No file open.','error');
  if(active.endsWith('.html')||active.endsWith('.js')||active.endsWith('.css')){
    const ci='<scr'+'ipt>const _l=console.log,_w=console.warn,_e=console.error;console.log=(...a)=>{window.parent.postMessage({type:"console",level:"log",log:a.join(" ")},"*");_l(...a)};console.warn=(...a)=>{window.parent.postMessage({type:"console",level:"warn",log:a.join(" ")},"*");_w(...a)};console.error=(...a)=>{window.parent.postMessage({type:"console",level:"error",log:a.join(" ")},"*");_e(...a)};window.onerror=(m,u,l)=>{window.parent.postMessage({type:"error",log:m+" (line "+l+")"},"*")};<\/scr'+'ipt>';
    let hc=content;if(active.endsWith('.html'))hc=hc.includes('<head>')?hc.replace('<head>','<head>'+ci):ci+hc;else hc=ci+'<scr'+'ipt type="module">'+content+'<\/scr'+'ipt>';
    document.getElementById('webview-frame').srcdoc=hc;document.getElementById('webview-modal')?.classList.remove('hidden');TerminalManager.print('▶ Running '+active+'...');
  }else if(active.endsWith('.md')){EditorManager._toggleMarkdownPreview();}
  else if(active.endsWith('.py')||active.endsWith('.cpp')||active.endsWith('.c')){
    if(isNative()&&PRootPlugin){
      try{
        PRootPlugin.writeData({sessionId:TerminalManager.activeSessionId,data:"cat << 'CPEOF' > /root/"+active+'\n'+content+'\nCPEOF\n'});
        const cmd=active.endsWith('.py')?'python3 /root/'+active+'\n':'g++ /root/'+active+' -o /tmp/cp_out && /tmp/cp_out\n';
        setTimeout(()=>{PRootPlugin.writeData({sessionId:TerminalManager.activeSessionId,data:cmd});TerminalManager.show();},600);
      }catch(e){TerminalManager.print('Terminal error: '+e.message,'error');}
    }else{
      TerminalManager.print('🐧 Python/C++ compiler requires Android APK build with Alpine Linux.','warning');
      TerminalManager.print('💡 For JS/HTML → use Run ▶ button','system');
    }
  }else TerminalManager.print('Cannot run .'+active.split('.').pop()+' directly.','error');
});
document.getElementById('close-webview-btn')?.addEventListener('click',()=>{document.getElementById('webview-modal')?.classList.add('hidden');document.getElementById('webview-frame').srcdoc='';});
window.addEventListener('message',e=>{if(!e.data)return;if(e.data.type==='console'){const icons={log:'',warn:'⚠️',error:'❌'};TerminalManager.print((icons[e.data.level]||'')+'[Browser] '+e.data.log,e.data.level==='error'?'error':e.data.level==='warn'?'warning':'system');}if(e.data.type==='error')TerminalManager.print('❌ [Error] '+e.data.log,'error');});
document.getElementById('action-terminal')?.addEventListener('click',()=>{if(TerminalManager.panel?.classList.contains('hidden'))TerminalManager.show();else TerminalManager.hide();document.getElementById('dots-dropdown')?.classList.add('hidden');});
document.getElementById('close-terminal-btn')?.addEventListener('click',()=>TerminalManager.hide());

// ═══ SETTINGS MANAGER ═══
const SettingsManager={
  DEFAULTS:{editorFontSize:14,termFontSize:14,theme:'catppuccin-mocha',aiProvider:'gemini',aiKey:'',gitToken:'',gitOwner:'',gitRepo:''},
  load(){try{return{...this.DEFAULTS,...JSON.parse(localStorage.getItem('cp_settings')||'{}')};}catch{return{...this.DEFAULTS};}},
  save(s){try{localStorage.setItem('cp_settings',JSON.stringify(s));}catch(e){}},
  set(key,val){const s=this.load();s[key]=val;this.save(s);},
  get(key){return this.load()[key];}
};

// ═══ UI MANAGER ═══
const UIManager={
  customCommands:{},
  init(){
    this._setupActivityBar();this._setupDropdowns();this._setupPlugins();
    this._setupSettings();this._setupSearch();this._setupCommandPalette();
    this._setupMobileKeys();this._setupFTPPanel();this._setupGitPanel();
    this._setupAIPanel();this._setupThemePanel();this._setupProfile();
    document.getElementById('hamburger-btn')?.addEventListener('click',()=>document.getElementById('left-sidebar')?.classList.toggle('hidden-mobile'));
  },
  _setupActivityBar(){
    document.querySelectorAll('.activity-icon').forEach(icon=>{
      icon.addEventListener('click',()=>{const target=icon.getAttribute('data-panel');if(!target)return;document.querySelectorAll('.activity-icon').forEach(i=>i.classList.remove('active'));icon.classList.add('active');document.querySelectorAll('.side-panel').forEach(p=>p.classList.add('hidden'));document.getElementById('panel-'+target)?.classList.remove('hidden');});
    });
  },
  _setupDropdowns(){
    const toggle=(btnId,dropId)=>{document.getElementById(btnId)?.addEventListener('click',e=>{e.stopPropagation();document.querySelectorAll('.dropdown-menu').forEach(d=>{if(d.id!==dropId)d.classList.add('hidden');});document.getElementById(dropId)?.classList.toggle('hidden');});};
    toggle('pencil-btn','pencil-dropdown');toggle('dots-btn','dots-dropdown');
    document.addEventListener('click',()=>document.querySelectorAll('.dropdown-menu').forEach(d=>d.classList.add('hidden')));
  },
  _setupPlugins(){
    document.getElementById('install-plugin-btn')?.addEventListener('click',async()=>{
      const url=document.getElementById('plugin-url')?.value?.trim();if(!url)return;
      try{TerminalManager.print('📥 Loading plugin...');const res=await fetch(url);if(!res.ok)throw new Error('HTTP '+res.status);const code=await res.text();const script=document.createElement('script');script.textContent=code;document.body.appendChild(script);const li=document.createElement('li');li.textContent='✅ '+url.split('/').pop();document.getElementById('plugin-list')?.appendChild(li);TerminalManager.print('Plugin installed!','success');document.getElementById('plugin-url').value='';}
      catch(e){TerminalManager.print('Plugin Error: '+e.message,'error');}
    });
  },
  _setupSettings(){
    const s=SettingsManager.load();
    const fs=document.getElementById('setting-font-size'),fv=document.getElementById('font-size-val');
    if(fs&&fv){fs.value=s.editorFontSize;fv.innerText=s.editorFontSize;fs.addEventListener('input',e=>{const v=parseInt(e.target.value);fv.innerText=v;document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontSize=v+'px');SettingsManager.set('editorFontSize',v);});}
    const ts=document.getElementById('setting-term-font'),tv=document.getElementById('term-font-val');
    if(ts&&tv){ts.value=s.termFontSize;tv.innerText=s.termFontSize;ts.addEventListener('input',e=>{const v=parseInt(e.target.value);tv.innerText=v;Object.values(TerminalManager.terminals).forEach(({term,fitAddon})=>{term.options.fontSize=v;fitAddon?.fit();});SettingsManager.set('termFontSize',v);});}
    document.getElementById('setting-export-btn')?.addEventListener('click',async()=>{const r=await StorageService.exportProject('codepocket-project');TerminalManager.print(r.message,'success');});
    document.getElementById('full-settings-btn')?.addEventListener('click',()=>ExtSettings.show());
    document.getElementById('setting-ws-export')?.addEventListener('click',()=>{const r=WorkspaceSync.export();TerminalManager.print(r.message,'success');});
    document.getElementById('setting-deploy-btn')?.addEventListener('click',()=>CloudDeploy.showDialog());
    document.getElementById('quick-theme-toggle')?.addEventListener('click',()=>{const dark=['catppuccin-mocha','dracula','nord','tokyo-night','ayu-dark','github-dark','monokai','solarized-dark'];const cur=ThemeService.current;ThemeService.apply(dark.includes(cur)?'github-light':'catppuccin-mocha',EditorManager.view);TerminalManager.print('🌙/☀️ Theme toggled!','success');});
  },
  _setupSearch(){
    const doSearch=()=>{
      const query=document.getElementById('search-query')?.value?.trim();const results=document.getElementById('search-results');if(!query||!results)return;
      const isRegex=document.getElementById('search-regex')?.checked||false;const isCaseSensitive=document.getElementById('search-case')?.checked||false;
      let regex;try{regex=new RegExp(isRegex?query:query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),isCaseSensitive?'g':'gi');}catch(e){results.innerHTML='<p style="color:red">Invalid regex</p>';return;}
      let total=0,htmlStr='';
      for(const[fname,fcontent]of Object.entries(FileManager.files)){const lines=fcontent.split('\n');const matches=[];lines.forEach((line,i)=>{regex.lastIndex=0;if(regex.test(line)){matches.push({lineNum:i+1,text:line.replace(regex,m=>'<mark style="background:#ff0;color:#000">'+m+'</mark>')});total++;}});if(matches.length){htmlStr+='<div style="margin-bottom:8px"><div style="color:var(--accent);font-weight:bold;cursor:pointer" onclick="FileManager.openFile(\''+fname+'\')">📄 '+fname+' ('+matches.length+')</div>';matches.forEach(m=>{htmlStr+='<div style="padding:2px 0 2px 12px;font-size:12px;cursor:pointer" onclick="FileManager.openFile(\''+fname+'\')"><span style="color:var(--text-secondary)">'+m.lineNum+':</span> <code>'+m.text+'</code></div>';});htmlStr+='</div>';}}
      results.innerHTML=total?'<p style="color:var(--text-secondary)">'+total+' results</p>'+htmlStr:'<p style="color:var(--text-muted)">No results</p>';
    };
    document.getElementById('search-btn')?.addEventListener('click',doSearch);
    document.getElementById('search-query')?.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
    document.getElementById('replace-all-btn')?.addEventListener('click',()=>{const query=document.getElementById('search-query')?.value?.trim();const repl=document.getElementById('replace-query')?.value||'';if(!query)return;let count=0;for(const fname of Object.keys(FileManager.files)){const before=FileManager.files[fname];const after=before.split(query).join(repl);if(before!==after){count+=(before.split(query).length-1);FileManager.files[fname]=after;StorageService.saveFile(fname,after);if(FileManager.activeFile===fname)EditorManager.setContent(after,fname);}}TerminalManager.print('Replaced '+count+' occurrences',count?'success':'error');doSearch();});
  },
  _setupCommandPalette(){
    const palette=document.getElementById('command-palette'),input=document.getElementById('palette-input'),results=document.getElementById('palette-results');if(!palette||!input||!results)return;
    document.getElementById('close-palette-btn')?.addEventListener('click',()=>palette.classList.add('hidden'));
    input.addEventListener('input',()=>{const q=input.value.toLowerCase();results.querySelectorAll('li').forEach(li=>{li.style.display=li.textContent.toLowerCase().includes(q)?'':'none';});});
    results.addEventListener('click',e=>{const li=e.target.closest('li');if(!li)return;const cmd=li.getAttribute('data-cmd');const actions={save:()=>FileManager.save(),format:()=>EditorManager._formatCode(),lint:()=>EditorManager._runLint(),settings:()=>document.querySelector('[data-panel="settings"]')?.click(),git:()=>document.querySelector('[data-panel="git"]')?.click(),ftp:()=>document.querySelector('[data-panel="ftp"]')?.click(),ai:()=>document.querySelector('[data-panel="ai"]')?.click(),themes:()=>document.querySelector('[data-panel="themes"]')?.click(),metrics:()=>{const m=DebugService.getMetrics(EditorManager.view.state.doc.toString());TerminalManager.print('\u{1F4CA} Lines:'+m.totalLines+' Code:'+m.codeLines+' Fn:'+m.functions+' '+m.rating);},'new-file':()=>FileManager.promptNewFile(),'export':()=>StorageService.exportProject(),'md-preview':()=>EditorManager._toggleMarkdownPreview()};if(actions[cmd])actions[cmd]();else if(this.customCommands[cmd])this.customCommands[cmd]();palette.classList.add('hidden');input.value='';});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')palette.classList.add('hidden');});
  },
  _setupMobileKeys(){
    const symbolBar=document.getElementById('symbol-bar-container');
    if(window.visualViewport){window.visualViewport.addEventListener('resize',()=>{const offset=window.innerHeight-window.visualViewport.height;if(symbolBar)symbolBar.style.bottom=(offset>0?offset:0)+'px';});}
    document.getElementById('symbol-toggle-btn')?.addEventListener('click',()=>{symbolBar?.classList.toggle('collapsed');const btn=document.getElementById('symbol-toggle-btn');if(btn)btn.textContent=symbolBar?.classList.contains('collapsed')?'⌃':'⌄';});
    let mods={ctrl:false,alt:false,shift:false};
    document.querySelectorAll('.symbol-btn').forEach(btn=>{
      btn.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});btn.addEventListener('mousedown',e=>e.preventDefault());
      btn.addEventListener('click',()=>{
        if(btn.classList.contains('modifier')){const mod=btn.getAttribute('data-mod');if(mod==='esc'){if(!TerminalManager.panel?.classList.contains('hidden')&&Capacitor.isNativePlatform())PRootPlugin.writeData({sessionId:TerminalManager.activeSessionId,data:'\x1B'});else EditorManager.view.contentDOM.blur();return;}mods[mod]=!mods[mod];btn.classList.toggle('sticky-active',mods[mod]);return;}
        const char=btn.textContent;
        if(!TerminalManager.panel?.classList.contains('hidden')){const data=(mods.ctrl&&char.toLowerCase()==='c')?'\x03':char;if(Capacitor.isNativePlatform())PRootPlugin.writeData({sessionId:TerminalManager.activeSessionId,data});else TerminalManager.terminals[TerminalManager.activeSessionId]?.term.write(data);}
        else EditorManager.insertText(char);
        if(mods.ctrl||mods.alt||mods.shift){mods={ctrl:false,alt:false,shift:false};document.querySelectorAll('.symbol-btn.modifier').forEach(b=>b.classList.remove('sticky-active'));}
      });
    });
  },
  _setupFTPPanel(){
    const refreshProfiles=()=>{const sel=document.getElementById('ftp-profile-select');if(!sel)return;const profiles=FTPService.getProfiles();sel.innerHTML='<option value="">-- Load Profile --</option>';Object.keys(profiles).forEach(name=>{const opt=document.createElement('option');opt.value=name;opt.textContent=name;sel.appendChild(opt);});};
    refreshProfiles();
    document.getElementById('ftp-profile-select')?.addEventListener('change',e=>{const p=FTPService.getProfiles()[e.target.value];if(!p)return;const sv=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};sv('ftp-host',p.host||'');sv('ftp-port',p.port||21);sv('ftp-user',p.user||'');sv('ftp-protocol',p.protocol||'ftp');});
    document.getElementById('ftp-connect-btn')?.addEventListener('click',async()=>{const host=document.getElementById('ftp-host')?.value?.trim();const port=document.getElementById('ftp-port')?.value||21;const user=document.getElementById('ftp-user')?.value?.trim();const pass=document.getElementById('ftp-pass')?.value;const protocol=document.getElementById('ftp-protocol')?.value||'ftp';if(!host||!user)return TerminalManager.print('FTP: host and user required','error');const r=await FTPService.connect(host,port,user,pass,protocol);TerminalManager.print(r.message,r.ok?'success':'error');});
    document.getElementById('ftp-disconnect-btn')?.addEventListener('click',()=>{const r=FTPService.disconnect();TerminalManager.print(r.message,'success');const tree=document.getElementById('ftp-file-tree');if(tree)tree.innerHTML='';});
    document.getElementById('ftp-list-btn')?.addEventListener('click',async()=>{const path=document.getElementById('ftp-path')?.value||'/';const r=await FTPService.listFiles(path);const tree=document.getElementById('ftp-file-tree');if(!tree)return;if(!r.ok){TerminalManager.print('FTP: '+r.error,'error');return;}tree.innerHTML='';(r.files||[]).forEach(file=>{const el=document.createElement('div');el.className='file-item';const ns=document.createElement('span');ns.textContent=(file.type==='dir'?'📁':'📄')+' '+file.name;ns.style.cssText='cursor:pointer;display:block;padding:4px 0;';ns.addEventListener('click',async()=>{if(file.type==='dir'){document.getElementById('ftp-path').value=(path+'/'+file.name).replace('//','/');}else{const fr=await FTPService.readFile((path+'/'+file.name).replace('//','/'));if(fr.ok){FileManager.files[file.name]=fr.content;FileManager.openFile(file.name);TerminalManager.print('Opened: '+file.name,'success');}else TerminalManager.print('FTP: '+fr.error,'error');}});el.appendChild(ns);tree.appendChild(el);});if(!r.files?.length)tree.innerHTML='<div style="color:var(--text-muted);padding:10px">Empty</div>';});
    document.getElementById('ftp-upload-btn')?.addEventListener('click',async()=>{if(!FileManager.activeFile)return TerminalManager.print('No active file','error');const path=document.getElementById('ftp-path')?.value||'/';const r=await FTPService.writeFile((path+'/'+FileManager.activeFile).replace('//','/'),FileManager.getCurrentContent());TerminalManager.print(r.ok?r.message:r.error,r.ok?'success':'error');});
    document.getElementById('ftp-save-profile-btn')?.addEventListener('click',()=>{const name=prompt('Profile name:');if(!name)return;const r=FTPService.saveProfile(name);TerminalManager.print(r.message,'success');refreshProfiles();});
  },
  _setupGitPanel(){
    GitService.load();const s=SettingsManager.load();const sv=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    sv('git-token',s.gitToken);sv('git-owner',s.gitOwner);sv('git-repo',s.gitRepo);
    document.getElementById('git-connect-btn')?.addEventListener('click',async()=>{const token=document.getElementById('git-token')?.value?.trim();const owner=document.getElementById('git-owner')?.value?.trim();const repo=document.getElementById('git-repo')?.value?.trim();const branch=document.getElementById('git-branch')?.value?.trim()||'main';if(!token||!owner||!repo)return TerminalManager.print('Git: token, owner, repo required','error');const r=GitService.init(token,owner,repo,branch);TerminalManager.print(r.message,r.ok?'success':'error');SettingsManager.set('gitToken',token);SettingsManager.set('gitOwner',owner);SettingsManager.set('gitRepo',repo);if(r.ok){const st=await GitService.status();if(st.ok)TerminalManager.print('\u{1F4CB} '+st.repo+' | '+st.branch+' | "'+st.lastCommit+'"','success');}});
    document.getElementById('git-status-btn')?.addEventListener('click',async()=>{const r=await GitService.status();if(r.ok)TerminalManager.print('\u{1F4CB} '+r.repo+' | '+(r.private?'🔒':'🌐')+' | ⭐'+r.stars,'success');else TerminalManager.print('Git: '+r.error,'error');});
    document.getElementById('git-list-btn')?.addEventListener('click',async()=>{const path=document.getElementById('git-path')?.value||'';const r=await GitService.listFiles(path);const tree=document.getElementById('git-file-tree');if(!tree)return;if(!r.ok){TerminalManager.print('Git: '+r.error,'error');return;}tree.innerHTML='';r.files.forEach(file=>{const el=document.createElement('div');el.className='file-item';el.style.cssText='display:flex;justify-content:space-between;align-items:center;';const ns=document.createElement('span');ns.textContent=(file.type==='dir'?'📁':'📄')+' '+file.name;ns.style.cssText='flex:1;cursor:pointer;overflow:hidden;text-overflow:ellipsis;';ns.addEventListener('click',async()=>{if(file.type==='dir'){document.getElementById('git-path').value=file.path;document.getElementById('git-list-btn').click();}else{const fr=await GitService.readFile(file.path);if(fr.ok){FileManager.files[file.name]=fr.content;FileManager.openFile(file.name);TerminalManager.print('Opened: '+file.name,'success');}else TerminalManager.print('Git: '+fr.error,'error');}});const pb=document.createElement('button');pb.textContent='⬆️';pb.style.cssText='background:none;border:none;cursor:pointer;font-size:11px;';pb.addEventListener('click',async()=>{if(!FileManager.activeFile)return;const msg=prompt('Commit:','Update '+FileManager.activeFile);if(!msg)return;const pr=await GitService.writeFile(file.path,FileManager.getCurrentContent(),msg);TerminalManager.print(pr.ok?pr.message:pr.error,pr.ok?'success':'error');});el.appendChild(ns);el.appendChild(pb);tree.appendChild(el);});});
    document.getElementById('git-push-btn')?.addEventListener('click',async()=>{if(!FileManager.activeFile)return TerminalManager.print('No active file','error');const msg=prompt('Commit message:','✏️ Update '+FileManager.activeFile+' via CodePocket');if(!msg)return;const r=await GitService.writeFile(FileManager.activeFile,FileManager.getCurrentContent(),msg);TerminalManager.print(r.ok?r.message:r.error,r.ok?'success':'error');});
    document.getElementById('git-commits-btn')?.addEventListener('click',async()=>{const r=await GitService.getCommits(10);if(!r.ok)return TerminalManager.print('Git: '+r.error,'error');TerminalManager.print('\u{1F4DC} Last '+r.commits.length+' commits:');r.commits.forEach(c=>TerminalManager.print('  '+c.sha+' - '+c.message+' ('+c.author+', '+c.date+')'));});
  },
  _setupAIPanel(){
    AIService.loadApiKey();const s=SettingsManager.load();const sv=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};sv('ai-key-input',s.aiKey);sv('ai-provider-select',s.aiProvider);
    document.getElementById('ai-save-key-btn')?.addEventListener('click',()=>{const key=document.getElementById('ai-key-input')?.value?.trim();const provider=document.getElementById('ai-provider-select')?.value||'gemini';if(!key)return TerminalManager.print('Enter API key','error');AIService.setApiKey(key,provider);SettingsManager.set('aiKey',key);SettingsManager.set('aiProvider',provider);TerminalManager.print('✅ '+provider+' key saved!','success');});
    const sendMsg=async()=>{
      const input=document.getElementById('ai-input');const msg=input?.value?.trim();if(!msg)return;input.value='';
      const chat=document.getElementById('ai-chat');
      if(chat){chat.innerHTML+='<div style="background:var(--bg-hover);border-radius:8px;padding:8px 12px;margin:6px 0;max-width:85%;margin-left:auto;font-size:13px;"><strong style="color:var(--accent)">You:</strong> '+msg+'</div>';chat.innerHTML+='<div id="ai-typing" style="color:var(--text-muted);font-size:12px;padding:4px 8px">⏳ Thinking...</div>';chat.scrollTop=chat.scrollHeight;}
      const result=await AIService.chat(msg,FileManager.getCurrentContent());
      document.getElementById('ai-typing')?.remove();
      if(chat){const div=document.createElement('div');div.style.cssText='background:var(--bg-base);border-radius:8px;padding:8px 12px;margin:6px 0;max-width:95%;font-size:13px;border:1px solid var(--border);';if(result.ok){const formatted=result.reply.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,l,c)=>'<pre style="background:var(--bg-editor);padding:8px;border-radius:4px;overflow-x:auto;margin:6px 0;font-size:12px;">'+c.trim()+'</pre>');div.innerHTML='<strong style="color:#a6e3a1">AI:</strong> '+formatted;const ib=document.createElement('button');ib.textContent='Insert to Editor';ib.style.cssText='background:var(--accent);color:var(--bg-base);border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;margin-top:6px;';ib.addEventListener('click',()=>{const m=result.reply.match(/```[\w]*\n?([\s\S]*?)```/);EditorManager.insertText(m?m[1].trim():result.reply);TerminalManager.print('Inserted!','success');});div.appendChild(ib);}else div.innerHTML='<span style="color:#f38ba8">❌ '+result.error+'</span>';chat.appendChild(div);chat.scrollTop=chat.scrollHeight;}
    };
    document.getElementById('ai-send-btn')?.addEventListener('click',sendMsg);
    document.getElementById('ai-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});
    document.getElementById('ai-fix-btn')?.addEventListener('click',async()=>{const code=FileManager.getCurrentContent();if(!code)return TerminalManager.print('No code','error');TerminalManager.print('\u{1F527} AI analyzing...');const r=await AIService.fix(code);if(r.ok){const m=r.reply.match(/```[\w]*\n?([\s\S]*?)```/);if(m&&confirm('Apply AI fix?'))EditorManager.view.dispatch({changes:{from:0,to:EditorManager.view.state.doc.length,insert:m[1].trim()}});TerminalManager.print('Done!','success');}else TerminalManager.print('AI: '+r.error,'error');});
    document.getElementById('ai-explain-btn')?.addEventListener('click',async()=>{const sel=EditorManager.view.state.sliceDoc(EditorManager.view.state.selection.main.from,EditorManager.view.state.selection.main.to)||FileManager.getCurrentContent();if(!sel)return;const r=await AIService.explain(sel);if(r.ok)TerminalManager.print('\u{1F4A1} '+r.reply.slice(0,500));else TerminalManager.print('AI: '+r.error,'error');});
    document.getElementById('ai-clear-btn')?.addEventListener('click',()=>{AIService.clearHistory();const chat=document.getElementById('ai-chat');if(chat)chat.innerHTML='<p class="system-msg">AI Ready!</p>';});
  },
  _setupThemePanel(){
    const container=document.getElementById('theme-list');if(!container)return;
    ThemeService.getList().forEach(t=>{const btn=document.createElement('button');btn.style.cssText='width:100%;text-align:left;padding:8px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);cursor:pointer;margin-bottom:5px;display:flex;justify-content:space-between;align-items:center;';btn.innerHTML='<span>'+t.label+'</span><span style="font-size:11px;color:var(--text-muted)">'+t.type+'</span>';btn.addEventListener('click',()=>{ThemeService.apply(t.id,EditorManager.view);TerminalManager.print('\u{1F3A8} Theme: '+t.label,'success');container.querySelectorAll('button').forEach(b=>b.style.border='1px solid var(--border)');btn.style.border='1px solid var(--accent)';});if(ThemeService.current===t.id)btn.style.border='1px solid var(--accent)';container.appendChild(btn);});
  },

  _setupProfile(){
    // Load saved profile
    const prof=JSON.parse(localStorage.getItem('cp_profile')||'{}');
    const setVal=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    setVal('profile-name',prof.name);setVal('profile-email',prof.email);setVal('profile-github',prof.github);
    const dn=document.getElementById('profile-display-name');
    const de=document.getElementById('profile-display-email');
    if(dn)dn.textContent=prof.name||'Set your name';
    if(de)de.textContent=prof.email||'Not set';

    // Stats
    const stats=document.getElementById('profile-stats');
    if(stats){
      const files=Object.keys(FileManager.files||{});
      stats.innerHTML='📁 Files: <strong>'+files.length+'</strong><br>'+
        '💾 Storage: <strong>'+(localStorage.getItem('codepocket_files')||'').length>1000?
        Math.round((localStorage.getItem('codepocket_files')||'').length/1024)+' KB':'< 1 KB'+'</strong><br>'+
        '🎨 Theme: <strong>'+(ThemeService.current||'catppuccin-mocha')+'</strong>';
    }

    document.getElementById('profile-save-btn')?.addEventListener('click',()=>{
      const name=document.getElementById('profile-name')?.value?.trim();
      const email=document.getElementById('profile-email')?.value?.trim();
      const github=document.getElementById('profile-github')?.value?.trim();
      const profile={name,email,github,savedAt:new Date().toLocaleDateString()};
      localStorage.setItem('cp_profile',JSON.stringify(profile));
      const dn=document.getElementById('profile-display-name');
      const de=document.getElementById('profile-display-email');
      if(dn)dn.textContent=name||'Your Name';
      if(de)de.textContent=email||'Not set';
      TerminalManager.print('✅ Profile saved!','success');
    });
  },
};

// ═══════════════════════════════════════════════
// KEYBOARD SHORTCUTS MANAGER
// ═══════════════════════════════════════════════
const ShortcutManager = {
  defaults: {
    'save':          { keys: 'Ctrl+S',       action: ()=>FileManager.save() },
    'palette':       { keys: 'Ctrl+K',       action: ()=>UIManager._openPalette() },
    'palette2':      { keys: 'Ctrl+Shift+P', action: ()=>UIManager._openPalette() },
    'toggle-sidebar':{ keys: 'Ctrl+B',       action: ()=>document.getElementById('left-sidebar')?.classList.toggle('hidden-mobile') },
    'toggle-terminal':{ keys: 'Ctrl+`',      action: ()=>{ if(TerminalManager.panel?.classList.contains('hidden'))TerminalManager.show(); else TerminalManager.hide(); } },
    'new-file':      { keys: 'Ctrl+N',       action: ()=>{ const n=prompt('Filename:'); if(n){ FileManager.files[n]=''; FileManager.openFile(n); FileManager.renderSidebar(); } } },
    'close-file':    { keys: 'Ctrl+W',       action: ()=>{ if(FileManager.activeFile && confirm('Close '+FileManager.activeFile+'?')){ delete FileManager.files[FileManager.activeFile]; FileManager.renderSidebar(); } } },
    'format':        { keys: 'Ctrl+Shift+F', action: ()=>EditorManager._runFormat() },
    'find':          { keys: 'Ctrl+F',       action: ()=>{ document.querySelector('[data-panel="search"]')?.click(); document.getElementById('search-query')?.focus(); } },
    'zoom-in':       { keys: 'Ctrl+=',       action: ()=>{ const s=SettingsManager.load(); const v=Math.min(s.editorFontSize+1,32); SettingsManager.set('editorFontSize',v); document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontSize=v+'px'); } },
    'zoom-out':      { keys: 'Ctrl+-',       action: ()=>{ const s=SettingsManager.load(); const v=Math.max(s.editorFontSize-1,8); SettingsManager.set('editorFontSize',v); document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontSize=v+'px'); } },
    'theme-toggle':  { keys: 'Ctrl+Shift+T', action: ()=>{ const dark=['catppuccin-mocha','dracula','nord','tokyo-night','ayu-dark','github-dark']; const cur=ThemeService.current; ThemeService.apply(dark.includes(cur)?'github-light':'catppuccin-mocha',EditorManager.view); } },
    'run':           { keys: 'Ctrl+Enter',   action: ()=>document.getElementById('run-btn')?.click() },
    'lint':          { keys: 'Ctrl+Shift+L', action: ()=>EditorManager._runLint() },
    'ai-panel':      { keys: 'Ctrl+Shift+A', action: ()=>document.querySelector('[data-panel="ai"]')?.click() },
  },
  custom: {},

  load() {
    try { this.custom = JSON.parse(localStorage.getItem('cp_shortcuts')||'{}'); } catch(e){}
  },

  save() {
    localStorage.setItem('cp_shortcuts', JSON.stringify(this.custom));
  },

  getAll() {
    const all = {...this.defaults};
    Object.entries(this.custom).forEach(([id,keys])=>{
      if(all[id]) all[id] = {...all[id], keys};
    });
    return all;
  },

  matches(e, keysStr) {
    const parts = keysStr.split('+');
    const ctrl  = parts.includes('Ctrl');
    const shift = parts.includes('Shift');
    const alt   = parts.includes('Alt');
    const key   = parts.filter(p=>!['Ctrl','Shift','Alt'].includes(p))[0]||'';
    return e.ctrlKey===ctrl && e.shiftKey===shift && e.altKey===alt && e.key.toLowerCase()===key.toLowerCase();
  },

  attach() {
    this.load();
    document.addEventListener('keydown', e=>{
      const all = this.getAll();
      for(const [,shortcut] of Object.entries(all)) {
        if(this.matches(e, shortcut.keys) && shortcut.action) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    });
  }
};

// ═══════════════════════════════════════════════
// WORKSPACE SYNC MANAGER
// ═══════════════════════════════════════════════
const WorkspaceSync = {
  STORAGE_KEY: 'cp_workspace',

  save() {
    const ws = {
      files: FileManager.files,
      activeFile: FileManager.activeFile,
      theme: ThemeService.current,
      settings: SettingsManager.load(),
      profile: JSON.parse(localStorage.getItem('cp_profile')||'{}'),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ws));
    return ws;
  },

  load() {
    try {
      const ws = JSON.parse(localStorage.getItem(this.STORAGE_KEY)||'null');
      if (!ws) return null;
      return ws;
    } catch(e) { return null; }
  },

  export() {
    const ws = this.save();
    const blob = new Blob([JSON.stringify(ws,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'codepocket-workspace-' + Date.now() + '.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(a.href);
    return {ok:true, message:'✅ Workspace exported!'};
  },

  async import(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const ws = JSON.parse(e.target.result);
          if (ws.files) Object.assign(FileManager.files, ws.files);
          if (ws.settings) localStorage.setItem('cp_settings', JSON.stringify(ws.settings));
          if (ws.profile) localStorage.setItem('cp_profile', JSON.stringify(ws.profile));
          if (ws.theme) ThemeService.apply(ws.theme, EditorManager.view);
          FileManager.renderSidebar();
          if (ws.activeFile && FileManager.files[ws.activeFile]) FileManager.openFile(ws.activeFile);
          resolve({ok:true, message:'✅ Workspace imported!'});
        } catch(err) {
          resolve({ok:false, error:'Invalid workspace file'});
        }
      };
      reader.readAsText(file);
    });
  },

  autoSave() {
    setInterval(()=>this.save(), 30000); // every 30s
  }
};

// ═══════════════════════════════════════════════
// CLOUD DEPLOY MANAGER
// ═══════════════════════════════════════════════
const CloudDeploy = {
  async deployToGithubPages(token, owner, repo) {
    TerminalManager.print('🚀 Deploying to GitHub Pages...', 'system');
    try {
      // Get current files and create index.html if needed
      const files = FileManager.files;
      const hasHtml = Object.keys(files).some(f=>f.endsWith('.html'));
      if (!hasHtml) return { ok:false, error:'No HTML file found. Create index.html first.' };

      // Push each file to gh-pages branch via GitHub API
      const api = async (method, path, body) => {
        const r = await fetch('https://api.github.com'+path, {
          method, headers: {'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'CodePocket'},
          body: body ? JSON.stringify(body) : undefined
        });
        return r.json();
      };

      // Get or create gh-pages branch
      let branchSha = '';
      try {
        const br = await api('GET', '/repos/'+owner+'/'+repo+'/git/ref/heads/main');
        branchSha = br.object?.sha || '';
      } catch(e){}

      // Push files
      for(const [filename, content] of Object.entries(files)) {
        const info = await api('GET', '/repos/'+owner+'/'+repo+'/contents/'+filename).catch(()=>({}));
        const body = {message:'Deploy: '+filename, content:btoa(unescape(encodeURIComponent(content))), branch:'main'};
        if(info.sha) body.sha = info.sha;
        await api('PUT', '/repos/'+owner+'/'+repo+'/contents/'+filename, body);
      }

      // Enable GitHub Pages
      await api('POST', '/repos/'+owner+'/'+repo+'/pages', {source:{branch:'main',path:'/'}});

      const url = 'https://'+owner+'.github.io/'+repo+'/';
      TerminalManager.print('✅ Deployed! URL: '+url, 'success');
      return { ok:true, url };
    } catch(e) {
      return { ok:false, error: e.message };
    }
  },

  async deployToNetlify(token, siteId) {
    TerminalManager.print('🚀 Deploying to Netlify...', 'system');
    try {
      const files = {};
      const allFiles = FileManager.files;
      for(const [name,content] of Object.entries(allFiles)) {
        files['/'+name] = { content };
      }
      const r = await fetch('https://api.netlify.com/api/v1/sites'+(siteId?'/'+siteId:'')+'/deploys', {
        method:'POST',
        headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body: JSON.stringify({files})
      });
      const data = await r.json();
      if(data.deploy_url) {
        TerminalManager.print('✅ Netlify: '+data.deploy_url, 'success');
        return {ok:true, url:data.deploy_url};
      }
      return {ok:false, error: data.message||'Deploy failed'};
    } catch(e) {
      return {ok:false, error:e.message};
    }
  },

  showDialog() {
    const existingModal = document.getElementById('deploy-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'deploy-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:24px;width:90%;max-width:400px;color:var(--text-primary);">
        <h3 style="margin:0 0 16px;color:var(--accent)">🚀 Deploy Project</h3>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <select id="deploy-target" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;">
            <option value="github">GitHub Pages (free)</option>
            <option value="netlify">Netlify (free)</option>
          </select>
          <input id="deploy-token" type="password" placeholder="API Token / PAT" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;">
          <input id="deploy-owner" placeholder="GitHub username (for GH Pages)" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;">
          <input id="deploy-repo" placeholder="Repository name" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;">
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button id="deploy-submit-btn" style="flex:1;background:var(--accent);color:var(--bg-base);border:none;padding:10px;border-radius:6px;cursor:pointer;font-weight:600;">🚀 Deploy</button>
            <button onclick="document.getElementById('deploy-modal').remove()" style="flex:1;background:var(--bg-hover);color:var(--text-primary);border:none;padding:10px;border-radius:6px;cursor:pointer;">Cancel</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('deploy-submit-btn')?.addEventListener('click', async()=>{
      const target = document.getElementById('deploy-target')?.value;
      const token  = document.getElementById('deploy-token')?.value?.trim();
      const owner  = document.getElementById('deploy-owner')?.value?.trim();
      const repo   = document.getElementById('deploy-repo')?.value?.trim();
      modal.remove();
      let r;
      if (target === 'github') r = await CloudDeploy.deployToGithubPages(token, owner, repo);
      else r = await CloudDeploy.deployToNetlify(token);
      TerminalManager.print(r.ok ? '✅ '+r.url : '❌ '+r.error, r.ok?'success':'error');
    });
  }
};

// ═══════════════════════════════════════════════
// EXTENDED SETTINGS MANAGER UI
// ═══════════════════════════════════════════════
const ExtSettings = {
  show() {
    const existingModal = document.getElementById('ext-settings-modal');
    if (existingModal) existingModal.remove();

    const s = SettingsManager.load();
    const shortcuts = ShortcutManager.getAll();

    const modal = document.createElement('div');
    modal.id = 'ext-settings-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;overflow-y:auto;';

    modal.innerHTML = `
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:12px;padding:24px;width:95%;max-width:520px;max-height:90vh;overflow-y:auto;color:var(--text-primary);position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:var(--accent)">⚙️ Settings</h2>
          <button onclick="document.getElementById('ext-settings-modal').remove()" style="background:none;border:none;color:var(--text-primary);font-size:20px;cursor:pointer;">✕</button>
        </div>

        <!-- EDITOR -->
        <div class="settings-section">
          <h4 style="color:var(--accent);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;">📝 Editor</h4>
          <div class="settings-row">
            <label>Font Size <span id="ext-font-size-val">${s.editorFontSize||14}</span>px</label>
            <input type="range" id="ext-font-size" min="8" max="32" value="${s.editorFontSize||14}" style="width:120px;">
          </div>
          <div class="settings-row">
            <label>Font Family</label>
            <select id="ext-font-family" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;">
              <option value="'Fira Code', monospace" ${(s.fontFamily||'').includes('Fira')?' selected':''}>Fira Code</option>
              <option value="'JetBrains Mono', monospace" ${(s.fontFamily||'').includes('JetBrains')?' selected':''}>JetBrains Mono</option>
              <option value="'Cascadia Code', monospace" ${(s.fontFamily||'').includes('Cascadia')?' selected':''}>Cascadia Code</option>
              <option value="Consolas, monospace" ${(s.fontFamily||'').includes('Consolas')?' selected':''}>Consolas</option>
              <option value="'Courier New', monospace" ${(s.fontFamily||'').includes('Courier')?' selected':''}>Courier New</option>
              <option value="monospace" ${s.fontFamily==='monospace'?' selected':''}>System Monospace</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Tab Size</label>
            <select id="ext-tab-size" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;">
              <option value="2" ${s.tabSize===2?' selected':''}>2 spaces</option>
              <option value="4" ${(s.tabSize===4||!s.tabSize)?' selected':''}>4 spaces</option>
              <option value="8" ${s.tabSize===8?' selected':''}>8 spaces</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Word Wrap</label>
            <input type="checkbox" id="ext-word-wrap" ${s.wordWrap?' checked':''}>
          </div>
          <div class="settings-row">
            <label>Line Numbers</label>
            <input type="checkbox" id="ext-line-nums" ${s.lineNumbers!==false?' checked':''}>
          </div>
          <div class="settings-row">
            <label>Auto Save</label>
            <input type="checkbox" id="ext-auto-save" ${s.autoSave!==false?' checked':''}>
          </div>
          <div class="settings-row">
            <label>Bracket Pairs</label>
            <input type="checkbox" id="ext-brackets" ${s.brackets!==false?' checked':''}>
          </div>
          <div class="settings-row">
            <label>Minimap</label>
            <input type="checkbox" id="ext-minimap" ${s.minimap?' checked':''}>
          </div>
        </div>

        <!-- TERMINAL -->
        <div class="settings-section" style="margin-top:16px;">
          <h4 style="color:var(--accent);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;">💻 Terminal</h4>
          <div class="settings-row">
            <label>Font Size <span id="ext-term-size-val">${s.termFontSize||14}</span>px</label>
            <input type="range" id="ext-term-size" min="8" max="24" value="${s.termFontSize||14}" style="width:120px;">
          </div>
          <div class="settings-row">
            <label>Scrollback Lines</label>
            <input type="number" id="ext-scrollback" value="${s.scrollback||5000}" min="100" max="50000" style="background:var(--bg-base);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:4px 8px;width:80px;">
          </div>
          <div class="settings-row">
            <label>Cursor Blink</label>
            <input type="checkbox" id="ext-cursor-blink" ${s.cursorBlink!==false?' checked':''}>
          </div>
        </div>

        <!-- APPEARANCE -->
        <div class="settings-section" style="margin-top:16px;">
          <h4 style="color:var(--accent);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;">🎨 Appearance</h4>
          <div class="settings-row">
            <label>Quick Theme Toggle</label>
            <button onclick="ThemeService.apply(ThemeService.current==='github-light'?'catppuccin-mocha':'github-light', EditorManager.view); TerminalManager.print('Theme toggled','success');" style="background:var(--bg-hover);color:var(--text-primary);border:1px solid var(--border);border-radius:4px;padding:4px 10px;cursor:pointer;">🌙/☀️ Toggle</button>
          </div>
          <div class="settings-row">
            <label>Compact Sidebar</label>
            <input type="checkbox" id="ext-compact" ${s.compact?' checked':''}>
          </div>
        </div>

        <!-- KEYBOARD SHORTCUTS -->
        <div class="settings-section" style="margin-top:16px;">
          <h4 style="color:var(--accent);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;">⌨️ Keyboard Shortcuts</h4>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
            ${Object.entries(shortcuts).filter(([id])=>!id.includes('2')).map(([id,s])=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--bg-base);border-radius:4px;">
                <span style="color:var(--text-secondary)">${id.replace(/-/g,' ')}</span>
                <code style="background:var(--bg-editor);padding:2px 6px;border-radius:4px;color:var(--accent)">${s.keys}</code>
              </div>`).join('')}
          </div>
        </div>

        <!-- WORKSPACE -->
        <div class="settings-section" style="margin-top:16px;">
          <h4 style="color:var(--accent);margin:0 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;">💼 Workspace</h4>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="ext-ws-export" style="flex:1;background:var(--bg-hover);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;cursor:pointer;font-size:12px;">📤 Export Workspace</button>
            <button id="ext-ws-import-btn" style="flex:1;background:var(--bg-hover);color:var(--text-primary);border:1px solid var(--border);border-radius:6px;padding:8px;cursor:pointer;font-size:12px;">📥 Import Workspace</button>
            <input type="file" id="ext-ws-import" accept=".json" style="display:none;">
            <button id="ext-deploy-btn" style="flex:1;background:var(--accent);color:var(--bg-base);border:none;border-radius:6px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;">🚀 Deploy</button>
          </div>
        </div>

        <button id="ext-settings-save" style="width:100%;margin-top:20px;background:var(--accent);color:var(--bg-base);border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">💾 Save All Settings</button>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

    // Font size live preview
    document.getElementById('ext-font-size')?.addEventListener('input', e=>{
      const v=parseInt(e.target.value);
      document.getElementById('ext-font-size-val').textContent=v;
      document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontSize=v+'px');
    });

    // Term size live preview
    document.getElementById('ext-term-size')?.addEventListener('input', e=>{
      const v=parseInt(e.target.value);
      document.getElementById('ext-term-size-val').textContent=v;
      Object.values(TerminalManager.terminals).forEach(({term,fitAddon})=>{
        term.options.fontSize=v; fitAddon?.fit();
      });
    });

    // Font family live preview
    document.getElementById('ext-font-family')?.addEventListener('change', e=>{
      document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontFamily=e.target.value);
    });

    // Workspace export
    document.getElementById('ext-ws-export')?.addEventListener('click',()=>{
      const r=WorkspaceSync.export(); TerminalManager.print(r.message,'success'); modal.remove();
    });

    // Workspace import
    document.getElementById('ext-ws-import-btn')?.addEventListener('click',()=>{
      document.getElementById('ext-ws-import')?.click();
    });
    document.getElementById('ext-ws-import')?.addEventListener('change', async e=>{
      if(!e.target.files[0]) return;
      const r=await WorkspaceSync.import(e.target.files[0]);
      TerminalManager.print(r.ok?r.message:'❌ '+r.error, r.ok?'success':'error');
      modal.remove();
    });

    // Deploy
    document.getElementById('ext-deploy-btn')?.addEventListener('click',()=>{ modal.remove(); CloudDeploy.showDialog(); });

    // Save settings
    document.getElementById('ext-settings-save')?.addEventListener('click',()=>{
      const newSettings = {
        editorFontSize: parseInt(document.getElementById('ext-font-size')?.value||14),
        termFontSize:   parseInt(document.getElementById('ext-term-size')?.value||14),
        fontFamily:     document.getElementById('ext-font-family')?.value || "'Fira Code', monospace",
        tabSize:        parseInt(document.getElementById('ext-tab-size')?.value||4),
        wordWrap:       document.getElementById('ext-word-wrap')?.checked,
        lineNumbers:    document.getElementById('ext-line-nums')?.checked,
        autoSave:       document.getElementById('ext-auto-save')?.checked,
        brackets:       document.getElementById('ext-brackets')?.checked,
        minimap:        document.getElementById('ext-minimap')?.checked,
        scrollback:     parseInt(document.getElementById('ext-scrollback')?.value||5000),
        cursorBlink:    document.getElementById('ext-cursor-blink')?.checked,
        compact:        document.getElementById('ext-compact')?.checked,
      };
      const cur = SettingsManager.load();
      SettingsManager.save({...cur,...newSettings});

      // Apply immediately
      document.querySelectorAll('.cm-editor').forEach(el=>{
        el.style.fontSize = newSettings.editorFontSize + 'px';
        el.style.fontFamily = newSettings.fontFamily;
      });
      if(newSettings.compact) document.getElementById('activity-bar')?.classList.add('compact');
      else document.getElementById('activity-bar')?.classList.remove('compact');

      TerminalManager.print('✅ Settings saved!','success');
      modal.remove();
    });
  }
};

// ═══ BOOTSTRAP ═══
(async()=>{
  await FileManager.init();
  EditorManager.init();
  await TerminalManager.init();
  UIManager.init();
  ShortcutManager.attach();
  WorkspaceSync.autoSave();
  if(FileManager.activeFile)EditorManager.setContent(FileManager.files[FileManager.activeFile],FileManager.activeFile);

  // Apply saved settings on boot
  const s = SettingsManager.load();
  if(s.editorFontSize) document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontSize=s.editorFontSize+'px');
  if(s.fontFamily)     document.querySelectorAll('.cm-editor').forEach(el=>el.style.fontFamily=s.fontFamily);
  if(s.theme)          ThemeService.apply(s.theme, EditorManager.view);

  // Wire full settings button
  document.getElementById('full-settings-btn')?.addEventListener('click',()=>ExtSettings.show());

  // Wire deploy button in command palette
  document.querySelectorAll('[data-cmd="deploy"]').forEach(el=>el.addEventListener('click',()=>{ document.getElementById('palette-modal')?.classList.add('hidden'); CloudDeploy.showDialog(); }));

  TerminalManager.print('✅ CodePocket v2.0 ready! Type help in terminal','success');
  TerminalManager.print('⌨️  Ctrl+K = palette | Ctrl+S = save | Ctrl+` = terminal','system');
})();
