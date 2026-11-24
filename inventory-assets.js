/* NAUVIS v0.27 · Infrastructure ledger, distinct from production machines.
   Counts placed/installed items, not the machines crafting them. */
(function(root){
'use strict';
const MAX=1000000;
const categories=['Mining','Power','Defense','Logistics','Production infrastructure','Installed modules','Other'];
const starterItems=[
 'electric-mining-drill','pumpjack','solar-panel','accumulator','steam-engine','steam-turbine','boiler',
 'gun-turret','laser-turret','flamethrower-turret','stone-wall','gate','radar',
 'roboport','construction-robot','logistic-robot','beacon','oil-refinery','chemical-plant',
 'assembling-machine-2','assembling-machine-3','electric-furnace','steel-furnace','storage-tank',
 'small-electric-pole','medium-electric-pole','big-electric-pole','substation','fast-transport-belt',
 'speed-module','efficiency-module','productivity-module','rocket-silo','locomotive','cargo-wagon'
];
function categoryFor(item){
 if(/mining-drill|pumpjack/.test(item))return 'Mining';
 if(/solar|accumulator|steam|boiler|generator|pole|substation|nuclear|reactor/.test(item))return 'Power';
 if(/turret|wall|gate|mine|artillery|radar/.test(item))return 'Defense';
 if(/robot|roboport|belt|inserter|wagon|locomotive|chest|rail|pipe|signal/.test(item))return 'Logistics';
 if(/module/.test(item))return 'Installed modules';
 if(/machine|refinery|plant|furnace|silo|tank|beacon/.test(item))return 'Production infrastructure';
 return 'Other';
}
const safeCount=v=>{
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>MAX)throw Error('Counts must be whole numbers from 0 to '+MAX+'.');
 return n;
};
const safeRecipe=s=>{
 const str=String(s||'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{0,80}$/.test(str))throw Error('Choose a valid item ID.');
 return str;
};
function validateAsset(row){
 if(!row||typeof row!=='object')throw Error('Invalid infrastructure record.');
 const recipe=safeRecipe(row.recipe),count=safeCount(row.count);
 const category=categories.includes(row.category)?row.category:categoryFor(recipe);
 const area=String(row.area||'Nauvis').trim().slice(0,80)||'Nauvis';
 const note=String(row.note||'').trim().slice(0,200);
 return {...row,recipe,count,category,area,note,verified:!!row.verified};
}
function normalizeAssets(arr){
 if(!Array.isArray(arr))return [];
 const known=new Set();const out=[];
 for(const raw of arr){
  try{
   const asset=validateAsset(raw);
   if(typeof asset.id!=='string'||!asset.id||known.has(asset.id))continue;
   known.add(asset.id);out.push(asset);
  }catch(_e){}
 }
 return out;
}
function deploymentProject(name,item,planned,id,area='Nauvis'){
 const recipe=safeRecipe(item),count=safeCount(planned),text=String(name||'').trim();
 if(count<1)throw Error('Plan at least one item to place.');
 if(text.length<1||text.length>80)throw Error('Project name must have 1–80 characters.');
 if(typeof id!=='string'||!id)throw Error('Project ID required.');
 return {id,name:text,type:'deployment',status:'active',createdAt:new Date().toISOString(),
  goal:{id:recipe,rate:0,machine:null,source:'deployment',belt:0,area:String(area||'Nauvis').slice(0,80)},
  tasks:[{recipe,kind:'asset',planned:count,built:0}]};
}
function applyAssetBuildDelta(project,recipe,delta,assets){
 if(!project?.tasks||!Number.isSafeInteger(delta)||Math.abs(delta)!==1)throw Error('Expected a one-item deployment change.');
 const task=project.tasks.find(t=>t.recipe===recipe&&t.kind==='asset');
 if(!task)throw Error('Deployment task not found.');
 const next=task.built+delta;
 if(next<0||next>task.planned)throw Error('Deployed quantity is outside planned limits.');
 const source=normalizeAssets(assets);
 const linked=source.filter(x=>x.projectId===project.id&&x.projectTask===recipe);
 if(linked.length>1)throw Error('Multiple records are linked to this deployment. Reconcile before editing.');
 const row=linked[0];
 if((row?.count||0)!==task.built||(row&&row.recipe!==recipe))throw Error('Linked infrastructure differs from the project. Reconcile first.');
 const updated=source.map(x=>({...x})),idx=updated.findIndex(x=>x.projectId===project.id&&x.projectTask===recipe);
 if(idx>=0){
  if(next===0)updated.splice(idx,1);
  else updated[idx]={...updated[idx],count:next};
 }else if(next>0){
  updated.push(validateAsset({id:'asset_'+project.id+'_'+recipe,recipe,count:next,area:project.goal?.area,
   category:categoryFor(recipe),note:'',verified:false,projectId:project.id,projectTask:recipe}));
 }
 return {project:{...project,tasks:project.tasks.map(t=>t===task?{...t,built:next}:t)},rows:updated};
}
function cleanFactorySetup(current){
 const smelt={};for(const [k,v] of Object.entries(current?.smelt||{}))smelt[k]=['furnaceSpeed','beltTier'].includes(k)?v:0;
 const oil={};for(const k of Object.keys(current?.oil||{}))oil[k]=0;
 return {smelt,oil,machines:[],feeds:[],assets:[]};
}
if(typeof module==='object'&&module.exports)
 module.exports={categoryFor,validateAsset,normalizeAssets,deploymentProject,applyAssetBuildDelta,cleanFactorySetup,starterItems,categories};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const itemName=id=>R?.[id]?.[0]||String(id).replace(/-/g,' ');
let showAll=false;
const uuid=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
const itemIDs=[...new Set([...starterItems.filter(x=>R?.[x]),...Object.keys(R||{})])];
const options=(value,all=false)=>[...new Set([value,...(all?itemIDs:starterItems.filter(x=>R?.[x]))])].filter(Boolean).map(id=>
 '<option value="'+escape(id)+'"'+(id===value?' selected':'')+'>'+escape(itemName(id))+'</option>').join('');
const categoryOptions=value=>categories.map(x=>'<option value="'+escape(x)+'"'+(x===value?' selected':'')+'>'+escape(x)+'</option>').join('');
function getAssets(){return normalizeAssets(setup.assets)}
function counts(){
 const arr=getAssets();
 return {rows:arr.length,placed:arr.reduce((a,r)=>a+r.count,0),verified:arr.filter(r=>r.verified).length};
}
function rowHTML(a){
 const locked=!!a.projectId;
 const duplicate=getAssets().filter(r=>r.id!==a.id&&r.recipe===a.recipe&&r.category===a.category&&r.area===a.area);
 return '<article class="asset-row" data-asset-id="'+escape(a.id)+'">'+
 '<div class="asset-heading">'+(root.NauvisIcons?.item?.(a.recipe,36)||'')+
 '<div><strong>'+escape(itemName(a.recipe))+'</strong><small>'+escape(a.category)+' · '+escape(a.area)+(locked?' · linked construction':'')+'</small></div>'+
 (a.verified?'<span class="asset-verified">VERIFIED</span>':'')+'</div>'+
 (duplicate.length?'<p class="asset-warning">Possible duplicate: another record matches this item and area. Review both.</p>':'')+
 '<div class="asset-fields"><label>Item<select data-asset-field="recipe" '+(locked?'disabled':'')+'>'+options(a.recipe,showAll)+'</select></label>'+
 '<label>Count placed<input type="number" min="0" max="'+MAX+'" step="1" data-asset-field="count" value="'+a.count+'" '+(locked?'disabled':'')+'></label>'+
 '<label>Category<select data-asset-field="category" '+(locked?'disabled':'')+'>'+categoryOptions(a.category)+'</select></label>'+
 '<label>Area / block<input type="text" maxlength="80" data-asset-field="area" value="'+escape(a.area)+'"></label></div>'+
 '<label class="asset-note-label">Notes<input type="text" maxlength="200" data-asset-field="note" placeholder="Optional: position, modules, uncertain counts" value="'+escape(a.note)+'"></label>'+
 '<div class="asset-row-actions"><label class="asset-check"><input type="checkbox" data-asset-field="verified" '+(a.verified?'checked':'')+'> Verified in-game</label>'+
 (locked?'<span class="asset-linked-hint">Adjust count from Construction Queue</span>':
 '<button type="button" data-asset-remove="'+escape(a.id)+'">Remove record</button>')+'</div></article>';
}
function render(){
 if(!$('setupAssetRows'))return;
 const assets=getAssets(),c=counts();
 $('setupAssetStats').innerHTML=[
  [c.placed,'Placed / installed items'],[c.rows,'Tracked groups'],[c.verified,'Verified groups']
 ].map(([n,label])=>'<div class="asset-stat"><b>'+n.toLocaleString()+'</b><small>'+label+'</small></div>').join('');
 $('setupAssetRows').innerHTML=assets.map(rowHTML).join('')||
  '<div class="asset-empty">No infrastructure recorded. Add a group for the structures you actually placed in Factorio.</div>';
 $('assetExpandItems').textContent=showAll?'Show common items only':'Show all '+itemIDs.length+' producible items';
}
function commit(){
 setup.assets=getAssets();saveSetup();root.NauvisWorkspace?.refresh?.('setup');render();
}
function add(){
 const item='electric-mining-drill';
 setup.assets=[...getAssets(),{id:'in_'+uuid(),recipe:item,category:categoryFor(item),count:0,area:'Nauvis',note:'',verified:false}];
 commit();
 const last=$('setupAssetRows')?.lastElementChild;last?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function edit(event){
 const input=event.target.closest('[data-asset-field]');if(!input)return;
 const rowEl=input.closest('[data-asset-id]');if(!rowEl)return;
 const id=rowEl.dataset.assetId,field=input.dataset.assetField;
 const row=getAssets().find(r=>r.id===id);if(!row)return;
 if(row.projectId&&['recipe','category','count'].includes(field))return;
 const val=field==='verified'?input.checked:field==='count'?Number(input.value):input.value;
 try{
  const next=validateAsset({...row,[field]:val});
  if(field==='recipe'&&next.category===row.category)next.category=categoryFor(next.recipe);
  setup.assets=getAssets().map(x=>x.id===id?next:x);
  commit();
 }catch(err){root.alert(err.message);render()}
}
function remove(event){
 const button=event.target.closest('[data-asset-remove]');if(!button)return;
 const item=getAssets().find(x=>x.id===button.dataset.assetRemove);
 if(!item||item.projectId)return;
 if(item.count>0&&!root.confirm('Remove the '+item.count+' recorded '+itemName(item.recipe)+' from Factory inventory? This affects only NAUVIS, not the game.'))return;
 setup.assets=getAssets().filter(x=>x.id!==item.id);commit();
}
function init(){
 setup.assets=normalizeAssets(setup.assets);
 $('assetAdd')?.addEventListener('click',add);
 $('assetExpandItems')?.addEventListener('click',()=>{showAll=!showAll;render()});
 $('setupAssetRows')?.addEventListener('change',edit);
 $('setupAssetRows')?.addEventListener('click',remove);
 render();
}
root.NauvisAssets={normalizeAssets,validateAsset,applyBuildDelta:applyAssetBuildDelta,createProject:deploymentProject,cleanFactorySetup,categoryFor,counts,render,refresh:render,starterItems};
init();
})(typeof window==='undefined'?globalThis:window);
