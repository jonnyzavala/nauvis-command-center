// Run: node --test tests/*.test.cjs
// The visual production graph must be the primary Build workflow, not hidden below old controls.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(base,file),'utf8');
const html=read('index.html'),ratios=read('recipe-ratios.js'),flow=read('ratio-flow.js'),
      css=read('ratio-flow.css'),worker=read('service-worker.js');
const start=html.indexOf('<section class="view" id="build">');
const end=html.indexOf('<section class="view active" id="balance">',start);
const build=html.slice(start,end);

test('the unified fourth tab opens blueprint designer',()=>{
 assert.equal((html.match(/<button data-view=/g)||[]).length,3,'Exactly three navigation destinations');
 assert.match(html,/<button data-view="build"[^>]*>[\s\S]*?Plan &amp; Build<\/button>/);
 assert.match(html,/build:'Plan & Build · Designer'/);
});
test('visual production chain is open by default and appears immediately below hero',()=>{
 assert.match(build,/<h1>Visual production planner<\/h1>/);
 assert.match(build,/class="section ratio-explorer ratio-featured" data-ratio-explorer="build" open/);
 const ratio=build.indexOf('data-ratio-explorer="build"'),old=build.indexOf('id="buildClassic"');
 assert.ok(ratio>0&&old>ratio,'Visual explorer must precede optional legacy calculator');
 assert.ok(ratio<build.indexOf('id="goalGrid"'),'Machine chart must precede legacy recipe presets');
});
test('the older calculator is available one click away with all existing IDs',()=>{
 assert.match(build,/<details id="buildClassic" class="section build-classic">/);
 assert.doesNotMatch(build,/<details id="buildClassic"[^>]+open/,'Legacy view starts collapsed');
 for(const id of ['goalGrid','allRecipes','scaleOptions','goalNumber','totalMachines','machineList','machineWhy','suppliesList','beltMessage','assemblyTier','sourceMode','beltTier']){
  assert.ok(build.includes('id="'+id+'"'),'Old calculator lost '+id);
 }
});
test('open-on-load explorer renders its graph with the dependency module available',()=>{
 const graphScript=html.indexOf('src="./ratio-flow.js" defer');
 const ratioScript=html.indexOf('src="./recipe-ratios.js" defer');
 assert.ok(graphScript>0&&ratioScript>graphScript,'Graph must be loaded before initial explorer render');
 assert.match(ratios,/cards\.filter\(card=>card\.open\)\.forEach\(renderCard\)/);
 assert.match(ratios,/root\.NauvisRatioFlow\?\.mount\(target,result,card\.dataset\.ratioExplorer\)/);
 assert.match(flow,/Build these machines/);
});
test('sending an exploratory goal opens the detailed calculator and scrolls to it',()=>{
 assert.match(ratios,/guide\.goal=state\.id;guide\.rate=state\.rate;guide\.machine=state\.machine;guide\.source=state\.source;guide\.belt=state\.belt;/);
 assert.match(ratios,/activateWorkspace\('build',true\)/);
 assert.match(ratios,/classic\.open=true/);
 assert.match(ratios,/classic\.scrollIntoView/);
 assert.doesNotMatch(ratios,/saveSetup\(\)|setup\.machines\s*=|setup\.feeds\s*=/);
});
test('the context-sensitive guide follows the promoted ratio panel, not hidden sections',()=>{
 assert.match(html,/build:\['> \.section','n4','n0','n1','n2','n3','n5'\]/);
 assert.match(html,/build:'n4'/);
 assert.match(html,/id==='build'\?/);
 assert.match(html,/buildClassic > \.build-classic-content > \.section/);
});
test('the featured visuals keep current mobile layout and offline support',()=>{
 assert.match(css,/#build > \.ratio-featured/);
 assert.match(css,/#build \.build-classic/);
 assert.match(css,/scroll-margin-top:calc\(var\(--chrome-height/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(worker,/nauvis-shell-v041/);
 assert.match(worker,/ratio-flow\.js/);
 assert.match(worker,/recipe-ratios\.js/);
 assert.match(html,/Nauvis Command Center v0\.41/);
 assert.match(html,/sync\/cloud-sync\.js/);
});
