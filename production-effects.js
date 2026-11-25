/* NAUVIS v0.28 · audited Factorio 2.0 machine/module throughput effects.
   Source: Factorio 2.0.77 extracted game prototype metadata + official wiki.
   https://wiki.factorio.com/Module
   https://wiki.factorio.com/Quality
   https://wiki.factorio.com/Beacon
   Normal-quality speed, efficiency and productivity modules, tiers 1–3. Machine quality affects crafting speed,
   NOT the product quality/rarity. Beacon speed is the effective bonus read in game,
   NOT calculated from beacon count (which has diminishing returns in 2.0).
*/
(function(root){
'use strict';
const PROD_ALLOWED=new Set(["advanced-circuit","advanced-oil-processing","automation-science-pack","barrel","basic-oil-processing","battery","chemical-science-pack","coal-liquefaction","copper-cable","copper-plate","electric-engine-unit","electronic-circuit","engine-unit","explosives","flying-robot-frame","heavy-oil-cracking","iron-gear-wheel","iron-plate","iron-stick","kovarex-enrichment-process","light-oil-cracking","logistic-science-pack","low-density-structure","lubricant","military-science-pack","nuclear-fuel","nuclear-fuel-reprocessing","parameter-0","parameter-1","parameter-2","parameter-3","parameter-4","parameter-5","parameter-6","parameter-7","parameter-8","parameter-9","plastic-bar","processing-unit","production-science-pack","rocket-fuel","rocket-part","solid-fuel","solid-fuel-from-heavy-oil","solid-fuel-from-light-oil","solid-fuel-from-petroleum-gas","steel-plate","stone-brick","sulfur","sulfuric-acid","uranium-fuel-cell","uranium-processing","utility-science-pack"]);
const QUALITIES=Object.freeze({normal:1,uncommon:1.3,rare:1.6,epic:1.9,legendary:2.5});
const MODULE_DATA=Object.freeze({none:[0,0,0],speed1:[.2,0,.5],speed2:[.3,0,.6],speed3:[.5,0,.7],efficiency1:[0,0,-.3],efficiency2:[0,0,-.4],efficiency3:[0,0,-.5],productivity1:[-.05,.04,.4],productivity2:[-.1,.06,.6],productivity3:[-.15,.1,.8]});
const MODULE_TYPES=Object.freeze(Object.keys(MODULE_DATA));
const MODULE_OPTIONS=Object.freeze(MODULE_TYPES.map(type=>type==='none'?['none','No modules']:[type,type.replace(/^(speed|efficiency|productivity)(\d)$/,(_,name,tier)=>name[0].toUpperCase()+name.slice(1)+' '+tier)]));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function settings(input={}){
 const type=String(input.moduleType??'none');
 if(!MODULE_TYPES.includes(type))throw Error('Choose a supported module type.');
 const count=Number(input.moduleCount??0);
 if(!Number.isSafeInteger(count)||count<0||count>4)throw Error('Module count must be a whole number from 0 to 4.');
 const secondType=String(input.moduleType2??'none'),secondCount=Number(input.moduleCount2??0);
 if(!MODULE_TYPES.includes(secondType))throw Error('Choose a supported second module type.');
 if(!Number.isSafeInteger(secondCount)||secondCount<0||secondCount>4)throw Error('Second module count must be a whole number from 0 to 4.');
 if((type==='none'?0:count)+(secondType==='none'?0:secondCount)>4)throw Error('A machine profile can request at most four modules in total.');
 const quality=String(input.machineQuality??'normal');
 if(!own(QUALITIES,quality))throw Error('Unsupported crafting-machine quality.');
 const beacon=Number(input.beaconSpeed??0);
 if(!Number.isFinite(beacon)||beacon<0||beacon>300)throw Error('Effective beacon speed bonus must be between 0 and +300%.');
 return {moduleType:type,moduleCount:count,moduleType2:secondType,moduleCount2:secondCount,machineQuality:quality,beaconSpeed:beacon};
}
function forRecipe(id,kind,input={}){
 const cfg=settings(input);
 const tier=Number(input.machine??input.tier??.75);
 const furnaceType=kind==='furnace'?input.furnaceType:undefined;
 if(furnaceType!==undefined&&!['stone','steel','electric'].includes(furnaceType))throw Error('Unsupported furnace type.');
 const electric=furnaceType==='electric';
 const slots=electric?2:kind==='asm'?(tier===1.25?4:tier===.75?2:0):kind==='chem'?3:0;
 const qualityFactor=kind==='asm'||kind==='chem'||electric?QUALITIES[cfg.machineQuality]:1;
 const speedBase=kind==='asm'?(tier||.75):kind==='chem'?1:furnaceType==='stone'?1:2;
 if(kind==='asm'&&![.5,.75,1.25].includes(tier))throw Error('Unsupported assembler crafting speed.');
 const groups=[[cfg.moduleType,cfg.moduleCount],[cfg.moduleType2,cfg.moduleCount2]];
 let remaining=slots,applied=0,eligible=true,speedBonus=slots?cfg.beaconSpeed/100:0,productivityBonus=0,energyBonus=0;
 const moduleGroups=groups.map(([type,requested])=>{
  const allowed=type==='none'||!type.startsWith('productivity')||PROD_ALLOWED.has(id);
  if(requested>0&&!allowed)eligible=false;
  const count=type==='none'||!allowed?0:Math.min(requested,remaining);
  remaining-=count;applied+=count;
  const [speed,prod,energy]=MODULE_DATA[type];
  speedBonus+=speed*count;productivityBonus+=prod*count;energyBonus+=energy*count;
  return {type,requested,applied:count,eligible:allowed};
 });
 const speedFactor=Math.max(.2,1+speedBonus);
 return {moduleType:cfg.moduleType,moduleRequested:groups.reduce((n,[t,c])=>n+(t==='none'?0:c),0),moduleApplied:applied,moduleGroups,
   moduleSlots:slots,moduleEligible:eligible,quality:cfg.machineQuality,
   qualityFactor,beaconSpeed:slots?cfg.beaconSpeed:0,productivityBonus,
   machineSpeed:speedBase*qualityFactor*speedFactor,speedFactor,
   energyFactor:Math.max(.2,1+energyBonus),baseSpeed:speedBase};
}
function effectiveOutputPerCraft(quantity,effects){
 const out=Number(quantity)*(1+effects.productivityBonus);
 if(!Number.isFinite(out)||out<=0)throw Error('Invalid effective recipe output.');
 return out;
}
// Shared production math: the same recipe profile drives Inventory,
// Blueprint, Logistics and the rated Balance ledger.
function recipeRates(id,recipe,input={},count=1){
 if(!recipe||!(recipe[1]>0)||!(recipe[2]>0))throw Error('Invalid recipe.');
 const n=Number(count);if(!Number.isFinite(n)||n<0)throw Error('Invalid machine count.');
 const profile=forRecipe(id,recipe[3],input),yieldPerCraft=effectiveOutputPerCraft(recipe[2],profile);
 const crafts=60*profile.machineSpeed/recipe[1]*n,output=crafts*yieldPerCraft;
 return {profile,yieldPerCraft,crafts,output,inputs:Object.fromEntries(Object.entries(recipe[4]||{}).map(([k,v])=>[k,crafts*v]))};
}
// Legacy grouped links keep their original key. New lines get an opaque identity.
// Allocation changes do not change identity; changing recipe is a replacement.
function machineKey(row){
 const prefix='machine:'+row.recipe+'|';
 return typeof row.entityKey==='string'&&row.entityKey.startsWith(prefix)&&row.entityKey.length<=300?row.entityKey:prefix+(row.destination||'Unspecified');
}
function materializeMachineKeys(rows){return (Array.isArray(rows)?rows:[]).map(row=>({...row,entityKey:machineKey(row)}))}
function newMachineKey(recipe,token){
 const value=String(token??(root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)));
 return 'machine:'+recipe+'|id:'+encodeURIComponent(value);
}
function machineKeyMatches(key,recipe){return typeof key==='string'&&key.length<=300&&key.startsWith('machine:'+recipe+'|')&&key.slice(('machine:'+recipe+'|').length).length>0}
function recordedRates(id,recipe,row){
 const machine=recipe?.[3]==='asm'?(Number(row.tier)||.75):1;
 const n=Math.max(0,Number(row.count)||0);
 try{return recipeRates(id,recipe,{...row,machine},n)}
 catch(_e){return recipeRates(id,recipe,{machine:[.5,.75,1.25].includes(machine)?machine:.75},n)}
}
function supportedRate(record,factor=1){
 const rated=Math.max(0,Number(record.rate)||0),f=Math.max(0,Math.min(1,Number(factor)||0));
 if(f===1)return rated;
 const raw=Number(record.inputRated);
 if(Number.isFinite(raw))return Math.min(rated,Math.max(0,raw*f-(Number(record.reserved)||0)));
 return rated*f;
}
// Project ownership is a subset of the existing aggregate smelting totals.
// Never add the ownership ledger to those totals again.
const SMELT_FIELDS={'iron-plate':'ironFurnaces','copper-plate':'copperFurnaces','steel-plate':'steelFurnaces','stone-brick':'brickFurnaces'};
// Explicit furnace groups are subsets, not extra production. Construction-owned
// units remain in the baseline population.
function validateSmeltProfiles(smelt,owned={}){
 const profiles=smelt?.profiles??[];
 if(!Array.isArray(profiles)||profiles.length>100)throw Error('Invalid furnace profile list (maximum 100 groups).');
 const totals={};
 for(const row of profiles){
  if(!row||!Object.hasOwn(SMELT_FIELDS,row.recipe)||!['stone','steel','electric'].includes(row.furnaceType)||!Number.isSafeInteger(row.count)||row.count<1)throw Error('Invalid furnace profile.');
  const cfg=settings(row),modules=(cfg.moduleType==='none'?0:cfg.moduleCount)+(cfg.moduleType2==='none'?0:cfg.moduleCount2);
  if(modules>2)throw Error('Electric furnaces have only two module slots.');
  if(row.furnaceType!=='electric'&&(modules||cfg.beaconSpeed||cfg.machineQuality!=='normal'))throw Error('Burner furnace profiles use normal quality, no modules or beacons.');
  const field=SMELT_FIELDS[row.recipe];totals[field]=(totals[field]||0)+row.count;
 }
 for(const [field,n] of Object.entries(totals)){
  const count=Number(smelt[field]);
  if(!Number.isSafeInteger(count)||count<n+(owned[field]||0))throw Error('Actual '+field+' must cover '+n+' profiled and '+(owned[field]||0)+' project-owned furnaces. Remove a profile before reducing the total.');
 }
 return totals;
}
function smeltingRates(smelt,recipes){
 const owned={};for(const row of smelt.projectBuilt||[]){const f=SMELT_FIELDS[row.recipe];owned[f]=(owned[f]||0)+row.count}
 const profiled=validateSmeltProfiles(smelt,owned),result={};
 for(const [id,field] of Object.entries(SMELT_FIELDS)){
  const recipe=recipes[id],total=Math.max(0,Number(smelt[field])||0),remainder=total-(profiled[field]||0);
  const groups=[{count:remainder,furnaceType:Number(smelt.furnaceSpeed)===1?'stone':'steel'},...(smelt.profiles||[]).filter(x=>x.recipe===id)];
  const input=Object.keys(recipe[4])[0];let output=0,inputRated=0;
  for(const row of groups){const rates=recipeRates(id,recipe,row,row.count);output+=rates.output;inputRated+=rates.inputs[input]}
  result[id]={output,inputRated,input,unprofiled:remainder,count:total};
 }
 return result;
}
function smeltingCapacity(smelt,recipes){
 const rates=smeltingRates(smelt,recipes),num=x=>Math.max(0,Number(x)||0),belt=num(smelt.beltTier);
 const ironM=rates['iron-plate'].output,ironTransport=num(smelt.ironBelts)*belt;
 const iron=Math.min(ironM,ironTransport),steelInput=Math.min(iron,Math.min(num(smelt.ironToSteel),num(smelt.ironBelts))*belt),busIron=iron-steelInput;
 const steelCapMachines=rates['steel-plate'].output,steelRatedInput=rates['steel-plate'].inputRated,steelCapBelt=num(smelt.steelBelts)*belt;
 // Proportional utilization of mixed steel profiles under input/output limits.
 const steel=Math.min(steelCapMachines,steelCapBelt,steelRatedInput?steelInput*steelCapMachines/steelRatedInput:0);
 const usedIronForSteel=steelCapMachines?steel*steelRatedInput/steelCapMachines:0;
 const copperM=rates['copper-plate'].output,brickM=rates['stone-brick'].output;
 return {rates,iron,steelInput,busIron,steel,copper:Math.min(copperM,num(smelt.copperBelts)*belt),bricks:Math.min(brickM,num(smelt.brickBelts)*belt),ironM,ironTransport,steelCapMachines,steelCapBelt,steelRatedInput,copperM,brickM,belt,usedIronForSteel,unusedSteelFeed:Math.max(0,steelInput-usedIronForSteel),perPlate:60*num(smelt.furnaceSpeed)/3.2,perSteel:60*num(smelt.furnaceSpeed)/16};
}
function smeltOwnership(smelt,projects){
 const ledger=smelt?.projectBuilt??[];
 if(!Array.isArray(ledger))throw Error('Smelting project ledger is invalid.');
 const totals={},keys=new Set(),expected=new Map();
 for(const p of projects||[])for(const t of p.tasks||[])if(t.kind==='furnace'&&t.built>0){
  if(!Object.hasOwn(SMELT_FIELDS,t.recipe)||!Number.isSafeInteger(t.built)||t.built>t.planned)throw Error('Invalid smelting project task.');
  expected.set(JSON.stringify([p.id,t.recipe]),t.built);
 }
 for(const r of ledger){
  const field=SMELT_FIELDS[r?.recipe],key=JSON.stringify([r?.projectId,r?.recipe]);
  if(!Object.hasOwn(SMELT_FIELDS,r?.recipe)||typeof r.projectId!=='string'||!Number.isSafeInteger(r.count)||r.count<1||keys.has(key)||expected.get(key)!==r.count)throw Error('Smelting project ownership differs from Construction. Review the saved snapshot.');
  keys.add(key);totals[field]=(totals[field]||0)+r.count;
 }
 if(keys.size!==expected.size)throw Error('A built smelting project is missing its ownership record.');
 for(const [field,count] of Object.entries(totals))if(!Number.isSafeInteger(Number(smelt[field]))||Number(smelt[field])<count)throw Error('Actual '+field+' cannot be lower than '+count+' project-owned furnaces.');
 if(keys.size&&Number(smelt.furnaceSpeed)!==2)throw Error('Project-owned furnaces require the modeled 2× steel/electric speed.');
 validateSmeltProfiles(smelt,totals);
 return totals;
}
function editSmelting(smelt,patch,projects){
 const next={...smelt,...patch};
 smeltOwnership(next,projects);
 return next;
}
function applySmeltBuildDelta(project,recipe,delta,smelt,projects){
 if(delta!==1&&delta!==-1)throw Error('Build adjustment must be one furnace.');
 const t=project?.tasks?.find(x=>x.recipe===recipe),field=SMELT_FIELDS[recipe];
 if(!Object.hasOwn(SMELT_FIELDS,recipe)||t?.kind!=='furnace')throw Error('Unsupported smelting task.');
 smeltOwnership(smelt,projects);
 if(Number(smelt.furnaceSpeed)!==2)throw Error('Set actual smelting to steel/electric (2×) before recording this project.');
 if(!Number.isSafeInteger(t.built)||!Number.isSafeInteger(t.planned)||t.built+delta<0||t.built+delta>t.planned)throw Error('Built count must stay between zero and planned.');
 const total=Number(smelt[field]??0);if(!Number.isSafeInteger(total)||total<0||total+delta<0)throw Error('Invalid actual furnace total.');
 const count=t.built+delta,ledger=(smelt.projectBuilt||[]).filter(x=>x.projectId!==project.id||x.recipe!==recipe);
 if(count)ledger.push({projectId:project.id,recipe,count});
 const updated={...project,tasks:project.tasks.map(x=>x===t?{...x,built:count}:x)};
 const next={...smelt,[field]:total+delta,projectBuilt:ledger};
 smeltOwnership(next,projects.map(p=>p.id===project.id?updated:p));
 return {project:updated,smelt:next};
}
// Prepare a complete replacement before touching local or synced state.
// Legacy district-only backups may update district fields, never actual
// inventory ownership, project history or journal.
function prepareBackupImport(input,current,districtDefaults){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Not a dashboard backup.');
 const plan=input.plan&&typeof input.plan==='object'?input.plan:input;
 if(typeof plan.redBlocks!=='number')throw Error('Not a dashboard backup.');
 if(input.setup!==undefined){
  if(!input.setup||typeof input.setup!=='object'||Array.isArray(input.setup)||!input.plan)throw Error('Invalid factory inventory in backup.');
  const candidate={...current,...input,plan:{...districtDefaults,...plan},guide:input.guide||current.guide,setup:input.setup,balancePrefs:input.balancePrefs||{includeGoal:false}};
  validateOwnershipSnapshot(candidate);
  return candidate;
 }
 const next=JSON.parse(JSON.stringify(current));
 for(const [key,value] of Object.entries(districtDefaults)){
  if(typeof value!=='number')continue;
  const n=Number(plan[key]??value);if(!Number.isFinite(n)||n<0)throw Error('Invalid legacy district quantity.');
  next.plan[key]=n;
 }
 next.plan.checked={...(plan.checked||{})};
 if(input.guide&&typeof input.guide==='object')next.guide={...next.guide,...input.guide};
 validateOwnershipSnapshot(next);
 return next;
}
// Saved proposals store only a goal and user selections, never actual capacity.
function normalizeProposalRoutes(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>300)throw Error('A proposed route plan supports at most 300 connections.');
 const ids=new Set(),pairs=new Set();
 return value.map(r=>{
  if(!r||typeof r.id!=='string'||!r.id||r.id.length>100||ids.has(r.id)||typeof r.from!=='string'||r.from.length>320||!/^(stage:|external:|actual:machine:).+/.test(r.from)||typeof r.to!=='string'||!r.to||r.to.length>100||typeof r.item!=='string'||!r.item||r.item.length>100||!['yellow','red','blue'].includes(r.tier)||!Number.isSafeInteger(r.belts)||r.belts<1||r.belts>10000||![1,2].includes(r.lanes)||!Number.isFinite(r.rate)||r.rate<=0||r.rate>Number.MAX_SAFE_INTEGER)throw Error('Invalid proposed belt connection.');
  const pair=JSON.stringify([r.from,r.to,r.item]);if(pairs.has(pair))throw Error('Combine duplicate proposed connections into one route.');
  ids.add(r.id);pairs.add(pair);
  return {id:r.id,from:r.from,to:r.to,item:r.item,tier:r.tier,belts:r.belts,lanes:r.lanes,rate:r.rate};
 });
}
function normalizeLogisticsDrafts(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>30)throw Error('Saved Logistics drafts must be a list of at most 30 designs.');
 const seen=new Set();
 return value.map(row=>{
  if(!row||typeof row.id!=='string'||!row.id||row.id.length>100||seen.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>100)throw Error('Invalid saved Logistics draft identity.');
  seen.add(row.id);
  const g=row.goal;
  if(!g||typeof g.id!=='string'||!g.id||g.id.length>100||!Number.isFinite(g.rate)||g.rate<=0||g.rate>25000||![.75,1.25].includes(g.machine)||![900,1800,2700].includes(g.belt)||!['bus','raw'].includes(g.source))throw Error('Invalid saved Logistics goal.');
  if(!Array.isArray(row.reuseKeys)||row.reuseKeys.length>200||row.reuseKeys.some(k=>typeof k!=='string'||!k.startsWith('machine:')||k.length>300))throw Error('Invalid saved Logistics reuse selections.');
  const focus=typeof row.focus==='string'&&row.focus.length<=100?row.focus:g.id;
  const updatedAt=typeof row.updatedAt==='string'&&row.updatedAt.length<=40?row.updatedAt:'';
  return {id:row.id,name:row.name.trim(),goal:{id:g.id,rate:g.rate,machine:g.machine,belt:g.belt,source:g.source,...settings(g)},reuseKeys:[...new Set(row.reuseKeys)],focus,updatedAt,routes:normalizeProposalRoutes(row.routes)};
 });
}
function saveLogisticsDraft(list,draft){
 const current=normalizeLogisticsDrafts(list),next=normalizeLogisticsDrafts([draft])[0];
 return normalizeLogisticsDrafts([...current.filter(x=>x.id!==next.id),next]);
}
function validateOwnershipSnapshot(data){
 if(!data||typeof data!=='object'||!data.plan||!data.guide||!data.setup)throw Error('Invalid shared factory snapshot.');
 const projects=data.plan.projects??[];
 if(!Array.isArray(projects))throw Error('Invalid construction project list.');
 smeltOwnership(data.setup.smelt||{},projects);
 normalizeLogisticsDrafts(data.setup.logisticsDrafts);
 return true;
}
if(typeof module==='object'&&module.exports)
 module.exports={forRecipe,settings,effectiveOutputPerCraft,recipeRates,recordedRates,machineKey,materializeMachineKeys,newMachineKey,machineKeyMatches,supportedRate,SMELT_FIELDS,validateSmeltProfiles,smeltingRates,smeltingCapacity,smeltOwnership,editSmelting,applySmeltBuildDelta,prepareBackupImport,validateOwnershipSnapshot,normalizeLogisticsDrafts,saveLogisticsDraft,normalizeProposalRoutes,PROD_ALLOWED,QUALITIES,MODULE_TYPES,MODULE_OPTIONS,MODULE_DATA};
root.NauvisEffects={forRecipe,settings,effectiveOutputPerCraft,recipeRates,recordedRates,machineKey,materializeMachineKeys,newMachineKey,machineKeyMatches,supportedRate,SMELT_FIELDS,validateSmeltProfiles,smeltingRates,smeltingCapacity,smeltOwnership,editSmelting,applySmeltBuildDelta,prepareBackupImport,validateOwnershipSnapshot,normalizeLogisticsDrafts,saveLogisticsDraft,normalizeProposalRoutes,PROD_ALLOWED,QUALITIES,MODULE_TYPES,MODULE_OPTIONS,MODULE_DATA};
})(typeof window==='undefined'?globalThis:window);
