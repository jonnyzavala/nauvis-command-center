/* NAUVIS Focus: presentation preferences, construction summary, and embedded network. */
(function(root){
'use strict';
const MODE='nauvis-focus-mode-v1';
const cap=(n,max=1000000)=>Math.min(max,Math.max(0,Number.isFinite(Number(n))?Number(n):0));
function progress(projects){
 const active=(Array.isArray(projects)?projects:[]).filter(p=>p.status!=='archived');
 const items=active.flatMap(p=>Array.isArray(p.tasks)?p.tasks:[]);
 const planned=items.reduce((n,t)=>n+cap(t.planned),0),built=items.reduce((n,t)=>n+Math.min(cap(t.planned),cap(t.built)),0);
 return {active:active.length,planned,built,remaining:planned-built,pct:planned?built/planned*100:0,complete:active.filter(p=>p.tasks?.length&&p.tasks.every(t=>cap(t.planned)>0&&cap(t.built)>=cap(t.planned))).length};
}
if(typeof module==='object'&&module.exports)module.exports={progress};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
let mode='focus';
try{mode=localStorage.getItem(MODE)==='full'?'full':'focus'}catch{}
const fullOnly=new Set(['learn','setup','balance']);
const journal=$('journalPanel'),anchor=document.createComment('Original activity journal location');journal?.before(anchor);
const network=$('logistics'),networkAnchor=document.createComment('Full mode network location');network.before(networkAnchor);
let lastFocus='build',lastFull='balance';
function applyMode(next,view){
 mode=next==='full'?'full':'focus';document.body.dataset.appMode=mode;
 try{localStorage.setItem(MODE,mode)}catch{}
 if(mode==='focus'){network.classList.remove('view','active');$('plannerNetworkHost').append(network)}else{networkAnchor.after(network);network.classList.add('view');network.classList.toggle('active',document.body.dataset.workspace==='logistics')}
 if(journal){if(mode==='focus'){$('focusLogHost').append(journal);journal.open=true}else{anchor.after(journal)}}
 $('focusModeToggle').textContent=mode==='focus'?'Full mode':'Focus mode';
 $('focusModeToggle').setAttribute('aria-label',mode==='focus'?'Switch to Full Command Center':'Switch to Focus Mode');
 $('focusModeToggle').setAttribute('aria-pressed',String(mode==='focus'));
 $('focusModeToggle').title=mode==='focus'?'Full Command Center':'Focus Mode';
 if(view)root.activateWorkspace(view,true);
}
function setMode(next){
 if(next===mode)return;
 const v=document.body.dataset.workspace;
 if(mode==='focus')lastFocus=['build','factory','log'].includes(v)?v:'build';else lastFull=fullOnly.has(v)||v==='logistics'?v:'balance';
 applyMode(next,next==='focus'?lastFocus:lastFull);
}
function beforeActivate(view){
 if(mode==='focus'&&fullOnly.has(view)){lastFocus=document.body.dataset.workspace||'build';applyMode('full')}
 if(mode==='full'&&view==='log')applyMode('focus');
}
function onActivate(view){
 for(const b of document.querySelectorAll('[data-focus-view]')){
  const on=b.dataset.focusView===(view==='logistics'&&mode==='focus'?'build':view);b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 if(mode==='focus'&&['build','factory','log'].includes(view))lastFocus=view;
 if(mode==='full'&&(fullOnly.has(view)||view==='logistics'))lastFull=view;
 refresh();
}
function refresh(){
 const snap=root.NauvisLocal?.snapshot?.();if(!snap)return;
 const p=progress(snap.plan.projects),pct=Math.round(p.pct),last=(snap.plan.journal||[]).at(-1);
 const ring='<div class="focus-ring" style="--p:'+pct+'%" role="img" aria-label="'+pct+' percent built"><strong>'+pct+'%</strong><small>BUILT</small></div>';
 const html='<div class="focus-summary-top">'+ring+'<div class="focus-summary-copy"><small>CONSTRUCTION PROGRESS</small><strong>'+fmt(p.built)+' <span>/ '+fmt(p.planned)+'</span></strong><span>'+p.remaining+' remaining · '+p.active+' active projects</span></div></div><div class="focus-bar"><span style="width:'+pct+'%"></span></div>'+(p.complete>0?'<div class="focus-complete">🏆 '+p.complete+' project'+(p.complete===1?'':'s')+' complete</div>':'');
 if($('focusConstructionSummary'))$('focusConstructionSummary').innerHTML=html;
 if($('focusLogStats'))$('focusLogStats').innerHTML='<div><small>JOURNAL ENTRIES</small><strong>'+fmt((snap.plan.journal||[]).length)+'</strong></div><div><small>PROJECTS COMPLETE</small><strong>'+p.complete+' / '+p.active+'</strong></div>';
 if($('focusSessionNote'))$('focusSessionNote').textContent=last?last.title+' · '+last.detail:'No session notes yet. Save a short note when you finish playing.';
}
function showTool(id){
 if(document.body.dataset.workspace!=='build')root.activateWorkspace('build',false);
 const panel=$(id);panel.open=true;
 panel.scrollIntoView({block:'start',behavior:'instant'});
}
function openNetwork(){showTool('plannerNetwork');root.NauvisLogistics?.render?.()}
$('focusModeToggle')?.addEventListener('click',()=>setMode(mode==='focus'?'full':'focus'));
document.querySelectorAll('[data-focus-view]').forEach(b=>b.addEventListener('click',()=>root.activateWorkspace(b.dataset.focusView,true)));
document.addEventListener('click',e=>{const b=e.target.closest('[data-focus-jump]');if(b)root.activateWorkspace(b.dataset.focusJump,true)});
$('plannerNetwork')?.addEventListener('toggle',e=>{if(e.target.open&&mode==='focus')root.NauvisLogistics?.render?.()});
root.NauvisFocus={setMode,beforeActivate,onActivate,refresh,openNetwork,getMode:()=>mode};
// Safari may expose a visual viewport smaller than the fixed layout viewport.
const dock=$('commandDock');
function pinDock(){const vv=root.visualViewport;if(!dock)return;const offset=vv&&vv.scale===1?Math.max(0,document.documentElement.clientHeight-vv.height-vv.offsetTop):0;dock.style.setProperty('--dock-viewport-offset',offset+'px')}
root.visualViewport?.addEventListener('resize',pinDock,{passive:true});root.visualViewport?.addEventListener('scroll',pinDock,{passive:true});root.addEventListener('resize',pinDock,{passive:true});pinDock();
applyMode(mode,mode==='focus'?'build':'balance');
})(typeof window==='undefined'?globalThis:window);
