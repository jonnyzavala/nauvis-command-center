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
function machineSupply(recipes,recipe,machineType,machines,effects){
 const r=recipes[recipe];if(!r||!['furnace','asm','chem'].includes(r[3]))throw Error('Choose a supported production recipe.');
 const n=Number(machines);if(!Number.isSafeInteger(n)||n<0||n>100000)throw Error('Enter a whole machine count from 0 to 100,000.');
 const profile=r[3]==='furnace'?{furnaceType:machineType}:r[3]==='asm'?{machine:Number(machineType)}:{machine:1};
 if(r[3]==='furnace'&&!['stone','steel','electric'].includes(machineType)||r[3]==='asm'&&![.5,.75,1.25].includes(profile.machine))throw Error('Choose a valid machine type.');
 const rate=effects.recipeRates(recipe,r,profile,n),unit=effects.recipeRates(recipe,r,profile,1).output;
 return {recipe,name:r[0],count:n,unit,output:rate.output,inputs:rate.inputs};
}
function progress(projects){
 const active=(Array.isArray(projects)?projects:[]).filter(p=>p.status!=='archived');
 const items=active.flatMap(p=>Array.isArray(p.tasks)?p.tasks:[]);
 const planned=items.reduce((n,t)=>n+cap(t.planned),0),built=items.reduce((n,t)=>n+Math.min(cap(t.planned),cap(t.built)),0);
 return {active:active.length,planned,built,remaining:planned-built,pct:planned?built/planned*100:0,complete:active.filter(p=>p.tasks?.length&&p.tasks.every(t=>cap(t.planned)>0&&cap(t.built)>=cap(t.planned))).length};
}
if(typeof module==='object'&&module.exports)module.exports={TIERS,DEFAULT,normalize,analyze,progress,machineSupply};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1}),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let flowView='blueprint';
let mode='focus',state=normalize({...DEFAULT,item:'Resource',supply:0,branches:[]}),planInputs=[],sourceCalc={recipe:'iron-plate',type:'steel',count:0};
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
 if(view==='flow'){refreshPlanInputs();showFlow(flowView)}refresh();
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
function opts(tier){return Object.entries(TIERS).map(([k,v])=>'<option value="'+k+'" '+(tier===k?'selected':'')+'>'+k[0].toUpperCase()+k.slice(1)+' · '+fmt(v)+'/min</option>').join('')}
function field(name,k,v,type='number'){return '<label>'+esc(name)+'<input data-flow-field="'+k+'" type="'+type+'" '+(type==='number'?'min="0" max="1000000" step="any" inputmode="decimal"':'maxlength="64"')+' value="'+esc(v)+'"></label>'}
function beltFields(b,prefix){return '<label>Belt tier<select data-flow-field="'+prefix+'tier">'+opts(b.tier)+'</select></label>'+field('Belts',prefix+'belts',b.belts)+'<label>Lane usage<select data-flow-field="'+prefix+'lanes"><option value="2" '+(b.lanes===2?'selected':'')+'>Both lanes</option><option value="1" '+(b.lanes===1?'selected':'')+'>One lane</option></select></label>'}
function machineTypes(recipe){const kind=R[recipe]?.[3];return kind==='furnace'?[['stone','Stone furnace'],['steel','Steel furnace'],['electric','Electric furnace']]:kind==='asm'?[['0.5','Assembler 1'],['0.75','Assembler 2'],['1.25','Assembler 3']]:[['1','Chemical plant']]}
function supplyPreview(){
 const out=$('focusSupplyPreview');if(!out)return;
 try{const a=machineSupply(R,sourceCalc.recipe,sourceCalc.type,sourceCalc.count,root.NauvisEffects),belt=TIERS[state.tier]*Number(state.lanes)/2;out.innerHTML='<strong>'+fmt(a.output)+'<small> /min rated</small></strong><span>'+fmt(a.unit)+'/min per machine · '+Math.ceil(a.output/belt)+' '+esc(state.tier)+' belt(s), '+(state.lanes==1?'one lane':'both lanes')+'</span><small>Unboosted normal-quality machines, continuous ingredients and power. Enter observed output manually if actual rates differ.</small>'}catch(err){out.textContent=err.message}
}
function supplyPanel(){
 const recipes=Object.entries(R).filter(([k,r])=>['asm','chem','furnace'].includes(r[3])&&!FLUID.has(k)).sort((a,b)=>a[1][0].localeCompare(b[1][0]));
 return '<details id="focusSupplyCalculator" class="focus-supply-calculator"><summary>Calculate supply from machines <span>↗</span></summary><div class="focus-flow-fields"><label>Output recipe<select id="focusSourceRecipe">'+recipes.map(([k,r])=>'<option value="'+esc(k)+'" '+(k===sourceCalc.recipe?'selected':'')+'>'+esc(r[0])+'</option>').join('')+'</select></label><label>Machine type<select id="focusSourceType">'+machineTypes(sourceCalc.recipe).map(([k,v])=>'<option value="'+esc(k)+'" '+(k===sourceCalc.type?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><label>Machine count<input type="number" id="focusSourceCount" min="0" max="100000" step="1" inputmode="numeric" value="'+esc(sourceCalc.count)+'"></label></div><div id="focusSupplyPreview" class="focus-supply-result"></div><button type="button" data-flow-action="use-machine-supply">Use calculated supply</button></details>';
}
function renderInputs(){
 const host=$('focusFlowInputs');if(!host)return;
 host.innerHTML=(planInputs.length?'<div class="focus-flow-policy"><label>Use a planned input<select id="focusPlanInput"><option value="">Choose material from this blueprint</option>'+planInputs.map((x,i)=>'<option value="'+i+'">'+esc(x.name)+' · '+fmt(x.needed)+'/min</option>').join('')+'</select></label><button type="button" data-flow-action="load-plan">Load selected input</button></div>':'')+'<div class="focus-flow-fields">'+field('Resource','item',state.item,'text')+field('Available supply / min','supply',state.supply)+beltFields(state,'')+'</div>'+supplyPanel()+'<div class="focus-flow-policy"><label>Distribution model<select data-flow-field="policy"><option value="automatic" '+(state.policy==='automatic'?'selected':'')+'>Automatic · redistribute unused capacity</option><option value="fixed" '+(state.policy==='fixed'?'selected':'')+'>Fixed shares · no redistribution</option></select></label></div><div class="focus-flow-branches">'+state.branches.map((b,i)=>'<article class="focus-branch-input"><div class="focus-branch-heading"><strong>Destination '+(i+1)+'</strong><button type="button" data-flow-remove="'+i+'" aria-label="Remove destination '+(i+1)+'">×</button></div><div class="focus-flow-fields">'+field('Name','b:'+i+':name',b.name,'text')+field('Demand / min','b:'+i+':demand',b.demand)+beltFields(b,'b:'+i+':')+(state.policy==='fixed'?field('Relative share','b:'+i+':weight',b.weight):'')+'</div></article>').join('')+'</div><div class="focus-flow-actions"><button type="button" data-flow-action="add" '+(state.branches.length>=8?'disabled':'')+'>+ Add destination</button><button type="button" data-flow-action="example">Load example</button><button type="button" data-flow-action="clear">Clear check</button></div>';supplyPreview();
}
function saveFlow(){try{localStorage.setItem(FLOW,JSON.stringify(state))}catch{}}
function refreshPlanInputs(result=root.NauvisRatioExplorer?.currentResult?.()){
 if(!result)return;
 const tier=Object.keys(TIERS).find(k=>TIERS[k]===result.belt)||'red';
 planInputs=(result.external||[]).filter(x=>!x.isFluid).map(x=>({key:x.key,name:x.name,needed:x.needed,tier,destination:result.name+' blueprint'}));
}
function showFlow(next){
 flowView=next==='quick'?'quick':'blueprint';
 $('focusBlueprintBelts').hidden=flowView!=='blueprint';
 $('focusQuickSplit').hidden=flowView!=='quick';
 document.querySelectorAll('[data-flow-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flowView===flowView)));
 if(flowView==='blueprint')root.NauvisRatioExplorer?.renderBeltView?.($('focusBlueprintBelts'));
 else{refreshPlanInputs();renderInputs();renderResults()}
}
function openEditor(kind,index){
 const editor=$('focusFlowEditor');editor.open=true;
 let target=editor;
 if(kind==='source'){const calc=$('focusSupplyCalculator');calc.open=true;target=calc}
 if(kind==='destination')target=editor.querySelectorAll('.focus-branch-input')[index]||editor;
 if(kind==='transport')target=editor.querySelector('[data-flow-field="tier"]')?.closest('label')||editor;
 target.scrollIntoView({block:'center',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function renderResults(){
 const host=$('focusFlowResults');if(!host)return;
 const a=analyze(state),pct=a.demand?Math.min(100,100*a.delivered/a.demand):0,good=a.demand>0&&a.shortage<1e-6;
 const diagnosis=!a.demand?'Enter destination demand':good?'Modeled demand covered':a.productionGap>0?'Production shortage':a.trunkGap>0?'Supply belt bottleneck':'Distribution / branch bottleneck';
 const lines=root.NauvisRatioFlow.beltLines;
 const routeCaption=b=>b.belts+' × '+b.tier+' · '+fmt(TIERS[b.tier])+'/min per full belt'+(b.lanes===1?' · one lane used':'');
 const rows=a.rows.map((b,i)=>'<div class="physical-branch"><div class="physical-branch-route"><small>'+esc(routeCaption(b))+'</small>'+lines(b.belts,b.tier)+'<small>'+fmt(b.capacity)+'/min usable · '+fmt(b.delivered)+'/min delivered</small></div><article class="physical-node"><button type="button" class="focus-node-label" data-flow-edit="destination" data-flow-index="'+i+'">'+esc(b.name)+' <span>✎</span></button><strong>'+fmt(b.delivered)+' / '+fmt(b.demand)+'/min</strong><small>'+(b.short>1e-6?fmt(b.short)+'/min short':b.demand?'Demand covered':'No demand')+' · '+Math.ceil(b.demand/(TIERS[b.tier]*b.lanes/2))+' belt(s) needed</small></article></div>').join('');
 const diagram='<div class="physical-split-map"><div class="physical-node physical-source"><button type="button" class="focus-node-label" data-flow-edit="source">'+esc(a.s.item)+' <span>✎</span></button><strong>'+fmt(a.s.supply)+'/min supply</strong><small>'+Math.ceil(a.demand/(TIERS[a.s.tier]*a.s.lanes/2))+' '+esc(a.s.tier)+' supply belts needed for demand</small></div><div class="physical-trunk"><span>'+esc(routeCaption(a.s))+'</span>'+lines(a.s.belts,a.s.tier,true)+'<small>'+fmt(a.capacity)+'/min usable capacity · '+fmt(a.incoming)+'/min available to distribute</small></div><button type="button" class="physical-junction" data-flow-edit="transport">'+esc(a.s.policy==='fixed'?'Fixed allocation':'Splitter / distribution')+' · Edit belts</button><div class="physical-branches">'+(rows||'<p>Add a destination to check the split.</p>')+'</div><small class="physical-legend">One colored line = one physical belt. Color = belt tier. Rates are modeled totals, not individual belt loading.</small></div>';
 host.innerHTML=diagram+'<div class="focus-flow-metrics"><div><small>AVAILABLE SUPPLY</small><strong>'+fmt(a.s.supply)+'</strong><span>/min</span></div><div><small>TOTAL DEMAND</small><strong>'+fmt(a.demand)+'</strong><span>/min</span></div><div><small>DELIVERED</small><strong>'+fmt(a.delivered)+'</strong><span>/min</span></div></div><div class="focus-flow-report '+(good?'good':a.shortage?'warn':'')+'"><div class="focus-ring" style="--p:'+pct+'%" role="img" aria-label="'+fmt(pct)+' percent modeled coverage"><strong>'+Math.round(pct)+'%</strong><small>COVERAGE</small></div><div><h3>'+diagnosis+'</h3><p>'+(!a.demand?'No positive demand entered.':good?'Enough supply and transport in this simplified scenario.':fmt(a.shortage)+'/min total short')+'</p><small>Production gap '+fmt(a.productionGap)+' · trunk gap '+fmt(a.trunkGap)+' · branch/allocation gap '+fmt(a.distributionGap)+'</small></div></div><div class="focus-flow-quick-actions"><button type="button" data-flow-edit="source">+ Set source</button><button type="button" data-flow-edit="transport">Edit belts</button><button type="button" data-flow-edit="add" '+(a.rows.length>=8?'disabled':'')+'>+ Destination</button><button type="button" data-flow-edit="example">Load example</button></div><p class="focus-flow-note">Undelivered incoming supply: '+fmt(a.unused)+'/min. '+(a.s.policy==='fixed'?'Fixed shares are a hypothetical allocation, not a literal splitter behavior.':'Automatic assumes equal split with redistribution from backed-up branches.')+' Assumes stated supply and unstacked solid belts, no inserter, geometry, priority or fluid constraints. These are local what-if inputs, not actual Inventory.</p>';
}
$('focusFlowInputs')?.addEventListener('input',e=>{
 if(e.target.id==='focusSourceCount'){sourceCalc.count=e.target.value;supplyPreview();return}const k=e.target.dataset.flowField;if(!k)return;const parts=k.split(':');let v=e.target.value;
 if(parts[0]==='b'){if(state.branches[Number(parts[1])])state.branches[Number(parts[1])][parts[2]]=v}else state[k]=v;
 saveFlow();renderResults();supplyPreview();
});
$('focusFlowInputs')?.addEventListener('change',e=>{if(e.target.id==='focusSourceRecipe'){sourceCalc.recipe=e.target.value;const options=machineTypes(sourceCalc.recipe);sourceCalc.type=options.find(([k])=>k===sourceCalc.type)?.[0]||options[0][0];$('focusSourceType').innerHTML=options.map(([k,v])=>'<option value="'+esc(k)+'" '+(k===sourceCalc.type?'selected':'')+'>'+esc(v)+'</option>').join('');supplyPreview();return}if(e.target.id==='focusSourceType'){sourceCalc.type=e.target.value;supplyPreview();return}if(e.target.id==='focusSourceCount'){sourceCalc.count=e.target.value;supplyPreview();return}if(!e.target.dataset.flowField)return;const k=e.target.dataset.flowField,parts=k.split(':'),policy=k==='policy';if(parts[0]==='b'){if(state.branches[Number(parts[1])])state.branches[Number(parts[1])][parts[2]]=e.target.value}else state[k]=e.target.value;state=normalize(state);saveFlow();if(policy)renderInputs();renderResults()});
$('focusFlowInputs')?.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.flowAction==='use-machine-supply'){try{const a=machineSupply(R,sourceCalc.recipe,sourceCalc.type,sourceCalc.count,root.NauvisEffects);if(state.branches.length&&state.item!=='Resource'&&state.item.toLowerCase().replace(/s$/,'')!==a.name.toLowerCase().replace(/s$/,'')&&!root.confirm('Change the resource to '+a.name+'? Existing destination rates will be retained.'))return;state.item=a.name;state.supply=a.output}catch(err){$('focusSupplyPreview').textContent=err.message;return}}
 else if(b.dataset.flowAction==='load-plan'){const i=$('focusPlanInput')?.value;if(i===''||!planInputs[Number(i)])return;const x=planInputs[Number(i)];loadMaterial({...x,belt:TIERS[x.tier]});return}
 else if(b.dataset.flowRemove!==undefined)state.branches.splice(Number(b.dataset.flowRemove),1);
 else if(b.dataset.flowAction==='add'&&state.branches.length<8)state.branches.push({name:'Destination '+(state.branches.length+1),demand:0,tier:state.tier,belts:1,lanes:2,weight:1});
 else if(b.dataset.flowAction==='example')state=normalize(DEFAULT);
 else if(b.dataset.flowAction==='clear')state=normalize({...DEFAULT,item:'',supply:0,branches:[]});
 else return;
 state=normalize(state);saveFlow();renderInputs();renderResults();
});
$('focusModeToggle')?.addEventListener('click',()=>setMode(mode==='focus'?'full':'focus'));
document.querySelectorAll('[data-focus-view]').forEach(b=>b.addEventListener('click',()=>root.activateWorkspace(b.dataset.focusView,true)));
document.addEventListener('click',e=>{const b=e.target.closest('[data-focus-jump]');if(b)root.activateWorkspace(b.dataset.focusJump,true)});
document.querySelectorAll('[data-flow-view]').forEach(b=>b.addEventListener('click',()=>showFlow(b.dataset.flowView)));
 document.querySelectorAll('[data-flow-open-network]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.flowOpenNetwork==='actual'){root.NauvisLogistics?.openActualNetwork?.();return}
  const result=root.NauvisRatioExplorer?.currentResult?.();if(result?.entries?.length&&result.rate>0)root.NauvisLogistics?.previewBlueprint?.(result,true);else root.alert('Choose a production target in Planner first.');
 }));
 $('focusFlowResults')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-flow-edit]');if(!b)return;
  const kind=b.dataset.flowEdit;
  if(kind==='add'||kind==='example'){const action=$('focusFlowInputs').querySelector('[data-flow-action="'+kind+'"]');action?.click();if(kind==='add')openEditor('destination',state.branches.length-1);return}
  openEditor(kind,Number(b.dataset.flowIndex));
 });
 function loadMaterial(x){
  if(state.branches.length&&!root.confirm('Replace this quick check with '+x.name+' demand?'))return false;
  const tier=Object.keys(TIERS).find(k=>TIERS[k]===x.belt)||'red',neededBelts=Math.max(1,Math.ceil(x.needed/TIERS[tier]));
  if(R[x.key]&&['asm','chem','furnace'].includes(R[x.key][3])){sourceCalc.recipe=x.key;sourceCalc.type=R[x.key][3]==='furnace'?'steel':R[x.key][3]==='asm'?'0.75':'1';sourceCalc.count=0}
  state=normalize({...DEFAULT,item:x.name,supply:0,tier,belts:neededBelts,branches:[{name:x.destination,demand:x.needed,tier,belts:neededBelts,lanes:2,weight:1}]});
  saveFlow();showFlow('quick');return true
 }
 function fromPlan(result){refreshPlanInputs(result);flowView='blueprint';root.activateWorkspace('flow',true)}
root.NauvisFocus={setMode,beforeActivate,onActivate,refresh,fromPlan,checkMaterial:loadMaterial,getMode:()=>mode,analyze:()=>analyze(state)};
// Safari may expose a visual viewport smaller than the fixed layout viewport.
const dock=$('commandDock');
function pinDock(){const vv=root.visualViewport;if(!dock)return;const offset=vv&&vv.scale===1?Math.max(0,document.documentElement.clientHeight-vv.height-vv.offsetTop):0;dock.style.setProperty('--dock-viewport-offset',offset+'px')}
root.visualViewport?.addEventListener('resize',pinDock,{passive:true});root.visualViewport?.addEventListener('scroll',pinDock,{passive:true});root.addEventListener('resize',pinDock,{passive:true});pinDock();
renderInputs();renderResults();applyMode(mode,mode==='focus'?'build':'balance');
})(typeof window==='undefined'?globalThis:window);
