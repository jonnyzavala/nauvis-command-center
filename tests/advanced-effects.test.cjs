// NAUVIS v0.28 · tier-1 module, machine quality, effective beacon and Factory parity.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const html=read('index.html'),ratioJs=read('recipe-ratios.js'),projectsJs=read('projects.js');
const effects=require('../production-effects.js');
const {analyzeRecipeRatios}=require('../recipe-ratios.js');
const {buildProject,applyBuildDelta,recordedForTask}=require('../projects.js');
const vm=require('node:vm');
const R=vm.runInNewContext('('+html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1]+')');
const s=n=>new Set(vm.runInNewContext(html.match(new RegExp('const '+n+'=new Set\\((\\[[^\\]]*\\])\\)'))?.[1]||'[]'));
const ctx={stopBus:s('STOP_BUS'),stopRaw:s('STOP_RAW'),fluids:s('FLUID'),names:{}};
const calc=(id='advanced-circuit',mods={},rate=90)=>analyzeRecipeRatios(R,{
 id,rate,machine:.75,source:'bus',belt:900,...mods},ctx);
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8,String(a)+' != '+String(b));

test('legacy production counts remain exactly correct with upgrades off',()=>{
 const result=calc();
 assert.deepEqual(result.entries.map(x=>[x.key,x.count]),[
  ['copper-cable',5],['electronic-circuit',2],['advanced-circuit',12]]);
 assert.equal(result.roundedTotal,19);
 assert.equal(result.external.find(x=>x.key==='plastic-bar').needed,180);
 assert.equal(result.entries.at(-1).moduleApplied,0);
});
test('speed-1 modules add 20% speed per slot with assembler 2 capped at 2 slots',()=>{
 const r=calc('advanced-circuit',{moduleType:'speed1',moduleCount:4});
 const row=r.entries.find(x=>x.key==='advanced-circuit');
 assert.equal(row.moduleSlots,2);assert.equal(row.moduleApplied,2);
 close(row.machineSpeed,.75*1.4);
 close(row.perMachine,10.5);
 assert.equal(row.count,9);
 assert.ok(r.roundedTotal<19);
 assert.equal(row.energyFactor,2);
});
test('efficiency 1 changes energy demand, but does not fake extra throughput',()=>{
 const base=calc(),efficient=calc('advanced-circuit',{moduleType:'efficiency1',moduleCount:2});
 assert.equal(efficient.roundedTotal,base.roundedTotal);
 assert.equal(efficient.entries.at(-1).energyFactor,.4);
 close(effects.forRecipe('battery','chem',{machine:.75,moduleType:'efficiency1',moduleCount:3}).energyFactor,.2);
});
test('productivity 1 gives +4% yield each, −5% speed, and reduces ingredients per output',()=>{
 const p=calc('advanced-circuit',{moduleType:'productivity1',moduleCount:2});
 const red=p.entries.find(x=>x.key==='advanced-circuit');
 close(red.productivityBonus,.08);
 close(red.machineSpeed,.75*.9);
 close(red.effectiveOutputPerCraft,1.08);
 close(red.ingredients.find(x=>x.id==='electronic-circuit').needed,90*2/1.08);
 assert.ok(p.external.find(x=>x.key==='copper-plate').needed<450);
 assert.equal(red.moduleApplied,2);
});
test('productivity is prohibited where game recipe metadata says not allowed',()=>{
 const p=effects.forRecipe('laser-turret','asm',{machine:.75,moduleType:'productivity1',moduleCount:2});
 assert.equal(p.moduleEligible,false);assert.equal(p.moduleApplied,0);assert.equal(p.productivityBonus,0);
 const battery=effects.forRecipe('battery','chem',{moduleType:'productivity1',moduleCount:4});
 assert.equal(battery.moduleSlots,3);assert.equal(battery.moduleApplied,3);
 close(battery.productivityBonus,.12);
 assert.ok(effects.PROD_ALLOWED.has('advanced-circuit'));
 assert.ok(!effects.PROD_ALLOWED.has('laser-turret'));
});
test('quality boosts crafting machine speed, without modeling higher product quality',()=>{
 const q=effects.forRecipe('advanced-circuit','asm',{machine:.75,machineQuality:'legendary'});
 close(q.machineSpeed,1.875);close(q.qualityFactor,2.5);
 const asm1=effects.forRecipe('iron-gear-wheel','asm',{machine:.5,machineQuality:'rare'});
 close(asm1.machineSpeed,.8);assert.equal(asm1.moduleSlots,0);
 assert.ok(calc('advanced-circuit',{machineQuality:'legendary'}).roundedTotal<19);
});
test('beacon bonus is an explicit effective additive speed modifier and never an inferred beacon count',()=>{
 const a=effects.forRecipe('battery','chem',{machine:.75,beaconSpeed:80});
 close(a.machineSpeed,1.8);
 assert.equal(a.beaconSpeed,80);
 const b=effects.forRecipe('iron-plate','furnace',{machine:.75,beaconSpeed:80});
 assert.equal(b.beaconSpeed,0);assert.equal(b.machineSpeed,2);
 for(const invalid of [-5,301,Infinity,'unavailable'])
  assert.throws(()=>effects.settings({beaconSpeed:invalid}),/beacon/);
 assert.match(read('production-effects.js'),/NOT calculated from beacon count/);
});
test('bad module configuration fails fast instead of silently manufacturing numbers',()=>{
 for(const input of [
  {moduleType:'speed4'},{moduleCount:-1},{moduleCount:2.5},{moduleCount:5},
  {machineQuality:'mythic'}
 ])assert.throws(()=>effects.settings(input));
});
test('all 182 recipes still calculate finite graph counts under advanced profile',()=>{
 for(const id of Object.keys(R)){
  for(const source of ['bus','raw']){
   const result=analyzeRecipeRatios(R,{id,rate:12,machine:.75,source,belt:900,
    moduleType:'productivity1',moduleCount:2,machineQuality:'uncommon',beaconSpeed:20},ctx);
   assert.ok(Number.isFinite(result.roundedTotal)&&result.roundedTotal>0,id);
   assert.ok(result.entries.every(x=>x.perMachine>0&&Number.isFinite(x.perMachine)),id);
  }
 }
});
test('saved blueprint and linked Factory line preserve module and quality settings',()=>{
 const analysis=calc('advanced-circuit',{moduleType:'speed1',moduleCount:2,
  machineQuality:'uncommon',beaconSpeed:50});
 const project=buildProject('Upgraded circuits',analysis,'plan-adv','2026-11-23');
 assert.equal(project.goal.moduleType,'speed1');
 assert.equal(project.goal.moduleCount,2);
 assert.equal(project.goal.machineQuality,'uncommon');
 assert.equal(project.goal.beaconSpeed,50);
 const built=applyBuildDelta(project,'advanced-circuit',1,[]);
 assert.equal(built.rows.length,1);
 assert.equal(built.rows[0].moduleType,'speed1');
 assert.equal(built.rows[0].moduleCount,2);
 assert.equal(built.rows[0].machineQuality,'uncommon');
 assert.equal(built.rows[0].beaconSpeed,50);
 assert.equal(recordedForTask(built.project,built.project.tasks.find(x=>x.recipe==='advanced-circuit'),built.rows).mismatch,false);
 const changed=built.rows.map(x=>({...x,beaconSpeed:10}));
 assert.throws(()=>applyBuildDelta(built.project,'advanced-circuit',1,changed),/differ/);
});
test('Factory Balance uses effective speed and productive yield for recorded lines',()=>{
 const a=html.indexOf('function resourceAuditEngine('),b=html.indexOf('function renderBalance()',a);
 const fn=Function('window',html.slice(a,b)+';return resourceAuditEngine;')({NauvisEffects:effects});
 const base={base:{busIron:0,copper:0,steel:0,bricks:0},oil:{refineries:0,heavyCrackers:0,lightCrackers:0},
  recipes:R,machines:[{recipe:'advanced-circuit',count:1,tier:.75,destination:'Main bus'}],includeGoal:false};
 const one=fn(base),speed=fn({...base,machines:[{...base.machines[0],moduleType:'speed1',moduleCount:2}]});
 const prod=fn({...base,machines:[{...base.machines[0],moduleType:'productivity1',moduleCount:2}]});
 const rate=res=>res.rows.find(x=>x.id==='advanced-circuit').produced;
 close(rate(one),7.5);close(rate(speed),10.5);close(rate(prod),7.29);
 const input=res=>res.rows.find(x=>x.id==='electronic-circuit').needed;
 close(input(prod),13.5);close(input(one),15);
});
test('the visual UI and recorded Factory profile editor provide the advanced controls',()=>{
 assert.match(ratioJs,/data-ratio-field="moduleCount"/);
 assert.match(ratioJs,/data-ratio-field="beaconSpeed"/);
 assert.match(ratioJs,/machineQuality/);
 assert.match(ratioJs,/ratio-advanced/);
 assert.match(ratioJs,/effectiveOutputPerCraft/);
 assert.match(ratioJs,/root\.NauvisRecipeMath=analyzeRecipeRatios/);
 assert.match(read('machine-upgrades.js'),/setup-machine-upgrades/);
 assert.match(read('machine-upgrades.js'),/NauvisJournal\?\.record/);
 assert.match(projectsJs,/moduleType:analysis\.moduleType/);
 assert.match(html,/window\.NauvisMachineUpgrades\?\.attach\?\.\(\)/);
});
test('advanced assets load offline and preserved cloud snapshot shape is unchanged',()=>{
 const sw=read('service-worker.js');
 for(const file of ['production-effects.js','machine-upgrades.js','advanced-v028.css'])
  assert.ok(sw.includes("'./"+file+"'"),file);
 assert.match(sw,/nauvis-shell-v1012/);
 assert.match(html,/Nauvis Command Center v1\.1\.2/);
 assert.match(html,/src="\.\/production-effects\.js"/);
 assert.match(html,/src="\.\/machine-upgrades\.js"/);
 assert.match(html,/href="\.\/advanced-v028\.css"/);
 assert.match(html,/snapshot\(\)\{return JSON\.parse\(JSON\.stringify\(\{version:7,plan:factory,guide,setup,balancePrefs\}\)\)\}/);
});

test('tier 2 and 3 modules use the verified additive effects',()=>{
 const a=effects.forRecipe('advanced-circuit','asm',{machine:1.25,moduleType:'speed2',moduleCount:4});
 close(a.machineSpeed,2.75);close(a.energyFactor,3.4);
 const b=effects.forRecipe('advanced-circuit','asm',{machine:1.25,moduleType:'productivity3',moduleCount:4});
 close(b.machineSpeed,.5);close(b.productivityBonus,.4);close(b.energyFactor,4.2);
 const c=effects.forRecipe('battery','chem',{moduleType:'efficiency3',moduleCount:2});
 close(c.energyFactor,.2);close(c.machineSpeed,1);
});
test('mixed modules share physical slots and skip ineligible productivity',()=>{
 const config={moduleType:'productivity3',moduleCount:2,moduleType2:'speed3',moduleCount2:2};
 const a=effects.forRecipe('advanced-circuit','asm',{machine:1.25,...config});
 close(a.machineSpeed,2.125);close(a.productivityBonus,.2);assert.equal(a.moduleApplied,4);
 const b=effects.forRecipe('advanced-circuit','asm',{machine:.75,...config});
 close(b.machineSpeed,.525);assert.equal(b.moduleApplied,2);
 const c=effects.forRecipe('laser-turret','asm',{machine:.75,...config});
 assert.equal(c.moduleEligible,false);close(c.machineSpeed,1.5);close(c.productivityBonus,0);
 assert.throws(()=>effects.settings({...config,moduleCount2:3}),/four modules/);
});
test('second module profile survives planner, project, linked factory rows and resource ledger',()=>{
 const config={moduleType:'productivity2',moduleCount:1,moduleType2:'speed2',moduleCount2:1};
 const result=calc('advanced-circuit',config);
 const row=result.entries.find(x=>x.key==='advanced-circuit');
 close(row.machineSpeed,.9);close(row.productivityBonus,.06);
 const project=buildProject('Mixed circuit line',result,'mixed','2026-11-24');
 const built=applyBuildDelta(project,'advanced-circuit',1,[]);
 assert.equal(project.goal.moduleType2,'speed2');assert.equal(built.rows[0].moduleCount2,1);
 assert.equal(recordedForTask(built.project,built.project.tasks.find(t=>t.recipe==='advanced-circuit'),built.rows).mismatch,false);
 const a=html.indexOf('function resourceAuditEngine('),b=html.indexOf('function renderBalance()',a);
 const fn=Function('window',html.slice(a,b)+';return resourceAuditEngine;')({NauvisEffects:effects});
 const ledger=fn({base:{busIron:0,copper:0,steel:0,bricks:0},oil:{refineries:0,heavyCrackers:0,lightCrackers:0},recipes:R,machines:built.rows,includeGoal:false});
 close(ledger.rows.find(x=>x.id==='advanced-circuit').produced,row.perMachine);
 assert.match(ratioJs,/data-ratio-field="moduleCount2"/);
 assert.match(read('machine-upgrades.js'),/data-upgrade-field="moduleType2"/);
});

test('shared recipe rate model accounts for productivity in output but not ingredients per craft',()=>{
 const r=R['advanced-circuit'],row={recipe:'advanced-circuit',count:24,tier:.75,moduleType:'productivity1',moduleCount:2};
 const rates=effects.recordedRates(row.recipe,r,row);close(rates.output,174.96);close(rates.inputs['electronic-circuit'],324);close(rates.inputs['copper-cable'],648);
 const a=html.indexOf('function resourceAuditEngine('),b=html.indexOf('function renderBalance()',a);
 const fn=Function('window',html.slice(a,b)+';return resourceAuditEngine;')({NauvisEffects:effects});
 const ledger=fn({base:{busIron:0,copper:0,steel:0,bricks:0},oil:{},recipes:R,machines:[row],includeGoal:false,network:{factors:new Map([['machine:advanced-circuit|Unspecified',.5]])}});
 const out=ledger.rows.find(x=>x.id==='advanced-circuit');close(out.produced,174.96);close(out.modeledOutput,87.48);assert.equal(out.routeLimited,true);close(ledger.rows.find(x=>x.id==='electronic-circuit').needed,324);
});
test('already transport-limited smelting capacity is capped, not multiplied twice',()=>{
 close(effects.supportedRate({rate:180,inputRated:360},.5),180);
 close(effects.supportedRate({rate:180,inputRated:360},.25),90);
 close(effects.supportedRate({rate:900,inputRated:1800,reserved:900},.75),450);
});
