// NAUVIS v0.27: infrastructure register, one-step deployments, backup-first factory reset.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
const html=read('index.html'),projects=read('projects.js'),journal=read('journal.js'),
 assetsUI=read('inventory-assets.js'),resetUI=read('factory-reset.js'),
 workspaces=read('workspace-ui.js'),sw=read('service-worker.js');
const {categoryFor,validateAsset,normalizeAssets,deploymentProject,applyAssetBuildDelta,cleanFactorySetup}=require('../inventory-assets.js');
const {resetSnapshotData,RESET_PHRASE}=require('../factory-reset.js');
const {summarizeSetupDelta}=require('../journal.js');
const stub={smelt:{ironFurnaces:48,copperFurnaces:24,steelFurnaces:28,furnaceSpeed:2,beltTier:1800,ironBelts:2},
 oil:{refineries:12,heavyCrackers:3,lightCrackers:11},machines:[{recipe:'advanced-circuit',count:19,tier:.75,destination:'Main bus'}],
 feeds:[{recipe:'plastic-bar',count:1,tier:'red',destination:'Main bus'}],assets:[]};

test('mining, power, defense, logistics and modules have separate infrastructure categories',()=>{
 for(const [id,category] of [['electric-mining-drill','Mining'],['pumpjack','Mining'],['accumulator','Power'],
 ['solar-panel','Power'],['laser-turret','Defense'],['gun-turret','Defense'],['roboport','Logistics'],
 ['construction-robot','Logistics'],['speed-module','Installed modules']]){
  assert.equal(categoryFor(id),category);
 }
});
test('strict validation prevents bogus counts and keeps user notes/areas constrained',()=>{
 const a=validateAsset({id:'a1',recipe:'solar-panel',count:25,area:'West field',verified:true});
 assert.equal(a.count,25);assert.equal(a.category,'Power');assert.equal(a.verified,true);
 for(const bad of [-1,1.5,Infinity,'garbage',1e9])assert.throws(()=>validateAsset({recipe:'solar-panel',count:bad}),/Counts/);
 assert.throws(()=>validateAsset({recipe:'<script>',count:1}),/item ID/);
});
test('old snapshots without infrastructure remain valid and duplicates are ignored',()=>{
 assert.deepEqual(normalizeAssets(undefined),[]);
 const one={id:'A',recipe:'solar-panel',count:25,category:'Power',area:'Nauvis'};
 assert.equal(normalizeAssets([one,one,null,{}]).length,1);
});
test('a new placement project tracks installed items, not production machines',()=>{
 const p=deploymentProject('North perimeter lasers','laser-turret',20,'p-one','North wall');
 assert.equal(p.type,'deployment');assert.equal(p.goal.area,'North wall');
 assert.equal(p.goal.rate,0);assert.equal(p.tasks[0].kind,'asset');
 const first=applyAssetBuildDelta(p,'laser-turret',1,[]);
 assert.equal(first.project.tasks[0].built,1);
 assert.equal(first.rows.length,1);
 assert.equal(first.rows[0].count,1);
 assert.equal(first.rows[0].projectId,'p-one');
 assert.equal(first.rows[0].area,'North wall');
 assert.equal(first.rows[0].category,'Defense');
 assert.equal(first.rows[0].verified,false);
});
test('repeated placement actions modify one linked record, and minus removes it at zero',()=>{
 let state={project:deploymentProject('Solar expansion','solar-panel',4,'p-solar'),rows:[]};
 for(let i=0;i<4;i++)state=applyAssetBuildDelta(state.project,'solar-panel',1,state.rows);
 assert.equal(state.rows.length,1);assert.equal(state.rows[0].count,4);
 assert.throws(()=>applyAssetBuildDelta(state.project,'solar-panel',1,state.rows),/outside planned/);
 for(let i=0;i<4;i++)state=applyAssetBuildDelta(state.project,'solar-panel',-1,state.rows);
 assert.equal(state.rows.length,0);
 assert.equal(state.project.tasks[0].built,0);
 assert.throws(()=>applyAssetBuildDelta(state.project,'solar-panel',-1,state.rows),/outside planned/);
});
test('existing manually placed infrastructure is not implicitly claimed or recounted',()=>{
 const old={id:'manual',recipe:'laser-turret',count:12,area:'Nauvis',category:'Defense'};
 const p=deploymentProject('Laser expansion','laser-turret',3,'p2');
 const next=applyAssetBuildDelta(p,'laser-turret',1,[old]);
 assert.equal(next.rows.length,2);
 assert.equal(next.rows.find(x=>x.id==='manual').count,12);
 assert.equal(next.rows.find(x=>x.projectId==='p2').count,1);
 assert.match(projects,/matchingUnlinkedAssets/);
 assert.match(projects,/if\(!root\.confirm\(msg\)\)return/);
});
test('a previously modified or duplicated linked asset blocks project updates',()=>{
 const p=deploymentProject('Battery bank','accumulator',3,'p3');
 const first=applyAssetBuildDelta(p,'accumulator',1,[]);
 assert.throws(()=>applyAssetBuildDelta(first.project,'accumulator',1,first.rows.map(x=>({...x,count:2}))),/differs/);
 assert.throws(()=>applyAssetBuildDelta(first.project,'accumulator',1,[...first.rows,...first.rows.map(x=>({...x,id:'duplicate'}))]),/Multiple records/);
});
test('journal records installed items, notes, and verification without inventing production capacity',()=>{
 const after={...stub,assets:[{id:'a',recipe:'electric-mining-drill',count:6,category:'Mining',area:'Iron field'}]};
 const entries=summarizeSetupDelta(stub,after);
 assert.equal(entries.length,1);
 assert.equal(entries[0].type,'asset');assert.equal(entries[0].delta,6);
 assert.equal(entries[0].after,6);
 const verified={...after,assets:[{...after.assets[0],verified:true}]};
 const verifyEvents=summarizeSetupDelta(after,verified);
 assert.equal(verifyEvents.length,1);assert.equal(verifyEvents[0].delta,undefined);
});
test('clean factory setup zeros counts while preserving machine/furnace configuration selectors',()=>{
 const clean=cleanFactorySetup({...stub,assets:[{id:'x',recipe:'solar-panel',count:40}]});
 assert.equal(clean.smelt.ironFurnaces,0);
 assert.equal(clean.smelt.copperFurnaces,0);
 assert.equal(clean.smelt.steelFurnaces,0);
 assert.equal(clean.smelt.furnaceSpeed,2);
 assert.equal(clean.smelt.beltTier,1800);
 assert.equal(clean.oil.refineries,0);
 assert.deepEqual(clean.machines,[]);assert.deepEqual(clean.feeds,[]);assert.deepEqual(clean.assets,[]);
});
test('Fresh Start clears all factory-specific records without changing original snapshot',()=>{
 const plan={projects:[deploymentProject('Solar bank','solar-panel',40,'p4'),{id:'red',name:'Circuits',status:'archived',tasks:[{recipe:'advanced-circuit',kind:'asm',planned:19,built:13}]}],
   journal:[{id:'event',title:'Older note'}],redBlocks:4,blueMachines:8,checked:{red1:true},customTarget:123};
 plan.projects[0].tasks[0].built=20;
 const before={version:7,plan,guide:{goal:'accumulator',rate:10},setup:{...stub,assets:[{id:'legacy',count:15}]},balancePrefs:{includeGoal:true}};
 const original=JSON.stringify(before),result=resetSnapshotData(before);
 assert.deepEqual(result.plan.projects,[]);assert.deepEqual(result.plan.journal,[]);
 assert.deepEqual(result.plan.checked,{});assert.equal(result.plan.redBlocks,0);assert.equal(result.plan.blueMachines,0);
 assert.equal(result.plan.customTarget,undefined);
 assert.deepEqual(result.guide,before.guide);assert.equal(result.balancePrefs.includeGoal,false);
 for(const k of ['machines','feeds','assets'])assert.deepEqual(result.setup[k],[]);
 assert.equal(result.setup.smelt.ironFurnaces,0);assert.equal(result.setup.oil.refineries,0);
 assert.equal(result.setup.smelt.furnaceSpeed,2);assert.equal(result.setup.smelt.beltTier,1800);
 assert.equal(JSON.stringify(before),original);assert.deepEqual(resetSnapshotData(result),result);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});
test('reset requires current backup, saved-file acknowledgment, and exact typed phrase',()=>{
 assert.equal(RESET_PHRASE,'RESET FACTORY');
 for(const id of ['factoryBackupBtn','factoryBackupConfirmed','factoryResetLaunch','factoryResetPhrase'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(resetUI,/backedUp&&agree\.checked/);assert.match(resetUI,/phrase\.value\.trim\(\)!==RESET_PHRASE/);
 assert.match(resetUI,/JSON\.stringify\(before\)!==backupJSON/);
 assert.match(resetUI,/root\.NauvisLocal\.apply\(next\)/);
 assert.match(resetUI,/NauvisCloud\?\.changed\?\.\(\)/);
 assert.doesNotMatch(resetUI,/NauvisJournal\?\.record|localStorage\.clear/);
});
test('no live infrastructure ledger or deployment entry controls; legacy records retained for backup',()=>{
 assert.equal((html.match(/<button data-view=/g)||[]).length,3);
 for(const id of ['setupAssetsPanel','setupAssetRows','setupAssetStats','assetAdd','deploymentDialog','deploymentForm','projectsNewDeployment'])
  assert.ok(!html.includes('id="'+id+'"'),id);
 assert.doesNotMatch(workspaces,/setupAssetsPanel|Placed infrastructure/);
 assert.match(projects,/function visibleProjects\(\)/);
 assert.match(projects,/function selectedProject\(id\)\{return visibleProjects\(\)/);
 assert.match(html,/setup\.assets=Array\.isArray\(data\.setup\.assets\)\?data\.setup\.assets:\[\]/);
 assert.doesNotMatch(html,/src="\.\/inventory-assets\.js"/);
});
test('empty defaults do not repopulate historical counts after reload or sync',()=>{
 assert.match(html,/const factory=\{\.\.\.blankDistrict/);
 assert.match(html,/smelt:\{\.\.\.blankSmelt/);assert.match(html,/oil:\{\.\.\.blankOil/);
 assert.match(html,/Object\.assign\(factory,blankDistrict,data\.plan/);
 assert.match(html,/Object\.assign\(setup\.smelt,blankSmelt,data\.setup\.smelt/);
 assert.match(html,/tasks\.length\?complete\/tasks\.length\*100:0/);
 assert.match(html,/window\.NauvisCloudApplying=true/);
 assert.match(sw,/nauvis-shell-v030/);assert.match(html,/Nauvis Command Center v0\.30/);
});
