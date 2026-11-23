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
   add(ingredient,quantity/r[2]*count,false);
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
  const r=recipes[key],kind=r[3],machineSpeed=kind==='asm'?speed:kind==='furnace'?2:1;
  const perMachine=60*r[2]*machineSpeed/r[1];
  const exact=needed/perMachine,rounded=needed?Math.ceil(exact-1e-10):0;
  return {
   key,name:r[0],kind,needed,perMachine,exact,count:rounded,
   craftSeconds:r[1],outputPerCraft:r[2],machineSpeed,
   craftsPerMinute:needed/r[2],
   ingredients:Object.entries(r[4]||{}).map(([input,perCraft])=>({
     id:input,name:recipes[input]?.[0]||context.names?.[input]||input,
     perCraft,needed:needed/r[2]*perCraft,fluid:fluid.has(input)
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
   entries,external,outputStream,roundedTotal,exactTotal,
   kinds:entries.reduce((out,row)=>{out[row.kind]=(out[row.kind]||0)+row.count;return out},{asm:0,chem:0,furnace:0})};
}
if(typeof module==='object'&&module.exports)module.exports={analyzeRecipeRatios,assertFiniteRate};
if(typeof document==='undefined')return;

const $=id=>document.getElementById(id);
const escape=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:2});
const precision=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:3});
const machineName=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':'furnaces';
const state={id:guide.goal,rate:guide.rate,machine:guide.machine,source:guide.source,belt:guide.belt};
const recipes=R,contexts={stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names};
const colorFor=(id,kind)=>csscolor(id,kind);
const cards=[...document.querySelectorAll('[data-ratio-explorer]')];
const select=(items,chosen)=>items.map(([v,title])=>'<option value="'+escape(v)+'"'+(String(v)===String(chosen)?' selected':'')+'>'+escape(title)+'</option>').join('');
function descriptionForRate(r){
 return number(r.needed)+' output/min ÷ '+number(r.outputPerCraft)+' per craft = '+precision(r.craftsPerMinute)+' crafts/min.';
}
function buildView(result,card){
 const cardKey=card.dataset.ratioExplorer;
 const id=key=>'ratio-'+cardKey+'-'+key;
 const tiers=[['0.75','Assembler 2 · 0.75×'],['1.25','Assembler 3 · 1.25×']];
 const options=allOrder.filter(k=>recipes[k]).map(k=>[k,recipes[k][0]]);
 const selectField=(key,title,opts,value)=>'<div class="ratio-field"><label for="'+id(key)+'">'+escape(title)+'</label><select id="'+id(key)+'" data-ratio-field="'+key+'">'+select(opts,value)+'</select></div>';
 const fieldset='<div class="ratio-fields">'+
    selectField('id','Recipe',options,state.id)+
    '<div class="ratio-field"><label for="'+id('rate')+'">Output target / min</label><input id="'+id('rate')+'" data-ratio-field="rate" type="number" inputmode="decimal" min="0" max="25000" step="0.1" value="'+state.rate+'"></div>'+
    selectField('machine','Assembler tier',tiers,state.machine)+
    selectField('source','Include upstream production?',[['bus','Bus-fed: produce local intermediates'],['raw','Raw: include smelting + chemicals']],state.source)+
    selectField('belt','Belt throughput',[['900','Yellow · 900/min'],['1800','Red · 1,800/min'],['2700','Blue · 2,700/min']],state.belt)+'</div>';
 const percentRows=result.entries.map(x=>{
  const pct=x.exact>0?Math.min(100,Math.max(2,100*x.exact/Math.max(1,x.count))):0;
  const color=colorFor(x.key,x.kind);
  return '<div class="ratio-part" style="--ratio-accent:'+color+'">'+
    '<div class="ratio-part-name"><span class="ratio-dot" aria-hidden="true"></span><div><b>'+escape(x.name)+'</b><div class="ratio-muted">'+number(x.needed)+'/min required · '+machineName(x.kind)+'</div></div></div>'+
    '<div class="ratio-part-count"><strong>'+x.count+'</strong><span>whole</span></div>'+
    '<div class="ratio-mini-meter"><span style="width:'+pct+'%"></span></div>'+
    '<div class="ratio-muted">Exact equivalent: '+precision(x.exact)+' machines · '+number(x.perMachine)+'/min each</div>'+
    '</div>';
 }).join('');
 const shorthand=result.entries.map(x=>'<span class="ratio-chip" style="--ratio-accent:'+colorFor(x.key,x.kind)+'"><span class="ratio-dot"></span><b>'+x.count+'</b> '+escape(x.name)+'</span>').join('');
 const tableRows=result.entries.map(x=>
    '<tr><td><strong>'+escape(x.name)+'</strong><div class="ratio-muted">'+machineName(x.kind)+'</div></td>'+
    '<td>'+number(x.needed)+'</td><td>'+number(x.perMachine)+'</td><td>'+precision(x.exact)+'</td><td class="ratio-rounded">'+x.count+'</td></tr>'
 ).join('');
 const detailed=result.entries.map((x,i)=>{
  const pieces=x.ingredients.map(z=>'<span>'+number(z.perCraft)+' '+escape(z.name)+(z.fluid?' fluid':'')+'</span>').join(' + ')||'No recorded ingredients';
  const ratioInfo=number(x.needed)+' ÷ '+number(x.perMachine)+' = '+precision(x.exact);
  const method=number(x.outputPerCraft)+' output/craft × '+precision(x.machineSpeed)+' speed × 60 ÷ '+number(x.craftSeconds)+' s = '+number(x.perMachine)+'/min per machine';
  return '<details class="ratio-why-item"><summary><span><b>'+escape(x.name)+'</b><span class="ratio-muted"> · '+x.count+' '+machineName(x.kind)+'</span></span><span class="ratio-expand-arrow">⌄</span></summary>'+
    '<div class="ratio-why-detail">'+
    '<p><b>Recipe:</b> '+number(x.craftSeconds)+' s per craft produces '+number(x.outputPerCraft)+' '+escape(x.name)+'; consumes '+pieces+'.</p>'+
    '<p><b>Required output:</b> '+descriptionForRate(x)+'</p>'+
    '<p><b>Per-machine output:</b> '+method+'.</p>'+
    '<p><b>Machine equivalents:</b> '+ratioInfo+'. Round up to <strong>'+x.count+'</strong> whole '+machineName(x.kind)+'.</p>'+
    '<p class="ratio-muted">This assumes continuous ingredients, no modules, no beacons, and normal quality. Rounded machine groups may have unused capacity.</p>'+
    '</div></details>';
 }).join('');
 const supplies=result.external.map(x=>'<div class="ratio-supply">'+
   '<div><b>'+escape(x.name)+'</b><small>'+ (x.isFluid?'Piped fluid':'Belted material')+'</small></div>'+
   '<div class="ratio-supply-value">'+number(x.needed)+'/min<div class="ratio-muted">'+(x.isFluid?'Pipe flow not modeled':x.belts+' × '+(result.belt===900?'yellow':result.belt===1800?'red':'blue')+' belt'+(x.belts===1?'':'s')+' minimum')+'</div></div></div>').join('');
 const output=result.outputStream;
 const outputDesc=output.isFluid?'Output uses pipes; pipe throughput not modeled':(output.belts+' × '+(result.belt===900?'yellow':result.belt===1800?'red':'blue')+' belt'+(output.belts===1?'':'s')+' for final output');
 return fieldset+
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
  '<details class="ratio-explain"><summary><span>Why this ratio? <small>Show recipe math and rounding for each machine group</small></span><span>⌄</span></summary>'+
  '<div class="ratio-explain-body"><p class="ratio-caveat">Machine output = items per craft × crafting speed × 60 ÷ recipe seconds. Divide needed items/min by output per machine/min, then round each group up.</p>'+detailed+'</div></details>'+
  '<div class="ratio-actions"><button type="button" class="ratio-send" data-ratio-send>Send to Build Next <span aria-hidden="true">→</span></button><small>This updates the hypothetical Build Next goal only. Your Existing Factory inventory remains untouched.</small></div>'+
  '<p class="ratio-caveat">Model limits: default/base Nauvis recipes only; no alternative Space Age recipes, quality, modules, beacons, productivity bonuses, inserter constraints, mining throughput, pump control or physical routing. Furnaces are modeled at 2× and chemical plants at 1×.</p>';
}
function renderCard(card){
 if(!card.open)return;
 const target=card.querySelector('.ratio-content');
 try{
  const result=analyzeRecipeRatios(recipes,state,contexts);
  target.innerHTML=buildView(result,card);
  target.querySelectorAll('[data-ratio-field]').forEach(input=>input.addEventListener('change',event=>{
   const kind=event.target.dataset.ratioField,prev=state[kind],raw=event.target.value;
   if(kind==='rate'){
    try{state.rate=assertFiniteRate(raw,'Target')}catch(err){state.rate=prev;target.querySelector('[data-ratio-error]').textContent=err.message;target.querySelector('[data-ratio-error]').hidden=false;event.target.value=String(prev);return}
   }else state[kind]=kind==='machine'||kind==='belt'?Number(raw):raw;
   renderAll();
  }));
  const button=target.querySelector('[data-ratio-send]');
  button.addEventListener('click',()=>{
   guide.goal=state.id;guide.rate=state.rate;guide.machine=state.machine;guide.source=state.source;guide.belt=state.belt;
   renderGuide();
   activateWorkspace('build',true);
   if(card.dataset.ratioExplorer!=='build'){
    const buildCard=document.querySelector('[data-ratio-explorer="build"]');
    buildCard.open=true;renderCard(buildCard);
   }
  });
  const note=document.createElement('p');note.className='ratio-error';note.dataset.ratioError='';note.hidden=true;note.setAttribute('role','alert');target.prepend(note);
 }catch(err){
  target.innerHTML='<p class="ratio-error">'+escape(err.message||'Recipe ratios unavailable')+'</p>';
 }
}
function renderAll(){cards.forEach(renderCard)}
cards.forEach(card=>card.addEventListener('toggle',()=>{if(card.open)renderCard(card)}));
root.NauvisRatioExplorer={refresh:renderAll,openAt(view){
 const card=document.querySelector('[data-ratio-explorer="'+view+'"]');
 if(card){card.open=true;renderCard(card)}
}};
})(typeof window==='undefined'?globalThis:window);
