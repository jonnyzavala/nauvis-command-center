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
// A saved incremental plan is a frozen design, not a fresh calculation
// against whichever factory happens to be loaded later.
function reuseClaims(projects){
 const claims=new Map();
 for(const p of projects||[]){
  if(!p?.design||p.reuseReleased===true)continue;
  for(const r of p.design.reuseClaims||[]){
   if(typeof r.key!=='string'||!Number.isFinite(r.rate)||r.rate<=0)continue;
   claims.set(r.key,(claims.get(r.key)||0)+r.rate);
  }
 }
 return claims;
}
function validateReuseClaims(analysis,claims){
 const reused=new Map();
 for(const r of analysis.reused||[]){
  if(!r?.key||!Number.isFinite(r.rate)||r.rate<=0||reused.has(r.key))throw Error('Invalid reused ingredient.');
  reused.set(r.key,r.rate);
 }
 const totals=new Map(),keys=new Set();
 for(const c of claims||[]){
  if(!c?.item||c.key!=='machine:'+c.item+'|Available for new build'||!Number.isFinite(c.rate)||c.rate<=0||keys.has(c.key))throw Error('Invalid reuse commitment.');
  keys.add(c.key);totals.set(c.item,(totals.get(c.item)||0)+c.rate);
 }
 if(totals.size!==reused.size||[...reused].some(([k,v])=>Math.abs((totals.get(k)||0)-v)>1e-6))throw Error('Reuse commitments differ from the calculated plan. Reopen preview.');
}
function freezeDesign(analysis){
 if(!Array.isArray(analysis.reused))return null;
 validateReuseClaims(analysis,analysis.reuseClaims);
 if(!Number.isSafeInteger(analysis.baselineMachines)||analysis.baselineMachines<analysis.entries.reduce((n,e)=>n+e.count,0))throw Error('Invalid original machine total.');
 return JSON.parse(JSON.stringify({analysis, reuseClaims:analysis.reuseClaims||[], baselineMachines:analysis.baselineMachines}));
}
function buildProject(name,analysis,id,createdAt,furnaceItem=null){
 validateProjectName(name);
 if(!analysis||!analysis.id||!Number.isFinite(analysis.rate)||!Array.isArray(analysis.entries)||!analysis.entries.length)
  throw Error('Choose a production goal above zero before saving a project.');
 if(!id||typeof id!=='string')throw Error('Project ID is required.');
 const hasFurnaces=analysis.entries.some(row=>row.kind==='furnace');
 if(hasFurnaces&&(!['steel-furnace','electric-furnace'].includes(furnaceItem)||analysis.entries.some(r=>r.kind==='furnace'&&!['iron-plate','copper-plate','steel-plate','stone-brick'].includes(r.key))))throw Error('Raw smelting requires an explicit steel/electric furnace choice.');
 const tasks=analysis.entries.map(row=>{
  if(!row.key||!VALID_KINDS.has(row.kind)||!Number.isSafeInteger(row.count)||row.count<1)
   throw Error('Invalid recipe machine count.');
  return {recipe:row.key,kind:row.kind,planned:row.count,built:0};
 });
 if(new Set(tasks.map(x=>x.recipe)).size!==tasks.length)throw Error('Duplicate recipe in project.');
 const design=freezeDesign(analysis);
 return {id,name:validateProjectName(name),status:'active',createdAt:String(createdAt),...(design?{design}:{}),...(hasFurnaces?{furnaceItem}:{}),
  goal:{id:analysis.id,rate:analysis.rate,machine:analysis.machine,source:analysis.source,belt:analysis.belt,
   moduleType:analysis.moduleType||'none',moduleCount:analysis.moduleCount||0,moduleType2:analysis.moduleType2||'none',moduleCount2:analysis.moduleCount2||0,
   machineQuality:analysis.machineQuality||'normal',beaconSpeed:analysis.beaconSpeed||0},
  tasks};
}
// Remaining machine items and their immediate crafting ingredients.
function constructionMaterials(project,recipes){
 const machineItems={asm:project.goal.machine===1.25?'assembling-machine-3':'assembling-machine-2',chem:'chemical-plant',furnace:project.furnaceItem};
 const counts=new Map(),ingredients=new Map(),unknown=[];
 for(const t of project.tasks||[]){
  const key=machineItems[t.kind];if(!key)continue;
  const old=counts.get(key)||{key,planned:0,built:0};old.planned+=t.planned;old.built+=t.built;counts.set(key,old);
 }
 for(const row of counts.values()){
  const remaining=Math.max(0,row.planned-row.built);row.remaining=remaining;
  if(!remaining)continue;const recipe=recipes[row.key];
  if(!recipe){unknown.push(row.key);continue}
  for(const [key,quantity] of Object.entries(recipe[4]||{}))ingredients.set(key,(ingredients.get(key)||0)+Math.ceil(remaining/recipe[2])*quantity);
 }
 return {machines:[...counts.values()],ingredients:[...ingredients].map(([key,quantity])=>({key,quantity})),unknown};
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
  (task.kind==='asm'&&Math.abs(Number(row.tier)-Number(project.goal.machine))>1e-8)||
  (task.kind!=='asset'&&(
   (row.moduleType||'none')!==(project.goal.moduleType||'none')||
   Number(row.moduleCount||0)!==Number(project.goal.moduleCount||0)||
   (row.moduleType2||'none')!==(project.goal.moduleType2||'none')||Number(row.moduleCount2||0)!==Number(project.goal.moduleCount2||0)||
   (row.machineQuality||'normal')!==(project.goal.machineQuality||'normal')||
   Number(row.beaconSpeed||0)!==Number(project.goal.beaconSpeed||0)
  )));
 return {count,mismatch};
}
function applyBuildDelta(project,recipe,delta,rows){
 if(delta!==1&&delta!==-1)throw Error('Build adjustment must be one machine.');
 const task=project?.tasks?.find(t=>t.recipe===recipe);
 if(!task)throw Error('Project task not found.');
 if(!['asm','chem'].includes(task.kind))throw Error('This recipe needs a different inventory category. Switch to bus-fed planning.');
 const count=clampInt(task.built),next=count+delta;
 if(next<0||next>task.planned)throw Error('Built count must stay between zero and the planned amount.');
 const source=Array.isArray(rows)?rows:[];
 const related=source.filter(row=>row?.projectId===project.id&&row?.projectTask===recipe);
 if(related.length>1)throw Error('Multiple Factory lines are linked to this task. Review them before editing.');
 const previous=recordedForTask(project,task,source);
 if(previous.mismatch||previous.count!==count)
  throw Error('Project and Factory counts differ. Review the linked Factory row before changing progress.');
 const tier=task.kind==='asm'?Number(project.goal.machine):1;
 const line=related[0];
 if(line&&(!Number.isSafeInteger(Number(line.count))||Number(line.count)<0))
  throw Error('Linked Factory line has an invalid machine count.');
 const nextRows=source.map(row=>({...row}));
 const index=source.findIndex(row=>row?.projectId===project.id&&row?.projectTask===recipe);
 if(index>=0){
  if(next===0)nextRows.splice(index,1);
  else nextRows[index]={...nextRows[index],count:next};
 }else if(next>0){
  nextRows.push({recipe,count:next,tier,destination:'Other',projectId:project.id,projectTask:recipe,
   moduleType:project.goal.moduleType||'none',moduleCount:project.goal.moduleCount||0,moduleType2:project.goal.moduleType2||'none',moduleCount2:project.goal.moduleCount2||0,
   machineQuality:project.goal.machineQuality||'normal',beaconSpeed:project.goal.beaconSpeed||0});
 }
 return {project:{...project,tasks:project.tasks.map(t=>t.recipe===recipe?{...t,built:next}:t)},rows:nextRows};
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
 module.exports={buildProject,projectProgress,recordedForTask,applyBuildDelta,validateProjectName,normalizeProjects,reuseClaims,validateReuseClaims,freezeDesign,constructionMaterials};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const itemGlyph=(id,size)=>root.NauvisIcons?.item?.(id,size)||'';
const colorFor=(recipe,kind)=>{
 if(typeof csscolor==='function'&&R?.[recipe])return csscolor(recipe,kind);
 return '#bba5e5';
};
const noun=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':kind==='asset'?'placed items':'furnaces';
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1});
let pending=null,editing=null,showArchived=false,notice='',pendingOptions=null;
const reviewedOverlaps=new Set();
function matchingUnlinked(recipe,machine){
 const matches=(setup.machines||[]).filter(row=>!row.projectId&&row.recipe===recipe&&
   (R[recipe]?.[3]!=='asm'||Math.abs(Number(row.tier)-Number(machine))<1e-8));
 return matches.reduce((sum,row)=>sum+Math.max(0,Number(row.count)||0),0);
}
function matchingUnlinkedAssets(recipe,area){
 return (setup.assets||[]).filter(a=>!a.projectId&&a.recipe===recipe&&(a.area||'Nauvis')===(area||'Nauvis')).reduce((n,a)=>n+Math.max(0,Number(a.count)||0),0);
}
function allProjects(){return normalizeProjects(factory.projects)}
function setProjects(projects,event){
 factory.projects=projects;
 if(event)root.NauvisJournal?.record?.(event);
 save();
 render();
}
function uniqueId(){
 if(root.crypto?.randomUUID)return 'p_'+root.crypto.randomUUID();
 return 'p_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
}
function visibleProjects(){return allProjects().filter(p=>p.type!=='deployment'&&!p.tasks.some(t=>t.kind==='asset'))}
function selectedProject(id){return visibleProjects().find(p=>p.id===id)}
function stats(){
 const all=visibleProjects(),active=all.filter(p=>p.status!=='archived');
 const summary=active.reduce((a,p)=>{const progress=projectProgress(p);a.planned+=progress.planned;a.built+=progress.built;return a;},{planned:0,built:0});
 return {active:active.length,archived:all.length-active.length,...summary};
}
function legacyStats(){
 const tasks=[];for(let i=1;i<=Math.max(0,Number(factory.redBlocks)||0);i++)tasks.push('red'+i);
 for(const [key,field] of [['blue','blueMachines'],['greenbus','greenBus'],['lds','ldsMachines'],['purple','purpleSPM'],['yellow','yellowSPM']])if(Number(factory[field])>0)tasks.push(key);
 const done=tasks.filter(k=>factory.checked?.[k]).length;
 return {done,total:tasks.length};
}
function designDetails(p){
 if(!p.design)return '';
 const a=p.design.analysis,claims=p.design.reuseClaims||[],reused=claims.map(r=>'<div class="project-design-row"><span>'+escape(R[r.item]?.[0]||r.item)+'</span><b>'+fmt(r.rate)+'/min</b></div>').join('');
 const inputs=(a.external||[]).map(r=>'<div class="project-design-row"><span>'+escape(r.name||r.key)+'</span><b>'+fmt(r.needed)+'/min'+(r.isFluid?' · pipe':'')+'</b></div>').join('');
 const build=projectProgress(p).planned;
 return '<details class="project-design"><summary>Saved incremental design · '+(p.design.baselineMachines-build)+' machines avoided</summary>'+
 '<p class="small">Only '+build+' additional machines are tracked below. Existing reused machines are never added again.</p>'+
 '<strong>Existing production commitments</strong>'+(reused||'<p class="small">No recorded supply reused.</p>')+
 (claims.length?'<p class="small">'+(p.reuseReleased?'Commitments released. This design is historical and must be reviewed before reuse.':'Planning commitments are retained even when archived or completed. They are not proof of physical delivery.')+'</p>':'')+
 '<strong>Other external input demand (full design target)</strong>'+(inputs||'<p class="small">None at this recipe boundary.</p>')+'</details>';
}
function materialDetails(p){
 const materials=constructionMaterials(p,R);
 if(!materials.machines.length)return '';
 const row=(k,v)=>'<div class="project-design-row"><span>'+itemGlyph(k,24)+' '+escape(R[k]?.[0]||k)+'</span><b>'+v+'</b></div>';
 return '<details class="project-design"><summary>Machine construction materials</summary>'+materials.machines.map(x=>row(x.key,fmt(x.remaining)+' remaining / '+fmt(x.planned))).join('')+
 '<strong>Immediate crafting ingredients for remaining machines</strong>'+
 (materials.ingredients.map(x=>row(x.key,fmt(x.quantity))).join('')||'<p class="small">None remaining or recipe unavailable.</p>')+
 (materials.unknown.length?'<p class="small">Missing machine recipes: '+escape(materials.unknown.join(', '))+'</p>':'')+
 '<p class="small">Gross requirements if crafting from components; subtract items you already own yourself. Not expanded to raw ores. No belt lengths, fuel, inserters, poles or installed module inventory inferred.</p></details>';
}
function furnaceRecorded(p,t){
 const field=root.NauvisEffects.SMELT_FIELDS[t.recipe];
 try{
  root.NauvisEffects.smeltOwnership(setup.smelt,allProjects());
  const count=(setup.smelt.projectBuilt||[]).find(x=>x.projectId===p.id&&x.recipe===t.recipe)?.count||0;
  return {count,mismatch:!field||count!==t.built};
 }catch(_e){return {count:0,mismatch:true}}
}
function projectHTML(p){
 const progress=projectProgress(p),pct=progress.planned?Math.round(100*progress.built/progress.planned):0;
 const archived=p.status==='archived';
 const lineItems=p.tasks.map(task=>{
  const isAsset=task.kind==='asset';
  const saved=task.kind==='furnace'?furnaceRecorded(p,task):recordedForTask(p,task,isAsset?setup.assets:setup.machines);
  const color=colorFor(task.recipe,task.kind);
  const mismatch=saved.mismatch||saved.count!==task.built;
  const cannotRecord=task.kind==='furnace'&&Number(setup.smelt.furnaceSpeed)!==2;
  const possibleDuplicates=task.kind==='furnace'?Math.max(0,Number(setup.smelt[root.NauvisEffects.SMELT_FIELDS[task.recipe]])-(setup.smelt.projectBuilt||[]).filter(x=>x.recipe===task.recipe).reduce((n,x)=>n+x.count,0)):isAsset?matchingUnlinkedAssets(task.recipe,p.goal.area):matchingUnlinked(task.recipe,p.goal.machine);
  return '<div class="project-task" style="--project-task-accent:'+color+'">'+
   '<div class="project-task-identity"><span class="project-task-led" aria-hidden="true"></span>'+itemGlyph(task.recipe,32)+'<div><strong>'+escape(R[task.recipe]?.[0]||task.recipe)+'</strong><small>'+escape(noun(task.kind))+' · '+task.planned+' planned'+(task.kind==='asm'?' · Assembler '+(p.goal.machine===1.25?'3':'2'):task.kind==='furnace'?' · '+escape(R[p.furnaceItem]?.[0]||'2× furnace'):'')+'</small></div></div>'+
   '<div class="project-task-controls"><button type="button" data-project-minus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" title="Reverse built count · removes one from actual Inventory" aria-label="Mark one fewer '+escape(task.recipe)+' built" '+(archived||task.built<=0||mismatch?'disabled':'')+'>−</button>'+
   '<span class="project-task-counter"><b>'+task.built+'</b><small>/ '+task.planned+(isAsset?' placed':' built')+'</small></span>'+
   '<button type="button" data-project-plus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" title="Mark one as built · adds one to actual Inventory" aria-label="Mark one more '+escape(task.recipe)+' built" '+(archived||task.built>=task.planned||mismatch||cannotRecord?'disabled':'')+'>+</button></div>'+
   '<div class="project-task-foot"><span class="project-task-recorded">'+saved.count+(isAsset?' deployed in Factory':' in actual Inventory')+' · linked to this project</span>'+
   (mismatch?'<span class="project-task-warning">Factory and project counts differ. Review the linked line in Factory.</span>':
    cannotRecord?'<span class="project-task-warning">Set actual smelting speed to 2× before recording this furnace.</span>':
    possibleDuplicates?'<span class="project-task-warning">Check for duplicates: '+possibleDuplicates+' matching unlinked machines already in Factory.</span>':'')+
   '</div></div>';
 }).join('');
 return '<article class="project-card" data-project-card="'+escape(p.id)+'" style="--project-card-accent:'+colorFor(p.goal.id,'asm')+'">'+
  '<div class="project-card-top"><span class="project-card-icon" aria-hidden="true">'+itemGlyph(p.goal.id,34)+'</span>'+
  '<div class="project-card-intro"><h3>'+escape(p.name)+'</h3><p>'+escape(R[p.goal.id]?.[0]||p.goal.id)+
 (p.type==='deployment'?' · '+escape(p.goal.area||'Nauvis')+' · deployment':
 ' · '+fmt(p.goal.rate)+'/min · '+(p.goal.source==='bus'?'Bus fed':'Raw inputs')+
 (p.goal.moduleType&&p.goal.moduleType!=='none'?' · '+escape(p.goal.moduleType)+' ×'+Number(p.goal.moduleCount||0):'')+
 (p.goal.moduleType2&&p.goal.moduleType2!=='none'?' · '+escape(p.goal.moduleType2)+' ×'+Number(p.goal.moduleCount2||0):'')+
  (p.goal.machineQuality&&p.goal.machineQuality!=='normal'?' · '+escape(p.goal.machineQuality)+' machines':'')+
 (p.goal.beaconSpeed?' · +'+Number(p.goal.beaconSpeed)+'% effective beacon speed':''))+'</p></div>'+
  '<span class="project-card-status">'+(archived?'ARCHIVED':pct===100?'BUILT':'IN PROGRESS')+'</span></div>'+
  '<div class="project-card-progress"><div class="project-card-progress-top"><strong>'+progress.built+' / '+progress.planned+(p.type==='deployment'?' items placed':' machines built')+'</strong><span>'+pct+'%</span></div>'+
  '<div class="project-progress-track"><span style="width:'+pct+'%"></span></div></div>'+
  designDetails(p)+materialDetails(p)+'<details class="project-task-details"><summary>'+(p.type==='deployment'?'Placement checklist':'Machine checklist')+' <span>'+progress.complete+' / '+progress.tasks+' groups complete</span></summary><div class="project-task-list">'+lineItems+'</div></details>'+
  '<div class="project-card-actions"><button type="button" data-project-visit="'+escape(p.id)+'">'+(p.type==='deployment'?'View placed inventory':p.design?'View saved design':'Open in Planner')+'</button>'+
  '<button type="button" data-project-rename="'+escape(p.id)+'">Rename</button>'+
  '<button type="button" data-project-archive="'+escape(p.id)+'">'+(archived?'Restore':'Archive')+'</button>'+(archived&&p.design?.reuseClaims?.length&&!p.reuseReleased&&progress.built===0?'<button type="button" data-project-release="'+escape(p.id)+'">Release reuse commitments</button>':'')+'</div>'+
 '</article>';
}
function render(){
 factory.projects=normalizeProjects(factory.projects);
 const total=stats(),legacy=legacyStats();
 if($('projectsSummary'))$('projectsSummary').innerHTML=[
  [total.active,'ACTIVE PROJECTS'],[total.planned,'QUANTITY PLANNED'],[total.built,'MACHINES BUILT'],[total.archived,'ARCHIVED']
 ].map(([n,label])=>'<div class="project-stat"><strong>'+fmt(n)+'</strong><small>'+label+'</small></div>').join('');
 if($('projectsLegacyStatus'))$('projectsLegacyStatus').textContent=legacy.done+'/'+legacy.total+' construction milestones complete';
 if($('projectsLegacyFill'))$('projectsLegacyFill').style.width=(legacy.total?Math.min(100,legacy.done/legacy.total*100):0)+'%';
 const active=visibleProjects().filter(p=>p.status!=='archived'),archived=visibleProjects().filter(p=>p.status==='archived');
 if($('projectsList'))$('projectsList').innerHTML=active.length?active.map(projectHTML).join(''):
  '<div class="project-empty"><strong>No saved builds yet</strong><p>Start in Blueprint Designer, pick an item and a production rate, then choose Queue construction. The optional circuit district is available below.</p><button type="button" data-project-go-planner>Open Visual Planner</button></div>';
 if($('projectsArchived'))$('projectsArchived').innerHTML=archived.map(projectHTML).join('')||'<p class="small">No archived projects.</p>';
 if($('projectsArchivedWrapper')){
  $('projectsArchivedWrapper').hidden=archived.length===0;
  $('projectsArchivedWrapper').open=showArchived;
 }
 if($('projectsNotice')){$('projectsNotice').textContent=notice;$('projectsNotice').hidden=!notice}
}
function openDialog(mode,project,result,options=null){
 pendingOptions=mode==='create'?options:null;
 editing=mode==='rename'?project.id:null;
 pending=mode==='create'?result:null;
 const title=$('projectsDialogTitle'),input=$('projectsName');
 title.textContent=editing?'Rename project':'Queue construction';
 $('projectsDialogSubmit').textContent=editing?'Save name':'Queue construction';
 $('projectsFurnaceField').hidden=!!editing||!result?.entries?.some(r=>r.kind==='furnace');
 $('projectsFurnaceItem').value='';
 input.value=editing?project.name:fmt(result.rate)+' '+(R[result.id]?.[0]||result.id)+'/min';
 $('projectsDialogSubtitle').textContent=editing?'Change the display name without changing machine counts.':result?.reused?'Queue '+result.roundedTotal+' additional machines from this incremental design. Reused output becomes a planning commitment. No machines are added to actual Inventory.':'Create a separate construction plan from this exact recipe calculation. No machines will be added to Existing Factory.';
 $('projectsDialog').showModal();
 input.focus();input.select();
}
function saveDialog(event){
 event.preventDefault();
 try{
  const name=validateProjectName($('projectsName').value);
  if(editing){
   const original=selectedProject(editing);
   setProjects(allProjects().map(p=>p.id===editing?{...p,name}:p),{
    type:'project',source:'Construction Queue',projectId:editing,title:'Renamed project',
    detail:(original?.name||'Project')+' → '+name
   });
  }else{
   if(!pending)throw Error('No production calculation selected.');
   if(pendingOptions?.validate)pendingOptions.validate(pending);
   if(pending.entries.some(r=>r.kind==='furnace')){root.NauvisEffects.smeltOwnership(setup.smelt,allProjects());if(Number(setup.smelt.furnaceSpeed)!==2)throw Error('Raw plans require actual smelting speed 2×.');}
   const project=buildProject(name,pending,uniqueId(),new Date().toISOString(),$('projectsFurnaceItem').value);
   setProjects([...allProjects(),project],{
    type:'project',source:project.design?'Logistics preview':'Blueprint Designer',projectId:project.id,
    recipe:project.goal.id,title:'Saved construction project',
    detail:project.name+' · '+project.tasks.reduce((n,t)=>n+t.planned,0)+' machines planned · 0 built'
   });
   notice='Queued '+project.name+'. Actual Inventory is unchanged until you mark machines built.';
   pendingOptions?.onSaved?.(project);
  }
  $('projectsDialog').close();editing=null;pending=null;pendingOptions=null;render();
  activateWorkspace('factory',true);
 }catch(err){
  $('projectsDialogError').textContent=err.message;$('projectsDialogError').hidden=false;
 }
}
function updateBuilt(id,recipe,delta){
 const project=selectedProject(id);if(!project)return;
 const task=project.tasks.find(t=>t.recipe===recipe);if(!task)return;
 const isAsset=task.kind==='asset';
 try{
  const isFurnace=task.kind==='furnace';
  const ownership=isFurnace?root.NauvisEffects.smeltOwnership(setup.smelt,allProjects()):{};
  const field=root.NauvisEffects.SMELT_FIELDS[recipe];
  const overlap=isFurnace?Math.max(0,Number(setup.smelt[field]||0)-(ownership[field]||0)):isAsset?matchingUnlinkedAssets(recipe,project.goal.area):matchingUnlinked(recipe,project.goal.machine);
  const overlapKey=id+'|'+recipe;
  if(delta>0&&overlap>0&&!reviewedOverlaps.has(overlapKey)){
   const msg=overlap+' matching '+(R[recipe]?.[0]||recipe)+' '+(isAsset?'placed structures':'machines')+
    ' already exist in Factory as manual records.\n\n'+
    'Are you certain this is a NEW '+(isAsset?'placed structure':'machine')+' that is not already counted?';
   if(!root.confirm(msg))return;
   reviewedOverlaps.add(overlapKey);
  }
  const change=isFurnace?root.NauvisEffects.applySmeltBuildDelta(project,recipe,delta,setup.smelt,allProjects()):isAsset?root.NauvisAssets?.applyBuildDelta?.(project,recipe,delta,setup.assets):
   applyBuildDelta(project,recipe,delta,setup.machines);
  if(!change)throw Error('Infrastructure inventory is not ready.');
  const expanded=!!$('projectsList')?.querySelector('[data-project-card="'+id+'"] .project-task-details')?.open;
  // Update the paired project and exactly one actual inventory ledger before syncing.
  factory.projects=allProjects().map(p=>p.id===id?change.project:p);
  if(isFurnace)Object.assign(setup.smelt,change.smelt);else if(isAsset)setup.assets=change.rows;else setup.machines=change.rows;
  const next=change.project.tasks.find(t=>t.recipe===recipe);
  const name=R[recipe]?.[0]||recipe;
  root.NauvisJournal?.record?.({
   type:'construction',source:'Construction Queue',projectId:id,recipe,delta,
   before:next.built-delta,after:next.built,
   title:(delta>0?(isAsset?'Placed +1 ':'Built +1 '):(isAsset?'Reversed placement −1 ':'Reversed −1 '))+name,
   detail:project.name+' · '+(next.built-delta)+' → '+next.built+(isAsset?' deployed':' built')+
    ' · '+(isFurnace?'Factory smelting inventory':isAsset?'Factory infrastructure ledger':'Factory production-machine inventory')+' updated once.'+
    (overlap&&delta>0?' Review '+overlap+' existing unlinked '+name+' records for possible duplicate entry.':'')
  });
  saveSetup();save();renderSetup();
  notice=delta>0?(isAsset?'Recorded one placed '+name+' in infrastructure and the journal.':'Built one '+name+' machine and updated Factory and the journal.'):
   'Reversed one recorded item in both Factory and the journal.';
  render();root.NauvisAssets?.render?.();
  if(expanded){
   const detail=$('projectsList')?.querySelector('[data-project-card="'+id+'"] .project-task-details');
   if(detail)detail.open=true;
  }
 }catch(err){notice=err.message;render()}
}
function navigateToPlan(id){
 const project=selectedProject(id);if(!project)return;
 if(project.type==='deployment'){
  activateWorkspace('setup',true);
  root.NauvisWorkspace?.jump?.('setup','#setupAssetsPanel');
  return;
 }
 if(project.design){root.NauvisLogistics?.viewSavedDesign?.(project);return}
 const goal=project.goal;
 guide.goal=goal.id;guide.rate=goal.rate;guide.machine=goal.machine;guide.source=goal.source;guide.belt=goal.belt;
 renderGuide();
 activateWorkspace('build',true);
 const explorer=document.querySelector('[data-ratio-explorer="build"]');
 if(explorer)explorer.open=true;
 root.NauvisRatioExplorer?.setGoal?.(goal);
}
function initializeDeployment(){
 const pick=$('deploymentItem');if(!pick)return;
 const preferred=root.NauvisAssets?.starterItems||[];
 const all=[...new Set([...preferred,...allOrder])].filter(x=>R[x]);
 pick.innerHTML=all.map(id=>'<option value="'+escape(id)+'">'+escape(R[id][0])+'</option>').join('');
 pick.value=R['laser-turret']?'laser-turret':all[0];
 $('projectsNewDeployment')?.addEventListener('click',()=>{
  $('deploymentError').hidden=true;
  $('deploymentDialog')?.showModal();
 });
 $('deploymentCancel')?.addEventListener('click',()=>$('deploymentDialog')?.close());
 $('deploymentForm')?.addEventListener('submit',event=>{
  event.preventDefault();
  try{
   const item=pick.value;
   const project=root.NauvisAssets?.createProject?.(
    $('deploymentName').value,item,Number($('deploymentCount').value),
    uniqueId(),$('deploymentArea').value
   );
   if(!project)throw Error('Infrastructure project handler unavailable.');
   setProjects([...allProjects(),project],{
    type:'project',source:'Construction Queue',recipe:item,projectId:project.id,
    title:'Planned infrastructure deployment',detail:project.name+' · '+project.tasks[0].planned+
     ' '+(R[item]?.[0]||item)+' to place in '+project.goal.area+'. No Factory counts changed.'
   });
   $('deploymentDialog').close();
   $('deploymentName').value='';
   notice='Created '+project.name+'. Mark structures placed only after they exist in-game.';
   render();activateWorkspace('factory',true);
  }catch(err){$('deploymentError').textContent=err.message;$('deploymentError').hidden=false}
 });
}
function attachEvents(){
 $('projectsSaveForm')?.addEventListener('submit',saveDialog);
 $('projectsDialogClose')?.addEventListener('click',()=>{$('projectsDialog').close();editing=null;pending=null;pendingOptions=null});
 $('projectsArchivedWrapper')?.addEventListener('toggle',event=>{showArchived=event.target.open});
 $('projectsGoPlanner')?.addEventListener('click',()=>activateWorkspace('build',true));
 $('projectsOpenLegacy')?.addEventListener('click',()=>{
  const d=$('legacyDistrict');if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'})}
 });
 $('projectsOpenFactory')?.addEventListener('click',()=>activateWorkspace('setup',true));
 $('factory')?.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.matches('[data-project-go-planner]')){activateWorkspace('build',true);return}
  const id=b.dataset.projectPlus||b.dataset.projectMinus||b.dataset.projectVisit||b.dataset.projectRename||b.dataset.projectArchive||b.dataset.projectRelease;
  if(!id)return;
  const project=selectedProject(id);
  if(!project)return;
  if(b.hasAttribute('data-project-release')){
   if(project.status!=='archived'||projectProgress(project).built!==0||project.reuseReleased||!project.design?.reuseClaims?.length)return;
   if(!root.confirm('Release this cancelled, unbuilt project’s planned supply commitments? Its saved design remains historical and cannot be restored.'))return;
   setProjects(allProjects().map(p=>p.id===id?{...p,reuseReleased:true}:p),{type:'project',source:'Construction Queue',projectId:id,title:'Released reuse commitments',detail:project.name+' · cancelled unbuilt plan'});return;
  }
  if(b.hasAttribute('data-project-plus'))updateBuilt(id,b.dataset.taskRecipe,1);
  else if(b.hasAttribute('data-project-minus'))updateBuilt(id,b.dataset.taskRecipe,-1);
  else if(b.hasAttribute('data-project-visit'))navigateToPlan(id);
  else if(b.hasAttribute('data-project-rename')){ $('projectsDialogError').hidden=true;openDialog('rename',project)}
  else if(b.hasAttribute('data-project-archive')){
   const restored=project.status==='archived';
   if(restored&&project.reuseReleased){notice='This cancelled design released its commitments. Create a fresh preview instead of restoring it.';render();return}
   setProjects(allProjects().map(p=>p.id===id?{...p,status:restored?'active':'archived'}:p),{
    type:'project',source:'Construction Queue',projectId:id,recipe:project.goal.id,
    title:(restored?'Restored':'Archived')+' project',detail:project.name
   });
  }
 });
}
function createFromRatio(result,options=null){
 if(!result?.entries?.length){root.alert('Choose a production target above zero before saving.');return}
 if(result.entries.some(row=>row.kind==='furnace')&&Number(setup.smelt.furnaceSpeed)!==2){root.alert('Raw blueprints use 2× steel/electric furnace speed. Set actual smelting to that speed before queueing, or choose bus-fed inputs.');return;}
 $('projectsDialogError').hidden=true;openDialog('create',null,JSON.parse(JSON.stringify(result)),options);
}
function refresh(){render()}
root.NauvisProjects={createFromRatio,refresh,reuseClaims:()=>reuseClaims(allProjects())};
attachEvents();render();
})(typeof window==='undefined'?globalThis:window);
