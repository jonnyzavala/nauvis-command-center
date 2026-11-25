'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../production-effects.js'),{resetSnapshotData}=require('../factory-reset.js'),{analyzeRecipeRatios,incrementalPlan}=require('../recipe-ratios.js');
const row={id:'draft-a',name:'Circuits',goal:{id:'advanced-circuit',rate:90,machine:.75,belt:1800,source:'bus',moduleType:'speed1',moduleCount:2},reuseKeys:['machine:electronic-circuit|Available for new build'],focus:'copper-cable',updatedAt:'2026-11-24T00:00:00Z'};
test('legacy missing drafts normalize to empty; new draft is compact and isolated',()=>{
 const before=JSON.stringify(row),stored=E.saveLogisticsDraft(undefined,{...row,goal:{...row.goal,entries:[{count:1000}],roundedTotal:1000},actualMachines:[{}]});
 assert.equal(stored.length,1);assert.equal(stored[0].goal.moduleType,'speed1');assert.equal(stored[0].goal.moduleCount,2);
 assert.equal(stored[0].goal.entries,undefined);assert.equal(stored[0].actualMachines,undefined);
 assert.equal(JSON.stringify(row),before);assert.deepEqual(E.normalizeLogisticsDrafts(undefined),[]);
});
test('update same draft, duplicate selection deduplication and save as new',()=>{
 const one=E.saveLogisticsDraft([],row),two=E.saveLogisticsDraft(one,{...row,name:'Updated',reuseKeys:[...row.reuseKeys,...row.reuseKeys]});
 assert.equal(one[0].name,'Circuits');assert.equal(two.length,1);assert.equal(two[0].name,'Updated');assert.equal(two[0].reuseKeys.length,1);
 assert.equal(E.saveLogisticsDraft(two,{...row,id:'draft-b'}).length,2);
});
test('draft validation rejects duplicates, invalid goal, unsupported selectors and oversized collection',()=>{
 for(const value of [null,{},[row,row],[{...row,goal:{...row.goal,rate:0}}],[{...row,goal:{...row.goal,machine:100}}],[{...row,goal:{...row.goal,moduleCount:5}}],[{...row,reuseKeys:['project:fake']}],Array.from({length:31},(_,i)=>({...row,id:'d'+i}))])assert.throws(()=>E.normalizeLogisticsDrafts(value));
});
test('snapshot round trip and Fresh Start preserve actual boundary',()=>{
 const base={version:7,plan:{redBlocks:0,projects:[]},guide:{},setup:{smelt:{furnaceSpeed:2},machines:[{recipe:'advanced-circuit',count:12}],feeds:[],assets:[],logistics:{nodes:[],edges:[]}}};
 const saved={...base,setup:{...base.setup,logisticsDrafts:E.saveLogisticsDraft([],row)}};
 assert.equal(E.validateOwnershipSnapshot(saved),true);
 const restored=E.prepareBackupImport(JSON.parse(JSON.stringify(saved)),base,{redBlocks:0});
 assert.deepEqual(restored.setup.machines,base.setup.machines);assert.deepEqual(restored.setup.logistics,base.setup.logistics);assert.deepEqual(restored.plan.projects,[]);
 assert.deepEqual(restored.setup.logisticsDrafts,saved.setup.logisticsDrafts);
 assert.equal(resetSnapshotData(saved).setup.logisticsDrafts,undefined);
 assert.deepEqual(E.prepareBackupImport({redBlocks:1},saved,{redBlocks:0}).setup.logisticsDrafts,saved.setup.logisticsDrafts);
 assert.throws(()=>E.validateOwnershipSnapshot({...saved,setup:{...saved.setup,logisticsDrafts:[row,row]}}));
});
test('reopening goal and recomputing uses current available production rather than cached counts',()=>{
 const R={'advanced-circuit':['Red',6,1,'asm',{'electronic-circuit':2}],'electronic-circuit':['Green',.5,1,'asm',{'iron-plate':1}]};
 const goal=E.saveLogisticsDraft([],row)[0].goal,full=analyzeRecipeRatios(R,goal,{stopBus:['iron-plate'],stopRaw:[],fluids:[],names:{}});
 const reused=incrementalPlan(full,{'electronic-circuit':180}),unavailable=incrementalPlan(full,{});
 assert.ok(reused.roundedTotal<unavailable.roundedTotal);assert.equal(unavailable.roundedTotal,full.roundedTotal);
 assert.equal(reused.entries.find(e=>e.key===goal.id).needed,goal.rate);
});
test('draft UI and snapshot restoration explicitly separate the actual network',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8'),js=read('logistics.js'),html=read('index.html');
 assert.match(js,/data-log-mode="drafts"/);assert.match(js,/setup\.logisticsDrafts=root\.NauvisEffects\.saveLogisticsDraft/);
 assert.match(js,/root\.NauvisRecipeMath\(R,record\.goal/);
 assert.match(js,/saved reuse selection\(s\) are no longer eligible/);
 assert.match(js,/function actualNetwork\(\)\{return networkResults\(scenarioGraph\(data\(\),false\),lookup\)\}/);
 assert.match(html,/if\(data\.setup\.logisticsDrafts!==undefined\)/);
});
