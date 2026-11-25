// NAUVIS v0.25 · workspace consolidation, non-destructive activity audit.
// Run: node --test tests/*.test.cjs
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html'),ui=read('workspace-ui.js'),style=read('workspace-v025.css'),
      journal=read('journal.js'),projects=read('projects.js'),sw=read('service-worker.js'),
      quick=read('quick-add.js');
const {normalizeJournal,groupedMachines,summarizeSetupDelta,MAX_ENTRIES}=require('../journal.js');
const empty=()=>({smelt:{ironFurnaces:0},oil:{refineries:0},machines:[],feeds:[]});

test('three tabs share Inventory/Analysis and Designer/Construction modes',()=>{
 const nav=html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0]||'';
 assert.deepEqual([...nav.matchAll(/<button data-view="([^"]+)"/g)].map(m=>m[1]),['learn','setup','build']);
 assert.match(nav,/>Plan &amp; Build<\/button>/);
 assert.doesNotMatch(nav,/data-view="factory"/);
 assert.match(html,/b\.dataset\.view===\(view==='factory'\?'build':\(view==='balance'\|\|view==='logistics'\)\?'setup':view\)/);
 assert.match(ui,/data-factory-target="balance"/);
 assert.match(ui,/data-plan-target="build"/);
 assert.match(ui,/data-plan-target="factory"/);
 assert.match(ui,/aria-pressed/);
 assert.match(style,/body\[data-workspace="build"\]/);
 assert.match(style,/body\[data-workspace="factory"\]/);
 assert.match(style,/--nauvis-planner:#65b5ff/);
 assert.match(style,/--nauvis-projects:#6ce0d1/);
});
test('both designer and teal Construction retain original functional elements',()=>{
 const designer=html.slice(html.indexOf('<section class="view" id="build">'),html.indexOf('<section class="view active" id="balance">'));
 const queue=html.slice(html.indexOf('<section class="view" id="factory">'),html.indexOf('<section class="view" id="learn">'));
 for(const id of ['buildClassic','goalGrid','allRecipes','scaleOptions','machineList','machineWhy'])assert.ok(designer.includes('id="'+id+'"'));
 assert.match(designer,/data-ratio-explorer="build" open/);
 for(const id of ['projectsOverview','projectsList','legacyDistrict','districtMetrics','districtChecklist','projectsArchivedWrapper','journalPanel','journalNoteForm'])assert.ok(queue.includes('id="'+id+'"'));
 assert.ok(queue.indexOf('id="projectsList"')<queue.indexOf('id="legacyDistrict"'));
});
test('all four workspaces have overview stats and section jump links',()=>{
 const ids=['learn','setup','balance','build','factory'];
 for(const id of ids)assert.ok(ui.includes(id+':{'),id+' overview');
 assert.match(ui,/data-workspace-stats/);
 assert.match(ui,/data-workspace-jump/);
 assert.match(ui,/scrollIntoView/);
 assert.match(ui,/node\.workspaceExpand\?\.\(\)/);
 assert.match(ui,/if\(node\.tagName==='DETAILS'\)node\.open=true/);
 assert.match(style,/\.workspace-overview-stats/);
 assert.match(style,/\.workspace-jump-list button/);
});
test('core Balance and blue flow remain visible; only secondary sections are collapsed',()=>{
 assert.match(ui,/setupOilPanel',true/);
 assert.match(ui,/setupBeltsPanel',true/);
 assert.match(ui,/workspace-balance-interpret',true/);
 assert.doesNotMatch(ui,/setupSmeltingPanel',true/);
 assert.doesNotMatch(ui,/setupMachinesPanel',true/);
 assert.doesNotMatch(ui,/balanceLedger',true/);
 assert.doesNotMatch(ui,/ratio-explorer',true/);
 assert.match(style,/\.workspace-folded>:not\(\.section-head\)\{display:none!important\}/);
 assert.match(html,/id="balanceSummary"/);
 assert.match(html,/id="balanceAlerts"/);
});
test('linked machine additions are explained once with before/after and project origin',()=>{
 const old=empty(),next=empty();
 next.machines=[{recipe:'advanced-circuit',count:1,tier:.75,destination:'Other',projectId:'p1',projectTask:'advanced-circuit'}];
 const events=summarizeSetupDelta(old,next);
 assert.equal(events.length,1);
 assert.equal(events[0].type,'inventory');
 assert.equal(events[0].delta,1);
 assert.equal(events[0].before,0);
 assert.equal(events[0].after,1);
 assert.equal(events[0].projectId,'p1');
 assert.match(events[0].detail,/linked to a project/);
});
test('machine edits record changes without creating phantom extra machines',()=>{
 const old=empty(),next=empty();
 old.machines=[{recipe:'copper-cable',count:2,tier:.75,destination:'Main bus'}];
 next.machines=[{...old.machines[0],count:4}];
 const events=summarizeSetupDelta(old,next);
 assert.equal(events.length,1);
 assert.equal(events[0].delta,2);
 assert.equal(events[0].before,2);
 assert.equal(events[0].after,4);
});
test('no fake event when a production line is unchanged or reordered',()=>{
 const a=empty(),b=empty();
 a.machines=[{recipe:'copper-cable',count:2,tier:.75,destination:'Main bus'}, {recipe:'advanced-circuit',count:3,tier:.75,destination:'Other'}];
 b.machines=[...a.machines].reverse();
 assert.deepEqual(summarizeSetupDelta(a,b),[]);
 assert.equal(groupedMachines(a.machines).size,2);
});
test('smelting, oil and belt changes are individually recognized',()=>{
 const old=empty(),now=empty();now.smelt.ironFurnaces=48;now.oil.refineries=2;
 now.feeds=[{recipe:'coal',count:2,tier:'red',destination:'Smelting'}];
 const events=summarizeSetupDelta(old,now);
 assert.deepEqual(events.map(e=>e.type),['routing','infrastructure','infrastructure']);
 assert.match(events[1].detail,/ironFurnaces/);
 assert.match(events[2].detail,/refineries/);
});
test('journal normalization rejects corrupt and duplicate IDs and caps old history',()=>{
 const old=Array.from({length:MAX_ENTRIES+35},(_,i)=>({id:'e'+i,title:'Edit '+i}));
 const normalized=normalizeJournal(old);
 assert.equal(normalized.length,MAX_ENTRIES);
 assert.equal(normalized.at(-1).id,'e'+(MAX_ENTRIES+34));
 assert.equal(normalizeJournal(undefined).length,0);
 assert.equal(normalizeJournal([{id:'x',title:'ok'},{id:'x',title:'again'},null,{}]).length,1);
});
test('project build actions log one construction event and preserve journal baseline during paired save',()=>{
 assert.match(projects,/type:'construction',source:'Construction Queue'/);
 assert.match(projects,/root\.NauvisJournal\?\.record\?\.\(\{/);
 assert.match(projects,/before:next\.built-delta,after:next\.built/);
 assert.match(projects,/setup\.machines=change\.rows/);
 assert.match(projects,/saveSetup\(\);save\(\);renderSetup\(\)/);
 assert.match(journal,/baseline=JSON\.stringify\(setup\)/);
 assert.match(journal,/function captureSetup\(\)/);
 assert.match(html,/function saveSetup\(\)\{window\.NauvisJournal\?\.captureSetup\?\.\(\)/);
});
test('legacy district resets cannot erase projects, journal, or factory machinery',()=>{
 assert.match(html,/const projects=factory\.projects,journal=factory\.journal/);
 assert.match(html,/Object\.assign\(factory,fd,\{checked:\{\},projects,journal\}\)/);
 assert.match(html,/title:'Reset legacy district plan'/);
 assert.doesNotMatch(html,/Object\.assign\(factory,fd,\{checked:\{\}\}\);save\(\)/);
});
test('old cloud snapshots still load, and journal is part of current snapshot without new DB tables',()=>{
 assert.match(html,/snapshot\(\)\{return JSON\.parse\(JSON\.stringify\(\{version:7,plan:factory,guide,setup,balancePrefs\}\)\)\}/);
 assert.match(html,/journal:Array\.isArray\(data\.plan\.journal\)\?data\.plan\.journal:\[\]/);
 assert.match(html,/factory\.journal/);
 assert.match(html,/NauvisJournal\?\.refreshBaseline\?\.\(\)/);
 assert.match(html,/NauvisJournal\?\.render\?\.\(\)/);
});
test('manual field notes cannot implicitly alter Factory counts',()=>{
 assert.match(journal,/function addNote\(note\)/);
 assert.match(journal,/type:'note',source:'Field note'/);
 assert.match(journal,/Journal notes must have 1–600 characters/);
 assert.match(journal,/No Factory counts changed/); // UI message is in journal source
 assert.doesNotMatch(journal,/setup\.machines\.push\(/);
});
test('new module assets and theme survive offline on iPhone',()=>{
 assert.match(sw,/nauvis-shell-v059/);
 for(const file of ['journal.js','workspace-ui.js','workspace-v025.css'])assert.ok(sw.includes("'./"+file+"'"),file);
 assert.match(html,/src="\.\/journal\.js"/);
 assert.match(html,/src="\.\/workspace-ui\.js"/);
 assert.match(html,/href="\.\/workspace-v025\.css"/);
 assert.match(style,/@media\(max-width:760px\)/);
 assert.match(style,/@media\(max-width:430px\)/);
 assert.match(html,/Nauvis Command Center v0\.59/);
});

test('six-mode spectrum retains blue and teal anchors and a continuous stable rail',()=>{
 for(const [name,color] of [['guide','#eec277'],['factory','#efa08e'],['balance','#e5a1cf'],['logistics','#b6a6f1'],['planner','#65b5ff'],['projects','#6ce0d1']]){
  assert.ok(style.includes('--nauvis-'+name+':'+color));
 }
 assert.match(style,/body\[data-workspace="logistics"\]\{\s*--workspace-accent:var\(--nauvis-logistics\)/);
 assert.match(style,/body\[data-workspace="logistics"\] \.nav button\[data-view="setup"\]\{--tab-color:var\(--nauvis-logistics\)/);
 assert.match(style,/button\[data-view="setup"\]::after\{[\s\S]*?var\(--nauvis-factory\) 18%,var\(--nauvis-balance\) 50%,var\(--nauvis-logistics\) 82%/);
 assert.match(style,/button\[data-view="build"\]::after\{[\s\S]*?var\(--nauvis-planner\) 30%,var\(--nauvis-projects\) 100%/);
 assert.doesNotMatch(read('logistics.css'),/--workspace-accent:/);
});
