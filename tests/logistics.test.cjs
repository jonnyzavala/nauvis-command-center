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
