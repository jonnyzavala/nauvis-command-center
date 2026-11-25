/* NAUVIS guided setup: a review-first seed for an empty factory, never a reset. */
(function(root){
'use strict';
const SMELT=[['ironFurnaces','Iron plate furnaces'],['ironBelts','Iron output belts (before steel split)'],['ironToSteel','Iron belts dedicated to steel'],['steelFurnaces','Steel furnaces'],['steelBelts','Steel output belts'],['copperFurnaces','Copper plate furnaces'],['copperBelts','Copper output belts'],['brickFurnaces','Brick furnaces'],['brickBelts','Brick output belts']];
const OIL=[['refineries','Advanced-oil refineries'],['heavyCrackers','Heavy → light cracking plants'],['lightCrackers','Light → petroleum cracking plants']];
const clone=x=>JSON.parse(JSON.stringify(x));
const entries=(value)=>value&&typeof value==='object'?Object.entries(value):[];
function emptyFactory(s){
 if(!s?.plan||!s?.setup||!s?.guide)return false;
 const q=s.setup,p=s.plan;
 return !entries(p).some(([k,v])=>typeof v==='number'&&v!==0)
  &&!Object.keys(p.checked||{}).length&&!(p.projects||[]).length&&!(p.journal||[]).length
  &&!entries(q.smelt).some(([k,v])=>!['furnaceSpeed','beltTier','profiles','projectBuilt'].includes(k)&&Number(v)!==0)
  &&!(q.smelt?.profiles||[]).length&&!(q.smelt?.projectBuilt||[]).length
  &&!entries(q.oil).some(([,v])=>Number(v)!==0)
  &&!(q.machines||[]).length&&!(q.feeds||[]).length&&!(q.assets||[]).length
  &&!(q.logistics?.nodes||[]).length&&!(q.logistics?.edges||[]).length&&!(q.logisticsDrafts||[]).length;
}
function quantity(v,label,optional=true){
 if(v===undefined||v===null||String(v).trim()===''){if(optional)return null;throw Error(label+' is required.')}
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>999999)throw Error(label+' must be a whole number from 0 to 999,999.');return n;
}
function prepareOnboarding(snapshot,config,context){
 if(!emptyFactory(snapshot))throw Error('Inventory is no longer empty. Reopen the tour; existing records will not be replaced.');
 if(!['new','existing'].includes(config.mode))throw Error('Choose a playthrough type.');
 const n=clone(snapshot),belt=Number(config.belt),furnace=Number(config.furnace),machine=Number(config.machine);
 if(![900,1800,2700].includes(belt)||![1,2].includes(furnace)||![.75,1.25].includes(machine))throw Error('Choose a supported equipment preference.');
 n.setup.smelt={...n.setup.smelt,beltTier:belt,furnaceSpeed:furnace};n.guide.belt=belt;n.guide.machine=machine;
 if(config.goal){
  if(!Object.hasOwn(context.recipes,config.goal))throw Error('Choose a supported planning goal.');
  const rate=Number(config.rate);if(!Number.isFinite(rate)||rate<=0||rate>25000||String(config.rate).trim()==='')throw Error('Target must be above 0 and at most 25,000/min.');
  n.guide={...n.guide,goal:config.goal,rate,source:config.source==='raw'?'raw':'bus',moduleType:'none',moduleCount:0,moduleType2:'none',moduleCount2:0,machineQuality:'normal',beaconSpeed:0};
 }
 if(config.mode==='existing'){
  for(const [key,label] of SMELT){const v=quantity(config.smelt?.[key],label);if(v!==null)n.setup.smelt[key]=v}
  if(Number(n.setup.smelt.ironToSteel||0)>Number(n.setup.smelt.ironBelts||0))throw Error('Iron belts dedicated to steel cannot exceed total iron output belts.');
  for(const [key,label] of OIL){const v=quantity(config.oil?.[key],label);if(v!==null)n.setup.oil[key]=v}
  if(!Array.isArray(config.lines)||config.lines.length>100)throw Error('Record at most 100 production lines in guided setup.');
  const keys=new Set();
  n.setup.machines=config.lines.map(line=>{
   const r=Object.hasOwn(context.recipes,line.recipe)?context.recipes[line.recipe]:null;
   if(!r||!['asm','chem'].includes(r[3]))throw Error('Choose a valid production recipe.');
   const count=quantity(line.count,'Production machine count',false),tier=r[3]==='asm'?Number(line.tier):1;
   if(!count||r[3]==='asm'&&![.5,.75,1.25].includes(tier)||!context.destinations.includes(line.destination))throw Error('Choose a positive machine count, supported tier and destination.');
   const entityKey=context.newMachineKey(line.recipe);if(keys.has(entityKey))throw Error('Duplicate array identifier. Try again.');keys.add(entityKey);
   return {recipe:line.recipe,count,tier,destination:line.destination,entityKey};
  });
 }
 return n;
}
if(typeof module==='object'&&module.exports)module.exports={emptyFactory,prepareOnboarding,quantity,SMELT,OIL};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),dialog=$('factoryOnboardingDialog'),host=$('factoryOnboardingContent');
if(!dialog||!host)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(list,val)=>list.map(([k,l])=>'<option value="'+esc(k)+'"'+(String(k)===String(val)?' selected':'')+'>'+esc(l)+'</option>').join('');
const ctx=()=>({recipes:R,destinations,newMachineKey:r=>root.NauvisEffects.newMachineKey(r)});
const recipes=()=>Object.entries(R).filter(([,r])=>['asm','chem'].includes(r[3])).map(([k,r])=>[k,r[0]]).sort((a,b)=>a[1].localeCompare(b[1]));
const seenKey='nauvis-guided-start-seen-v1';
let baseline=null,config=null,step=0,tourOnly=false,notice='',tourIndex=0;
const tours=[
 ['setup','Inventory','Record only equipment you have physically built. Smelting, oil, production arrays, belts and infrastructure live here. Use Quick Change for fast additions.'],
 ['balance','Balance Analysis','Compare rated production with demand. Transport-constrained capacity is separate; unknown inputs are not proof of supply.'],
 ['logistics','Logistics','Connect recorded production arrays and inspect belt capacity. Save hypothetical layouts as drafts without reserving actual supply.'],
 ['build','Blueprint Designer','Pick a recipe and output target. Reverse-plan required machines, ingredients and belt lanes.'],
 ['factory','Construction Queue','Queue a calculated plan when ready. Mark machines built only after placing them in Factorio. This updates Inventory exactly once.'],
 ['learn','Quick Guide','Find reference explanations and workflow help. Return to Inventory tools to replay this tour.']
];
function remember(){try{localStorage.setItem(seenKey,'1')}catch{}}
function defaults(s){return {mode:'',belt:s.guide.belt||900,furnace:s.setup.smelt?.furnaceSpeed||2,machine:[.75,1.25].includes(s.guide.machine)?s.guide.machine:.75,goal:'',rate:30,source:'bus',smelt:{},oil:{},lines:[]}}
function open(reason='manual'){
 if(dialog.open)return;
 baseline=root.NauvisLocal?.snapshot?.();if(!baseline)return;
 tourOnly=!emptyFactory(baseline);config=defaults(baseline);step=0;tourIndex=0;notice='';
 remember();render();dialog.showModal();
}
function close(){if(dialog.open)dialog.close();remember()}
function title(t,sub){return '<header class="onboard-header"><small>NAUVIS · '+(tourOnly||step===4?'WORKSPACE TOUR':'GUIDED START')+'</small><h2 id="factoryOnboardingTitle">'+esc(t)+'</h2><p>'+esc(sub)+'</p></header>'}
function select(label,field,list,value){return '<label>'+esc(label)+'<select data-onboard-field="'+field+'">'+options(list,value)+'</select></label>'}
function number(label,field,value,placeholder='Not entered'){return '<label>'+esc(label)+'<input type="number" inputmode="decimal" min="0" step="any" data-onboard-field="'+field+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'"></label>'}
function nav(next='Continue'){return '<div class="onboard-actions"><button type="button" data-onboard-action="close">Skip setup</button>'+(step>0?'<button type="button" data-onboard-action="back">Back</button>':'')+'<button type="button" class="btn" data-onboard-action="next">'+esc(next)+'</button></div>'}
function tour(){
 const t=tours[tourIndex];host.innerHTML=title(t[1],t[2])+'<div class="onboard-progress">Workspace '+(tourIndex+1)+' of '+tours.length+'</div><div class="onboard-actions"><button data-onboard-action="tour-close">Finish tour</button>'+(tourIndex>0?'<button data-onboard-action="tour-back">Back</button>':'')+'<button data-onboard-action="tour-visit">Open '+esc(t[1])+'</button>'+(tourIndex<tours.length-1?'<button class="btn" data-onboard-action="tour-next">Next workspace</button>':'')+'</div><p class="small">The tour does not change factory data.</p>';
}
function render(){
 if(tourOnly||step===4){tour();return}
 const progress='<div class="onboard-progress">Step '+(step+1)+' of 4 · Nothing is recorded until review and apply</div>';
 let html='';
 if(step===0){
  html=title('Welcome to NAUVIS','Where are you in your Factorio playthrough?')+progress+
   '<div class="onboard-choice-grid"><button type="button" data-onboard-mode="new" aria-pressed="'+(config.mode==='new')+'"><strong>Brand-new save</strong><span>Start with an empty factory and choose your first planning goal.</span></button><button type="button" data-onboard-mode="existing" aria-pressed="'+(config.mode==='existing')+'"><strong>Existing playthrough</strong><span>Enter actual counts to seed Inventory and help Balance get useful immediately.</span></button></div>'+nav();
 }else if(step===1){
  html=title('Equipment and your next goal','Select equipment assumptions. A planning goal is optional and never records production.')+progress+
   '<div class="onboard-grid">'+select('Main output belt / planning belt','belt',[[900,'Yellow · 15/s'],[1800,'Red · 30/s'],[2700,'Blue · 45/s']],config.belt)+select('Baseline furnace','furnace',[[1,'Stone · 1×'],[2,'Steel / electric · 2×']],config.furnace)+select('Blueprint assembler preference','machine',[[.75,'Assembler 2'],[1.25,'Assembler 3']],config.machine)+select('Next recipe to plan (optional)','goal',[['','Keep current goal'],...recipes()],config.goal)+
   (config.goal?number('Target items / minute','rate',config.rate)+select('Ingredient planning boundary','source',[['bus','Main bus inputs'],['raw','Raw inputs']],config.source):'')+'</div><p class="small">Actual Assembler 1 counts can be recorded below. Designer currently supports Assembler 2 and 3 only. A new goal starts with normal quality and no module/beacon bonuses. Mixed furnace and belt setups can be refined later.</p>'+nav();
 }else if(step===2){
  if(config.mode==='new')html=title('Start with a clean slate','There is no equipment to record yet. You can add machines as you actually build them.')+progress+'<p>Inventory stays empty. Start in Blueprint Designer for a production plan, or use Quick Change as you place your first machines.</p>'+nav('Review setup');
  else html=title('Record existing smelting and oil','Enter only numbers you know. Blank fields remain unrecorded (zero in the current ledger).')+progress+'<h3>Smelting</h3><div class="onboard-grid">'+SMELT.map(([k,l])=>number(l,'smelt:'+k,config.smelt[k])).join('')+'</div><h3>Advanced oil</h3><div class="onboard-grid">'+OIL.map(([k,l])=>number(l,'oil:'+k,config.oil[k])).join('')+'</div><p class="small">Basic oil recipes, mixed furnace profiles, belts and other infrastructure can be refined separately. No output belts are inferred from furnace counts.</p>'+nav('Production lines');
 }else if(step===3){
  const rows=config.mode==='existing'?config.lines:[];
  html=title('Review and initialize','Only the values you enter will be recorded. You can leave any inventory category blank.')+progress+
   (config.mode==='existing'?'<h3>Existing production arrays (optional)</h3><p class="small">One physical line per recipe and destination. Add another row if machines use a different tier or allocation.</p>'+rows.map((r,i)=>'<div class="onboard-line"><div class="onboard-grid">'+select('Recipe','line:'+i+':recipe',recipes(),r.recipe)+number('Built machine count','line:'+i+':count',r.count)+
    (R[r.recipe]?.[3]==='asm'?select('Actual assembler tier','line:'+i+':tier',[[.5,'Assembler 1'],[.75,'Assembler 2'],[1.25,'Assembler 3']],r.tier):'<p class="small">Chemical plant</p>')+select('Destination','line:'+i+':destination',destinations.map(x=>[x,x]),r.destination)+'</div><button data-onboard-remove="'+i+'">Remove line</button></div>').join('')+'<button data-onboard-action="add">+ Add existing production line</button>':'')+
   '<div class="onboard-review"><strong>Setup summary</strong><div>'+esc(config.mode==='new'?'New save':'Existing playthrough')+' · '+esc({900:'Yellow',1800:'Red',2700:'Blue'}[config.belt])+' belts · '+(Number(config.furnace)===1?'Stone':'Steel/electric')+' furnaces</div>'+
   '<div>'+esc(config.goal?R[config.goal]?.[0]+' · '+config.rate+'/min':'Keep current planning goal')+'</div>'+
   '<div>'+rows.length+' production line(s) · '+rows.reduce((n,x)=>n+(Number(x.count)||0),0)+' entered machines</div>'+
   (config.mode==='existing'?'<div>'+SMELT.filter(([k])=>String(config.smelt[k]??'').trim()!=='').map(([k,l])=>esc(l)+': '+esc(config.smelt[k])).concat(OIL.filter(([k])=>String(config.oil[k]??'').trim()!=='').map(([k,l])=>esc(l)+': '+esc(config.oil[k]))).join(' · ')+'</div>':'<div>No actual equipment will be added.</div>')+
   '</div><p class="small">Review before applying. This will seed the empty factory and sync through your normal pairing. It does not create projects, routes, or assumed equipment.</p>'+nav('Apply setup');
 }
 host.innerHTML=html+(notice?'<p class="onboard-error" role="alert">'+esc(notice)+'</p>':'');
}
function readFields(){
 for(const node of host.querySelectorAll('[data-onboard-field]')){
  const [key,i,field]=node.dataset.onboardField.split(':');
  if(key==='line'){if(config.lines[i])config.lines[i][field]=node.value}
  else if(key==='smelt'||key==='oil')config[key][i]=node.value;
  else config[key]=node.value;
 }
}
function apply(){
 const latest=root.NauvisLocal.snapshot();
 if(JSON.stringify(latest)!==JSON.stringify(baseline))throw Error('Factory data changed while setup was open. Close and reopen the wizard; nothing has been overwritten.');
 const next=prepareOnboarding(latest,config,ctx());
 root.NauvisLocal.apply(next);root.NauvisCloud?.changed?.();step=4;tourIndex=0;notice='';render();
}
host.addEventListener('change',e=>{
 if(!e.target.matches('[data-onboard-field]'))return;
 readFields();const field=e.target.dataset.onboardField;
 if(field==='goal'||field.endsWith(':recipe')||field.endsWith(':count'))render();
});
host.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 readFields();notice='';
 try{
  if(b.dataset.onboardMode){config.mode=b.dataset.onboardMode;
   if(config.mode==='new'){config.belt=900;config.furnace=1;config.machine=.75;config.goal='automation-science-pack';config.rate=30;config.source='raw'}
   else {config.belt=baseline.guide.belt||900;config.furnace=baseline.setup.smelt?.furnaceSpeed||2;config.goal='';config.source='bus'}
   render();return;
  }
  if(b.dataset.onboardRemove!==undefined){config.lines.splice(Number(b.dataset.onboardRemove),1);render();return}
  const a=b.dataset.onboardAction;
  if(a==='close'||a==='tour-close'){close();return}
  if(a==='tour-visit'){root.activateWorkspace(tours[tourIndex][0],true);close();return}
  if(a==='tour-next'||a==='tour-back'){tourIndex+=a==='tour-next'?1:-1;render();return}
  if(a==='back'){step=Math.max(0,step-1);render();return}
  if(a==='add'){if(config.lines.length>=100)throw Error('Maximum 100 lines.');config.lines.push({recipe:'electronic-circuit',count:'',tier:config.machine,destination:'Other'});render();return}
  if(a==='next'){
   if(step===0&&!config.mode)throw Error('Choose a new save or an existing playthrough.');
   if(step===3){apply();return}
   step++;render();
  }
 }catch(err){notice=err.message;render()}
});
dialog.addEventListener('cancel',remember);
$('factoryOnboardingLaunch')?.addEventListener('click',()=>open());
root.NauvisOnboarding={open};
try{
 if(!localStorage.getItem(seenKey)&&!localStorage.getItem('nauvis-cloud-factory-v1')&&emptyFactory(root.NauvisLocal.snapshot()))setTimeout(()=>{if(!localStorage.getItem(seenKey)&&emptyFactory(root.NauvisLocal.snapshot()))open('first')},0);
}catch{}
})(typeof window==='undefined'?globalThis:window);
