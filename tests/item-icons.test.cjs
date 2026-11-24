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

test('all 182 modelable recipe IDs render original icon glyphs',()=>{
 assert.equal(Object.keys(R).length,182);
 for(const id of Object.keys(R)){
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
 // The standard SVG XML namespace is an identifier, not an image fetch.
 const outOfBand=icons.replaceAll('http://www.w3.org/2000/svg','');
 assert.doesNotMatch(outOfBand,/(?:<img\b|https?:\/\/|fetch\(|\.png\b|\.webp\b|\.jpg\b|@import\b)/i);
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
 assert.match(quick,/\$\('quickItemPreview'\)\.innerHTML/);
 assert.match(projects,/setup\.machines=change\.rows/);
});

test('Factory, Balance and recipe picker show text alongside decorative icons',()=>{
 assert.match(html,/itemIcon\(row\.recipe,30\)/);
 assert.match(html,/itemIcon\(r\.id,29\)/);
 assert.match(html,/itemIcon\(x\.id,35\)/);
 assert.match(html,/escapeHTML\(nameOf\(r\.id\)\)/);
 assert.match(html,/id="setupMachineRows"/);
});

test('four tabs have a warm-to-purple-to-blue spectrum and teal Construction mode',()=>{
 const uiCSS=read('workspace-v025.css');
 const nav=html.match(/<nav class="nav"[\s\S]*?<\/nav>/)?.[0]||'';
 assert.deepEqual([...nav.matchAll(/<button data-view="([^"]+)"/g)].map(x=>x[1]),
  ['learn','setup','build']);
 const expected=[
  ['guide','#eec277','learn'],['factory','#ed91aa','setup'],
  ['balance','#bba5e5','balance'],['planner','#65b5ff','build'],
  ['projects','#6ce0d1','factory']
 ];
 for(const [name,color,view] of expected){
  assert.ok(uiCSS.includes('--nauvis-'+name+':'+color),name+' palette token');
  assert.ok(uiCSS.includes('body[data-workspace="'+view+'"]{'),name+' workspace');
 }
 assert.match(uiCSS,/body\[data-workspace="factory"\] \.nav button\[data-view="build"\]/);
 assert.match(uiCSS,/--tab-next:var\(--nauvis-projects\)/);
 assert.match(uiCSS,/\.plan-build-switch/);
 assert.match(uiCSS,/button\[data-plan-target="build"\] \.plan-switch-light/);
 assert.match(uiCSS,/button\[data-plan-target="factory"\] \.plan-switch-light/);
 assert.match(projectsCSS,/\.command-chrome \.nav-track>button::after/);
 assert.ok(html.indexOf('href="./projects.css"')<html.indexOf('href="./workspace-v025.css"'));
});

test('responsive gradient paints each real navigation segment',()=>{
 const uiCSS=read('workspace-v025.css');
 for(const name of ['learn','setup','build'])
  assert.ok(uiCSS.includes('.nav button[data-view="'+name+'"]'),name);
 assert.match(uiCSS,/\.command-chrome \.nav-track>button/);
 assert.match(uiCSS,/@media\(max-width:430px\)/);
 assert.match(projectsCSS,/\.command-chrome \.nav-track::after\{display:none\}/);
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
 assert.match(sw,/nauvis-shell-v033/);
 assert.match(sw,/'\.\/item-icons\.js','\.\/item-icons\.css'/);
 assert.match(html,/Nauvis Command Center v0\.33/);
 assert.equal((html.match(/<button data-view=/g)||[]).length,3);
});

test('every modeled item has an explicit visual identity with no duplicate artwork',()=>{
 const {glyph,color}=require('../item-icons.js');
 const ids=[...new Set([...Object.keys(R),...Object.values(R).flatMap(x=>Object.keys(x[4]))])];
 assert.equal(ids.length,202);
 const drawings=new Set();
 for(const id of ids){
  assert.ok(Object.hasOwn(specs,id),id);
  const drawing=glyph(id);
  assert.ok(drawing.length>30,id);
  assert.ok(!drawings.has(drawing),'duplicate drawing: '+id);
  drawings.add(drawing);
  assert.match(color(id),/^#[0-9a-f]{6}$/i,id);
  assert.ok(item(id).includes('--item-tone:'+color(id)),id);
 }
 assert.equal(color('copper-cable'),'#eec277');
 assert.equal(color('electronic-circuit'),'#79d0ad');
 assert.equal(color('advanced-circuit'),'#f18b86');
 assert.equal(color('processing-unit'),'#82bdf0');
 assert.match(html,/window\.NauvisIcons\?\.color\?\.\(id\)/);
 assert.match(flow,/root\.NauvisIcons\?\.color\?\.\(node\.recipe\)/);
});
