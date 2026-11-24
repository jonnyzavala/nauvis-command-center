/* NAUVIS v0.28 · audited Factorio 2.0 machine/module throughput effects.
   Source: Factorio 2.0.77 extracted game prototype metadata + official wiki.
   https://wiki.factorio.com/Module
   https://wiki.factorio.com/Quality
   https://wiki.factorio.com/Beacon
   Only normal-quality tier-1 modules. Machine quality affects crafting speed,
   NOT the product quality/rarity. Beacon speed is the effective bonus read in game,
   NOT calculated from beacon count (which has diminishing returns in 2.0).
*/
(function(root){
'use strict';
const PROD_ALLOWED=new Set(["advanced-circuit","advanced-oil-processing","automation-science-pack","barrel","basic-oil-processing","battery","chemical-science-pack","coal-liquefaction","copper-cable","copper-plate","electric-engine-unit","electronic-circuit","engine-unit","explosives","flying-robot-frame","heavy-oil-cracking","iron-gear-wheel","iron-plate","iron-stick","kovarex-enrichment-process","light-oil-cracking","logistic-science-pack","low-density-structure","lubricant","military-science-pack","nuclear-fuel","nuclear-fuel-reprocessing","parameter-0","parameter-1","parameter-2","parameter-3","parameter-4","parameter-5","parameter-6","parameter-7","parameter-8","parameter-9","plastic-bar","processing-unit","production-science-pack","rocket-fuel","rocket-part","solid-fuel","solid-fuel-from-heavy-oil","solid-fuel-from-light-oil","solid-fuel-from-petroleum-gas","steel-plate","stone-brick","sulfur","sulfuric-acid","uranium-fuel-cell","uranium-processing","utility-science-pack"]);
const QUALITIES=Object.freeze({normal:1,uncommon:1.3,rare:1.6,epic:1.9,legendary:2.5});
const MODULE_TYPES=Object.freeze(['none','speed1','efficiency1','productivity1']);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function settings(input={}){
 const type=String(input.moduleType??'none');
 if(!MODULE_TYPES.includes(type))throw Error('Choose None, Speed 1, Efficiency 1, or Productivity 1.');
 const count=Number(input.moduleCount??0);
 if(!Number.isSafeInteger(count)||count<0||count>4)throw Error('Module count must be a whole number from 0 to 4.');
 const quality=String(input.machineQuality??'normal');
 if(!own(QUALITIES,quality))throw Error('Unsupported crafting-machine quality.');
 const beacon=Number(input.beaconSpeed??0);
 if(!Number.isFinite(beacon)||beacon<0||beacon>300)throw Error('Effective beacon speed bonus must be between 0 and +300%.');
 return {moduleType:type,moduleCount:count,machineQuality:quality,beaconSpeed:beacon};
}
function forRecipe(id,kind,input={}){
 const cfg=settings(input);
 const tier=Number(input.machine??input.tier??.75);
 const slots=kind==='asm'?(tier===1.25?4:tier===.75?2:0):kind==='chem'?3:0;
 const qualityFactor=kind==='asm'||kind==='chem'?QUALITIES[cfg.machineQuality]:1;
 const speedBase=kind==='asm'?(tier||.75):kind==='chem'?1:2;
 if(kind==='asm'&&![.5,.75,1.25].includes(tier))throw Error('Unsupported assembler crafting speed.');
 const allowed=cfg.moduleType!=='productivity1'||PROD_ALLOWED.has(id);
 const applied=slots&&allowed&&cfg.moduleType!=='none'?Math.min(cfg.moduleCount,slots):0;
 const speedBonus=(cfg.moduleType==='speed1'?.2*applied:0)+
  (cfg.moduleType==='productivity1'?-.05*applied:0)+
  (slots?cfg.beaconSpeed/100:0);
 const speedFactor=Math.max(.2,1+speedBonus);
 const productivityBonus=cfg.moduleType==='productivity1'?.04*applied:0;
 const energyBonus=cfg.moduleType==='speed1'?.5*applied:
  cfg.moduleType==='efficiency1'?-.3*applied:
  cfg.moduleType==='productivity1'?.4*applied:0;
 return {moduleType:cfg.moduleType,moduleRequested:cfg.moduleCount,moduleApplied:applied,
   moduleSlots:slots,moduleEligible:allowed,quality:cfg.machineQuality,
   qualityFactor,beaconSpeed:slots?cfg.beaconSpeed:0,productivityBonus,
   machineSpeed:speedBase*qualityFactor*speedFactor,speedFactor,
   energyFactor:Math.max(.2,1+energyBonus),baseSpeed:speedBase};
}
function effectiveOutputPerCraft(quantity,effects){
 const out=Number(quantity)*(1+effects.productivityBonus);
 if(!Number.isFinite(out)||out<=0)throw Error('Invalid effective recipe output.');
 return out;
}
if(typeof module==='object'&&module.exports)
 module.exports={forRecipe,settings,effectiveOutputPerCraft,PROD_ALLOWED,QUALITIES,MODULE_TYPES};
root.NauvisEffects={forRecipe,settings,effectiveOutputPerCraft,PROD_ALLOWED,QUALITIES,MODULE_TYPES};
})(typeof window==='undefined'?globalThis:window);
