/* NAUVIS v0.20 · Recipe Ratio Explorer
   Analysis is pure and does not write to Existing Factory, guide or cloud.
   The Send action explicitly hands one hypothetical goal to Build Next. */
(function(root){
'use strict';
const cloneSet=x=>x instanceof Set?x:new Set(x||[]);
const assertFiniteRate=(n,field)=>{
 const v=Number(n);
 if(n===null||n===undefined||String(n).trim()===''||!Number.isFinite(v)||v<0||v>25000)throw Error(field+' must be between 0 and 25,000 per minute.');
 return v;
};
function analyzeRecipeRatios(recipes,query,context){
 const id=query.id,recipe=recipes[id],rate=assertFiniteRate(query.rate,'Target');
 if(!recipe)throw Error('Choose a supported recipe.');
 const speed=Number(query.machine),belt=Number(query.belt),source=query.source;
 if(![.75,1.25].includes(speed))throw Error('Choose an available assembler tier.');
 if(![900,1800,2700].includes(belt))throw Error('Choose a supported transport belt.');
 if(!['bus','raw'].includes(source))throw Error('Choose bus-fed or raw-material inputs.');
 const effectsLib=root.NauvisEffects||(typeof require==='function'?require('./production-effects.js'):null);
 const effectiveFor=(item,r)=>{
  if(effectsLib)return effectsLib.forRecipe(item,r[3],query);
  const machineSpeed=r[3]==='asm'?speed:r[3]==='furnace'?2:1;
  return {machineSpeed,productivityBonus:0,moduleApplied:0,moduleSlots:0,
   moduleEligible:true,qualityFactor:1,energyFactor:1,beaconSpeed:0};
 };
 const bus=cloneSet(context.stopBus),raw=cloneSet(context.stopRaw),stop=source==='bus'?bus:raw;
 const fluid=cloneSet(context.fluids);
 const amounts=new Map(),supplies=new Map(),stack=new Set();
 function add(item,quantity,rootItem){
  if(quantity<1e-9)return;
  if(!recipes[item]||(!rootItem&&stop.has(item))){
   supplies.set(item,(supplies.get(item)||0)+quantity);return;
  }
  if(stack.has(item))throw Error('A circular recipe dependency was found for '+item+'.');
  const r=recipes[item];
  if(!Number.isFinite(r[1])||r[1]<=0||!Number.isFinite(r[2])||r[2]<=0)throw Error('Invalid recipe parameters for '+item+'.');
  amounts.set(item,(amounts.get(item)||0)+quantity);
  stack.add(item);
  for(const [ingredient,count] of Object.entries(r[4]||{})){
   if(!Number.isFinite(count)||count<0)throw Error('Invalid ingredient quantity for '+item+'.');
   const profile=effectiveFor(item,r);
   const produced=r[2]*(1+profile.productivityBonus);
   add(ingredient,quantity/produced*count,false);
  }
  stack.delete(item);
 }
 add(id,rate,true);
 const depthMemo=new Map();
 function depth(item,seen=new Set()){
  if(depthMemo.has(item))return depthMemo.get(item);
  if(seen.has(item))throw Error('Circular recipe dependencies.');
  seen.add(item);
  const children=Object.keys(recipes[item][4]||{}).filter(x=>amounts.has(x));
  const count=children.length?1+Math.max(...children.map(x=>depth(x,new Set(seen)))):0;
  depthMemo.set(item,count);return count;
 }
 const entries=[...amounts].map(([key,needed])=>{
  const r=recipes[key],kind=r[3],profile=effectiveFor(key,r),machineSpeed=profile.machineSpeed;
  const effectiveOutputPerCraft=r[2]*(1+profile.productivityBonus);
  const perMachine=effectsLib?.recipeRates?effectsLib.recipeRates(key,r,query,1).output:60*effectiveOutputPerCraft*machineSpeed/r[1];
  const exact=needed/perMachine,rounded=needed?Math.ceil(exact-1e-10):0;
  return {
   key,name:r[0],kind,needed,perMachine,exact,count:rounded,
   craftSeconds:r[1],outputPerCraft:r[2],effectiveOutputPerCraft,machineSpeed,
   productivityBonus:profile.productivityBonus,qualityFactor:profile.qualityFactor,
   moduleApplied:profile.moduleApplied,moduleSlots:profile.moduleSlots,
   moduleEligible:profile.moduleEligible,energyFactor:profile.energyFactor,
   beaconSpeed:profile.beaconSpeed,
   craftsPerMinute:needed/effectiveOutputPerCraft,
   ingredients:Object.entries(r[4]||{}).map(([input,perCraft])=>({
     id:input,name:recipes[input]?.[0]||context.names?.[input]||input,
     perCraft,needed:needed/effectiveOutputPerCraft*perCraft,fluid:fluid.has(input)
   })),
   depth:depth(key)
  };
 }).sort((a,b)=>a.depth-b.depth||a.name.localeCompare(b.name));
 const external=[...supplies].map(([key,needed])=>({
   key,name:recipes[key]?.[0]||context.names?.[key]||key,needed,
   isFluid:fluid.has(key),belts:fluid.has(key)?null:Math.ceil(needed/belt-1e-10)
 })).sort((a,b)=>b.needed-a.needed||a.name.localeCompare(b.name));
 const outputStream={
   key:id,name:recipe[0],needed:rate,isFluid:fluid.has(id),
   belts:fluid.has(id)?null:rate?Math.ceil(rate/belt-1e-10):0
 };
 const roundedTotal=entries.reduce((sum,row)=>sum+row.count,0);
 const exactTotal=entries.reduce((sum,row)=>sum+row.exact,0);
 return {id,name:recipe[0],rate,machine:speed,source,belt,
   moduleType:query.moduleType||'none',moduleCount:query.moduleCount||0,moduleType2:query.moduleType2||'none',moduleCount2:query.moduleCount2||0,
   machineQuality:query.machineQuality||'normal',beaconSpeed:query.beaconSpeed||0,
   entries,external,outputStream,roundedTotal,exactTotal,
   kinds:entries.reduce((out,row)=>{out[row.kind]=(out[row.kind]||0)+row.count;return out},{asm:0,chem:0,furnace:0})};
}
const RECIPE_GROUPS=['Science & research','Circuits & components','Raw materials & fluids','Production machines','Belts & logistics','Power & mining','Trains & vehicles','Military & equipment','Modules & beacons','Construction & other'];
function recipeGroup(id){
 if(/science-pack$|^lab$/.test(id))return RECIPE_GROUPS[0];
 if(/^(speed|efficiency|productivity|quality)-module|^beacon$/.test(id))return RECIPE_GROUPS[8];
 if(/turret|ammo|magazine|shell|grenade|armor|equipment|capsule|^rocket$|launcher|land-mine|atomic-bomb|shotgun|submachine-gun|flamethrower/.test(id))return RECIPE_GROUPS[7];
 if(/locomotive|wagon|^rail$|^rail-|train-stop|^car$|^tank$|spidertron/.test(id))return RECIPE_GROUPS[6];
 if(/belt|splitter|inserter|chest|roboport|construction-robot|logistic-robot|pipe|^pump$|storage-tank|combinator|speaker|display-panel|^radar$/.test(id))return RECIPE_GROUPS[4];
 if(/mining-drill|pumpjack|solar-panel|accumulator|steam-engine|steam-turbine|boiler|electric-pole|substation|nuclear-reactor|heat-exchanger|heat-pipe|offshore-pump|power-switch|small-lamp/.test(id))return RECIPE_GROUPS[5];
 if(/assembling-machine|furnace|chemical-plant|oil-refinery|centrifuge|rocket-silo|cargo-landing-pad/.test(id))return RECIPE_GROUPS[3];
 if(/circuit|processing-unit|copper-cable|iron-gear-wheel|iron-stick|engine-unit|flying-robot-frame|battery$|low-density-structure/.test(id))return RECIPE_GROUPS[1];
 if(/plate$|brick$|plastic-bar|sulfur|fuel|uranium-|lubricant|barrel$|petroleum-gas|heavy-oil|light-oil|^explosives$/.test(id))return RECIPE_GROUPS[2];
 return RECIPE_GROUPS[9];
}
function recipeMatches(order,recipes,category='all',query=''){
 const q=String(query).trim().toLowerCase();
 return [...new Set(order)].filter(id=>recipes[id]&&(category==='all'||recipeGroup(id)===category)&&(!q||id.includes(q.replace(/\s+/g,'-'))||recipes[id][0].toLowerCase().includes(q))).sort((a,b)=>recipes[a][0].localeCompare(recipes[b][0]));
}
// Minimum dedicated lanes per ingredient, then pair odd residual lanes
// within ONE receiving production array. This never pairs unrelated arrays.
function planIngredientLanes(ingredients,belt,scale=1){
 if(![900,1800,2700].includes(belt)||!Number.isFinite(scale)||scale<0)throw Error('Invalid lane planning profile.');
 const lane=belt/2,merged=new Map(),fluids=[];
 for(const x of ingredients||[]){
  const needed=Number(x.needed)*scale;if(!Number.isFinite(needed)||needed<=0)continue;
  if(x.fluid){fluids.push({...x,needed});continue}
  const old=merged.get(x.id)||{id:x.id,name:x.name,needed:0};old.needed+=needed;merged.set(x.id,old);
 }
 const requirements=[...merged.values()].map(x=>({...x,lanes:Math.ceil(x.needed/lane-1e-10)})),groups=[],odd=[];
 let dedicated=0;
 for(const x of requirements){
  dedicated+=Math.ceil(x.lanes/2);
  const full=Math.floor(x.lanes/2);
  if(full)groups.push({count:full,a:x.id,b:x.id});
  if(x.lanes%2)odd.push(x);
 }
 odd.sort((a,b)=>b.needed%belt-a.needed%belt||a.id.localeCompare(b.id));
 for(let i=0;i<odd.length;i+=2)groups.push({count:1,a:odd[i].id,b:odd[i+1]?.id||null});
 const physical=groups.reduce((s,g)=>s+g.count,0);
 return {belt,lane,requirements,groups,fluids,dedicated,physical,saved:dedicated-physical};
}
function planArrayLanes(entry,belt,rounded=false){
 return planIngredientLanes(entry.ingredients,belt,rounded&&entry.needed>0?entry.count*entry.perMachine/entry.needed:1);
}
// Allocate explicitly selected existing supply once across shared dependencies.
// The final goal is NEW output; do not silently substitute existing final product.
function incrementalPlan(full,available={}){
 if(!full?.entries?.length||!Number.isFinite(full.rate)||full.rate<=0)throw Error('Choose a positive blueprint target.');
 const needs=new Map([[full.id,full.rate]]),reused=[],entries=[],external=[];
 const take=(key,required,name)=>{
  const amount=key===full.id?0:Math.min(required,Math.max(0,Number(available[key])||0));
  if(amount>1e-9)reused.push({key,name,rate:amount});
  return Math.max(0,required-amount);
 };
 // Descending depth guarantees all consuming stages contribute before the
 // shared ingredient is sized; a supply pool is deducted once, not per branch.
 for(const row of [...full.entries].sort((a,b)=>b.depth-a.depth)){
  const total=needs.get(row.key)||0,needed=take(row.key,total,row.name);
  if(needed<=1e-9)continue;
  const scale=needed/row.needed,exact=needed/row.perMachine,count=Math.ceil(exact-1e-10);
  const ingredients=row.ingredients.map(x=>({...x,needed:x.needed*scale}));
  for(const x of ingredients)needs.set(x.id,(needs.get(x.id)||0)+x.needed);
  entries.push({...row,needed,exact,count,craftsPerMinute:row.craftsPerMinute*scale,ingredients});
 }
 for(const row of full.external){
  const needed=take(row.key,needs.get(row.key)||0,row.name);
  if(needed>1e-9)external.push({...row,needed,belts:row.isFluid?null:Math.ceil(needed/full.belt-1e-10)});
 }
 entries.sort((a,b)=>a.depth-b.depth||a.name.localeCompare(b.name));
 return {...full,entries,external,reused,roundedTotal:entries.reduce((s,x)=>s+x.count,0),exactTotal:entries.reduce((s,x)=>s+x.exact,0),kinds:entries.reduce((a,x)=>{a[x.kind]=(a[x.kind]||0)+x.count;return a},{asm:0,chem:0,furnace:0}),baselineMachines:full.roundedTotal};
}
if(typeof module==='object'&&module.exports)module.exports={analyzeRecipeRatios,assertFiniteRate,recipeGroup,recipeMatches,RECIPE_GROUPS,planIngredientLanes,planArrayLanes,incrementalPlan};
root.NauvisRecipeMath=analyzeRecipeRatios;
root.NauvisEngineering={incrementalPlan,planIngredientLanes,planArrayLanes};
if(typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const precision=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
const machineName=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':'furnaces';
const state={id:guide.goal,rate:guide.rate,machine:guide.machine,source:guide.source,belt:guide.belt,
 moduleType:guide.moduleType||'none',moduleCount:guide.moduleCount||0,moduleType2:guide.moduleType2||'none',moduleCount2:guide.moduleCount2||0,
 machineQuality:guide.machineQuality||'normal',beaconSpeed:guide.beaconSpeed||0,preset:'custom'};
const recipes=R,contexts={stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names};
let recipeFilter='',recipeCategory='all',laneRounded=false,laneArray=null,laneOpen=false;
const recommendation=()=>root.NauvisPresets?.recommendation(state.id,recipes,state.machine)||{starter:30,balanced:60,expand:120,rationale:'Choose an item and target.'};
state.preset=root.NauvisPresets?.modeFor(state.rate,recommendation())||'custom';
const colorFor=(id,kind)=>csscolor(id,kind);
const itemGlyph=(id,size)=>root.NauvisIcons?.item?.(id,size)||'';
const cards=[...document.querySelectorAll('[data-ratio-explorer]')];
const select=(items,chosen)=>items.map(([v,title])=>'<option value="'+escape(v)+'"'+(String(v)===String(chosen)?' selected':'')+'>'+escape(title)+'</option>').join('');
function matchingRecipes(){return recipeMatches(allOrder,recipes,recipeCategory,recipeFilter)}
function groupedOptions(){
 const matches=matchingRecipes();
 const option=id=>select([[id,recipes[id][0]]],state.id);
 return (matches.includes(state.id)?'':'<optgroup label="Current recipe">'+option(state.id)+'</optgroup>')+
  RECIPE_GROUPS.map(group=>{
   const ids=matches.filter(id=>recipeGroup(id)===group);
   return ids.length?'<optgroup label="'+escape(group)+'">'+ids.map(option).join('')+'</optgroup>':'';
  }).join('');
}
function recipeResults(){

 const matches=matchingRecipes(),shown=matches;
 return '<div class="recipe-result-count">'+matches.length+' matching recipe'+(matches.length===1?'':'s')+'</div>'+
  (shown.length?'<div class="recipe-result-grid">'+shown.map(id=>'<button type="button" data-recipe-pick="'+escape(id)+'" aria-pressed="'+(id===state.id)+'">'+itemGlyph(id,25)+'<span>'+escape(recipes[id][0])+'</span></button>').join('')+'</div>':'<p class="ratio-muted">No matching recipes. Try another search.</p>');
}
function descriptionForRate(r){
 return number(r.needed)+' output/min ÷ '+precision(r.effectiveOutputPerCraft||r.outputPerCraft)+' effective per craft = '+precision(r.craftsPerMinute)+' crafts/min.';
}
function lanePanel(result){
 const entry=result.entries.find(e=>e.key===laneArray)||result.entries.find(e=>e.key===result.id)||result.entries.at(-1);
 if(!entry)return '';
 const plan=planArrayLanes(entry,result.belt,laneRounded),tier=result.belt===900?'yellow':result.belt===1800?'red':'blue',by=new Map(plan.requirements.map(x=>[x.id,x]));
 const name=k=>k?(by.get(k)?.name||k):null;
 const groups=plan.groups.map(g=>root.NauvisRatioFlow.feederLines(g.count,tier,name(g.a),name(g.b),result.belt)).join('');
 return '<details class="ratio-lane-panel" data-ratio-lane-panel '+(laneOpen?'open':'')+'><summary><b>Physical input belts</b><span>'+plan.physical+' '+tier+' · '+plan.saved+' saved</span></summary>'+
 '<div class="ratio-lane-body"><label>Receiving production array<select data-ratio-lane-array>'+select(result.entries.map(x=>[x.key,x.name+' · '+x.count+' machines']),entry.key)+'</select></label>'+
 '<label class="ratio-lane-check"><input type="checkbox" data-ratio-lane-rounded '+(laneRounded?'checked':'')+'> Feed every rounded machine at full speed</label>'+
 '<div class="ratio-lane-summary"><div><small>Separate belts</small><b>'+plan.dedicated+'</b></div><div><small>Belts needed</small><b>'+plan.physical+'</b></div><div><small>Full belt / min</small><b>'+number(result.belt)+'</b></div></div>'+
 '<div class="ratio-lane-rates">'+plan.requirements.map(x=>'<div>'+itemGlyph(x.id,20)+'<span>'+escape(x.name)+'</span><b>'+number(x.needed)+'/min</b><small>'+Math.ceil(x.lanes/2)+' dedicated belt'+(Math.ceil(x.lanes/2)===1?'':'s')+'</small></div>').join('')+'</div>'+
 '<div class="physical-feeder-map"><small>INPUTS → '+escape(entry.name)+' · '+entry.count+' machines</small>'+(groups||'<p class="ratio-muted">No solid input belts required.</p>')+'<div class="physical-feeder-target"><strong>'+escape(entry.name)+'</strong><span>'+entry.count+' machines · '+number(entry.needed)+'/min target</span></div></div>'+
 (plan.fluids.length?'<p class="ratio-muted">Pipe inputs (excluded): '+plan.fluids.map(f=>escape(f.name)+' '+number(f.needed)+'/min').join(', ')+'.</p>':'')+
 '<p class="ratio-muted">Each line is a physical belt. Mixed ingredients share a single line; exact input demand is listed above. '+(laneRounded?'Uses full rounded machine capacity; supporting producers may need expansion.':'Uses exact target-rate ingredient demand, not the extra capacity from machine rounding.')+' Physical inserter throughput, loading and fuel are not modeled. Layout is advisory.</p></div></details>';
}
function buildView(result,card){
 const cardKey=card.dataset.ratioExplorer;
 const id=key=>'ratio-'+cardKey+'-'+key;
 const tiers=[['0.75','Assembler 2 · 0.75×'],['1.25','Assembler 3 · 1.25×']];
 const rec=recommendation();
 const advancedOn=state.moduleType!=='none'&&state.moduleCount>0||
  state.moduleType2!=='none'&&state.moduleCount2>0||state.machineQuality!=='normal'||state.beaconSpeed>0;
 const presetButtons=[['starter','Starter',rec.starter,'Smaller start'],['balanced','Balanced',rec.balanced,'Recommended baseline'],['expand','More',rec.expand,'Additional capacity'],['custom','Custom',state.rate,'Choose your output']].map(([key,name,rate,detail])=>
  '<button type="button" data-ratio-preset="'+key+'" class="ratio-preset-btn" aria-pressed="'+(state.preset===key)+'"><b>'+name+'</b><span>'+number(rate)+'/min</span></button>').join('');

 const selectField=(key,title,opts,value)=>'<div class="ratio-field"><label for="'+id(key)+'">'+escape(title)+'</label><select id="'+id(key)+'" data-ratio-field="'+key+'">'+select(opts,value)+'</select></div>';
 const advanced='<details class="ratio-advanced"'+(advancedOn?' open':'')+'>'+
  '<summary>Machine upgrades & module effects <small>'+(advancedOn?'CUSTOM PROFILE':'OPTIONAL · BASE CASE')+'</small></summary>'+
  '<div class="ratio-advanced-body"><p>Apply a uniform profile to compatible machine groups. Primary modules fill slots first, then secondary modules. Ineligible productivity modules are skipped.</p>'+
  '<div class="ratio-advanced-fields">'+
  selectField('moduleType','Primary module',root.NauvisEffects.MODULE_OPTIONS,state.moduleType)+
  '<div class="ratio-field"><label for="'+id('moduleCount')+'">Modules per machine (up to slots)</label><input data-ratio-field="moduleCount" id="'+id('moduleCount')+'" type="number" inputmode="numeric" min="0" max="4" step="1" value="'+state.moduleCount+'"></div>'+
  selectField('moduleType2','Second module',root.NauvisEffects.MODULE_OPTIONS,state.moduleType2)+
   '<div class="ratio-field"><label for="'+id('moduleCount2')+'">Second module count</label><input data-ratio-field="moduleCount2" id="'+id('moduleCount2')+'" type="number" inputmode="numeric" min="0" max="4" step="1" value="'+state.moduleCount2+'"></div>'+
   selectField('machineQuality','Crafting machine quality',[['normal','Normal · 1.0×'],['uncommon','Uncommon · 1.3×'],['rare','Rare · 1.6×'],['epic','Epic · 1.9×'],['legendary','Legendary · 2.5×']],state.machineQuality)+
  '<div class="ratio-field"><label for="'+id('beaconSpeed')+'">Effective beacon speed bonus (%)</label><input data-ratio-field="beaconSpeed" id="'+id('beaconSpeed')+'" type="number" inputmode="decimal" min="0" max="300" step="1" value="'+state.beaconSpeed+'"></div></div>'+
  '<p class="ratio-advanced-note">Use the actual additive speed bonus contributed by beacons, not the number of beacons. Factorio 2.0 beacon transmission has diminishing returns. Machine quality changes crafting speed, not the quality of products. Generic furnaces are held at 2× speed without module assumptions.</p></div></details>';
 const fieldset='<div class="ratio-picker ratio-primary-controls"><div class="ratio-fields ratio-primary-fields">'+
    '<div class="ratio-field ratio-recipe-field"><label>Recipe</label><details class="ratio-recipe-search"><summary>'+itemGlyph(state.id,25)+'<span>'+escape(recipes[state.id][0])+'</span><span aria-hidden="true">⌄</span></summary><div class="ratio-search-fields"><input id="'+id('search')+'" data-ratio-search type="search" aria-label="Find recipe" placeholder="Search recipes…" value="'+escape(recipeFilter)+'" autocomplete="off"><div data-recipe-results>'+recipeResults()+'</div></div></details><select hidden id="'+id('id')+'" data-ratio-field="id" aria-label="Selected recipe">'+groupedOptions()+'</select></div>'+
    '<div class="ratio-field"><label for="'+id('rate')+'">Output / min</label><input id="'+id('rate')+'" data-ratio-field="rate" type="number" inputmode="decimal" min="0" max="25000" step="0.1" value="'+state.rate+'"></div></div></div>'+
    '<section class="ratio-preset-panel ratio-compact-presets" aria-label="Output target recommendation"><div class="ratio-preset-options">'+presetButtons+'</div></section>';
 const settings='<details class="ratio-planning-settings" data-ratio-settings><summary>Production settings <small>'+escape(state.machine===1.25?'Assembler 3':'Assembler 2')+' · '+(state.source==='bus'?'Bus-fed':'Raw inputs')+(advancedOn?' · Upgrades active':'')+'</small></summary><div class="ratio-settings-body"><div class="ratio-fields">'+
    selectField('machine','Assembler tier',tiers,state.machine)+
    selectField('source','Upstream production',[['bus','Bus-fed: produce local intermediates'],['raw','Raw: include smelting + chemicals']],state.source)+
    selectField('belt','Default feeder belt',[['900','Yellow · 900/min'],['1800','Red · 1,800/min'],['2700','Blue · 2,700/min']],state.belt)+'</div>'+advanced+
    '<p class="ratio-muted">'+escape(rec.rationale)+'</p></div></details>';
 const tableRows=result.entries.map(x=>
    '<tr><td><span class="ratio-cell-item">'+itemGlyph(x.key,30)+'<strong>'+escape(x.name)+'</strong></span><div class="ratio-muted">'+machineName(x.kind)+'</div></td>'+
    '<td>'+number(x.needed)+'</td><td>'+number(x.perMachine)+'</td><td>'+precision(x.exact)+'</td><td class="ratio-rounded">'+x.count+'</td></tr>'
 ).join('');
 const detailed=result.entries.map((x,i)=>{
  const pieces=x.ingredients.map(z=>'<span>'+number(z.perCraft)+' '+escape(z.name)+(z.fluid?' fluid':'')+'</span>').join(' + ')||'No recorded ingredients';
  const ratioInfo=number(x.needed)+' ÷ '+number(x.perMachine)+' = '+precision(x.exact);
  const method=precision(x.effectiveOutputPerCraft)+' effective output/craft × '+precision(x.machineSpeed)+' crafting speed × 60 ÷ '+number(x.craftSeconds)+' s = '+number(x.perMachine)+'/min per machine';
  return '<details class="ratio-why-item"><summary><span>'+itemGlyph(x.key,27)+'<b>'+escape(x.name)+'</b><span class="ratio-muted"> · '+x.count+' '+machineName(x.kind)+'</span></span><span class="ratio-expand-arrow">⌄</span></summary>'+
    '<div class="ratio-why-detail">'+
    '<p><b>Recipe:</b> '+number(x.craftSeconds)+' s per craft produces '+number(x.outputPerCraft)+' '+escape(x.name)+'; consumes '+pieces+'.</p>'+
    (x.productivityBonus?'<p><b>Productivity:</b> +'+number(x.productivityBonus*100)+'% expected output per craft, reducing ingredients per finished item.</p>':'')+
    '<p><b>Machine profile:</b> '+x.moduleApplied+' / '+x.moduleSlots+' compatible module slots; '+precision(x.qualityFactor)+'× quality speed factor; '+(x.beaconSpeed?('+'+number(x.beaconSpeed)+'% beacon speed; '):'')+number(x.energyFactor*100)+'% base electrical-demand multiplier from installed machine modules only (excludes beacon-transmitted energy effects and beacon power).</p>'+
    '<p><b>Required output:</b> '+descriptionForRate(x)+'</p>'+
    '<p><b>Per-machine output:</b> '+method+'.</p>'+
    '<p><b>Machine equivalents:</b> '+ratioInfo+'. Round up to <strong>'+x.count+'</strong> whole '+machineName(x.kind)+'.</p>'+
    '<p class="ratio-muted">The machine profile above is applied only where compatible. It assumes continuous ingredients and no physical routing constraints. Rounded groups can have unused capacity.</p>'+
    '</div></details>';
 }).join('');
 const output=result.outputStream;
 const outputDesc=output.isFluid?'Output uses pipes; pipe throughput not modeled':(output.belts+' × '+(result.belt===900?'yellow':result.belt===1800?'red':'blue')+' belt'+(output.belts===1?'':'s')+' for final output');
 return fieldset+
  '<div data-ratio-flow-root class="ratio-flow-root"></div>'+
  '<div class="ratio-primary-actions"><button class="ratio-save-project" data-ratio-project-save type="button">Add to Construction <span aria-hidden="true">→</span></button></div>'+
  settings+lanePanel(result)+
  '<details class="ratio-explain ratio-technical" data-ratio-legacy-table><summary><span>Machine rates &amp; recipe math <small>Exact ratios, output per machine and rounding</small></span><span>⌄</span></summary>'+
  '<div class="ratio-explain-body"><div class="ratio-tablewrap" tabindex="0" aria-label="Machine ratio ledger, swipe sideways on mobile">'+
  '<table class="ratio-table"><thead><tr><th>Recipe</th><th>Required /min</th><th>Per machine /min</th><th>Exact machines</th><th>Build machines</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
  '<p class="ratio-output"><b>Finished output:</b> '+number(result.rate)+'/min '+escape(result.name)+'. '+outputDesc+'.</p>'+
  '<p class="ratio-caveat">Machine output = items per craft × crafting speed × 60 ÷ recipe seconds. Divide required output by per-machine output, then round each recipe group up.</p>'+detailed+
  '<p class="ratio-caveat">Scope: 182 deterministic Nauvis base recipes. Assumes continuous supply and power; supported modules, quality and effective beacon speed are included. No physical inserter, stacking, pipe throughput, fuel or beacon geometry constraints; no probabilistic quality outputs or planetary recipe chains.</p></div></details>'+
  '<div class="ratio-actions full-only-classic" hidden><button type="button" class="ratio-send" data-ratio-send>Open legacy detailed calculator <span aria-hidden="true">→</span></button></div>';
}

function renderCard(card){
 if(!card.open)return;
 const target=card.querySelector('.ratio-content');
 try{
  const result=analyzeRecipeRatios(recipes,state,contexts);
  const settingsOpen=target.querySelector('[data-ratio-settings]')?.open||false,technicalOpen=target.querySelector('[data-ratio-legacy-table]')?.open||false;
  target.innerHTML=buildView(result,card);
  target.querySelector('[data-ratio-settings]').open=settingsOpen;
  target.querySelector('[data-ratio-legacy-table]').open=technicalOpen;
  root.NauvisRatioFlow?.mount(target,result,card.dataset.ratioExplorer);
  const search=target.querySelector('[data-ratio-search]');
  const updatePicker=()=>{
   const pick=target.querySelector('[data-ratio-field="id"]');
   if(pick){pick.innerHTML=groupedOptions();pick.value=state.id}
   const results=target.querySelector('[data-recipe-results]');if(results)results.innerHTML=recipeResults();
  };
  target.querySelector('.ratio-recipe-search')?.addEventListener('toggle',e=>{if(e.target.open)search?.focus({preventScroll:true})});
  search?.addEventListener('input',event=>{recipeFilter=event.target.value.trim().toLowerCase();updatePicker()});
  target.querySelector('[data-recipe-results]')?.addEventListener('click',event=>{
   const item=event.target.closest('[data-recipe-pick]');if(!item)return;
   const pick=target.querySelector('[data-ratio-field="id"]');if(pick){pick.value=item.dataset.recipePick;pick.dispatchEvent(new Event('change',{bubbles:true}))}
  });
  target.querySelectorAll('[data-ratio-preset]').forEach(button=>button.addEventListener('click',()=>{
   const next=button.dataset.ratioPreset,rec=recommendation();
   state.preset=next;
   if(next!=='custom')state.rate=rec[next];
   renderAll();
  }));
  target.querySelectorAll('[data-ratio-field]').forEach(input=>input.addEventListener('change',event=>{
   const kind=event.target.dataset.ratioField,prev=state[kind],raw=event.target.value;
   if(kind==='rate'){
    try{state.rate=assertFiniteRate(raw,'Target')}catch(err){state.rate=prev;target.querySelector('[data-ratio-error]').textContent=err.message;target.querySelector('[data-ratio-error]').hidden=false;event.target.value=String(prev);return}
    state.preset=root.NauvisPresets?.modeFor(state.rate,recommendation())||'custom';
   }else if(kind==='id'){
    state.id=raw;state.preset='balanced';state.rate=recommendation().balanced;
    recipeFilter='';recipeCategory='all';
   }else{
    if(kind==='moduleCount'||kind==='moduleCount2'||kind==='beaconSpeed'){
     const value=Number(raw);
     if(!Number.isFinite(value)||value<0||value>(kind==='beaconSpeed'?300:4)||
      (kind!=='beaconSpeed'&&!Number.isSafeInteger(value))){
      const error=target.querySelector('[data-ratio-error]');if(error){error.textContent='Invalid module count or beacon bonus.';error.hidden=false}
      event.target.value=String(prev);return;
     }
     state[kind]=value;
    }else state[kind]=kind==='machine'||kind==='belt'?Number(raw):raw;
    try{root.NauvisEffects.settings(state)}catch(err){state[kind]=prev;const error=target.querySelector('[data-ratio-error]');if(error){error.textContent=err.message;error.hidden=false}event.target.value=String(prev);return}
    if(kind==='machine'&&state.preset!=='custom')state.rate=recommendation()[state.preset];
   }
   renderAll();
  }));
  target.querySelector('[data-ratio-lane-panel]')?.addEventListener('toggle',e=>{laneOpen=e.target.open});
  target.querySelector('[data-ratio-lane-array]')?.addEventListener('change',e=>{laneArray=e.target.value;laneOpen=true;renderAll()});
  target.querySelector('[data-ratio-lane-rounded]')?.addEventListener('change',e=>{laneRounded=e.target.checked;laneOpen=true;renderAll()});
  target.querySelector('[data-ratio-project-save]')?.addEventListener('click',()=>root.NauvisProjects?.createFromRatio(result,{beltPlan:root.NauvisRatioFlow?.captureBeltPlan(card.dataset.ratioExplorer,result)}));
  const button=target.querySelector('[data-ratio-send]');
  button.addEventListener('click',()=>{
   guide.goal=state.id;guide.rate=state.rate;guide.machine=state.machine;guide.source=state.source;guide.belt=state.belt;
   for(const key of ['moduleType','moduleCount','moduleType2','moduleCount2','machineQuality','beaconSpeed'])guide[key]=state[key];
   renderGuide();
   activateWorkspace('build',true);
   const buildCard=document.querySelector('[data-ratio-explorer="build"]');
   if(buildCard&&!buildCard.open)buildCard.open=true;
   const classic=document.getElementById('buildClassic');
   if(classic){
    if(state.moduleType!=='none'||state.moduleType2!=='none'||state.machineQuality!=='normal'||state.beaconSpeed>0)
     root.alert?.('The legacy detailed calculator uses base recipe speeds. The active module/quality/beacon profile is only applied to the visual Ratio Explorer above and to saved compatible Factory lines.');
    classic.open=true;
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>classic.scrollIntoView({behavior:'smooth',block:'start'}));
   }
  });
  const note=document.createElement('p');note.className='ratio-error';note.dataset.ratioError='';note.hidden=true;note.setAttribute('role','alert');target.prepend(note);
 }catch(err){
  target.innerHTML='<p class="ratio-error">'+escape(err.message||'Recipe ratios unavailable')+'</p>';
 }
}
function renderAll(){cards.forEach(renderCard)}
cards.forEach(card=>card.addEventListener('toggle',()=>{if(card.open)renderCard(card)}));
function currentResult(){return analyzeRecipeRatios(recipes,state,contexts)}
root.NauvisRatioExplorer={refresh:renderAll,currentResult,setGoal(goal){
  if(!goal||!recipes[goal.id])return;
  for(const key of ['id','rate','machine','source','belt','moduleType','moduleCount','moduleType2','moduleCount2','machineQuality','beaconSpeed'])
   if(goal[key]!==undefined)state[key]=goal[key];
  state.preset=root.NauvisPresets?.modeFor(state.rate,recommendation())||'custom';
  recipeFilter='';recipeCategory='all';
  renderAll();
 },openAt(view){
 const card=document.querySelector('[data-ratio-explorer="'+view+'"]');
 if(card){card.open=true;renderCard(card)}
}};
cards.filter(card=>card.open).forEach(renderCard);
})(typeof window==='undefined'?globalThis:window);
