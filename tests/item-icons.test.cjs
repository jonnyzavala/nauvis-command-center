// NAUVIS v0.24: original industrial item glyphs and palette synchronization.
// Run with node --test tests/*.test.cjs
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');
const {item,specs}=require('../item-icons.js');
const html=read('index.html');
const icons=read('item-icons.js');
const style=read('item-icons.css');
const projectsCSS=read('projects.css');
const flow=read('ratio-flow.js');
const ratios=read('recipe-ratios.js');
const projects=read('projects.js');
const quick=read('quick-add.js');
const sw=read('service-worker.js');
const expr=html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1];
assert.ok(expr,'Could not find live R recipe model');
const R=vm.runInNewContext('('+expr+')');

test('all 33 live recipe IDs have intentionally designed item icons',()=>{
 assert.equal(Object.keys(R).length,33);
 for(const id of Object.keys(R)){
  assert.ok(specs[id],'Missing original art specification for '+id);
  const str=item(id,40);
  assert.match(str,/<svg class="item-icon-svg"/);
  assert.match(str,/viewBox="0 0 64 64"/);
  assert.match(str,/data-item-icon="/);
  assert.match(str,/<\/svg><\/span>$/);
 }
});

test('every external raw input has an icon even without a production recipe',()=>{
 const ext=['iron-ore','copper-ore','coal','stone','water',
  'petroleum-gas','heavy-oil','light-oil','lubricant'];
 for(const id of ext)assert.ok(specs[id],'Missing material icon: '+id);
 const fallback=item('unmodeled-resource',29);
 assert.match(fallback,/data-item-icon="unmodeled-resource"/);
});

test('original circuit colors, plates, fluids, machinery, science and belts have distinct shapes',()=>{
 const samples=['electronic-circuit','advanced-circuit','processing-unit','iron-plate',
  'copper-plate','copper-cable','iron-gear-wheel','battery','rail','inserter',
  'transport-belt','fast-transport-belt','water','petroleum-gas',
  'production-science-pack','utility-science-pack'];
 const shapes=samples.map(id=>item(id));
 assert.equal(shapes.length,new Set(shapes).size);
 assert.notEqual(specs['advanced-circuit'][1],specs['electronic-circuit'][1]);
 assert.notEqual(specs['transport-belt'][1],specs['fast-transport-belt'][1]);
 assert.notEqual(specs['water'][1],specs['heavy-oil'][1]);
});

test('icons are local, copyright-safe vector drawings, not copied game art or network requests',()=>{
 assert.doesNotMatch(icons,/(?:<img\b|https?:\/\/|fetch\(|\.png\b|\.webp\b|\.jpg\b|@import\b)/i);
 assert.match(icons,/original industrial item icon illustrations/);
 assert.match(icons,/not Wube\/Factorio game sprites/);
 const svg=item('advanced-circuit',32);
 assert.match(svg,/aria-hidden="true"/);
 assert.doesNotMatch(svg,/<img\b|<script\b/i);
});

test('item icons remain in the production flow, the big Build these machines list and detail',()=>{
 assert.match(flow,/itemGlyph\(node\.recipe,40\)/);
 assert.match(flow,/itemGlyph\(node\.recipe,34\)/);
 assert.match(flow,/itemGlyph\(n\.recipe,35\)/);
 assert.match(flow,/itemGlyph\(node\.recipe,27\)/);
 assert.match(flow,/Build these machines/);
});

test('ratio inspector and supply cards use the same icon API',()=>{
 assert.match(ratios,/itemGlyph\(x\.key,34\)/);
 assert.match(ratios,/itemGlyph\(x\.key,25\)/);
 assert.match(ratios,/itemGlyph\(x\.key,30\)/);
 assert.match(ratios,/itemGlyph\(x\.key,31\)/);
 assert.match(ratios,/itemGlyph\(x\.key,27\)/);
});

test('projects and quick change show real-time current recipe icons without changing storage logic',()=>{
 assert.match(projects,/itemGlyph\(task\.recipe,32\)/);
 assert.match(projects,/itemGlyph\(p\.goal\.id,34\)/);
 assert.match(quick,/id="quickItemPreview"/);
 assert.match(quick,/NauvisIcons\?\.item\?\.\(key,38\)/);
 assert.match(quick,/id='quickItemPreview'/);
 assert.match(projects,/setup\.machines=change\.rows/);
});

test('Factory, Balance and recipe picker show text alongside decorative icons',()=>{
 assert.match(html,/itemIcon\(row\.recipe,30\)/);
 assert.match(html,/itemIcon\(r\.id,29\)/);
 assert.match(html,/itemIcon\(x\.id,35\)/);
 assert.match(html,/escapeHTML\(nameOf\(r\.id\)\)/);
 assert.match(html,/id="setupMachineRows"/);
});

test('the five palette variables exactly match the tab order and drive gradient stops',()=>{
 const colors=[
  ['guide','#9ab0c1','learn','10%'],
  ['factory','#eec277','setup','30%'],
  ['balance','#79d0ad','balance','50%'],
  ['planner','#65b5ff','build','70%'],
  ['projects','#bba5e5','factory','90%']
 ];
 for(const [key,color,view,stop] of colors){
  assert.ok(projectsCSS.includes('--nauvis-'+key+':'+color),key+' palette token');
  assert.ok(projectsCSS.includes('body[data-workspace="'+view+'"]{--workspace-accent:var(--nauvis-'+key+')'),key+' workspace');
  assert.ok(projectsCSS.includes('.nav button[data-view="'+view+'"]{--tab-color:var(--nauvis-'+key+')'),key+' navigation');
  assert.ok(projectsCSS.includes('var(--nauvis-'+key+') '+stop),key+' gradient stop');
 }
 assert.match(projectsCSS,/\.nav-track::after,\.command-chrome \.nav-track::after/);
 assert.match(projectsCSS,/\.nav button \.nav-dot\{background:var\(--tab-color/);
 assert.ok(html.indexOf('href="./projects.css"')<html.indexOf('href="./item-icons.css"'));
});

test('gradient and icons still share the same iPhone-responsive background strategy',()=>{
 assert.match(style,/@media\(max-width:650px\)/);
 assert.match(style,/\.ratio-flow-node:not\(\.ratio-flow-supply\)/);
 assert.match(style,/\.goal>.item-icon/);
 assert.match(style,/\.balance-ledger \.balance-item-label/);
 assert.match(html,/background-image:var\(--workspace-canvas\)/);
 assert.match(html,/clip-path:polygon\(0 0,100% 0,100% var\(--chrome-height\)/);
});

test('first render loads icon system before inline rendering and caches both files offline',()=>{
 assert.ok(html.indexOf('src="./item-icons.js"')<html.indexOf('/* Verified standard recipes.'));
 assert.match(html,/href="\.\/item-icons\.css"/);
 assert.match(sw,/nauvis-shell-v024/);
 assert.match(sw,/'\.\/item-icons\.js','\.\/item-icons\.css'/);
 assert.match(html,/Nauvis Command Center v0\.24/);
 assert.equal((html.match(/<button data-view=/g)||[]).length,5);
});
