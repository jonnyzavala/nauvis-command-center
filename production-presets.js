/* NAUVIS production presets v0.26.
   Recommendations are transparent heuristic starting targets, NOT inferred factory demand. */
(function(root){
'use strict';
const KNOWN=Object.freeze({
 'advanced-circuit':90,'processing-unit':30,'electronic-circuit':360,
 'low-density-structure':30,'production-science-pack':30,'utility-science-pack':30,
 'chemical-science-pack':30,'automation-science-pack':30,'logistic-science-pack':30,
 'battery':30,'accumulator':10,'solar-panel':10,'laser-turret':6,
 'speed-module':12,'efficiency-module':12,'productivity-module':12,
 'construction-robot':12,'logistic-robot':12,'flying-robot-frame':12,
 'electric-mining-drill':10,'assembling-machine-2':10,'assembling-machine-3':6,
 'plastic-bar':240,'fast-transport-belt':60,'transport-belt':120,
 'iron-plate':900,'copper-plate':900,'steel-plate':180,'stone-brick':180
});
const STEPS=[1,2,3,4,5,6,8,10,12,15,18,20,24,30,36,45,60,72,90,120,150,180,240,300,360,480,600,720,900,1200,1800,2400,3600,7200,12000,25000];
const nextNice=n=>STEPS.find(x=>x>=n-1e-8)||25000;
const clamp=n=>Math.max(1,Math.min(25000,n));
function recommendation(id,recipes,tier=.75){
 const recipe=recipes[id];if(!recipe)throw Error('Unsupported recipe');
 const speed=recipe[3]==='asm'?Number(tier):recipe[3]==='furnace'?2:1;
 if(!Number.isFinite(speed)||speed<=0)throw Error('Invalid crafting speed');
 const perMachine=recipe[2]*60*speed/recipe[1];
 const fixed=Object.prototype.hasOwnProperty.call(KNOWN,id);
 const baseline=fixed?KNOWN[id]:nextNice(clamp(perMachine*2));
 const balanced=Math.min(25000,baseline);
 const starter=nextNice(clamp(balanced/2));
 const expand=nextNice(clamp(balanced*2));
 return {id,starter,balanced,expand,perMachine,
  source:fixed?'curated':'two-machine-heuristic',
  rationale:fixed
   ?'Balanced is a curated starting target for this item, not a claim that your factory needs exactly this many.'
   :'Balanced starts near two standard producing machines, rounded to a practical target. Your actual demand may be different.',
  note:'Actual demand, assembler module bonuses, game progress and belt limits can change the ideal size.'};
}
function modeFor(rate,preset){
 if(!preset||!Number.isFinite(Number(rate)))return 'custom';
 for(const key of ['starter','balanced','expand'])
  if(Math.abs(Number(rate)-Number(preset[key]))<=1e-7)return key;
 return 'custom';
}
if(typeof module==='object'&&module.exports)module.exports={recommendation,modeFor,KNOWN};
root.NauvisPresets={recommendation,modeFor};
})(typeof window==='undefined'?globalThis:window);
