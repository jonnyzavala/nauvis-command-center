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
test('all 33 recipes produce acyclic nodes and edges in both input modes',()=>{
 assert.equal(Object.keys(recipes).length,33);
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
 assert.match(flowSource,/ratio-link-text/);
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
 assert.match(html,/Nauvis Command Center v0\.25/);
 assert.match(html,/href="\.\/ratio-flow\.css"/);
 assert.match(html,/src="\.\/ratio-flow\.js" defer/);
 assert.match(worker,/nauvis-shell-v025/);
 assert.match(worker,/ratio-flow\.css/);
 assert.match(worker,/ratio-flow\.js/);
 assert.match(html,/sync\/cloud-sync\.js/);
});
