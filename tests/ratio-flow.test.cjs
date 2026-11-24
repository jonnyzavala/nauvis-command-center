// Run: node --test tests/*.test.cjs
// Visual chain is a projection of the existing recipe engine: no duplicate math.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ratioSource=fs.readFileSync(path.join(root,'recipe-ratios.js'),'utf8');
const flowSource=fs.readFileSync(path.join(root,'ratio-flow.js'),'utf8');
const style=fs.readFileSync(path.join(root,'ratio-flow.css'),'utf8');
const worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
const model=html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1];
assert.ok(model,'Live recipe data could not be parsed');
const recipes=vm.runInNewContext('('+model+')');
const fromSet=name=>{
 const m=html.match(new RegExp('const '+name+'=new Set\\((\\[[^\\]]*\\])\\)'));
 assert.ok(m,'Expected set '+name);
 return new Set(vm.runInNewContext(m[1]));
};
const ctx={stopBus:fromSet('STOP_BUS'),stopRaw:fromSet('STOP_RAW'),fluids:fromSet('FLUID'),names:{}};
const {analyzeRecipeRatios}=require('../recipe-ratios.js');
const {buildFlowGraph}=require('../ratio-flow.js');
const calc=(id='advanced-circuit',rate=90,source='bus')=>analyzeRecipeRatios(
 recipes,{id,rate,machine:.75,source,belt:900},ctx
);
test('machine blocks use the established counts for 90 red circuits per minute',()=>{
 const result=calc(),graph=buildFlowGraph(result);
 assert.equal(result.roundedTotal,19);
 assert.deepEqual(graph.nodes.filter(x=>x.type==='machine').map(x=>[x.recipe,x.count]),[
  ['copper-cable',5],['electronic-circuit',2],['advanced-circuit',12]
 ]);
 assert.equal(graph.nodes.find(n=>n.recipe==='copper-plate').type,'supply');
 assert.equal(graph.nodes.find(n=>n.recipe==='advanced-circuit').final,true);
});
test('split copper cable demand has two distinct and correct labeled branches',()=>{
 const graph=buildFlowGraph(calc());
 const cable=graph.edges.filter(e=>e.from==='m:copper-cable');
 assert.deepEqual(cable.map(e=>[e.to,e.rate]),[
  ['m:electronic-circuit',540],
  ['m:advanced-circuit',360]
 ]);
 const copper=graph.edges.find(e=>e.from==='s:copper-plate'&&e.to==='m:copper-cable');
 assert.equal(copper.rate,450);
});
test('stages order upstream producers to the final output, even with shared inputs',()=>{
 const graph=buildFlowGraph(calc());
 const node=id=>graph.nodes.find(n=>n.key===id);
 for(const edge of graph.edges)assert.ok(node(edge.from).stage<node(edge.to).stage,
  edge.from+' must precede '+edge.to);
 assert.equal(node('m:advanced-circuit').stage,graph.maxLevel);
 assert.equal(node('s:copper-plate').stage,0);
});
test('all 182 recipes produce acyclic nodes and edges in both input modes',()=>{
 assert.equal(Object.keys(recipes).length,182);
 for(const source of ['bus','raw'])for(const id of Object.keys(recipes)){
  const result=calc(id,30,source),graph=buildFlowGraph(result);
  const allIds=new Set(graph.nodes.map(n=>n.key));
  assert.equal(allIds.size,graph.nodes.length,id+' duplicated');
  assert.equal(graph.nodes.length,result.entries.length+result.external.length,id);
  assert.equal(graph.columns.flat().length,graph.nodes.length,id+' stage cardinality');
  for(const edge of graph.edges){
   assert.ok(allIds.has(edge.from)&&allIds.has(edge.to),id+' missing endpoint');
   const from=graph.nodes.find(n=>n.key===edge.from).stage;
   const to=graph.nodes.find(n=>n.key===edge.to).stage;
   assert.ok(from<to,id+' non-forward edge');
   assert.ok(edge.rate>=0&&Number.isFinite(edge.rate),id+' non-finite rate');
  }
 }
});
test('zero production does not invent machine counts or chart arrows',()=>{
 const result=calc('advanced-circuit',0);
 const graph=buildFlowGraph(result);
 assert.equal(result.roundedTotal,0);
 assert.equal(graph.nodes.length,0);
 assert.equal(graph.edges.length,0);
});
test('visual interface presents counts before flow and includes Flow/Table toggle',()=>{
 assert.match(flowSource,/Build these machines/);
 assert.match(flowSource,/formatted\(n\.count\)/);
 assert.match(flowSource,/fullLabel\(n\)/);
 assert.match(flowSource,/Flow view/);
 assert.match(flowSource,/Table view/);
 assert.match(flowSource,/Show inputs/);
 assert.match(flowSource,/data-flow-node/);
 assert.match(flowSource,/ratio-flow-junction/);
 assert.match(ratioSource,/data-ratio-flow-root/);
 assert.match(ratioSource,/data-ratio-legacy-table hidden/);
 assert.match(ratioSource,/NauvisRatioFlow\?\.mount/);
});
test('layout stays inside explorer and switches to vertical diagram on iPhone',()=>{
 assert.match(style,/\.ratio-flow-viewport\{/);
 assert.match(style,/max-width:100%;min-width:0;overflow-x:auto/);
 assert.match(style,/@media\(max-width:650px\)\{/);
 assert.match(style,/\.ratio-flow-columns\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(style,/\.ratio-flow-viewport\{overflow-x:hidden\}/);
 assert.match(style,/\.ratio-flow-node-label strong\{font-size:11px\}/);
});
test('version and offline caching include the visual graph without editing cloud sync',()=>{
 assert.match(html,/Nauvis Command Center v0\.45/);
 assert.match(html,/href="\.\/ratio-flow\.css"/);
 assert.match(html,/src="\.\/ratio-flow\.js" defer/);
 assert.match(worker,/nauvis-shell-v045/);
 assert.match(worker,/ratio-flow\.css/);
 assert.match(worker,/ratio-flow\.js/);
 assert.match(html,/sync\/cloud-sync\.js/);
});


test('automatic fit chooses the larger scale and keeps full canvas within phone bounds',()=>{
 const {fitLayout,routeLayout}=require('../ratio-flow.js');
 const graph=buildFlowGraph(calc('processing-unit',30,'raw'));
 const fit=fitLayout(graph.columns,graph.edges,340,550);
 assert.ok(fit.width*fit.scale<=340+1e-8);
 assert.ok(fit.height*fit.scale<=550+1e-8);
 assert.ok(fit.scale>0&&fit.scale<=1);
 for(const v of [true,false]){
  const layout=routeLayout(graph.columns,graph.edges,v);
  assert.ok(fit.scale+1e-10>=Math.min(1,340/layout.width,550/layout.height));
 }
 assert.doesNotMatch(flowSource,/data-flow-zoom|zoomByCard/);
 assert.match(flowSource,/scaledSpace\.style\.height=Math\.ceil\(layout\.height\*layout\.scale\)/);
 assert.match(style,/transform-origin:top left/);
 assert.match(style,/\.ratio-flow-auto \.ratio-flow-node\{position:absolute/);
});
test('all 728 recipe layouts have complete orthogonal connections that never cross a card interior',()=>{
 const {routeLayout}=require('../ratio-flow.js');
 const hits=(a,b,r)=>Math.min(a.x,b.x)<r.x+r.w&&Math.max(a.x,b.x)>r.x&&Math.min(a.y,b.y)<r.y+r.h&&Math.max(a.y,b.y)>r.y;
 let checked=0;
 for(const source of ['bus','raw'])for(const id of Object.keys(recipes)){
  const graph=buildFlowGraph(calc(id,30,source));
  for(const vertical of [true,false]){
   const layout=routeLayout(graph.columns,graph.edges,vertical);
   assert.equal(layout.boxes.length,graph.nodes.length,id);
   assert.equal(layout.routes.length,graph.edges.length,id);
   for(const route of layout.routes){
    for(let i=1;i<route.points.length;i++){
     const a=route.points[i-1],b=route.points[i];
     assert.ok(a.x===b.x||a.y===b.y,id+' non-orthogonal');
     assert.ok(!layout.boxes.some(r=>hits(a,b,r)),id+' line enters a card');
     for(const p of [a,b])assert.ok(p.x>=0&&p.y>=0&&p.x<=layout.width&&p.y<=layout.height,id+' outside canvas');
    }
   }
   checked++;
  }
 }
 assert.equal(checked,728);
});

test('resource outputs have a single shared trunk with explicit split points and no duplicated segments',()=>{
 const {routeLayout,roundedPath}=require('../ratio-flow.js');
 let shared=0;
 for(const source of ['bus','raw'])for(const id of Object.keys(recipes)){
  const graph=buildFlowGraph(calc(id,30,source));
  for(const vertical of [true,false]){
   const layout=routeLayout(graph.columns,graph.edges,vertical);
   assert.equal(layout.bundles.reduce((sum,b)=>sum+b.routes.length,0),graph.edges.length);
   for(const bundle of layout.bundles){
    const terminals=bundle.paths.filter(p=>p.edge).map(p=>p.edge.i).sort((a,b)=>a-b);
    assert.deepEqual(terminals,bundle.routes.map(p=>p.edge.i).sort((a,b)=>a-b));
    const segments=new Set();
    for(const path of bundle.paths)for(let i=1;i<path.points.length;i++){
     const key=[path.points[i-1],path.points[i]].map(p=>p.x+','+p.y).sort().join('|');
     assert.ok(!segments.has(key),'duplicate segment');segments.add(key);
    }
    if(bundle.routes.length>1){
     assert.ok(bundle.junctions.length>0);
     assert.ok(bundle.routes.every(r=>r.points[0].x===bundle.source.x&&r.points[0].y===bundle.source.y));
     shared++;
    }
   }
  }
 }
 assert.ok(shared>1000);
 assert.equal(roundedPath([{x:0,y:0},{x:10,y:0},{x:10,y:10}]),'M0,0 L5,0 Q10,0 10,5 L10,10');
 assert.match(flowSource,/roundedPath\(path\.points,16,obstacles\)/);
 assert.match(flowSource,/ratio-flow-junction/);
});

test('crossing-aware routes improve the blue circuit layout and retain every branch',()=>{
 const {routeLayout,baseRouteLayout,routingScore}=require('../ratio-flow.js');
 const graph=buildFlowGraph(calc('processing-unit',30,'bus'));
 for(const vertical of [true,false]){
  const baseline=baseRouteLayout(graph.columns,graph.edges,vertical);
  const optimized=routeLayout(graph.columns,graph.edges,vertical);
  assert.ok(routingScore(baseline).cost>0);
  assert.equal(routingScore(optimized).cost,0);
  assert.equal(optimized.routes.length,graph.edges.length);
 }
});
test('larger curve radii are reduced near other resource segments',()=>{
 const {roundedPath}=require('../ratio-flow.js');
 const points=[{x:0,y:0},{x:30,y:0},{x:30,y:30}];
 assert.equal(roundedPath(points),'M0,0 L15,0 Q30,0 30,15 L30,30');
 assert.notEqual(roundedPath(points,16,[{a:{x:25,y:3},b:{x:25,y:30}}]),roundedPath(points));
});

test('direct focus and upstream focus select only the intended nodes and edges',()=>{
 const {focusGraph}=require('../ratio-flow.js');
 const edges=[{from:'ore',to:'plate'},{from:'plate',to:'wire'},{from:'wire',to:'green'},{from:'wire',to:'red'},{from:'green',to:'blue'}];
 const direct=focusGraph(edges,'green');
 assert.deepEqual([...direct.nodes].sort(),['blue','green','wire']);
 const upstream=focusGraph(edges,'green',true);
 assert.deepEqual([...upstream.nodes].sort(),['blue','green','ore','plate','wire']);
 assert.equal(upstream.edges.has('wire|red'),false);
 assert.equal(upstream.edges.has('green|blue'),true);
});
test('highlighting a selected consumer does not illuminate unrelated branches of its producer',()=>{
 const {routeLayout,focusGraph,focusBundle}=require('../ratio-flow.js');
 const graph=buildFlowGraph(calc('processing-unit',30,'bus'));
 for(const v of [true,false]){
  const layout=routeLayout(graph.columns,graph.edges,v);
  const focus=focusGraph(graph.edges,'m:electronic-circuit');
  const wire=layout.bundles.find(b=>b.key==='m:copper-cable');
  const lit=focusBundle(wire,focus.edges);
  const terminals=wire.paths.filter(p=>p.edge&&lit.active.has(p));
  assert.deepEqual(terminals.map(p=>p.edge.to),['m:electronic-circuit']);
  assert.ok(wire.paths.some(p=>!p.edge&&lit.active.has(p)));
 }
 assert.match(flowSource,/data-flow-upstream-toggle type="checkbox"/);
 assert.match(flowSource,/markerWidth="5\.6"/);
 assert.match(style,/data-flow-highlight="selected"/);
 assert.match(style,/ratio-link-glow/);
});

test('overview has no forced selection, tap again clears, and unrelated paths return to normal',()=>{
 const {toggleSelection,focusTone,focusGraph}=require('../ratio-flow.js');
 assert.equal(toggleSelection(null,'m:wire'),'m:wire');
 assert.equal(toggleSelection('m:wire','m:wire'),null);
 assert.equal(toggleSelection('m:wire','m:green'),'m:green');
 assert.equal(focusTone(null,false),'normal');
 assert.equal(focusTone('m:wire',true),'active');
 assert.equal(focusTone('m:wire',false),'muted');
 assert.equal(focusGraph([{from:'a',to:'b'}],null,true).edges.size,0);
 assert.doesNotMatch(flowSource,/selectedDefault/);
 assert.match(flowSource,/selected:older\?\.result\?\.id===result\.id/);
 assert.match(flowSource,/toggleSelection\(state\.selected,b\.dataset\.flowNode\)/);
 assert.match(flowSource,/data-flow-input-toggle type="checkbox"/);
 assert.match(flowSource,/data-flow-upstream-toggle type="checkbox"/);
 assert.match(style,/\.ratio-flow-options\{display:flex/);
 assert.match(style,/\.ratio-link\.normal\{stroke-opacity:1/);
});
