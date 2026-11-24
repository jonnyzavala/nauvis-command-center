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
  const perMachine=60*effectiveOutputPerCraft*machineSpeed/r[1];
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
   moduleType:query.moduleType||'none',moduleCount:query.moduleCount||0,
   machineQuality:query.machineQuality||'normal',beaconSpeed:query.beaconSpeed||0,
   entries,external,outputStream,roundedTotal,exactTotal,
   kinds:entries.reduce((out,row)=>{out[row.kind]=(out[row.kind]||0)+row.count;return out},{asm:0,chem:0,furnace:0})};
}
if(typeof module==='object'&&module.exports)module.exports={analyzeRecipeRatios,assertFiniteRate};
root.NauvisRecipeMath=analyzeRecipeRatios;
if(typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const precision=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
const machineName=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':'furnaces';
const state={id:guide.goal,rate:guide.rate,machine:guide.machine,source:guide.source,belt:guide.belt,
 moduleType:guide.moduleType||'none',moduleCount:guide.moduleCount||0,
 machineQuality:guide.machineQuality||'normal',beaconSpeed:guide.beaconSpeed||0,preset:'custom'};
const recipes=R,contexts={stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names};
let recipeFilter='';
const recommendation=()=>root.NauvisPresets?.recommendation(state.id,recipes,state.machine)||{starter:30,balanced:60,expand:120,rationale:'Choose an item and target.'};
state.preset=root.NauvisPresets?.modeFor(state.rate,recommendation())||'custom';
const colorFor=(id,kind)=>csscolor(id,kind);
const itemGlyph=(id,size)=>root.NauvisIcons?.item?.(id,size)||'';
const cards=[...document.querySelectorAll('[data-ratio-explorer]')];
const select=(items,chosen)=>items.map(([v,title])=>'<option value="'+escape(v)+'"'+(String(v)===String(chosen)?' selected':'')+'>'+escape(title)+'</option>').join('');
function descriptionForRate(r){
 return number(r.needed)+' output/min ÷ '+precision(r.effectiveOutputPerCraft||r.outputPerCraft)+' effective per craft = '+precision(r.craftsPerMinute)+' crafts/min.';
}
function buildView(result,card){
 const cardKey=card.dataset.ratioExplorer;
 const id=key=>'ratio-'+cardKey+'-'+key;
 const tiers=[['0.75','Assembler 2 · 0.75×'],['1.25','Assembler 3 · 1.25×']];
 const options=allOrder.filter(k=>recipes[k]&&(!recipeFilter||k===state.id||recipes[k][0].toLowerCase().includes(recipeFilter)||k.includes(recipeFilter))).map(k=>[k,recipes[k][0]]);
 const rec=recommendation();
 const advancedOn=state.moduleType!=='none'&&state.moduleCount>0||
  state.machineQuality!=='normal'||state.beaconSpeed>0;
 const presetButtons=[['starter','Starter',rec.starter,'Smaller start'],['balanced','Balanced',rec.balanced,'Recommended baseline'],['expand','More',rec.expand,'Additional capacity'],['custom','Custom',state.rate,'Choose your output']].map(([key,name,rate,detail])=>
  '<button type="button" data-ratio-preset="'+key+'" class="ratio-preset-btn" aria-pressed="'+(state.preset===key)+'"><b>'+name+'</b><span>'+number(rate)+'/min</span><small>'+detail+'</small></button>').join('');

 const selectField=(key,title,opts,value)=>'<div class="ratio-field"><label for="'+id(key)+'">'+escape(title)+'</label><select id="'+id(key)+'" data-ratio-field="'+key+'">'+select(opts,value)+'</select></div>';
 const advanced='<details class="ratio-advanced"'+(advancedOn?' open':'')+'>'+
  '<summary>Machine upgrades & module effects <small>'+(advancedOn?'CUSTOM PROFILE':'OPTIONAL · BASE CASE')+'</small></summary>'+
  '<div class="ratio-advanced-body"><p>Apply a uniform profile to compatible machine groups. Each recipe clamps module counts to its available slots. Productivity is skipped automatically when the recipe forbids it.</p>'+
  '<div class="ratio-advanced-fields">'+
  selectField('moduleType','Tier-1 modules',[['none','No modules'],['speed1','Speed 1 · +20% speed each'],['efficiency1','Efficiency 1 · −30% energy each'],['productivity1','Productivity 1 · +4% yield each']],state.moduleType)+
  '<div class="ratio-field"><label for="'+id('moduleCount')+'">Modules per machine (up to slots)</label><input data-ratio-field="moduleCount" id="'+id('moduleCount')+'" type="number" min="0" max="4" step="1" value="'+state.moduleCount+'"></div>'+
  selectField('machineQuality','Crafting machine quality',[['normal','Normal · 1.0×'],['uncommon','Uncommon · 1.3×'],['rare','Rare · 1.6×'],['epic','Epic · 1.9×'],['legendary','Legendary · 2.5×']],state.machineQuality)+
  '<div class="ratio-field"><label for="'+id('beaconSpeed')+'">Effective beacon speed bonus (%)</label><input data-ratio-field="beaconSpeed" id="'+id('beaconSpeed')+'" type="number" inputmode="decimal" min="0" max="300" step="1" value="'+state.beaconSpeed+'"></div></div>'+
  '<p class="ratio-advanced-note">Use the actual additive speed bonus contributed by beacons, not the number of beacons. Factorio 2.0 beacon transmission has diminishing returns. Machine quality changes crafting speed, not the quality of products. Generic furnaces are held at 2× speed without module assumptions.</p></div></details>';
 const fieldset='<div class="ratio-picker"><label for="'+id('search')+'">Find anything to produce (standard Nauvis recipes)</label>'+
    '<input id="'+id('search')+'" data-ratio-search type="search" placeholder="Search recipes, modules, military, belts…" value="'+escape(recipeFilter)+'" autocomplete="off"></div>'+
    '<div class="ratio-fields">'+
    selectField('id','Recipe',options,state.id)+
    '<div class="ratio-field"><label for="'+id('rate')+'">Output target / min</label><input id="'+id('rate')+'" data-ratio-field="rate" type="number" inputmode="decimal" min="0" max="25000" step="0.1" value="'+state.rate+'"></div>'+
    selectField('machine','Assembler tier',tiers,state.machine)+
    selectField('source','Include upstream production?',[['bus','Bus-fed: produce local intermediates'],['raw','Raw: include smelting + chemicals']],state.source)+
    selectField('belt','Belt throughput',[['900','Yellow · 900/min'],['1800','Red · 1,800/min'],['2700','Blue · 2,700/min']],state.belt)+'</div>'+
    '<section class="ratio-preset-panel" aria-label="Output target recommendation"><div class="ratio-preset-intro"><strong>How much should I produce?</strong><small>Balanced is the default starting recommendation, not a live demand prediction.</small></div>'+
    '<div class="ratio-preset-options">'+presetButtons+'</div><p class="ratio-preset-explanation">'+escape(rec.rationale)+'</p></section>'+advanced;
 const percentRows=result.entries.map(x=>{
  const pct=x.exact>0?Math.min(100,Math.max(2,100*x.exact/Math.max(1,x.count))):0;
  const color=colorFor(x.key,x.kind);
  return '<div class="ratio-part" style="--ratio-accent:'+color+'">'+
    '<div class="ratio-part-name">'+itemGlyph(x.key,34)+'<div><b>'+escape(x.name)+'</b><div class="ratio-muted">'+number(x.needed)+'/min required · '+machineName(x.kind)+'</div></div></div>'+
    '<div class="ratio-part-count"><strong>'+x.count+'</strong><span>whole</span></div>'+
    '<div class="ratio-mini-meter"><span style="width:'+pct+'%"></span></div>'+
    '<div class="ratio-muted">Exact equivalent: '+precision(x.exact)+' machines · '+number(x.perMachine)+'/min each</div>'+
    '</div>';
 }).join('');
 const shorthand=result.entries.map(x=>'<span class="ratio-chip" style="--ratio-accent:'+colorFor(x.key,x.kind)+'">'+itemGlyph(x.key,25)+'<b>'+x.count+'</b> '+escape(x.name)+'</span>').join('');
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
    '<p><b>Machine profile:</b> '+x.moduleApplied+' / '+x.moduleSlots+' compatible module slots; '+precision(x.qualityFactor)+'× quality speed factor; '+(x.beaconSpeed?('+'+number(x.beaconSpeed)+'% beacon speed; '):'')+number(x.energyFactor*100)+'% of base module-adjusted electrical demand (without beacon electricity).</p>'+
    '<p><b>Required output:</b> '+descriptionForRate(x)+'</p>'+
    '<p><b>Per-machine output:</b> '+method+'.</p>'+
    '<p><b>Machine equivalents:</b> '+ratioInfo+'. Round up to <strong>'+x.count+'</strong> whole '+machineName(x.kind)+'.</p>'+
    '<p class="ratio-muted">The machine profile above is applied only where compatible. It assumes continuous ingredients and no physical routing constraints. Rounded groups can have unused capacity.</p>'+
    '</div></details>';
 }).join('');
 const supplies=result.external.map(x=>'<div class="ratio-supply">'+
   '<div>'+itemGlyph(x.key,31)+'<span><b>'+escape(x.name)+'</b><small>'+ (x.isFluid?'Piped fluid':'Belted material')+'</small></span></div>'+
   '<div class="ratio-supply-value">'+number(x.needed)+'/min<div class="ratio-muted">'+(x.isFluid?'Pipe flow not modeled':x.belts+' × '+(result.belt===900?'yellow':result.belt===1800?'red':'blue')+' belt'+(x.belts===1?'':'s')+' minimum')+'</div></div></div>').join('');
 const output=result.outputStream;
 const outputDesc=output.isFluid?'Output uses pipes; pipe throughput not modeled':(output.belts+' × '+(result.belt===900?'yellow':result.belt===1800?'red':'blue')+' belt'+(output.belts===1?'':'s')+' for final output');
 return fieldset+
  (advancedOn?'<p class="ratio-effect-status"><strong>Upgrade profile active:</strong> machine counts and upstream ingredients reflect compatible module/quality bonuses. Review per-recipe effects under “Why this ratio?”.</p>':'')+
  '<div data-ratio-flow-root class="ratio-flow-root"></div>'+
  '<div class="ratio-save-strip"><button class="ratio-save-project" data-ratio-project-save type="button">Save to Construction Queue <span aria-hidden="true">→</span></button><span>Turn this recipe calculation into a saved construction checklist.</span></div>'+
  '<div data-ratio-legacy-table hidden>'+
  '<div class="ratio-overview">'+
   '<div class="ratio-number-box"><span class="ratio-kicker">ROUNDED MACHINE COUNT</span><strong>'+result.roundedTotal+'</strong><small>'+number(result.rate)+' '+escape(result.name)+'/min</small></div>'+
   '<div class="ratio-number-box secondary"><span class="ratio-kicker">EXACT MACHINE EQUIVALENTS</span><strong>'+precision(result.exactTotal)+'</strong><small>Before whole-machine rounding</small></div>'+
  '</div>'+
  '<p class="ratio-caveat">Exact machine equivalents represent continuous utilization. <b>Whole machines are rounded separately for every recipe</b>, so these totals can differ. These are independent recipe groups, not machines already in your factory.</p>'+
  '<div class="ratio-section-head"><h3>Compact build ratio</h3><span class="ratio-muted">Supporting producers → final output</span></div>'+
  '<div class="ratio-chip-row">'+(shorthand||'<span class="ratio-muted">Set a target above zero.</span>')+'</div>'+
  '<div class="ratio-parts">'+percentRows+'</div>'+
  '<div class="ratio-section-head"><h3>Machine allocation ledger</h3><span class="ratio-muted">Rates per minute</span></div>'+
  '<div class="ratio-tablewrap" tabindex="0" aria-label="Machine ratio ledger, swipe sideways on mobile">'+
  '<table class="ratio-table"><thead><tr><th>Recipe</th><th>Required /min</th><th>Per machine /min</th><th>Exact machines</th><th>Build machines</th></tr></thead><tbody>'+tableRows+'</tbody></table></div>'+
  '<div class="ratio-section-head"><h3>External ingredients and belts</h3><span class="ratio-muted">'+(state.source==='bus'?'Bus-fed':'Raw-to-production')+' boundary</span></div>'+
  '<div class="ratio-supplies">'+(supplies||'<p class="ratio-muted">No external inputs for this selected recipe.</p>')+'</div>'+
  '<p class="ratio-output"><b>Finished output:</b> '+number(result.rate)+'/min '+escape(result.name)+'. '+outputDesc+'. Belts assume a dedicated full belt, both lanes and no stacking. Fluids are calculated in fluid units/min.</p>'+
  '</div>'+
  '<details class="ratio-explain"><summary><span>Why this ratio? <small>Show recipe math and rounding for each machine group</small></span><span>⌄</span></summary>'+
  '<div class="ratio-explain-body"><p class="ratio-caveat">Machine output = items per craft × crafting speed × 60 ÷ recipe seconds. Divide needed items/min by output per machine/min, then round each group up.</p>'+detailed+'</div></details>'+
  '<div class="ratio-actions"><button type="button" class="ratio-send" data-ratio-send>Open detailed planner with this goal <span aria-hidden="true">→</span></button><small>Updates the hypothetical planning goal only. Your Existing Factory inventory remains untouched.</small></div>'+
  '<p class="ratio-caveat">Scope: 182 deterministic Nauvis base recipes; normal tier-1 modules, supported machine quality speed, and user-entered effective beacon speed are calculated on compatible machines. No probabilistic product-quality output, beacon count/placement geometry, module level 2/3, mixed modules, uranium byproducts, planetary Space Age recipe chains, inserter constraints, mining supply or physical routing. Chemical plants have base speed 1×; generic furnaces remain 2×.</p>';
}
function renderCard(card){
 if(!card.open)return;
 const target=card.querySelector('.ratio-content');
 try{
  const result=analyzeRecipeRatios(recipes,state,contexts);
  target.innerHTML=buildView(result,card);
  root.NauvisRatioFlow?.mount(target,result,card.dataset.ratioExplorer);
  const search=target.querySelector('[data-ratio-search]');
  search?.addEventListener('input',event=>{
   recipeFilter=event.target.value.trim().toLowerCase();
   const match=allOrder.filter(key=>recipes[key]&&(!recipeFilter||key===state.id||
    recipes[key][0].toLowerCase().includes(recipeFilter)||key.includes(recipeFilter)));
   const pick=target.querySelector('[data-ratio-field="id"]');
   if(pick){pick.innerHTML=select(match.map(key=>[key,recipes[key][0]]),state.id);pick.value=state.id}
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
    recipeFilter='';
   }else{
    if(kind==='moduleCount'||kind==='beaconSpeed'){
     const value=Number(raw);
     if(!Number.isFinite(value)||value<0||value>(kind==='moduleCount'?4:300)||
      (kind==='moduleCount'&&!Number.isSafeInteger(value))){
      const error=target.querySelector('[data-ratio-error]');if(error){error.textContent='Invalid module count or beacon bonus.';error.hidden=false}
      event.target.value=String(prev);return;
     }
     state[kind]=value;
    }else state[kind]=kind==='machine'||kind==='belt'?Number(raw):raw;
    if(kind==='machine'&&state.preset!=='custom')state.rate=recommendation()[state.preset];
   }
   renderAll();
  }));
  target.querySelector('[data-ratio-project-save]')?.addEventListener('click',()=>root.NauvisProjects?.createFromRatio(result));
  const button=target.querySelector('[data-ratio-send]');
  button.addEventListener('click',()=>{
   guide.goal=state.id;guide.rate=state.rate;guide.machine=state.machine;guide.source=state.source;guide.belt=state.belt;
   for(const key of ['moduleType','moduleCount','machineQuality','beaconSpeed'])guide[key]=state[key];
   renderGuide();
   activateWorkspace('build',true);
   const buildCard=document.querySelector('[data-ratio-explorer="build"]');
   if(buildCard&&!buildCard.open)buildCard.open=true;
   const classic=document.getElementById('buildClassic');
   if(classic){
    if(state.moduleType!=='none'||state.machineQuality!=='normal'||state.beaconSpeed>0)
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
root.NauvisRatioExplorer={refresh:renderAll,setGoal(goal){
  if(!goal||!recipes[goal.id])return;
  for(const key of ['id','rate','machine','source','belt','moduleType','moduleCount','machineQuality','beaconSpeed'])
   if(goal[key]!==undefined)state[key]=goal[key];
  state.preset=root.NauvisPresets?.modeFor(state.rate,recommendation())||'custom';
  recipeFilter='';
  renderAll();
 },openAt(view){
 const card=document.querySelector('[data-ratio-explorer="'+view+'"]');
 if(card){card.open=true;renderCard(card)}
}};
cards.filter(card=>card.open).forEach(renderCard);
})(typeof window==='undefined'?globalThis:window);
