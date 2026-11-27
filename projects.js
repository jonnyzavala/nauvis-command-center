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
  if(!c?.item||!(typeof c.key==='string'&&c.key.length<=300&&c.key.startsWith('machine:'+c.item+'|'))||!Number.isFinite(c.rate)||c.rate<=0||keys.has(c.key))throw Error('Invalid reuse commitment.');
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
  const key=t.kind==='asm'?(taskProfile(project,t).machine===.5?'assembling-machine-1':taskProfile(project,t).machine===1.25?'assembling-machine-3':'assembling-machine-2'):machineItems[t.kind];if(!key){if(['asm','chem','furnace'].includes(t.kind)&&t.planned>t.built)unknown.push('unspecified '+t.kind+' machine');continue;}
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
// Expand aggregate demand in dependency order, then round each recipe once.
// The leaves are alternative procurement requirements, never added to components.
const MATERIAL_BOUNDARY=new Set(['iron-ore','copper-ore','stone','coal','water','petroleum-gas','heavy-oil','light-oil','crude-oil','wood','uranium-ore']);
function expandConstructionMaterials(machines,recipes,boundary=MATERIAL_BOUNDARY){
 const needs=new Map(),state=new Map(),order=[],stages=[],external=[];
 const add=(key,n)=>{if(!Number.isFinite(n)||n<0||n>Number.MAX_SAFE_INTEGER)throw Error('Invalid construction material quantity.');const sum=(needs.get(key)||0)+n;if(!Number.isSafeInteger(sum))throw Error('Construction quantity must be a safe whole number.');if(sum)needs.set(key,sum)};
 const recipeFor=key=>Object.hasOwn(recipes,key)?recipes[key]:undefined;
 function visit(key){
  if(state.get(key)===1)throw Error('Cyclic construction recipe: '+key);
  if(state.get(key)===2)return;
  state.set(key,1);
  const r=recipeFor(key);
  if(r&&!boundary.has(key)){
   if(!Number.isSafeInteger(r[2])||r[2]<=0||!r[4]||typeof r[4]!=='object')throw Error('Invalid recipe: '+key);
   for(const [id,q] of Object.entries(r[4])){if(!Number.isSafeInteger(q)||q<=0)throw Error('Invalid ingredient: '+id);visit(id)}
  }
  state.set(key,2);order.push(key);
 }
 for(const row of machines){add(row.key,row.remaining);if(row.remaining>0)visit(row.key)}
 for(const key of order.reverse()){
  const quantity=needs.get(key)||0;if(!quantity)continue;
  const r=recipeFor(key);
  if(boundary.has(key)||!r){external.push({key,quantity,reason:boundary.has(key)?'boundary':'missing-recipe'});continue}
  const crafts=Math.ceil(quantity/r[2]),produced=crafts*r[2];
  if(!Number.isSafeInteger(produced))throw Error('Construction quantity exceeds safe range.');
  stages.push({key,quantity,crafts,produced,surplus:produced-quantity});
  for(const [id,q] of Object.entries(r[4]))add(id,crafts*q);
 }
 return {stages,external};
}
// Independent acquisition estimates for direct requested items, not a schedule.
// Capacity is a conditional rate, not stored items; never deduct from gross bill.
function constructionSupply(rows,candidates){
 const rates=new Map();
 for(const c of candidates||[])if(typeof c.item==='string'&&Number.isFinite(c.rate)&&c.rate>0)rates.set(c.item,(rates.get(c.item)||0)+c.rate);
 return rows.filter(r=>(r.quantity??r.remaining)>0).map(r=>{
  const quantity=r.quantity??r.remaining,rate=rates.get(r.key)||0;
  return {key:r.key,quantity,rate,minutes:rate>0?quantity/rate:null};
 });
}
function projectProgress(project){
 const tasks=Array.isArray(project?.tasks)?project.tasks:[];
 return {planned:tasks.reduce((n,t)=>n+clampInt(t.planned),0),
  built:tasks.reduce((n,t)=>n+Math.min(clampInt(t.built),clampInt(t.planned)),0),
  complete:tasks.filter(t=>clampInt(t.planned)>0&&clampInt(t.built)>=clampInt(t.planned)).length,
  tasks:tasks.length};
}
// The saved blueprint remains historical; a task override describes the
// uniform profile actually installed (and used by subsequent Built actions).
function taskProfile(project,task){return task.actualProfile||project.goal}
function reconcileTaskProfile(project,recipe,patch,rows,recipes){
 const task=project?.tasks?.find(t=>t.recipe===recipe);
 if(!task||!['asm','chem'].includes(task.kind)||task.built<=0)throw Error('Record built production machines before changing their installed profile.');
 const r=recipes[recipe];if(!r||r[3]!==task.kind)throw Error('Unsupported machine recipe.');
 const effects=root.NauvisEffects||(typeof require==='function'?require('./production-effects.js'):null);
 const matching=rows.filter(x=>x.projectId===project.id&&x.projectTask===recipe),prior=recordedForTask(project,task,rows);
 if(matching.length!==1||prior.mismatch||prior.count!==task.built)throw Error('Project and Factory records differ. Reconcile counts before changing the installed profile.');
 const profile={...effects.settings(patch),machine:task.kind==='asm'?Number(patch.machine):1};
 if(task.kind==='asm'&&![.5,.75,1.25].includes(profile.machine))throw Error('Choose a supported assembler tier.');
 const effective=effects.forRecipe(recipe,task.kind,profile);
 if(effective.moduleRequested>effective.moduleSlots||!effective.moduleEligible)throw Error('The selected modules are not supported by this recipe or machine tier.');
 if(profile.beaconSpeed&&!effective.moduleSlots)throw Error('This machine does not support the selected effective beacon bonus.');
 const line=matching[0],next={...line,tier:profile.machine,moduleType:profile.moduleType,moduleCount:profile.moduleCount,moduleType2:profile.moduleType2,moduleCount2:profile.moduleCount2,machineQuality:profile.machineQuality,beaconSpeed:profile.beaconSpeed};
 return {project:{...project,tasks:project.tasks.map(t=>t===task?{...t,actualProfile:profile}:t)},rows:rows.map(x=>x===line?next:x)};
}
function recordedForTask(project,task,rows){
 const profile=taskProfile(project,task);
 const matching=(Array.isArray(rows)?rows:[]).filter(row=>row?.projectId===project.id&&row?.projectTask===task.recipe);
 const count=matching.reduce((sum,row)=>sum+clampInt(row.count),0);
 const mismatch=matching.some(row=>row.recipe!==task.recipe||
  (task.kind==='asm'&&Math.abs(Number(row.tier)-Number(profile.machine))>1e-8)||
  (task.kind!=='asset'&&(
   (row.moduleType||'none')!==(profile.moduleType||'none')||
   Number(row.moduleCount||0)!==Number(profile.moduleCount||0)||
   (row.moduleType2||'none')!==(profile.moduleType2||'none')||Number(row.moduleCount2||0)!==Number(profile.moduleCount2||0)||
   (row.machineQuality||'normal')!==(profile.machineQuality||'normal')||
   Number(row.beaconSpeed||0)!==Number(profile.beaconSpeed||0)
  )));
 return {count,mismatch};
}
function applyBuildDelta(project,recipe,delta,rows){
 if(!Number.isSafeInteger(delta)||delta===0)throw Error('Build adjustment must be a nonzero whole number.');
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
 const profile=taskProfile(project,task),tier=task.kind==='asm'?Number(profile.machine):1;
 const line=related[0];
 const effects=root.NauvisEffects||(typeof require==='function'?require('./production-effects.js'):null);
 const entityKey=line?effects.machineKey(line):task.entityKey||effects.newMachineKey(recipe,'project:'+project.id+':'+recipe);
 if(line&&(!Number.isSafeInteger(Number(line.count))||Number(line.count)<0))
  throw Error('Linked Factory line has an invalid machine count.');
 const nextRows=source.map(row=>({...row}));
 const index=source.findIndex(row=>row?.projectId===project.id&&row?.projectTask===recipe);
 if(index>=0){
  if(next===0)nextRows.splice(index,1);
  else nextRows[index]={...nextRows[index],count:next};
 }else if(next>0){
  nextRows.push({recipe,count:next,tier,destination:'Other',projectId:project.id,projectTask:recipe,entityKey,
   moduleType:profile.moduleType||'none',moduleCount:profile.moduleCount||0,moduleType2:profile.moduleType2||'none',moduleCount2:profile.moduleCount2||0,
   machineQuality:profile.machineQuality||'normal',beaconSpeed:profile.beaconSpeed||0});
 }
 return {project:{...project,tasks:project.tasks.map(t=>t.recipe===recipe?{...t,built:next,entityKey}:t)},rows:nextRows};
}
// Prepare all adjustments on copies before touching live inventory, journal or cloud.
function prepareBuildBatch(project,adjustments,rows,smelt,projects,effects){
 if(!project||project.status==='archived')throw Error('Archived projects cannot be changed.');
 if(!Array.isArray(adjustments)||!adjustments.length)throw Error('No construction changes selected.');
 let next=project,nextRows=rows,nextSmelt=smelt;const changes=[],seen=new Set();
 for(const a of adjustments){
  if(seen.has(a.recipe))throw Error('Duplicate task adjustment.');seen.add(a.recipe);
  const t=next.tasks.find(t=>t.recipe===a.recipe);
  if(!t||!Number.isSafeInteger(a.delta)||a.delta===0)throw Error('Invalid task adjustment.');
  if(!Number.isSafeInteger(t.built)||!Number.isSafeInteger(t.planned)||t.built+a.delta<0||t.built+a.delta>t.planned)throw Error('Built count must stay between zero and the planned amount.');
  const change=t.kind==='furnace'?effects.applySmeltBuildDelta(next,a.recipe,a.delta,nextSmelt,projects.map(p=>p.id===project.id?next:p)):applyBuildDelta(next,a.recipe,a.delta,nextRows);
  next=change.project;if(t.kind==='furnace')nextSmelt=change.smelt;else nextRows=change.rows;
  changes.push({recipe:a.recipe,kind:t.kind,delta:a.delta,before:t.built,after:t.built+a.delta});
 }
 return {project:next,rows:nextRows,smelt:nextSmelt,changes};
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
 module.exports={buildProject,projectProgress,recordedForTask,applyBuildDelta,prepareBuildBatch,validateProjectName,normalizeProjects,reuseClaims,validateReuseClaims,freezeDesign,constructionMaterials,expandConstructionMaterials,constructionSupply,taskProfile,reconcileTaskProfile};
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
const reviewedOverlaps=new Set(),batchAmounts=new Map();
let feedbackTimer=null,feedbackSequence=0;
const taskKey=(id,recipe)=>id+'|'+recipe;
function batchAmount(id,recipe){return batchAmounts.get(taskKey(id,recipe))??5}
function cardFor(id){return [...document.querySelectorAll('[data-project-card]')].find(x=>x.dataset.projectCard===id)}
function rowFor(id,recipe){return [...(cardFor(id)?.querySelectorAll('.project-task[data-task-row]')||[])].find(x=>x.dataset.taskRow===recipe)}
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
 if(!materials.machines.length&&!materials.unknown.length)return '';
 const row=(k,v)=>'<div class="project-design-row"><span>'+itemGlyph(k,24)+' '+escape(R[k]?.[0]||k.replaceAll('-',' '))+'</span><b>'+v+'</b></div>';
 let rawHTML='';
 try{
  const expanded=expandConstructionMaterials(materials.machines,R);
  rawHTML='<details class="project-design"><summary>Expanded raw &amp; external inputs</summary><p class="small">Alternative bill if crafting every remaining machine from scratch using standard recipes and whole crafting batches. Do not add this bill to the immediate components.</p>'+
   (expanded.external.map(x=>row(x.key,fmt(x.quantity)+(x.reason==='missing-recipe'?' · external recipe unavailable':''))).join('')||'<p class="small">None remaining.</p>')+
   '<details class="project-design"><summary>Intermediate crafting batches &amp; surplus</summary>'+
   (expanded.stages.map(x=>row(x.key,fmt(x.quantity)+' needed · '+fmt(x.crafts)+' crafts'+(x.surplus?' · '+fmt(x.surplus)+' extra':''))).join('')||'<p class="small">None remaining.</p>')+'</details>'+
   '<p class="small">Oil products are external supply boundaries; refinery coproducts, fuel, power, modules, quality and alternative recipes are not modeled. Shared ingredients are aggregated before rounding each recipe once.</p></details>';
 }catch(err){rawHTML='<p class="small">Expanded bill unavailable: '+escape(err.message)+'</p>'}
 return '<details class="project-design"><summary>Machine construction materials</summary>'+materials.machines.map(x=>row(x.key,fmt(x.remaining)+' remaining / '+fmt(x.planned))).join('')+
 '<strong>Immediate crafting ingredients for remaining machines</strong>'+
 (materials.ingredients.map(x=>row(x.key,fmt(x.quantity))).join('')||'<p class="small">None remaining or recipe unavailable.</p>')+
 (materials.unknown.length?'<p class="small">Incomplete bill: missing machine recipes or choices: '+escape(materials.unknown.join(', '))+'</p>':'')+rawHTML+
 '<details class="project-design"><summary>Existing production reference</summary><p class="small">Check explicitly available, uncommitted production lines for direct components and finished machines. Rates are conditional, not stock or reserved delivery. Estimates are independent and must not be summed into a completion time.</p><button type="button" data-project-material-supply="'+escape(p.id)+'">Check current available production</button><div data-material-supply-result aria-live="polite"></div></details>'+
 '<p class="small">Gross requirements for remaining machines only. Subtract items you already own yourself. No belt lengths, fuel, inserters, poles or installed module inventory inferred.</p></details>';
}
function checkMaterialSupply(project,button){
 const host=button.parentElement.querySelector('[data-material-supply-result]');
 try{
  const available=root.NauvisLogistics?.availableProduction?.();
  if(!available||!available.valid){host.textContent='Available production cannot be verified from the current network model.';return}
  const bill=constructionMaterials(project,R);
  const section=(label,rows)=>'<strong>'+label+'</strong>'+ (constructionSupply(rows,available.candidates).map(x=>'<div class="project-design-row"><span>'+itemGlyph(x.key,24)+' '+escape(R[x.key]?.[0]||x.key)+' · '+fmt(x.quantity)+'</span><b>'+(x.rate>0?fmt(x.rate)+'/min · '+(x.minutes<1?fmt(x.minutes*60)+' s':fmt(x.minutes)+' min'):'No eligible recorded supply')+'</b></div>').join('')||'<p class="small">None remaining.</p>');
  host.innerHTML=section('Finished machines',bill.machines)+section('Immediate ingredients',bill.ingredients)+'<p class="small">Snapshot at check time. Missing input routes remain unverified. These are separate acquisition options, not additive requirements. No inventory, project or route changes.</p>';
 }catch(err){host.textContent=err.message}
}
function furnaceRecorded(p,t){
 const field=root.NauvisEffects.SMELT_FIELDS[t.recipe];
 try{
  root.NauvisEffects.smeltOwnership(setup.smelt,allProjects());
  const count=(setup.smelt.projectBuilt||[]).find(x=>x.projectId===p.id&&x.recipe===t.recipe)?.count||0;
  return {count,mismatch:!field||count!==t.built};
 }catch(_e){return {count:0,mismatch:true}}
}
function taskProfileControls(p,t,mismatch){
 if(!['asm','chem'].includes(t.kind)||t.built<=0||mismatch)return '';
 const cfg=taskProfile(p,t),effects=root.NauvisEffects,recipe=R[t.recipe];if(!recipe)return '';
 const opts=(pairs,value)=>pairs.map(([key,label])=>'<option value="'+escape(key)+'"'+(String(key)===String(value)?' selected':'')+'>'+escape(label)+'</option>').join('');
 const line=setup.machines.find(x=>x.projectId===p.id&&x.projectTask===t.recipe);if(!line)return '';
 const output=effects.recordedRates(t.recipe,recipe,line).output;
 return '<details class="project-task-profile"><summary>Installed machine profile · '+fmt(output)+'/min rated'+(t.actualProfile?' · adjusted':'')+'</summary><p class="small">Applies to every built machine in this task and subsequent Built actions. Original blueprint and planned machine count are unchanged; compare the actual Balance after upgrading.</p><div class="project-profile-fields">'+
 (t.kind==='asm'?'<label>Assembler tier<select data-task-profile-field="machine">'+opts([[.5,'Assembler 1'],[.75,'Assembler 2'],[1.25,'Assembler 3']],cfg.machine)+'</select></label>':'')+
 '<label>Primary module<select data-task-profile-field="moduleType">'+opts(effects.MODULE_OPTIONS,cfg.moduleType||'none')+'</select></label><label>Primary slots<input type="number" min="0" max="4" step="1" data-task-profile-field="moduleCount" value="'+Number(cfg.moduleCount||0)+'"></label>'+
 '<label>Secondary module<select data-task-profile-field="moduleType2">'+opts(effects.MODULE_OPTIONS,cfg.moduleType2||'none')+'</select></label><label>Secondary slots<input type="number" min="0" max="4" step="1" data-task-profile-field="moduleCount2" value="'+Number(cfg.moduleCount2||0)+'"></label>'+
 '<label>Machine quality<select data-task-profile-field="machineQuality">'+opts(['normal','uncommon','rare','epic','legendary'].map(x=>[x,x]),cfg.machineQuality||'normal')+'</select></label><label>Effective beacon speed (%)<input type="number" min="0" max="300" step="any" data-task-profile-field="beaconSpeed" value="'+Number(cfg.beaconSpeed||0)+'"></label></div>'+
 '<button type="button" class="project-record-btn" data-project-profile="'+escape(p.id)+'" data-task-recipe="'+escape(t.recipe)+'">Record installed profile</button><p class="small">This records a physical change you have already made in-game. Does not place extra machines or change planned logistics routes.</p></details>';
}
function updateTaskProfile(p,recipe,button){
 try{
  const fields=button.closest('.project-task-profile').querySelectorAll('[data-task-profile-field]'),patch={};
  for(const input of fields){const k=input.dataset.taskProfileField;patch[k]=['machine','moduleCount','moduleCount2','beaconSpeed'].includes(k)?Number(input.value):input.value}
  const change=reconcileTaskProfile(p,recipe,patch,setup.machines,R);
  if(!root.confirm('Record this installed machine profile for the entire linked array? Actual machine count and the original blueprint remain unchanged.'))return;
  factory.projects=allProjects().map(x=>x.id===p.id?change.project:x);setup.machines=change.rows;
  root.NauvisJournal?.record?.({type:'machine-settings',source:'Construction Queue',projectId:p.id,recipe,title:'Updated installed '+(R[recipe]?.[0]||recipe)+' profile',detail:p.name+' · existing linked array; counts and original blueprint unchanged.'});
  saveSetup();save();renderSetup();notice='Installed profile reconciled. Blueprint retained; actual production rates updated.';render();
  const card=[...document.querySelectorAll('[data-project-card]')].find(x=>x.dataset.projectCard===p.id);const tasks=card?.querySelector('.project-task-details');if(tasks)tasks.open=true;
 }catch(err){root.alert(err.message)}
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
  const possibleDuplicates=task.kind==='furnace'?Math.max(0,Number(setup.smelt[root.NauvisEffects.SMELT_FIELDS[task.recipe]])-(setup.smelt.projectBuilt||[]).filter(x=>x.recipe===task.recipe).reduce((n,x)=>n+x.count,0)):isAsset?matchingUnlinkedAssets(task.recipe,p.goal.area):matchingUnlinked(task.recipe,taskProfile(p,task).machine);
  const done=task.built>=task.planned&&task.planned>0,plusDisabled=archived||done||mismatch||cannotRecord,minusDisabled=archived||task.built<=0||mismatch;
  return '<div class="project-task'+(done?' project-task-done':'')+'" data-task-row="'+escape(task.recipe)+'" style="--project-task-accent:'+color+'">'+
   '<div class="project-task-identity"><span class="project-task-led" aria-hidden="true"></span>'+itemGlyph(task.recipe,32)+'<div><strong>'+escape(R[task.recipe]?.[0]||task.recipe)+'</strong><small>'+escape(noun(task.kind))+' · '+task.planned+' planned'+(task.kind==='asm'?' · Assembler '+(taskProfile(p,task).machine===1.25?'3':taskProfile(p,task).machine===.5?'1':'2'):task.kind==='furnace'?' · '+escape(R[p.furnaceItem]?.[0]||'2× furnace'):'')+'</small></div></div>'+
   '<div class="project-task-controls"><button type="button" data-project-minus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" title="Reverse built count · removes one from actual Inventory" aria-label="Mark one fewer '+escape(task.recipe)+' built" '+(archived||task.built<=0||mismatch?'disabled':'')+'>−</button>'+
   '<span class="project-task-counter"><b>'+task.built+'</b><small>/ '+task.planned+(isAsset?' placed':' built')+'</small></span>'+
   '<button type="button" data-project-plus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" title="Mark one as built · adds one to actual Inventory" aria-label="Mark one more '+escape(task.recipe)+' built" '+(plusDisabled?'disabled':'')+'>+</button></div>'+
   '<div class="project-task-progress"><span style="width:'+(task.planned?100*task.built/task.planned:0)+'%"></span></div>'+
   '<div class="project-batch-controls"><button type="button" data-project-batch-minus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" '+(minusDisabled?'disabled':'')+'>− Batch</button><label class="project-batch-amount"><span>Batch size</span><input type="number" inputmode="numeric" min="1" max="100000" step="1" data-project-batch-size="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" aria-label="Batch size for '+escape(task.recipe)+'" value="'+batchAmount(p.id,task.recipe)+'" '+(archived?'disabled':'')+'></label><button type="button" data-project-batch-plus="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" '+(plusDisabled?'disabled':'')+'>+ Batch</button><button type="button" class="project-group-complete" data-project-group-complete="'+escape(p.id)+'" data-task-recipe="'+escape(task.recipe)+'" '+(plusDisabled?'disabled':'')+'>'+(done?'✓ Complete':'✓ Finish group')+'</button></div>'+
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
  '<span class="project-card-status">'+(archived?'ARCHIVED':pct===100?'COMPLETE':progress.built===0?'NOT STARTED':'IN PROGRESS')+'</span></div>'+
  '<div class="focus-project-progress"><div class="focus-ring focus-project-ring focus-only" style="--p:'+pct+'%" role="img" aria-label="'+pct+' percent built"><strong>'+pct+'%</strong></div><div class="project-card-progress"><div class="project-card-progress-top"><strong>'+progress.built+' / '+progress.planned+(p.type==='deployment'?' items placed':' machines built')+'</strong><span>'+pct+'%</span></div>'+
  '<div class="project-progress-track"><span style="width:'+pct+'%"></span></div></div></div>'+
  '<details class="project-task-details" '+(!archived?'open':'')+'><summary>'+(p.type==='deployment'?'Placement checklist':'Machine checklist')+' <span>'+progress.complete+' / '+progress.tasks+' groups complete</span></summary><div class="project-task-list">'+lineItems+'</div><div class="project-finish-row"><button type="button" data-project-complete="'+escape(p.id)+'" '+(archived||progress.built>=progress.planned?'disabled':'')+'>'+(progress.planned>0&&progress.built===progress.planned?'✓ Project complete':'✓ Finish entire project')+'</button><small>Only mark machines actually built in-game.</small></div></details>'+
  '<details class="project-reference"><summary>Project reference <span>Materials, design &amp; installed profiles</span></summary><div class="project-reference-body">'+designDetails(p)+materialDetails(p)+p.tasks.map(task=>{const saved=task.kind==='furnace'?furnaceRecorded(p,task):recordedForTask(p,task,setup.machines);const controls=taskProfileControls(p,task,saved.mismatch||saved.count!==task.built);return controls?'<div class="project-profile-reference" data-task-row="'+escape(task.recipe)+'"><small>'+escape(R[task.recipe]?.[0]||task.recipe)+'</small>'+controls+'</div>':''}).join('')+'</div></details>'+
  '<div class="project-card-actions"><button type="button" data-project-visit="'+escape(p.id)+'">'+(p.type==='deployment'?'View placed inventory':p.design&&root.NauvisFocus?.getMode?.()==='full'?'View saved design':'Open in Planner')+'</button>'+
  '<button type="button" data-project-rename="'+escape(p.id)+'">Rename</button>'+
  '<button type="button" data-project-archive="'+escape(p.id)+'">'+(archived?'Restore':'Archive')+'</button>'+(archived&&p.design?.reuseClaims?.length&&!p.reuseReleased&&progress.built===0?'<button type="button" data-project-release="'+escape(p.id)+'">Release reuse commitments</button>':'')+'</div>'+
 '</article>';
}
function detailStates(){
 const states=new Map();
 for(const card of document.querySelectorAll('[data-project-card]')){
  const byKey=new Map(),n=new Map();
  for(const d of card.querySelectorAll('details')){
   const base=(d.closest('[data-task-row]')?.dataset.taskRow||'card')+'|'+d.className;
   const i=n.get(base)||0;n.set(base,i+1);byKey.set(base+'|'+i,d.open);
  }
  states.set(card.dataset.projectCard,byKey);
 }
 return states;
}
function restoreDetails(states){
 for(const card of document.querySelectorAll('[data-project-card]')){
  const prior=states.get(card.dataset.projectCard);if(!prior)continue;const n=new Map();
  for(const d of card.querySelectorAll('details')){
   const base=(d.closest('[data-task-row]')?.dataset.taskRow||'card')+'|'+d.className,i=n.get(base)||0;n.set(base,i+1);
   if(prior.has(base+'|'+i))d.open=prior.get(base+'|'+i);
  }
 }
}
function render(){
 const states=detailStates(),y=root.scrollY;
 factory.projects=normalizeProjects(factory.projects);
 const legacy=legacyStats();
 if($('projectsLegacyStatus'))$('projectsLegacyStatus').textContent=legacy.done+'/'+legacy.total+' construction milestones complete';
 if($('projectsLegacyFill'))$('projectsLegacyFill').style.width=(legacy.total?Math.min(100,legacy.done/legacy.total*100):0)+'%';
 const active=visibleProjects().filter(p=>p.status!=='archived'),archived=visibleProjects().filter(p=>p.status==='archived');
 if($('projectsList'))$('projectsList').innerHTML=active.length?active.map(projectHTML).join(''):
  '<div class="project-empty"><strong>No construction projects yet</strong><p>Choose a recipe in Planner and tap Add to Construction. Your checklist appears right here.</p><button type="button" data-project-go-planner>Open Planner</button></div>';
 if($('projectsArchived'))$('projectsArchived').innerHTML=archived.map(projectHTML).join('')||'<p class="small">No archived projects.</p>';
 if($('projectsArchivedWrapper')){
  $('projectsArchivedWrapper').hidden=archived.length===0;
  $('projectsArchivedWrapper').open=showArchived;
 }
 restoreDetails(states);
 if($('projectsNotice')){$('projectsNotice').textContent=notice;$('projectsNotice').hidden=!notice}
 root.NauvisFocus?.refresh?.();
 if(document.body.dataset.workspace==='factory'&&Math.abs(root.scrollY-y)>1)root.scrollTo({top:y,behavior:'instant'});
}
function openDialog(mode,project,result,options=null){
 pendingOptions=mode==='create'?options:null;
 editing=mode==='rename'?project.id:null;
 pending=mode==='create'?result:null;
 const title=$('projectsDialogTitle'),input=$('projectsName');
 title.textContent=editing?'Rename project':'Add to Construction';
 $('projectsDialogSubmit').textContent=editing?'Save name':'Add project';
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
   notice='Added '+project.name+' to Construction. Mark machines built as you place them.';
   root.NauvisSensory?.semantic?.('queue');
   pendingOptions?.onSaved?.(project);
  }
  $('projectsDialog').close();editing=null;pending=null;pendingOptions=null;render();
  activateWorkspace('factory',true);
 }catch(err){
  $('projectsDialogError').textContent=err.message;$('projectsDialogError').hidden=false;root.NauvisSensory?.semantic?.('warning');
 }
}
function anchorPosition(id,recipe){
 const target=recipe?rowFor(id,recipe):cardFor(id);
 return {y:root.scrollY,top:target?.getBoundingClientRect().top??null};
}
function restorePosition(id,recipe,anchor){
 if(document.body.dataset.workspace!=='factory')return;
 const el=recipe?rowFor(id,recipe):cardFor(id);
 const top=el?.getBoundingClientRect().top;
 const y=top!=null&&anchor.top!=null?root.scrollY+top-anchor.top:anchor.y;
 root.scrollTo({top:Math.max(0,y),behavior:'instant'});
}
function positiveFeedback(id,recipe,delta,groupDone,projectDone){
 const seq=++feedbackSequence,el=projectDone?cardFor(id):recipe?rowFor(id,recipe):cardFor(id);
 if(el){el.classList.remove('project-celebrate','project-count-flash');void el.offsetWidth;el.classList.add(groupDone||projectDone?'project-celebrate':'project-count-flash')}
 let toast=$('projectFeedbackToast');
 if(!toast){toast=document.createElement('div');toast.id='projectFeedbackToast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.append(toast)}
 toast.textContent=projectDone?'🏆 Project complete!':groupDone?'✓ Group complete!':(delta>0?'+'+delta+' built':Math.abs(delta)+' reversed');
 toast.className='project-feedback-toast'+(projectDone?' project-feedback-win':groupDone?' project-feedback-group':'');toast.hidden=false;
 if(feedbackTimer!==null)clearTimeout(feedbackTimer);
 feedbackTimer=setTimeout(()=>{if(seq===feedbackSequence)toast.hidden=true;el?.classList.remove('project-celebrate','project-count-flash')},projectDone?2500:groupDone?1800:1000);
 root.NauvisSensory?.semantic?.(projectDone?'complete':groupDone?'phase':delta>0?'build':'reverse',el);
}
function updateBuiltBatch(id,adjustments,recipe=null){
 const project=selectedProject(id);if(!project||project.status==='archived')return;
 const anchor=anchorPosition(id,recipe),before=projectProgress(project);
 try{
  const actual=allProjects(),effects=root.NauvisEffects;
  // Validate every task first; project completion is all-or-nothing.
  const change=prepareBuildBatch(project,adjustments,setup.machines,setup.smelt,actual,effects);
  const overlaps=[];
  for(const item of change.changes){
   if(item.delta<=0||reviewedOverlaps.has(taskKey(id,item.recipe)))continue;
   const task=project.tasks.find(t=>t.recipe===item.recipe),field=effects.SMELT_FIELDS[item.recipe];
   const overlap=task.kind==='furnace'?Math.max(0,Number(setup.smelt[field]||0)-(effects.smeltOwnership(setup.smelt,actual)[field]||0)):matchingUnlinked(item.recipe,taskProfile(project,task).machine);
   if(overlap>0)overlaps.push({recipe:item.recipe,count:overlap,delta:item.delta});
  }
  if(overlaps.length&&!root.confirm(overlaps.map(x=>x.count+' matching '+(R[x.recipe]?.[0]||x.recipe)+' already recorded; adding '+x.delta+' new.').join('\n')+'\n\nConfirm these are physically built machines not already counted.'))return;
  for(const x of overlaps)reviewedOverlaps.add(taskKey(id,x.recipe));
  factory.projects=actual.map(p=>p.id===id?change.project:p);
  setup.machines=change.rows;Object.assign(setup.smelt,change.smelt);
  const totalDelta=change.changes.reduce((n,x)=>n+x.delta,0),after=projectProgress(change.project);
  const title=change.changes.length>1?(totalDelta>0?'Completed project · +'+totalDelta+' built':'Reversed project progress'):(totalDelta>0?'Built +'+totalDelta+' ':'Reversed −'+Math.abs(totalDelta)+' ')+(R[change.changes[0].recipe]?.[0]||change.changes[0].recipe);
  root.NauvisJournal?.record?.({type:'construction',source:'Construction Queue',projectId:id,recipe:recipe||null,delta:totalDelta,before:recipe?change.changes[0].before:before.built,after:recipe?change.changes[0].after:after.built,title,detail:project.name+' · '+change.changes.map(x=>(R[x.recipe]?.[0]||x.recipe)+' '+x.before+' → '+x.after).join('; ')+' · actual Inventory updated once.'});
  saveSetup();save();renderSetup();
  notice='';render();root.NauvisAssets?.render?.();
  restorePosition(id,recipe,anchor);
  const groupDone=!!recipe&&totalDelta>0&&change.project.tasks.find(t=>t.recipe===recipe).built===change.project.tasks.find(t=>t.recipe===recipe).planned;
  const projectDone=totalDelta>0&&after.planned>0&&after.built===after.planned;
  positiveFeedback(id,recipe,totalDelta,groupDone,projectDone);
 }catch(err){notice=err.message;render();restorePosition(id,recipe,anchor);root.NauvisSensory?.semantic?.('warning')}
}
function updateBuilt(id,recipe,delta){updateBuiltBatch(id,[{recipe,delta}],recipe)}
function batchBuilt(project,recipe,sign){
 const t=project.tasks.find(t=>t.recipe===recipe);if(!t)return;
 const input=rowFor(project.id,recipe)?.querySelector('[data-project-batch-size]'),n=Number(input?.value??batchAmount(project.id,recipe));
 if(!Number.isSafeInteger(n)||n<1||n>100000){input?.reportValidity();return}
 batchAmounts.set(taskKey(project.id,recipe),n);
 const delta=sign*Math.min(n,sign>0?t.planned-t.built:t.built);if(delta)updateBuilt(project.id,recipe,delta);
}
function completeGroup(project,recipe){
 const t=project.tasks.find(t=>t.recipe===recipe);if(t&&t.planned>t.built)updateBuilt(project.id,recipe,t.planned-t.built);
}
function completeProject(project){
 const changes=project.tasks.filter(t=>t.planned>t.built).map(t=>({recipe:t.recipe,delta:t.planned-t.built}));
 if(!changes.length)return;
 const count=changes.reduce((n,t)=>n+t.delta,0);
 if(root.confirm('Mark all '+count+' remaining machines in '+project.name+' as physically built? This updates actual Inventory and the journal together.'))updateBuiltBatch(project.id,changes);
}
function navigateToPlan(id){
 const project=selectedProject(id);if(!project)return;
 if(project.type==='deployment'){
  activateWorkspace('setup',true);
  root.NauvisWorkspace?.jump?.('setup','#setupAssetsPanel');
  return;
 }
 if(project.design&&root.NauvisFocus?.getMode?.()==='full'){root.NauvisLogistics?.viewSavedDesign?.(project);return}
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
 $('factory')?.addEventListener('input',event=>{const b=event.target;if(b.matches('[data-project-batch-size]')){const n=Number(b.value);if(Number.isSafeInteger(n)&&n>=1&&n<=100000)batchAmounts.set(taskKey(b.dataset.projectBatchSize,b.dataset.taskRecipe),n)}});
 $('factory')?.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.matches('[data-project-go-planner]')){activateWorkspace('build',true);return}
  const id=b.dataset.projectPlus||b.dataset.projectMinus||b.dataset.projectBatchPlus||b.dataset.projectBatchMinus||b.dataset.projectGroupComplete||b.dataset.projectComplete||b.dataset.projectVisit||b.dataset.projectRename||b.dataset.projectArchive||b.dataset.projectRelease||b.dataset.projectMaterialSupply||b.dataset.projectProfile;
  if(!id)return;
  const project=selectedProject(id);
  if(!project)return;
  if(b.hasAttribute('data-project-profile')){updateTaskProfile(project,b.dataset.taskRecipe,b);return}
  if(b.hasAttribute('data-project-material-supply')){checkMaterialSupply(project,b);return}
  if(b.hasAttribute('data-project-release')){
   if(project.status!=='archived'||projectProgress(project).built!==0||project.reuseReleased||!project.design?.reuseClaims?.length)return;
   if(!root.confirm('Release this cancelled, unbuilt project’s planned supply commitments? Its saved design remains historical and cannot be restored.'))return;
   setProjects(allProjects().map(p=>p.id===id?{...p,reuseReleased:true}:p),{type:'project',source:'Construction Queue',projectId:id,title:'Released reuse commitments',detail:project.name+' · cancelled unbuilt plan'});return;
  }
  if(b.hasAttribute('data-project-plus'))updateBuilt(id,b.dataset.taskRecipe,1);
  else if(b.hasAttribute('data-project-minus'))updateBuilt(id,b.dataset.taskRecipe,-1);
  else if(b.hasAttribute('data-project-batch-plus'))batchBuilt(project,b.dataset.taskRecipe,1);
  else if(b.hasAttribute('data-project-batch-minus'))batchBuilt(project,b.dataset.taskRecipe,-1);
  else if(b.hasAttribute('data-project-group-complete'))completeGroup(project,b.dataset.taskRecipe);
  else if(b.hasAttribute('data-project-complete'))completeProject(project);
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
