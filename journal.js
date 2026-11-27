/* NAUVIS v0.25 · Local-first change journal.
   Appends to existing plan JSON; never modifies project counts or Factory inventory. */
(function(root){
'use strict';
const MAX_ENTRIES=250;
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validCount=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
const name=id=>typeof R==='object'&&R[id]?.[0]||String(id||'Unknown item').replace(/-/g,' ');
const noun=kind=>kind==='chem'?'chemical plant':kind==='furnace'?'furnace':'assembler';
function normalizeJournal(value){
 if(!Array.isArray(value))return [];
 const seen=new Set();
 return value.filter(x=>{
  if(!x||typeof x!=='object'||typeof x.id!=='string'||!x.id||seen.has(x.id)||typeof x.title!=='string')return false;
  seen.add(x.id);return true;
 }).slice(-MAX_ENTRIES);
}
function snapshotsEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function groupedMachines(arr){
 const grouped=new Map();
 for(const r of Array.isArray(arr)?arr:[]){
  if(!r?.recipe)continue;
  const key=[r.recipe,r.tier||'none',r.destination||'Other',r.projectId||'',r.projectTask||''].join('|');
  const item=grouped.get(key)||{recipe:r.recipe,tier:r.tier,destination:r.destination||'Other',projectId:r.projectId||'',count:0};
  item.count+=validCount(r.count);grouped.set(key,item);
 }
 return grouped;
}
function summarizeSetupDelta(before,after){
 const events=[];
 const a=groupedMachines(before.machines),b=groupedMachines(after.machines);
 const all=new Set([...a.keys(),...b.keys()]);
 for(const key of all){
  const old=a.get(key),now=b.get(key),one=now||old;
  const diff=(now?.count||0)-(old?.count||0);
  if(Math.abs(diff)<1e-8)continue;
  events.push({
   type:'inventory',recipe:one.recipe,
   title:(diff>0?'Added ':'Removed ')+Math.abs(diff)+' '+name(one.recipe)+' '+noun(typeof R==='object'&&R[one.recipe]?.[3]),
   detail:(diff>0?'+':'')+diff+' machines · '+(one.destination||'Other')+
    (one.projectId?' · linked to a project':' · manual Factory entry'),
   delta:diff,source:'Factory',before:old?.count||0,after:now?.count||0,
   projectId:one.projectId||null
  });
 }
 const oldAssets=new Map((Array.isArray(before.assets)?before.assets:[]).filter(x=>x?.id).map(x=>[x.id,x]));
 const newAssets=new Map((Array.isArray(after.assets)?after.assets:[]).filter(x=>x?.id).map(x=>[x.id,x]));
 for(const id of new Set([...oldAssets.keys(),...newAssets.keys()])){
  const old=oldAssets.get(id),now=newAssets.get(id),a=now||old;
  const delta=(now?.count||0)-(old?.count||0);
  if(delta!==0){
   events.push({type:'asset',source:'Factory',recipe:a.recipe,
    title:(delta>0?'Added ':'Removed ')+Math.abs(delta)+' placed '+name(a.recipe),
    detail:(a.area||'Nauvis')+' · '+(a.category||'Infrastructure')+
     (a.projectId?' · linked deployment':' · manual record')+
     (a.verified?' · verified in-game':' · not verified'),
    delta,before:old?.count||0,after:now?.count||0,projectId:a.projectId||null});
  }else if(JSON.stringify(old||null)!==JSON.stringify(now||null)){
   events.push({type:'asset',source:'Factory',recipe:a.recipe,title:'Updated '+name(a.recipe)+' infrastructure record',
    detail:(a.area||'Nauvis')+' · '+(a.verified?'verified':'unverified')+' · '+(a.note||'no note'),
    before:old?.count??null,after:now?.count??null,projectId:a.projectId||null});
  }
 }
 const fa=JSON.stringify(before.feeds||[]),fb=JSON.stringify(after.feeds||[]);
 if(fa!==fb)events.push({type:'routing',title:'Updated belt routing',detail:'Recorded belt resources, counts, or destinations changed.',source:'Factory',before:before.feeds?.length||0,after:after.feeds?.length||0});
 const keys=[['smelt','Smelting settings'],['oil','Oil processing settings']];
 for(const [key,label] of keys){
  const x=before[key]||{},y=after[key]||{};
  if(snapshotsEqual(x,y))continue;
  const diffs=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>k!=='projectBuilt'&&JSON.stringify(x[k])!==JSON.stringify(y[k]));
  if(!diffs.length)continue;
  const detail=diffs.slice(0,5).map(k=>k==='profiles'?'Furnace profiles: '+(x[k]?.length||0)+' → '+(y[k]?.length||0)+' groups (settings updated)':k+': '+(x[k]??'—')+' → '+(y[k]??'—')).join(' · ')+(diffs.length>5?' · +'+(diffs.length-5)+' more':'');
  events.push({type:'infrastructure',title:label+' updated',detail,source:'Factory'});
 }
 return events;
}
if(typeof module==='object'&&module.exports)
 module.exports={normalizeJournal,groupedMachines,summarizeSetupDelta,MAX_ENTRIES};
if(typeof document==='undefined')return;
let baseline=JSON.stringify(setup);
const getJournal=()=>normalizeJournal(factory.journal);
function nextID(){return 'j_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,11)}
function persistPlan(){try{localStorage.setItem(fkey,JSON.stringify(factory))}catch(e){}}
function record(entry,opts={}){
 if(root.NauvisCloudApplying)return null;
 if(!entry?.title)return null;
 const obj={
  id:nextID(),at:new Date().toISOString(),type:String(entry.type||'note'),
  source:String(entry.source||'Manual'),title:String(entry.title).slice(0,160),
  detail:String(entry.detail||'').slice(0,600),
  recipe:entry.recipe||null,projectId:entry.projectId||null,
  delta:Number.isFinite(Number(entry.delta))?Number(entry.delta):null,
  before:entry.before??null,after:entry.after??null
 };
 factory.journal=[...getJournal(),obj].slice(-MAX_ENTRIES);
 // Explicit project actions update Factory and project in the same operation.
 // Baseline follows that grouped save, so it isn't logged as a second edit.
 if(opts.syncSetup!==false)baseline=JSON.stringify(setup);
 persistPlan();
 render();
 root.NauvisWorkspace?.refresh?.();
 return obj;
}
function captureSetup(){
 const current=JSON.stringify(setup);
 if(current===baseline)return;
 const prev=JSON.parse(baseline||'{}');
 baseline=current;
 if(root.NauvisCloudApplying)return;
 for(const entry of summarizeSetupDelta(prev,setup))record(entry,{syncSetup:false});
}
function refreshBaseline(){baseline=JSON.stringify(setup)}
function count(){return getJournal().length}
function formatTime(at){
 const d=new Date(at);return Number.isNaN(d.getTime())?'Unknown time':
  d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function renderEntry(e,editable=false){
 const kind=escapeHTML(e.type),src=escapeHTML(e.source),ico=e.recipe?root.NauvisIcons?.item?.(e.recipe,30)||'':'';
 const extra=e.delta===null||e.delta===undefined?'':'<span class="journal-amount">'+(e.delta>0?'+':'')+escapeHTML(e.delta)+'</span>';
 return '<li class="journal-entry" data-journal-id="'+escapeHTML(e.id)+'">'+
  '<span class="journal-entry-icon" aria-hidden="true">'+(ico||'▤')+'</span>'+
  '<div class="journal-entry-body"><strong>'+escapeHTML(e.title)+'</strong><p>'+escapeHTML(e.detail)+'</p>'+
  '<span class="journal-entry-meta">'+escapeHTML(formatTime(e.at))+' · '+src+' · '+kind+'</span></div>'+extra+(editable?'<button type="button" class="journal-delete" data-journal-delete="'+escapeHTML(e.id)+'" aria-label="Delete log entry">Delete</button>':'')+'</li>';
}
let showAll=false;
function render(){
 const data=getJournal().slice().reverse();
 const panel=document.getElementById('journalList');
 if(panel)panel.innerHTML=data.length?data.slice(0,showAll?MAX_ENTRIES:12).map(e=>renderEntry(e,true)).join(''):
  '<li class="journal-entry journal-empty">No recorded changes yet. Updates you make in Projects or Factory will appear here.</li>';
 const preview=document.getElementById('journalPreview');
 if(preview)preview.innerHTML=data.length?data.slice(0,2).map(e=>renderEntry(e)).join(''):
  '<li class="journal-entry journal-empty">Your recent Factory and construction changes will appear here.</li>';
 const button=document.getElementById('journalShowAll');
 if(button){button.hidden=data.length<=12;button.textContent=showAll?'Show fewer':'Show all '+data.length+' changes'}
 const countSpan=document.getElementById('journalCount');
 if(countSpan)countSpan.textContent=String(data.length)+' entries';
}
function addNote(note){
 const trimmed=String(note||'').trim();
 if(!trimmed||trimmed.length>600)throw Error('Journal notes must have 1–600 characters.');
 record({type:'note',source:'Field note',title:'Construction note',detail:trimmed},{syncSetup:false});
 save(); // saves existing plan and queues this note for the normal cloud revision pipeline
}
function events(){
 document.getElementById('journalList')?.addEventListener('click',e=>{
  const button=e.target.closest('[data-journal-delete]');if(!button||!root.confirm('Delete this log entry? Factory and project counts will not change.'))return;
  factory.journal=getJournal().filter(x=>x.id!==button.dataset.journalDelete);persistPlan();save();render();root.NauvisFocus?.refresh?.();
 });
 document.getElementById('journalNoteForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const field=document.getElementById('journalNoteInput');
  try{
   addNote(field.value);field.value='';
   const status=document.getElementById('journalMessage');if(status)status.textContent='Journal note saved. No Factory counts changed.';
  }catch(err){const status=document.getElementById('journalMessage');if(status)status.textContent=err.message}
 });
 document.getElementById('journalShowAll')?.addEventListener('click',()=>{
  showAll=!showAll;render();
 });
}
root.NauvisJournal={record,captureSetup,refreshBaseline,render,addNote,count,get entries(){return getJournal()}};
factory.journal=getJournal();
events();render();
})(typeof window==='undefined'?globalThis:window);
