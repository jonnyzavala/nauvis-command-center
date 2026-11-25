'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../production-effects.js'),{buildProject,applyBuildDelta,recordedForTask,reconcileTaskProfile,constructionMaterials}=require('../projects.js'),{analyzeRecipeRatios}=require('../recipe-ratios.js');
const R={'advanced-circuit':['Red',6,1,'asm',{'electronic-circuit':2}],'electronic-circuit':['Green',.5,1,'asm',{'iron-plate':1}],'assembling-machine-1':['Assembler 1',.5,1,'asm',{'iron-plate':9}],'assembling-machine-2':['Assembler 2',.5,1,'asm',{'assembling-machine-1':1}],'assembling-machine-3':['Assembler 3',.5,1,'asm',{'assembling-machine-2':2}],'laser-turret':['Laser turret',1,1,'asm',{'iron-plate':1}],'battery':['Battery',4,1,'chem',{'iron-plate':1}]};
const plan=(recipe='advanced-circuit')=>buildProject('Test',analyzeRecipeRatios(R,{id:recipe,rate:90,machine:.75,belt:900,source:'bus'},{stopBus:['iron-plate'],stopRaw:[],fluids:[],names:{}}),'p','2026-11-24');
const build=(recipe='advanced-circuit')=>applyBuildDelta(plan(recipe),recipe,1,[]);
const patch={machine:1.25,moduleType:'speed3',moduleCount:2,machineQuality:'uncommon',beaconSpeed:25};
test('installed upgrades preserve historical design, machine count, stable identity and goal',()=>{
 const initial=build(),old=JSON.stringify(initial),changed=reconcileTaskProfile(initial.project,'advanced-circuit',patch,initial.rows,R);
 assert.equal(JSON.stringify(initial),old);
 assert.deepEqual(changed.project.goal,initial.project.goal);
 assert.deepEqual(changed.project.design,initial.project.design);
 assert.equal(changed.rows[0].count,1);assert.equal(changed.rows[0].entityKey,initial.rows[0].entityKey);
 assert.equal(changed.rows[0].tier,1.25);assert.equal(changed.rows[0].moduleType,'speed3');
 assert.ok(E.recordedRates('advanced-circuit',R['advanced-circuit'],changed.rows[0]).output>E.recordedRates('advanced-circuit',R['advanced-circuit'],initial.rows[0]).output);
 const task=changed.project.tasks.find(t=>t.recipe==='advanced-circuit');assert.equal(task.planned,initial.project.tasks.find(t=>t.recipe==='advanced-circuit').planned);assert.equal(task.built,1);
 assert.deepEqual(recordedForTask(changed.project,task,changed.rows),{count:1,mismatch:false});
});
test('subsequent build and reversal to zero preserve installed configuration',()=>{
 const initial=build(),changed=reconcileTaskProfile(initial.project,'advanced-circuit',patch,initial.rows,R);
 const next=applyBuildDelta(changed.project,'advanced-circuit',1,changed.rows);assert.equal(next.rows[0].count,2);assert.equal(next.rows[0].tier,1.25);
 const zero=applyBuildDelta(changed.project,'advanced-circuit',-1,changed.rows),again=applyBuildDelta(zero.project,'advanced-circuit',1,zero.rows);
 assert.equal(again.rows[0].entityKey,changed.rows[0].entityKey);assert.equal(again.rows[0].tier,1.25);assert.equal(again.rows[0].moduleCount,2);
});
test('invalid module slots, productivity eligibility, and mismatched counts are rejected',()=>{
 const a=build();
 assert.throws(()=>reconcileTaskProfile(a.project,'advanced-circuit',{...patch,machine:.75,moduleCount:3},a.rows,R),/not supported/);
 assert.throws(()=>reconcileTaskProfile(a.project,'advanced-circuit',{...patch,machine:2},a.rows,R),/tier/);
 assert.throws(()=>reconcileTaskProfile(a.project,'advanced-circuit',patch,[{...a.rows[0],count:2}],R),/differ/);
 assert.throws(()=>reconcileTaskProfile(a.project,'advanced-circuit',patch,[a.rows[0],a.rows[0]],R),/differ/);
 assert.throws(()=>reconcileTaskProfile(plan(),'advanced-circuit',patch,[],R),/Record built/);
 const l=build('laser-turret');assert.throws(()=>reconcileTaskProfile(l.project,'laser-turret',{machine:.75,moduleType:'productivity1',moduleCount:1},l.rows,R),/not supported/);
});
test('remaining crafting bill uses each task installed assembler tier',()=>{
 const a=build(),changed=reconcileTaskProfile(a.project,'advanced-circuit',patch,a.rows,R),bill=constructionMaterials(changed.project,R);
 assert.equal(bill.machines.find(x=>x.key==='assembling-machine-3').remaining,changed.project.tasks.find(x=>x.recipe==='advanced-circuit').planned-1);
 assert.ok(bill.machines.some(x=>x.key==='assembling-machine-2'));
});
test('chemical plant overrides use its own slots and speed',()=>{
 const a=build('battery'),changed=reconcileTaskProfile(a.project,'battery',{moduleType:'speed2',moduleCount:3},a.rows,R);
 assert.equal(changed.rows[0].tier,1);assert.equal(changed.rows[0].moduleCount,3);
 assert.equal(recordedForTask(changed.project,changed.project.tasks.find(t=>t.recipe==='battery'),changed.rows).mismatch,false);
});
test('snapshot serialization retains actual override independently of original plan',()=>{
 const a=build(),changed=reconcileTaskProfile(a.project,'advanced-circuit',patch,a.rows,R),restored=JSON.parse(JSON.stringify(changed));
 assert.equal(recordedForTask(restored.project,restored.project.tasks.find(t=>t.recipe==='advanced-circuit'),restored.rows).mismatch,false);
 assert.equal(restored.project.goal.machine,.75);
});
