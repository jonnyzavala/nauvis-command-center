/* NAUVIS Focus: presentation preferences and local what-if belt checks, never a second inventory. */
(function(root){
'use strict';
const MODE='nauvis-focus-mode-v1',FLOW='nauvis-focus-flow-v1';
const TIERS={yellow:900,red:1800,blue:2700,green:3600};
const cap=(n,max=1000000)=>Math.min(max,Math.max(0,Number.isFinite(Number(n))?Number(n):0));
const count=n=>Math.min(1000,Math.max(0,Math.floor(cap(n))));
const label=(s,fallback)=>String(s??'').trim().slice(0,64)||fallback;
const DEFAULT={item:'Iron plates',supply:1800,tier:'red',belts:1,lanes:2,policy:'automatic',branches:[{name:'Green circuits',demand:1200,tier:'red',belts:1,lanes:2,weight:1},{name:'Gear production',demand:600,tier:'red',belts:1,lanes:2,weight:1}]};
function normalize(s){
 const q=s&&typeof s==='object'?s:DEFAULT;
 const tier=t=>Object.hasOwn(TIERS,t)?t:'red',lanes=n=>Number(n)===1?1:2;
 return {item:label(q.item,'Resource'),supply:cap(q.supply),tier:tier(q.tier),belts:count(q.belts),lanes:lanes(q.lanes),policy:q.policy==='fixed'?'fixed':'automatic',branches:(Array.isArray(q.branches)?q.branches:DEFAULT.branches).slice(0,8).map((b,i)=>({name:label(b?.name,'Branch '+(i+1)),demand:cap(b?.demand),tier:tier(b?.tier),belts:count(b?.belts),lanes:lanes(b?.lanes),weight:cap(b?.weight,1000)}))};
}
function analyze(input){
 const s=normalize(input),capacity=TIERS[s.tier]*s.belts*s.lanes/2,incoming=Math.min(s.supply,capacity),demand=s.branches.reduce((n,b)=>n+b.demand,0);
 const rows=s.branches.map(b=>({...b,capacity:TIERS[b.tier]*b.belts*b.lanes/2,delivered:0}));
 const sumWeights=rows.reduce((n,b)=>n+b.weight,0);
 if(s.policy==='fixed'){
  for(const b of rows)b.delivered=Math.min(b.demand,b.capacity,sumWeights?incoming*b.weight/sumWeights:0);
 }else{
  // Equal splitting with demand/capacity backpressure redistribution, not a simulation of belt geometry.
  let left=incoming,active=rows.filter(b=>Math.min(b.demand,b.capacity)>0);
  for(let i=0;i<rows.length+1&&left>1e-8&&active.length;i++){
   const share=left/active.length;let used=0;
   for(const b of active){const n=Math.max(0,Math.min(share,Math.min(b.demand,b.capacity)-b.delivered));b.delivered+=n;used+=n}
   left=Math.max(0,left-used);active=active.filter(b=>Math.min(b.demand,b.capacity)-b.delivered>1e-8);
   if(used<1e-8)break;
  }
 }
 const delivered=rows.reduce((n,b)=>n+b.delivered,0),shortage=Math.max(0,demand-delivered),productionGap=Math.max(0,demand-s.supply),trunkGap=Math.max(0,Math.min(demand,s.supply)-incoming),distributionGap=Math.max(0,shortage-productionGap-trunkGap);
 return {s,capacity,incoming,demand,delivered,shortage,productionGap,trunkGap,distributionGap,unused:Math.max(0,incoming-delivered),rows:rows.map(b=>({...b,short:Math.max(0,b.demand-b.delivered),coverage:b.demand?b.delivered/b.demand:null}))};
}
function progress(projects){
 const active=(Array.isArray(projects)?projects:[]).filter(p=>p.status!=='archived');
 const items=active.flatMap(p=>Array.isArray(p.tasks)?p.tasks:[]);
 const planned=items.reduce((n,t)=>n+cap(t.planned),0),built=items.reduce((n,t)=>n+Math.min(cap(t.planned),cap(t.built)),0);
 return {active:active.length,planned,built,remaining:planned-built,pct:planned?built/planned*100:0,complete:active.filter(p=>p.tasks?.length&&p.tasks.every(t=>cap(t.planned)>0&&cap(t.built)>=cap(t.planned))).length};
}
if(typeof module==='object'&&module.exports)module.exports={TIERS,DEFAULT,normalize,analyze,progress};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1}),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode='focus',state=normalize(DEFAULT);
try{mode=localStorage.getItem(MODE)==='full'?'full':'focus';const saved=localStorage.getItem(FLOW);if(saved)state=normalize(JSON.parse(saved))}catch{}
const fullOnly=new Set(['learn','setup','balance']);
const journal=$('journalPanel'),anchor=document.createComment('Original activity journal location');journal?.before(anchor);
let lastFocus='build',lastFull='balance';
function applyMode(next,view){
 mode=next==='full'?'full':'focus';document.body.dataset.appMode=mode;
 try{localStorage.setItem(MODE,mode)}catch{}
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
 if(mode==='focus')lastFocus=['build','factory','log','flow'].includes(v)?v:'flow';else lastFull=fullOnly.has(v)||v==='logistics'?v:'balance';
 applyMode(next,next==='focus'?lastFocus:lastFull);
}
function beforeActivate(view){
 if(mode==='focus'&&fullOnly.has(view)){lastFocus=document.body.dataset.workspace||'build';applyMode('full')}
 if(mode==='full'&&(view==='log'||view==='flow'))applyMode('focus');
}
function onActivate(view){
 for(const b of document.querySelectorAll('[data-focus-view]')){
  const on=b.dataset.focusView===(view==='logistics'?'flow':view);b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 if(mode==='focus'&&['build','factory','log','flow'].includes(view))lastFocus=view;
 if(mode==='full'&&(fullOnly.has(view)||view==='logistics'))lastFull=view;
 if(view==='flow')renderResults();refresh();
}
function refresh(){
 const snap=root.NauvisLocal?.snapshot?.();if(!snap)return;
 const p=progress(snap.plan.projects),pct=Math.round(p.pct),last=(snap.plan.journal||[]).at(-1);
 const ring='<div class="focus-ring" style="--p:'+pct+'%" role="img" aria-label="'+pct+' percent built"><strong>'+pct+'%</strong><small>BUILT</small></div>';
 const html='<div class="focus-summary-top">'+ring+'<div class="focus-summary-copy"><small>CONSTRUCTION PROGRESS</small><strong>'+fmt(p.built)+' <span>/ '+fmt(p.planned)+'</span></strong><span>'+p.remaining+' remaining · '+p.active+' active projects</span></div></div><div class="focus-bar"><span style="width:'+pct+'%"></span></div>';
 if($('focusConstructionSummary'))$('focusConstructionSummary').innerHTML=html;
 if($('focusLogStats'))$('focusLogStats').innerHTML='<div><small>JOURNAL ENTRIES</small><strong>'+fmt((snap.plan.journal||[]).length)+'</strong></div><div><small>PROJECTS COMPLETE</small><strong>'+p.complete+' / '+p.active+'</strong></div>';
 if($('focusSessionNote'))$('focusSessionNote').textContent=last?last.title+' · '+last.detail:'No session notes yet. Save a short note when you finish playing.';
}
function opts(tier){return Object.entries(TIERS).map(([k,v])=>'<option value="'+k+'" '+(tier===k?'selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+' · '+fmt(v)+'/min</option>').join('')}
function field(name,k,v,type='number'){return '<label>'+esc(name)+'<input data-flow-field="'+k+'" type="'+type+'" '+(type==='number'?'min="0" max="1000000" step="any" inputmode="decimal"':'maxlength="64"')+' value="'+esc(v)+'"></label>'}
function beltFields(b,prefix){return '<label>Belt tier<select data-flow-field="'+prefix+'tier">'+opts(b.tier)+'</select></label>'+field('Belts',prefix+'belts',b.belts)+'<label>Lane usage<select data-flow-field="'+prefix+'lanes"><option value="2" '+(b.lanes===2?'selected':'')+'>Both lanes</option><option value="1" '+(b.lanes===1?'selected':'')+'>One lane</option></select></label>'}
function renderInputs(){
 const host=$('focusFlowInputs');if(!host)return;
 host.innerHTML='<div class="focus-flow-fields">'+field('Resource','item',state.item,'text')+field('Available supply / min','supply',state.supply)+beltFields(state,'')+'</div><div class="focus-flow-policy"><label>Distribution model<select data-flow-field="policy"><option value="automatic" '+(state.policy==='automatic'?'selected':'')+'>Automatic · redistribute unused capacity</option><option value="fixed" '+(state.policy==='fixed'?'selected':'')+'>Fixed shares · no redistribution</option></select></label></div><div class="focus-flow-branches">'+state.branches.map((b,i)=>'<article class="focus-branch-input"><div class="focus-branch-heading"><strong>Destination '+(i+1)+'</strong><button type="button" data-flow-remove="'+i+'" aria-label="Remove destination '+(i+1)+'">×</button></div><div class="focus-flow-fields">'+field('Name','b:'+i+':name',b.name,'text')+field('Demand / min','b:'+i+':demand',b.demand)+beltFields(b,'b:'+i+':')+(state.policy==='fixed'?field('Relative share','b:'+i+':weight',b.weight):'')+'</div></article>').join('')+'</div><div class="focus-flow-actions"><button type="button" data-flow-action="add" '+(state.branches.length>=8?'disabled':'')+'>+ Add destination</button><button type="button" data-flow-action="example">Load example</button><button type="button" data-flow-action="clear">Clear check</button></div>';
}
function saveFlow(){try{localStorage.setItem(FLOW,JSON.stringify(state))}catch{}}
function renderResults(){
 const host=$('focusFlowResults');if(!host)return;
 const a=analyze(state),pct=a.demand?Math.min(100,100*a.delivered/a.demand):0,good=a.demand>0&&a.shortage<1e-6;
 const diagnosis=!a.demand?'Enter destination demand':good?'Modeled demand covered':a.productionGap>0?'Production shortage':a.trunkGap>0?'Supply belt bottleneck':'Distribution / branch bottleneck';
 const rows=a.rows.map((b,i)=>'<div class="focus-flow-destination"><div class="focus-belt-link" style="--belt:'+({yellow:'#e5c35f',red:'#e87572',blue:'#79b5f6',green:'#91d79a'}[b.tier])+'"><span style="width:'+Math.min(100,b.capacity?100*b.delivered/b.capacity:0)+'%"></span></div><article><small>'+esc(b.name)+'</small><strong>'+fmt(b.delivered)+' <span>/ '+fmt(b.demand)+'</span></strong><div class="focus-bar '+(b.short>1e-6?'short':'')+'"><span style="width:'+(b.coverage===null?0:Math.min(100,b.coverage*100))+'%"></span></div><small>'+fmt(b.capacity)+'/min branch capacity · '+(b.short>1e-6?fmt(b.short)+'/min short':b.demand?'covered':'no demand')+'</small></article></div>').join('');
 host.innerHTML='<div class="focus-flow-metrics"><div><small>AVAILABLE SUPPLY</small><strong>'+fmt(a.s.supply)+'</strong><span>/min</span></div><div><small>TOTAL DEMAND</small><strong>'+fmt(a.demand)+'</strong><span>/min</span></div><div><small>DELIVERED</small><strong>'+fmt(a.delivered)+'</strong><span>/min</span></div></div><div class="focus-flow-report '+(good?'good':a.shortage?'warn':'')+'"><div class="focus-ring" style="--p:'+pct+'%" role="img" aria-label="'+fmt(pct)+' percent modeled coverage"><strong>'+Math.round(pct)+'%</strong><small>COVERAGE</small></div><div><h3>'+diagnosis+'</h3><p>'+(!a.demand?'No positive demand entered.':good?'Enough supply and transport in this simplified scenario.':fmt(a.shortage)+'/min total short')+'</p><small>Production gap '+fmt(a.productionGap)+' · trunk gap '+fmt(a.trunkGap)+' · branch/allocation gap '+fmt(a.distributionGap)+'</small></div></div><div class="focus-flow-diagram"><div class="focus-flow-source"><small>'+esc(a.s.item)+'</small><strong>'+fmt(a.incoming)+'/min</strong><span>of '+fmt(a.capacity)+' belt capacity</span></div><div class="focus-trunk" style="--belt:'+({yellow:'#e5c35f',red:'#e87572',blue:'#79b5f6',green:'#91d79a'}[a.s.tier])+'"></div><div class="focus-split"><span>◆</span><small>'+esc(a.s.policy==='fixed'?'Fixed allocation':'Splitter')+'</small></div><div class="focus-flow-dests">'+(rows||'<p>Add a destination to check the split.</p>')+'</div></div><p class="focus-flow-note">Unused incoming capacity: '+fmt(a.unused)+'/min. '+(a.s.policy==='fixed'?'Fixed shares are a hypothetical allocation, not a literal splitter behavior.':'Automatic assumes equal split with redistribution from backed-up branches.')+' Assumes stated supply and unstacked solid belts, no inserter, geometry, priority or fluid constraints. These are local what-if inputs, not actual Inventory.</p>';
}
$('focusFlowInputs')?.addEventListener('input',e=>{
 const k=e.target.dataset.flowField;if(!k)return;const parts=k.split(':');let v=e.target.value;
 if(parts[0]==='b'){if(state.branches[Number(parts[1])])state.branches[Number(parts[1])][parts[2]]=v}else state[k]=v;
 saveFlow();renderResults();
});
$('focusFlowInputs')?.addEventListener('change',e=>{if(!e.target.dataset.flowField)return;const policy=e.target.dataset.flowField==='policy';state=normalize(state);saveFlow();if(policy)renderInputs();renderResults()});
$('focusFlowInputs')?.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.flowRemove!==undefined)state.branches.splice(Number(b.dataset.flowRemove),1);
 else if(b.dataset.flowAction==='add'&&state.branches.length<8)state.branches.push({name:'Destination '+(state.branches.length+1),demand:0,tier:state.tier,belts:1,lanes:2,weight:1});
 else if(b.dataset.flowAction==='example')state=normalize(DEFAULT);
 else if(b.dataset.flowAction==='clear')state=normalize({...DEFAULT,item:'',supply:0,branches:[]});
 else return;
 state=normalize(state);saveFlow();renderInputs();renderResults();
});
$('focusModeToggle')?.addEventListener('click',()=>setMode(mode==='focus'?'full':'focus'));
document.querySelectorAll('[data-focus-view]').forEach(b=>b.addEventListener('click',()=>root.activateWorkspace(b.dataset.focusView,true)));
document.addEventListener('click',e=>{const b=e.target.closest('[data-focus-jump]');if(b)root.activateWorkspace(b.dataset.focusJump,true)});
root.NauvisFocus={setMode,beforeActivate,onActivate,refresh,getMode:()=>mode,analyze:()=>analyze(state)};
renderInputs();renderResults();applyMode(mode,mode==='focus'?'build':'balance');
})(typeof window==='undefined'?globalThis:window);
