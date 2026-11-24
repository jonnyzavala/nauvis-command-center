'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalize,connect,analyze}=require('../logistics.js'),{resetSnapshotData}=require('../factory-reset.js');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const node=(id,kind,extra={})=>({id,kind,item:'iron-plate',label:id,...extra});
const edge=(id,from,to,belts=1,weight='',tier='red')=>({id,from,to,belts,tier,weight});
function example(){
 let g={nodes:[node('iron','source',{amount:4,tier:'red'}),node('bus','destination'),node('steel','destination'),node('split','splitter'),node('mall','destination'),node('circuits','destination')],edges:[]};
 for(const e of [edge('a','iron','bus',2),edge('b','iron','steel'),edge('c','iron','split'),edge('d','split','mall'),edge('e','split','circuits')])g=connect(g,e);
 return g;
}
test('four red belts split into two, one, and two half-belt equivalents without duplicating supply',()=>{
 const g=example(),r=analyze(g);
 assert.equal(r.nodes.iron.supply,7200);assert.equal(r.nodes.bus.received,3600);assert.equal(r.nodes.steel.received,1800);assert.equal(r.nodes.mall.received,900);assert.equal(r.nodes.circuits.received,900);
 assert.equal(r.nodes.iron.remaining,0);assert.equal(r.nodes.split.remaining,0);
 assert.equal(r.routes.d.capacity,1800);assert.equal(r.routes.d.delivered,900);
});
test('explicit zero weight means no flow, blank means auto; bottlenecks leave unrouted supply',()=>{
 const g=example();g.edges[3].weight=0;g.edges[4].weight=1;
 const a=analyze(g);assert.equal(a.nodes.mall.received,0);assert.equal(a.nodes.circuits.received,1800);
 g.edges[4].tier='yellow';const b=analyze(g);assert.equal(b.nodes.circuits.received,900);assert.equal(b.nodes.split.remaining,900);
});
test('merger conserves supply and limits outgoing belt capacity',()=>{
 let g={nodes:[node('a','source',{amount:1,tier:'red'}),node('b','source',{amount:1,tier:'yellow'}),node('m','merger'),node('d','destination',{amount:2,tier:'red'})],edges:[]};
 for(const e of [edge('1','a','m'),edge('2','b','m'),edge('3','m','d')])g=connect(g,e);
 const r=analyze(g);assert.equal(r.nodes.m.received,2700);assert.equal(r.nodes.d.received,1800);assert.equal(r.nodes.m.remaining,900);assert.equal(r.nodes.d.margin,-1800);
});
test('invalid direction, duplicate edges, different items and cycles rejected',()=>{
 const g={nodes:[node('s','source'),node('a','splitter'),node('b','merger'),node('d','destination'),node('c','destination',{item:'copper-plate'})],edges:[]};
 let next=connect(g,edge('1','a','b'));assert.throws(()=>connect(next,edge('2','b','a')),/Circular/);
 assert.throws(()=>connect(next,edge('3','a','b')),/already/);assert.throws(()=>connect(g,edge('4','d','a')));assert.throws(()=>connect(g,edge('5','a','s')));assert.throws(()=>connect(g,edge('6','s','c')));
 assert.throws(()=>connect(g,edge('7','s','d',.5)));
});
test('linked sources and demands are recalculated and duplicate sources cannot create extra supply',()=>{
 const g={nodes:[node('s','source',{link:'machine:a'}),node('s2','source',{link:'machine:a'}),node('d','destination',{link:'machine:b'})],edges:[edge('1','s','d'),edge('2','s2','d')]};
 const r=analyze(g,n=>({rate:n.kind==='source'?600:900}));assert.equal(r.nodes.d.received,600);assert.equal(r.nodes.d.margin,-300);assert.equal(r.nodes.s2.supply,0);assert.equal(r.nodes.s2.missing,true);
 const missing=analyze(g);assert.equal(missing.nodes.d.demand,null);assert.equal(missing.nodes.s.supply,0);
});
test('legacy snapshots can omit logistics and Fresh Start removes routing without touching guide',()=>{
 assert.deepEqual(normalize(undefined),{nodes:[],edges:[]});
 const snap={setup:{logistics:example(),smelt:{beltTier:1800},oil:{}},plan:{},guide:{goal:'advanced-circuit'}};
 const next=resetSnapshotData(snap);assert.equal(next.setup.logistics,undefined);assert.deepEqual(next.guide,snap.guide);assert.ok(snap.setup.logistics.nodes.length);
});
test('editor is wired into factory modes, snapshot restore and offline shell',()=>{
 const html=read('index.html'),ui=read('workspace-ui.js'),sw=read('service-worker.js'),js=read('logistics.js');
 assert.match(html,/id="logisticsEditor"/);assert.match(ui,/data-factory-target="logistics"/);assert.match(html,/if\(data\.setup\.logistics\)setup\.logistics=data\.setup\.logistics;else delete setup\.logistics/);
 assert.match(js,/setup\.logistics=normalize\(next\);saveSetup\(\)/);
 assert.match(sw,/'\.\/logistics\.js','\.\/logistics\.css'/);assert.match(html,/src="\.\/logistics\.js" defer/);
});

test('six and two yellow belts render eight separate physical routes',()=>{
 const g={nodes:[node('s','source',{amount:8,tier:'yellow'}),node('a','destination'),node('b','destination')],edges:[edge('1','s','a',6,'','yellow'),edge('2','s','b',2,'','yellow')]};
 const result=analyze(g),layout=require('../logistics.js').layoutBelts(g,result.stage);
 assert.deepEqual(layout.routes.map(r=>r.lanes.length),[6,2]);
 assert.equal(new Set(layout.routes.flatMap(r=>r.lanes.map(l=>l[0].x))).size,8);
 assert.equal(result.nodes.a.received,5400);assert.equal(result.nodes.b.received,1800);
});
test('gross and post-steel iron are mutually exclusive sources',()=>{
 const g={nodes:[node('s','source',{link:'smelt:iron-gross'}),node('s2','source',{link:'smelt:iron-plate'})],edges:[]};
 const a=analyze(g,()=>({rate:7200}));assert.equal(a.nodes.s.supply,7200);assert.equal(a.nodes.s2.supply,0);assert.equal(a.nodes.s2.missing,true);
});
test('touch-first editor has a unified inventory picker, belt slider, split slider and output ports',()=>{
 const js=read('logistics.js'),css=read('logistics.css');
 for(const token of ['data-log-port','data-physical-belt','data-log-slider','data-log-split','data-log-link','smelt:steel-input','steelCapMachines*5','setPointerCapture','elementFromPoint'])assert.ok(js.includes(token),token);
 assert.match(css,/touch-action:none/);
});

test('input starvation propagates across resource networks, without changing rated demand',()=>{
 const {networkResults}=require('../logistics.js');
 const g={nodes:[{id:'iron',kind:'source',item:'iron-plate',amount:1,tier:'yellow'},{id:'steel-in',kind:'destination',item:'iron-plate',link:'smelt:steel-input'},{id:'steel-out',kind:'source',item:'steel-plate',link:'smelt:steel-plate'},{id:'sink',kind:'destination',item:'steel-plate',amount:.4,tier:'yellow'}],edges:[{id:'a',from:'iron',to:'steel-in',belts:3,tier:'yellow'},{id:'b',from:'steel-out',to:'sink',belts:1,tier:'yellow'}]};
 const lookup=n=>({rate:n.kind==='source'?360:1800}),result=networkResults(g,lookup);
 assert.equal(result.converged,true);assert.equal(result.results.get('iron-plate').nodes['steel-in'].demand,1800);assert.equal(result.results.get('steel-plate').nodes['steel-out'].supply,180);
 g.nodes[0].amount=2;assert.equal(networkResults(g,lookup).results.get('steel-plate').nodes['steel-out'].supply,360);
});
test('diagnostics distinguish incoming transport limits from insufficient connected production',()=>{
 const {diagnostics,analyze}=require('../logistics.js');
 const g={nodes:[{id:'s',kind:'source',item:'iron-plate',amount:4,tier:'yellow'},{id:'d',kind:'destination',item:'iron-plate',amount:2,tier:'yellow'}],edges:[{id:'r',from:'s',to:'d',belts:1,tier:'yellow'}]};
 let a=diagnostics(g,analyze(g),()=>null);
 assert.equal(a.productionGap,0);assert.equal(a.findings[0].short,900);assert.ok(a.findings[0].actions.some(x=>x.type==='transport'&&x.extra===1));assert.ok(a.findings[0].actions.some(x=>x.type==='test-belt'&&x.gain===900));
 g.nodes[0].amount=1;g.edges[0].belts=2;a=diagnostics(g,analyze(g),()=>null);assert.equal(a.productionGap,900);assert.ok(a.findings[0].actions.some(x=>x.type==='source'));assert.ok(!a.findings[0].actions.some(x=>x.type==='transport'));
});
test('redistribution recommendation must preserve other known supported demand',()=>{
 const {diagnostics,analyze}=require('../logistics.js');
 const g={nodes:[{id:'s',kind:'source',item:'iron-plate',amount:2,tier:'yellow'},{id:'a',kind:'destination',item:'iron-plate',amount:1.5,tier:'yellow'},{id:'b',kind:'destination',item:'iron-plate',amount:1,tier:'yellow'}],edges:[{id:'r',from:'s',to:'a',belts:2,tier:'yellow',weight:1},{id:'t',from:'s',to:'b',belts:2,tier:'yellow',weight:1}]};
 const a=diagnostics(g,analyze(g),()=>null);assert.equal(a.findings[0].short,450);assert.ok(!a.findings[0].actions.some(x=>x.type==='test-share'));
});
test('diagnostic UI offers explicit blueprint handoff without mutating inventory',()=>{
 const js=read('logistics.js');
 assert.match(js,/data-log-plan/);assert.match(js,/NauvisRatioExplorer\?\.setGoal/);assert.match(js,/activateWorkspace\('build',true\)/);
});

test('queued demand is excluded from actual network by default without deleting it',()=>{
 const {scenarioGraph}=require('../logistics.js');
 const g={nodes:[node('s','source'),node('d','destination',{link:'project:p1'})],edges:[edge('e','s','d')]};
 assert.equal(scenarioGraph(g).nodes.length,1);assert.equal(scenarioGraph(g).edges.length,0);
 assert.equal(scenarioGraph(g,true).edges.length,1);assert.equal(g.edges.length,1);
});

test('entity projection combines steel input and output without changing underlying saved routes',()=>{
 const {entityProjection}=require('../logistics.js');
 const g={nodes:[{id:'i',kind:'destination',item:'iron-plate',link:'smelt:steel-input'},{id:'o',kind:'source',item:'steel-plate',link:'smelt:steel-plate'}],edges:[]},before=JSON.stringify(g);
 const p=entityProjection(g,[{key:'smelt:steel',label:'48 steel furnaces',ports:[{kind:'destination',item:'iron-plate',link:'smelt:steel-input',rate:1800},{kind:'source',item:'steel-plate',link:'smelt:steel-plate',rate:360}]}]);
 assert.equal(p.entities.length,1);assert.equal(p.entities[0].ports.length,2);assert.equal(p.entities[0].ports[0].nodeId,'i');assert.equal(p.entities[0].ports[1].nodeId,'o');assert.equal(JSON.stringify(g),before);
});
test('entity ports are materialized only when needed and do not duplicate linked endpoints',()=>{
 const {ensureEntityPort,analyze}=require('../logistics.js'),g={nodes:[],edges:[]},entity={label:'48 steel furnaces'},port={kind:'destination',item:'iron-plate',link:'smelt:steel-input'};
 assert.equal(ensureEntityPort(g,port,entity,()=> 'input'),'input');assert.equal(ensureEntityPort(g,port,entity,()=> 'duplicate'),'input');assert.equal(g.nodes.length,1);
 assert.equal(analyze(g,()=>({rate:1800})).nodes.input.demand,null);
 g.nodes.push({id:'s',kind:'source',item:'iron-plate',amount:1,tier:'yellow'});g.edges.push({id:'r',from:'s',to:'input',tier:'yellow',belts:1});
 assert.equal(analyze(g,()=>({rate:1800})).nodes.input.demand,1800);
});
test('production network and resource detail share saved endpoints and edge identities',()=>{
 const {entityProjection}=require('../logistics.js');
 const g={nodes:[{id:'s',kind:'source',item:'iron-plate',link:'smelt:iron-gross'},{id:'d',kind:'destination',item:'iron-plate',link:'smelt:steel-input'}],edges:[{id:'r',from:'s',to:'d',tier:'red',belts:2}]};
 const p=entityProjection(g);assert.equal(p.edges[0].id,'r');assert.equal(p.edges[0].from,'smelt:iron');assert.equal(p.edges[0].to,'smelt:steel');assert.equal(p.edges[0].sourceEndpoint,'s');assert.equal(p.edges[0].belts,2);
});
