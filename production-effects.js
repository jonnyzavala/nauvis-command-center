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
 const slots=kind==='asm'?(tier===1.25?4:tier===.75?2:0):kind==='chem'?3:0;
 const qualityFactor=kind==='asm'||kind==='chem'?QUALITIES[cfg.machineQuality]:1;
 const speedBase=kind==='asm'?(tier||.75):kind==='chem'?1:2;
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
if(typeof module==='object'&&module.exports)
 module.exports={forRecipe,settings,effectiveOutputPerCraft,recipeRates,recordedRates,supportedRate,PROD_ALLOWED,QUALITIES,MODULE_TYPES,MODULE_OPTIONS,MODULE_DATA};
root.NauvisEffects={forRecipe,settings,effectiveOutputPerCraft,recipeRates,recordedRates,supportedRate,PROD_ALLOWED,QUALITIES,MODULE_TYPES,MODULE_OPTIONS,MODULE_DATA};
})(typeof window==='undefined'?globalThis:window);
