// NAUVIS v0.23 Projects. Run: node --test tests/*.test.cjs
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const html=read('index.html'),worker=read('service-worker.js'),
 projectJs=read('projects.js'),css=read('projects.css'),recipeJs=read('recipe-ratios.js');
const {buildProject,projectProgress,recordedForTask,applyBuildDelta,validateProjectName,normalizeProjects}=require('../projects.js');
const {analyzeRecipeRatios}=require('../recipe-ratios.js');
const model=html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1];
assert.ok(model,'Live recipe model not found');
const R=vm.runInNewContext('('+model+')');
const getSet=name=>{
 const match=html.match(new RegExp('const '+name+'=new Set\\((\\[[^\\]]*\\])\\)'));
 assert.ok(match,'Expected '+name);
 return new Set(vm.runInNewContext(match[1]));
};
const context={stopBus:getSet('STOP_BUS'),stopRaw:getSet('STOP_RAW'),fluids:getSet('FLUID'),names:{}};
const analyze=(rate=90,source='bus',id='advanced-circuit')=>
 analyzeRecipeRatios(R,{id,rate,machine:.75,source,belt:900},context);
const make=(id='project_1')=>buildProject('Red circuit expansion',analyze(),id,'2026-11-22T18:00:00Z');
test('three tabs hold both Factory/Balance and Plan/Construction modes',()=>{
 const nav=html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0]||'';
 const names=[...nav.matchAll(/<button data-view="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)].map(m=>m[1]);
 assert.deepEqual(names,['learn','setup','build']);
 for(const label of ['Quick Guide','Factory &amp; Balance','Plan &amp; Build'])assert.match(nav,new RegExp('>'+label+'<\\/button>'));
 const newPalette=fs.readFileSync(path.join(base,'workspace-v025.css'),'utf8');
 for(const color of ['#eec277','#efa08e','#e5a1cf','#b6a6f1','#65b5ff','#6ce0d1'])assert.ok(newPalette.toLowerCase().includes(color));
 assert.match(css,/body\[data-workspace="build"\]/);
 assert.match(newPalette,/--workspace-grid:rgba\(100,181,255,\.125\)/);
});
test('Projects preserve original circuit district and its live construction checklist',()=>{
 const view=html.slice(html.indexOf('<section class="view" id="factory">'),html.indexOf('<section class="view" id="learn">'));
 assert.ok(view.indexOf('id="projectsSummary"')<view.indexOf('id="legacyDistrict"'));
 for(const id of ['legacyDistrict','districtMetrics','districtBlocks','districtInventory','districtChecklist','factorySettings','exportButton','importButton'])assert.ok(view.includes('id="'+id+'"'));
 assert.equal((html.match(/id="districtChecklist"/g)||[]).length,1);
 assert.match(projectJs,/factory\.checked/);
});
test('a saved 90/min red circuit project uses live model counts and starts at 0 built',()=>{
 const p=make();
 assert.equal(p.goal.id,'advanced-circuit');
 assert.deepEqual(p.tasks.map(x=>[x.recipe,x.planned,x.built]),[
  ['copper-cable',5,0],['electronic-circuit',2,0],['advanced-circuit',12,0]]);
 assert.equal(projectProgress(p).planned,19);
 assert.equal(projectProgress(p).built,0);
});
test('one Built action updates exactly one project machine and one linked Factory row',()=>{
 const initial=make(),result=applyBuildDelta(initial,'copper-cable',1,[]);
 assert.equal(projectProgress(result.project).built,1);
 assert.equal(result.rows.length,1);
 assert.deepEqual([result.rows[0].recipe,result.rows[0].count,result.rows[0].tier,result.rows[0].destination],
  ['copper-cable',1,.75,'Other']);
 assert.equal(result.rows[0].projectId,'project_1');
 assert.equal(result.rows[0].projectTask,'copper-cable');
});
test('another Built action increments linked row, never adds duplicate inventory',()=>{
 const first=applyBuildDelta(make(),'copper-cable',1,[]);
 const next=applyBuildDelta(first.project,'copper-cable',1,first.rows);
 assert.equal(next.project.tasks[0].built,2);
 assert.equal(next.rows.length,1);
 assert.equal(next.rows[0].count,2);
});
test('built minus reverses BOTH project and actual Factory, including removing empty row',()=>{
 const first=applyBuildDelta(make(),'advanced-circuit',1,[]);
 const second=applyBuildDelta(first.project,'advanced-circuit',-1,first.rows);
 assert.equal(second.project.tasks.at(-1).built,0);
 assert.equal(second.rows.length,0);
 assert.equal(projectProgress(second.project).built,0);
});
test('different projects have separate linked rows, and manual Factory rows are left alone',()=>{
 const existing={recipe:'copper-cable',count:17,tier:.75,destination:'Main bus'};
 const a=applyBuildDelta(make('A'),'copper-cable',1,[existing]);
 const b=applyBuildDelta(make('B'),'copper-cable',1,a.rows);
 assert.equal(b.rows.length,3);
 assert.equal(b.rows[0].count,17);
 assert.equal(b.rows.filter(x=>x.projectId==='A').length,1);
 assert.equal(b.rows.filter(x=>x.projectId==='B').length,1);
});
test('already-recorded machines cannot be accidentally recorded again after manual editing',()=>{
 const added=applyBuildDelta(make(),'copper-cable',1,[]);
 const manuallyChanged=added.rows.map(x=>({...x,count:3}));
 assert.throws(()=>applyBuildDelta(added.project,'copper-cable',1,manuallyChanged),/differ/);
 assert.throws(()=>applyBuildDelta(added.project,'copper-cable',-1,manuallyChanged),/differ/);
});
test('changed recipe or machine tier blocks project progress until reviewed',()=>{
 const first=applyBuildDelta(make(),'copper-cable',1,[]);
 assert.throws(()=>applyBuildDelta(first.project,'copper-cable',1,first.rows.map(x=>({...x,recipe:'advanced-circuit'}))),/differ/);
 assert.throws(()=>applyBuildDelta(first.project,'copper-cable',1,first.rows.map(x=>({...x,tier:1.25}))),/differ/);
});
test('duplicated linked lines cannot double-count inventory',()=>{
 const first=applyBuildDelta(make(),'copper-cable',1,[]);
 assert.throws(()=>applyBuildDelta(first.project,'copper-cable',1,[...first.rows,...first.rows]),/Multiple Factory lines/);
});
test('built progress cannot go below zero or beyond planned machine counts',()=>{
 assert.throws(()=>applyBuildDelta(make(),'copper-cable',-1,[]),/between zero/);
 let state={project:make(),rows:[]};
 for(let i=0;i<5;i++)state=applyBuildDelta(state.project,'copper-cable',1,state.rows);
 assert.equal(state.project.tasks[0].built,5);
 assert.throws(()=>applyBuildDelta(state.project,'copper-cable',1,state.rows),/between zero/);
});
test('raw smelting projects require an explicit compatible furnace choice',()=>{
 const raw=analyze(90,'raw');
 assert.ok(raw.entries.some(x=>x.kind==='furnace'));
 assert.throws(()=>buildProject('Raw project',raw,'raw-1','2026-11-22'),/explicit steel\/electric/);
 const p=buildProject('Raw project',raw,'raw-1','2026-11-22','steel-furnace');assert.equal(p.furnaceItem,'steel-furnace');assert.ok(p.tasks.some(x=>x.kind==='furnace'));
});
test('zero-target projects and invalid project names are rejected',()=>{
 assert.throws(()=>buildProject('','x','id','2026-11-22'));
 assert.throws(()=>validateProjectName(' '.repeat(4)));
 assert.throws(()=>buildProject('No output',analyze(0),'zero','2026-11-22'),/above zero/);
});
test('missing optional project field normalizes cleanly for old snapshots',()=>{
 assert.deepEqual(normalizeProjects(undefined),[]);
 assert.deepEqual(normalizeProjects(null),[]);
 const legacy={redBlocks:4,checked:{red1:true}};
 assert.equal(legacy.projects,undefined);
 assert.deepEqual(normalizeProjects(legacy.projects),[]);
});
test('the cloud snapshot continues to include plan without new tables or sync code changes',()=>{
 assert.match(html,/snapshot\(\)\{return JSON\.parse\(JSON\.stringify\(\{version:7,plan:factory,guide,setup,balancePrefs\}\)\)\}/);
 assert.match(html,/projects:Array\.isArray\(data\.plan\.projects\)\?data\.plan\.projects:\[\]/);
 assert.match(html,/factory\.projects=Array\.isArray\(factory\.projects\)\?factory\.projects:\[\]/);
 assert.match(worker,/nauvis-shell-v058/);
 assert.match(worker,/projects\.js/);
 assert.match(worker,/projects\.css/);
});
test('projects and the visual planner expose working navigation and create controls',()=>{
 assert.match(html,/id="projectsGoPlanner"/);
 assert.match(html,/id="projectsSaveForm"/);
 assert.match(recipeJs,/NauvisProjects\?\.createFromRatio\(result\)/);
 assert.match(recipeJs,/setGoal\(goal\)/);
 assert.match(projectJs,/saveSetup\(\);save\(\);renderSetup\(\)/);
 assert.match(projectJs,/factory\.projects=allProjects\(\)\.map/);
 assert.doesNotMatch(projectJs,/data-project-record/);
});

test('incremental project freezes reduced design and records only additional machines',()=>{
 const {incrementalPlan}=require('../recipe-ratios.js'),{reuseClaims}=require('../projects.js');
 const full=analyze(90),reduced=incrementalPlan(full,{'electronic-circuit':180});
 reduced.reuseClaims=[{key:'machine:electronic-circuit|Available for new build',item:'electronic-circuit',rate:180}];
 const p=buildProject('Incremental',reduced,'incremental','now');
 assert.equal(projectProgress(p).planned,reduced.roundedTotal);
 assert.equal(projectProgress(p).built,0);
 assert.equal(p.tasks.some(t=>t.recipe==='electronic-circuit'),false);
 assert.equal(p.design.baselineMachines,full.roundedTotal);
 assert.equal(reuseClaims([p]).get(reduced.reuseClaims[0].key),180);
 assert.equal(reuseClaims([{...p,status:'archived'}]).get(reduced.reuseClaims[0].key),180);
 assert.equal(reuseClaims([{...p,status:'archived',reuseReleased:true}]).size,0);
 const existing=[{recipe:'electronic-circuit',count:2,tier:.75,destination:'Available for new build'}];
 const next=applyBuildDelta(p,'advanced-circuit',1,existing);
 assert.deepEqual(next.rows[0],existing[0]);assert.equal(next.rows.length,2);assert.equal(next.rows[1].count,1);
 reduced.entries[0].count=999;assert.notEqual(p.design.analysis.entries[0].count,999);
 assert.throws(()=>buildProject('Bad',{...reduced,reuseClaims:[]},'bad','now'),/Reuse commitments differ/);
});

test('raw projects own a subset of actual smelting counts, reverse safely, and guard manual edits',()=>{
 const effects=require('../production-effects.js');
 const p=buildProject('Raw project',analyze(90,'raw'),'raw-1','now','steel-furnace');
 const task=p.tasks.find(x=>x.kind==='furnace'),field=effects.SMELT_FIELDS[task.recipe];
 const initial={furnaceSpeed:2,[field]:12};
 const a=effects.applySmeltBuildDelta(p,task.recipe,1,initial,[p]);
 assert.equal(a.smelt[field],13);assert.equal(a.smelt.projectBuilt[0].count,1);
 assert.equal(effects.smeltOwnership(a.smelt,[a.project])[field],1);
 assert.equal(initial[field],12);
 assert.throws(()=>effects.editSmelting(a.smelt,{[field]:0},[a.project]),/cannot be lower/);
 assert.throws(()=>effects.editSmelting(a.smelt,{furnaceSpeed:1},[a.project]),/2×/);
 assert.throws(()=>effects.applySmeltBuildDelta(a.project,task.recipe,1,{...a.smelt,projectBuilt:[]},[a.project]),/missing/);
 const b=effects.applySmeltBuildDelta(a.project,task.recipe,-1,a.smelt,[a.project]);
 assert.equal(b.smelt[field],12);assert.equal(b.smelt.projectBuilt.length,0);
});
test('remaining machine construction ingredient bill uses selected furnace type and remaining tasks',()=>{
 const {constructionMaterials}=require('../projects.js');
 const p=buildProject('Raw project',analyze(90,'raw'),'raw-1','now','electric-furnace');
 const bill=constructionMaterials(p,R);
 const f=bill.machines.find(x=>x.key==='electric-furnace');
 assert.ok(f.remaining>0);assert.equal(bill.unknown.length,0);
 const expected=Object.fromEntries(bill.ingredients.map(x=>[x.key,x.quantity]));
 for(const [k,q] of Object.entries(R['electric-furnace'][4]))assert.ok(expected[k]>=f.remaining*q);
 const built={...p,tasks:p.tasks.map(t=>({...t,built:t.planned}))};
 assert.equal(constructionMaterials(built,R).ingredients.length,0);
});
