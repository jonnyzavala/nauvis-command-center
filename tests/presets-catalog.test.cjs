// v0.26: Standard Nauvis catalog and transparent target recommendations.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const read=n=>fs.readFileSync(path.join(base,n),'utf8');
const html=read('index.html'),ratio=read('recipe-ratios.js'),ui=read('workspace-ui.js');
const R=vm.runInNewContext('('+html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1]+')');
const {recommendation,modeFor,KNOWN}=require('../production-presets.js');
const {analyzeRecipeRatios}=require('../recipe-ratios.js');
const extractSet=k=>new Set(vm.runInNewContext(html.match(new RegExp('const '+k+'=new Set\\((\\[[^\\]]*\\])\\)'))?.[1]||'[]'));
const ctx={stopBus:extractSet('STOP_BUS'),stopRaw:extractSet('STOP_RAW'),fluids:extractSet('FLUID'),names:{}};
test('source-backed base catalog includes 182 deterministic producible recipes without losing original 33',()=>{
 assert.equal(Object.keys(R).length,182);
 for(const id of ['laser-turret','accumulator','solar-panel','efficiency-module','speed-module','construction-robot','logistic-robot','electric-mining-drill','assembling-machine-2','rocket-silo'])assert.ok(R[id],id);
 assert.deepEqual(JSON.parse(JSON.stringify(R['laser-turret'])),['Laser turret',20,1,'asm',{'steel-plate':20,'electronic-circuit':20,'battery':12}]);
 assert.deepEqual(JSON.parse(JSON.stringify(R['accumulator'])),['Accumulator',10,1,'asm',{'iron-plate':2,'battery':5}]);
 assert.equal(R['rocket-fuel'][1],15,'Correct updated Factorio 2.0 recipe time');
});
test('Starter / Balanced / More targets are deterministic, positive and ordered for every item',()=>{
 for(const id of Object.keys(R)){
  const x=recommendation(id,R,.75);
  assert.ok(x.starter<=x.balanced&&x.balanced<=x.expand,id);
  assert.ok(x.starter>0&&x.expand<=25000,id);
  assert.equal(modeFor(x.balanced,x),'balanced');
  assert.equal(modeFor(x.expand,x),'expand');
  assert.equal(modeFor(x.starter,x),'starter');
 }
 assert.equal(recommendation('advanced-circuit',R,.75).balanced,90);
 assert.equal(recommendation('battery',R,.75).balanced,30);
 assert.equal(recommendation('accumulator',R,.75).balanced,10);
 assert.equal(recommendation('laser-turret',R,.75).balanced,6);
 assert.equal(modeFor(123,recommendation('battery',R,.75)),'custom');
});
test('recommendation is expressly a starting heuristic, not observed demand',()=>{
 assert.equal(recommendation('accumulator',R,.75).source,'curated');
 const x=recommendation('assembling-machine-1',R,.75);
 assert.ok(['curated','two-machine-heuristic'].includes(x.source));
 assert.match(x.rationale,/not a claim|actual demand/i);
 assert.match(read('production-presets.js'),/NOT inferred factory demand/);
});
test('all 182 base items can be planned at the suggested rate in bus-fed and raw modes',()=>{
 for(const id of Object.keys(R)){
  const preset=recommendation(id,R,.75);
  for(const source of ['bus','raw']){
   const result=analyzeRecipeRatios(R,{id,rate:preset.balanced,machine:.75,source,belt:900},ctx);
   assert.equal(result.id,id);
   assert.ok(result.roundedTotal>0,id+' '+source);
   assert.ok(result.entries.every(row=>Number.isFinite(row.needed)&&row.count>=0),id+' '+source);
  }
 }
});
test('search and preset controls preserve visual flow and detailed table toggles',()=>{
 assert.match(ratio,/data-ratio-search/);
 assert.match(ratio,/data-ratio-preset/);
 assert.match(ratio,/data-ratio-field/);
 assert.match(ratio,/state\.preset='balanced';state\.rate=recommendation\(\)\.balanced/);
 assert.match(ratio,/root\.NauvisPresets\?\.recommendation/);
 assert.match(ratio,/data-ratio-legacy-table/);
 assert.match(ratio,/NauvisRatioFlow\?\.mount/);
 assert.match(html,/function scaleChoices\(\)\{const x=window\.NauvisPresets\?\.recommendation/);
});
test('three top-level tabs retain their distinct dual-mode destinations',()=>{
 const nav=html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0]||'';
 assert.deepEqual([...nav.matchAll(/<button data-view="([^"]+)"/g)].map(x=>x[1]),['learn','setup','build']);
 assert.match(ui,/data-factory-target="setup"/);
 assert.match(ui,/data-factory-target="balance"/);
 assert.match(ui,/data-plan-target="build"/);
 assert.match(ui,/data-plan-target="factory"/);
 assert.match(ui,/lastFactoryMode/);
});
test('preset scripts and styling precache offline without any data schema changes',()=>{
 const worker=read('service-worker.js');
 assert.match(html,/src="\.\/production-presets\.js\?v=1\.1\.18"/);
 assert.match(html,/href="\.\/preset-v026\.css\?v=1\.1\.18"/);
 assert.match(worker,/nauvis-shell-v10118/);
 assert.match(worker,/production-presets\.js/);
 assert.match(worker,/preset-v026\.css/);
 assert.match(html,/Nauvis Command Center v1\.1\.18/);
 assert.match(html,/version:7,plan:factory,guide,setup,balancePrefs/);
});

test('categorized recipe browsing covers the entire catalog and filters without duplicates',()=>{
 const {recipeGroup,recipeMatches,RECIPE_GROUPS}=require('../recipe-ratios.js');
 const ids=Object.keys(R),all=recipeMatches([...ids,...ids],R);
 assert.equal(all.length,ids.length);
 const grouped=RECIPE_GROUPS.flatMap(g=>recipeMatches(ids,R,g));
 assert.equal(grouped.length,ids.length);assert.equal(new Set(grouped).size,ids.length);
 assert.equal(recipeGroup('copper-cable'),'Circuits & components');
 assert.equal(recipeGroup('military-science-pack'),'Science & research');
 assert.equal(recipeGroup('laser-turret'),'Military & equipment');
 assert.ok(recipeMatches(ids,R,'all','copper cable').includes('copper-cable'));
 assert.deepEqual(recipeMatches(ids,R,'Military & equipment','copper cable'),[]);
 assert.doesNotMatch(ratio,/data-recipe-category/);assert.match(ratio,/data-recipe-pick/);assert.match(ratio,/<optgroup label=/);
});
test('mobile profile spans the full row; compact inputs and corrected recipe color',()=>{
 const css=read('advanced-v028.css');
 assert.match(css,/\.setup-row>\.setup-machine-upgrades\{grid-column:1\/-1/);
 assert.match(css,/#setupSmeltingInputs,#setupOilInputs\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.ratio-header-title,\.ratio-header-subtitle\{display:block\}/);
 assert.match(html,/window\.NauvisIcons\?\.color\?\.\(id\)/);
 assert.match(html,/type="number" inputmode="numeric" min="0" step="1" id="setupIronFurnaces"/);
 assert.match(html,/class="inventory-tool-actions"/);
});

test('workspace briefing scrolls at fixed size without scroll-triggered layout changes',()=>{
 const css=read('advanced-v028.css');
 assert.doesNotMatch(html,/command-scrolled|updateScroll/);
 assert.doesNotMatch(css,/command-scrolled/);
 assert.match(html,/\.view\.active>\.hero\{\s*position:relative;/);
 assert.doesNotMatch(html,/\.view\.active>\.hero\{\s*position:sticky/);
 assert.match(html,/\.command-chrome\{\s*position:sticky/);
});
