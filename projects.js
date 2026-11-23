/* NAUVIS v0.23 · Projects / Build Queue
   Versioned project plans live inside the existing factory plan JSON snapshot.
   Record into Existing Factory only after explicit confirmation; never double count. */
(function(root){
'use strict';
const VALID_KINDS=new Set(['asm','chem','furnace']);
const clampInt=(v,max=100000)=>{
 const n=Number(v);
 return Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
};
function validateProjectName(name){
 const trimmed=String(name??'').trim().replace(/\s+/g,' ');
 if(!trimmed||trimmed.length>80)throw Error('Project name must contain 1–80 characters.');
 return trimmed;
}
function buildProject(name,analysis,id,createdAt){
 validateProjectName(name);
 if(!analysis||!analysis.id||!Number.isFinite(analysis.rate)||!Array.isArray(analysis.entries)||!analysis.entries.length)
  throw Error('Choose a production goal above zero before saving a project.');
 if(!id||typeof id!=='string')throw Error('Project ID is required.');
 const tasks=analysis.entries.map(row=>{
  if(!row.key||!VALID_KINDS.has(row.kind)||!Number.isSafeInteger(row.count)||row.count<1)
   throw Error('Invalid recipe machine count.');
  return {recipe:row.key,kind:row.kind,planned:row.count,built:0};
 });
 if(new Set(tasks.map(x=>x.recipe)).size!==tasks.length)throw Error('Duplicate recipe in project.');
 return {id,name:validateProjectName(name),status:'active',createdAt:String(createdAt),
  goal:{id:analysis.id,rate:analysis.rate,machine:analysis.machine,source:analysis.source,belt:analysis.belt},
  tasks};
}
function projectProgress(project){
 const tasks=Array.isArray(project?.tasks)?project.tasks:[];
 return {planned:tasks.reduce((n,t)=>n+clampInt(t.planned),0),
  built:tasks.reduce((n,t)=>n+Math.min(clampInt(t.built),clampInt(t.planned)),0),
  complete:tasks.filter(t=>clampInt(t.planned)>0&&clampInt(t.built)>=clampInt(t.planned)).length,
  tasks:tasks.length};
}
function recordedForTask(project,task,rows){
 const matching=(Array.isArray(rows)?rows:[]).filter(row=>row?.projectId===project.id&&row?.projectTask===task.recipe);
 const count=matching.reduce((sum,row)=>sum+clampInt(row.count),0);
 const mismatch=matching.some(row=>row.recipe!==task.recipe||
  (task.kind==='asm'&&Math.abs(Number(row.tier)-Number(project.goal.machine))>1e-8));
 return {count,mismatch};
}
function changeBuilt(project,recipe,nextBuilt,rows){
 const task=project?.tasks?.find(t=>t.recipe===recipe);
 if(!task)throw Error('Project task not found.');
 const target=Number(nextBuilt);
 if(!Number.isSafeInteger(target)||target<0||target>task.planned)throw Error('Built count must be between zero and the planned amount.');
 const recorded=recordedForTask(project,task,rows);
 if(recorded.mismatch)throw Error('A linked factory line has a different recipe or tier. Review it before changing this task.');
 if(target<recorded.count)throw Error('Cannot mark fewer machines built than have already been recorded in Existing Factory.');
 return {...project,tasks:project.tasks.map(t=>t.recipe===recipe?{...t,built:target}:t)};
}
function prepareRecording(project,recipe,rows){
 const task=project?.tasks?.find(t=>t.recipe===recipe);
 if(!task)throw Error('Project task not found.');
 if(task.kind==='furnace')throw Error('Furnaces must be added through Existing Factory smelting controls.');
 if(!['asm','chem'].includes(task.kind))throw Error('This machine type cannot be recorded here.');
 const prev=recordedForTask(project,task,rows);
 if(prev.mismatch)throw Error('A linked factory line was modified. Review the Existing Factory entry to avoid double-counting.');
 const amount=clampInt(task.built)-prev.count;
 if(amount<=0)throw Error('No newly built, unrecorded machines remain for this task.');
 if(prev.count+amount>clampInt(task.planned))throw Error('Recorded count exceeds the project plan.');
 return {amount,line:{
  recipe:task.recipe,count:amount,tier:task.kind==='asm'?Number(project.goal.machine):1,
  destination:'Other',projectId:project.id,projectTask:task.recipe
 }};
}
function normalizeProjects(value){
 if(!Array.isArray(value))return [];
 const seen=new Set();
 return value.filter(p=>{
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!p.id||seen.has(p.id)||!Array.isArray(p.tasks)||!p.goal)return false;
  seen.add(p.id);return true;
 });
}
if(typeof module==='object'&&module.exports)
 module.exports={buildProject,projectProgress,recordedForTask,changeBuilt,prepareRecording,validateProjectName,normalizeProjects};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const colorFor=(recipe,kind)=>{
 if(typeof csscolor==='function'&&R?.[recipe])return csscolor(recipe,kind);
 return '#bba5e5';
};
const noun=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':'furnaces';
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
let pending=null,editing=null,showArchived=false,notice='';
function allProjects(){return normalizeProjects(factory.projects)}
function setProjects(projects){
 factory.projects=projects;
 save();
 render();
}
function uniqueId(){
 if(root.crypto?.randomUUID)return 'p_'+root.crypto.randomUUID();
 return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function selectedProject(id){return allProjects().find(p=>p.id===id)}
function stats(){
 const all=allProjects(),active=all.filter(p=>p.status!=='archived');
 const summary=active.reduce((a,p)=>{const progress=projectProgress(p);a.planned+=progress.planned;a.built+=progress.built;return a;},{planned:0,built:0});
 return {active:active.length,archived:all.length-active.length,...summary};
}
function legacyStats(){
 const tasks=[];for(let i=1;i<=Math.max(0,Number(factory.redBlocks)||0);i++)tasks.push('red'+i);
 tasks.push('blue','greenbus','lds','purple','yellow');
 const done=tasks.filter(k=>factory.checked?.[k]).length;
 return {done,total:tasks.length};
}
function projectHTML(p){
 const progress=projectProgress(p),pct=progress.planned?Math.round(100*progress.built/progress.planned):0;
 const archived=p.status==='archived';
 const lineItems=p.tasks.map(task=>{
  const saved=recordedForTask(p,task,setup.machines),remaining=Math.max(0,task.built-saved.count);
  const color=colorFor(task.recipe,task.kind);
  const mismatch=saved.mismatch;
  const cannotRecord=task.kind==='furnace';
  return '<div class="project-task" style="--project-task-accent:'+color+'">'+
   '<div class="project-task-identity"><span class="project-task-led" aria-hidden="true"></span><div><strong>'+escape(R[task.recipe]?.[0]||task.recipe)+'</strong><small>'+escape(noun(task.kind))+' · '+task.planned+' planned'+(task.kind==='asm'?' · Assembler '+(p.goal.machine===1.25?'3':'2'):'')+'</small></div></div>'+
   '<div class="project-task-controls"><button type="button" data-project-minus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" aria-label="Mark one fewer '+escape(task.recipe)+' built" '+(archived||task.built<=saved.count?'disabled':'')+'>−</button>'+
   '<span class="project-task-counter"><b>'+task.built+'</b><small>/ '+task.planned+' built</small></span>'+
   '<button type="button" data-project-plus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" aria-label="Mark one more '+escape(task.recipe)+' built" '+(archived||task.built>=task.planned?'disabled':'')+'>+</button></div>'+
   '<div class="project-task-foot"><span class="project-task-recorded">'+saved.count+' already recorded in Factory</span>'+
    (mismatch?'<span class="project-task-warning">Linked factory line differs; check Existing Factory.</span>':
    cannotRecord?'<span class="project-task-warning">Record furnaces under Factory → Smelting.</span>':
    !archived&&remaining>0?
     '<button type="button" class="project-record-btn" data-project-record="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'">Record '+remaining+' in Factory</button>':'')+
   '</div></div>';
 }).join('');
 return '<article class="project-card" data-project-card="'+escape(p.id)+'" style="--project-card-accent:'+colorFor(p.goal.id,'asm')+'">'+
  '<div class="project-card-top"><span class="project-card-icon" aria-hidden="true">▦</span>'+
  '<div class="project-card-intro"><h3>'+escape(p.name)+'</h3><p>'+escape(R[p.goal.id]?.[0]||p.goal.id)+' · '+fmt(p.goal.rate)+'/min · '+(p.goal.source==='bus'?'Bus fed':'Raw inputs')+'</p></div>'+
  '<span class="project-card-status">'+(archived?'ARCHIVED':pct===100?'BUILT':'IN PROGRESS')+'</span></div>'+
  '<div class="project-card-progress"><div class="project-card-progress-top"><strong>'+progress.built+' / '+progress.planned+' machines built</strong><span>'+pct+'%</span></div>'+
  '<div class="project-progress-track"><span style="width:'+pct+'%"></span></div></div>'+
  '<details class="project-task-details"><summary>Machine checklist <span>'+progress.complete+' / '+progress.tasks+' recipes complete</span></summary><div class="project-task-list">'+lineItems+'</div></details>'+
  '<div class="project-card-actions"><button type="button" data-project-visit="'+escape(p.id)+'">Open in Planner</button>'+
  '<button type="button" data-project-rename="'+escape(p.id)+'">Rename</button>'+
  '<button type="button" data-project-archive="'+escape(p.id)+'">'+(archived?'Restore':'Archive')+'</button></div>'+
 '</article>';
}
function render(){
 factory.projects=normalizeProjects(factory.projects);
 const total=stats(),legacy=legacyStats();
 if($('projectsSummary'))$('projectsSummary').innerHTML=[
  [total.active,'ACTIVE PROJECTS'],[total.planned,'MACHINES PLANNED'],[total.built,'MACHINES BUILT'],[total.archived,'ARCHIVED']
 ].map(([n,label])=>'<div class="project-stat"><strong>'+fmt(n)+'</strong><small>'+label+'</small></div>').join('');
 if($('projectsLegacyStatus'))$('projectsLegacyStatus').textContent=legacy.done+'/'+legacy.total+' construction milestones complete';
 if($('projectsLegacyFill'))$('projectsLegacyFill').style.width=(legacy.total?Math.min(100,legacy.done/legacy.total*100):0)+'%';
 const active=allProjects().filter(p=>p.status!=='archived'),archived=allProjects().filter(p=>p.status==='archived');
 if($('projectsList'))$('projectsList').innerHTML=active.length?active.map(projectHTML).join(''):
  '<div class="project-empty"><strong>No saved builds yet</strong><p>Start in Planner, pick an item and a production rate, then use Save to Projects. Your old circuit district is preserved below.</p><button type="button" data-project-go-planner>Open Visual Planner</button></div>';
 if($('projectsArchived'))$('projectsArchived').innerHTML=archived.map(projectHTML).join('')||'<p class="small">No archived projects.</p>';
 if($('projectsArchivedWrapper')){
  $('projectsArchivedWrapper').hidden=archived.length===0;
  $('projectsArchivedWrapper').open=showArchived;
 }
 if($('projectsNotice')){$('projectsNotice').textContent=notice;$('projectsNotice').hidden=!notice}
}
function openDialog(mode,project,result){
 editing=mode==='rename'?project.id:null;
 pending=mode==='create'?result:null;
 const title=$('projectsDialogTitle'),input=$('projectsName');
 title.textContent=editing?'Rename project':'Save production chain to Projects';
 input.value=editing?project.name:fmt(result.rate)+' '+(R[result.id]?.[0]||result.id)+'/min';
 $('projectsDialogSubtitle').textContent=editing?'Change the display name without changing machine counts.':'Create a separate construction plan from this exact recipe calculation. No machines will be added to Existing Factory.';
 $('projectsDialog').showModal();
 input.focus();input.select();
}
function saveDialog(event){
 event.preventDefault();
 try{
  const name=validateProjectName($('projectsName').value);
  if(editing){
   setProjects(allProjects().map(p=>p.id===editing?{...p,name}:p));
  }else{
   if(!pending)throw Error('No production calculation selected.');
   const project=buildProject(name,pending,uniqueId(),new Date().toISOString());
   setProjects([...allProjects(),project]);
   notice='Saved '+project.name+'. Machine counts are planned, not yet built.';
  }
  $('projectsDialog').close();editing=null;pending=null;render();
  activateWorkspace('factory',true);
 }catch(err){
  $('projectsDialogError').textContent=err.message;$('projectsDialogError').hidden=false;
 }
}
function updateBuilt(id,recipe,change){
 const project=selectedProject(id);if(!project)return;
 const task=project.tasks.find(t=>t.recipe===recipe);if(!task)return;
 try{
  const next=changeBuilt(project,recipe,task.built+change,setup.machines);
  const openCard=$('projectsList')?.querySelector('[data-project-card="'+id+'"] .project-task-details');
  const shouldOpen=!!openCard?.open;
  setProjects(allProjects().map(p=>p.id===id?next:p));
  if(shouldOpen){
   const card=document.querySelector('#projectsList [data-project-card="'+id+'"] .project-task-details');
   if(card)card.open=true;
  }
 }catch(err){notice=err.message;render()}
}
function record(id,recipe){
 const project=selectedProject(id);
 if(!project)return;
 try{
  const change=prepareRecording(project,recipe,setup.machines);
  const label=R[recipe]?.[0]||recipe;
  const message='Record '+change.amount+' newly built '+label+' machine(s) in Existing Factory?\n\nOnly confirm if you physically built these machines and have NOT already entered them manually. They will be linked to this project and assigned to "Other" until you choose their output destination.';
  if(!root.confirm(message))return;
  // Re-verify against current rows before any write; the plan is not a second machine inventory.
  const latest=prepareRecording(project,recipe,setup.machines);
  if(latest.amount!==change.amount)throw Error('Factory data changed. Review the project before recording.');
  setup.machines.push(latest.line);
  saveSetup();renderSetup();render();
  notice='Recorded '+latest.amount+' '+label+' machine(s) in Existing Factory. Set their destination in Factory.';
  render();
 }catch(err){notice=err.message;render()}
}
function navigateToPlan(id){
 const project=selectedProject(id);if(!project)return;
 const goal=project.goal;
 guide.goal=goal.id;guide.rate=goal.rate;guide.machine=goal.machine;guide.source=goal.source;guide.belt=goal.belt;
 renderGuide();
 activateWorkspace('build',true);
 const explorer=document.querySelector('[data-ratio-explorer="build"]');
 if(explorer)explorer.open=true;
 root.NauvisRatioExplorer?.setGoal?.(goal);
}
function attachEvents(){
 $('projectsSaveForm')?.addEventListener('submit',saveDialog);
 $('projectsDialogClose')?.addEventListener('click',()=>{$('projectsDialog').close();editing=null;pending=null});
 $('projectsArchivedWrapper')?.addEventListener('toggle',event=>{showArchived=event.target.open});
 $('projectsGoPlanner')?.addEventListener('click',()=>activateWorkspace('build',true));
 $('projectsOpenLegacy')?.addEventListener('click',()=>{
  const d=$('legacyDistrict');if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'})}
 });
 $('projectsOpenFactory')?.addEventListener('click',()=>activateWorkspace('setup',true));
 $('factory')?.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.matches('[data-project-go-planner]')){activateWorkspace('build',true);return}
  const id=b.dataset.projectPlus||b.dataset.projectMinus||b.dataset.projectRecord||b.dataset.projectVisit||b.dataset.projectRename||b.dataset.projectArchive;
  if(!id)return;
  const project=selectedProject(id);
  if(!project)return;
  if(b.hasAttribute('data-project-plus'))updateBuilt(id,b.dataset.taskRecipe,1);
  else if(b.hasAttribute('data-project-minus'))updateBuilt(id,b.dataset.taskRecipe,-1);
  else if(b.hasAttribute('data-project-record'))record(id,b.dataset.taskRecipe);
  else if(b.hasAttribute('data-project-visit'))navigateToPlan(id);
  else if(b.hasAttribute('data-project-rename')){ $('projectsDialogError').hidden=true;openDialog('rename',project)}
  else if(b.hasAttribute('data-project-archive')){
   setProjects(allProjects().map(p=>p.id===id?{...p,status:p.status==='archived'?'active':'archived'}:p));
  }
 });
}
function createFromRatio(result){
 if(!result?.entries?.length){notice='Choose a production target above zero before saving.';render();return}
 $('projectsDialogError').hidden=true;openDialog('create',null,result);
}
function refresh(){render()}
root.NauvisProjects={createFromRatio,refresh};
attachEvents();render();
})(typeof window==='undefined'?globalThis:window);
