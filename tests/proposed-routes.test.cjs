'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../production-effects.js'),{proposalPorts,proposeRoutes,evaluateProposalRoutes}=require('../logistics.js'),{buildProject}=require('../projects.js');
const item=(id,needed,fluid=false)=>({id,name:id,needed,fluid});
const model={id:'final',rate:600,machine:.75,belt:900,source:'bus',baselineMachines:12,roundedTotal:10,reused:[{key:'a',rate:300}],reuseClaims:[{key:'machine:a|id:stable',item:'a',rate:300}],entries:[
 {key:'a',name:'A',kind:'asm',count:3,depth:0,needed:300,ingredients:[item('ore',600)]},
 {key:'b',name:'B',kind:'asm',count:3,depth:1,needed:300,ingredients:[item('a',300)]},
 {key:'final',name:'Final',kind:'asm',count:4,depth:2,needed:600,ingredients:[item('a',300),item('b',300),item('water',50,true)]}
],external:[{key:'ore',name:'Ore',needed:600,isFluid:false},{key:'water',name:'Water',needed:50,isFluid:true}]};
function recommended(m=model){let n=0;return proposeRoutes(m,'yellow',()=>String(++n))}
test('recommendations distribute existing and proposed supply once, ignore fluids explicitly',()=>{
 const routes=recommended(),report=evaluateProposalRoutes(model,routes);
 assert.equal(report.supportedTarget,600);assert.equal(report.short.length,0);assert.equal(report.stale.length,0);
 assert.equal(report.ports.fluids.length,1);
 assert.equal(routes.filter(r=>r.from==='actual:machine:a|id:stable').reduce((n,r)=>n+r.rate,0),300);
 assert.equal(routes.filter(r=>r.from==='stage:a').reduce((n,r)=>n+r.rate,0),300);
 assert.equal(routes.find(r=>r.item==='ore').lanes,2);
 assert.equal(routes.find(r=>r.item==='a').lanes,1);
});
test('belt bottleneck propagates upstream starvation into final production',()=>{
 const routes=recommended().map(r=>r.item==='ore'?{...r,lanes:1}:r),report=evaluateProposalRoutes(model,routes);
 assert.equal(report.supportedTarget,450);
 assert.ok(report.short.some(x=>x.item==='ore'&&x.short===150));
 assert.ok(report.short.some(x=>x.to==='final'&&x.item==='b'&&x.short===75));
});
test('removed reuse source produces stale route, not phantom supply',()=>{
 const changed={...model,reuseClaims:[]},report=evaluateProposalRoutes(changed,recommended());
 assert.equal(report.stale.length,1);assert.equal(report.supportedTarget,0);
});
test('oversubscribed source is capped once in dependency order',()=>{
 const routes=recommended().filter(r=>r.from!=='actual:machine:a|id:stable');
 routes.push({id:'extra',from:'stage:a',to:'final',item:'a',tier:'yellow',belts:1,lanes:2,rate:300});
 const report=evaluateProposalRoutes(model,routes);
 assert.equal(report.flow.filter(r=>r.from==='stage:a').reduce((n,r)=>n+r.delivered,0),300);
 assert.equal(report.supportedTarget,0);
});
test('drafts and saved construction plans preserve independent proposed connections',()=>{
 const routes=recommended(),draft={id:'d',name:'Draft',goal:model,reuseKeys:['machine:a|id:stable'],routes};
 const stored=E.saveLogisticsDraft([],draft);
 assert.deepEqual(stored[0].routes,routes);assert.equal(stored[0].goal.entries,undefined);
 assert.throws(()=>E.normalizeProposalRoutes([...routes,routes[0]]));assert.throws(()=>E.normalizeProposalRoutes([{...routes[0],lanes:3}]));
 const p=buildProject('P',{...model,proposedRoutes:routes},'p','2026-11-24');
 assert.deepEqual(p.design.analysis.proposedRoutes,routes);
 assert.equal(p.tasks.reduce((n,t)=>n+t.built,0),0);
});
test('editor connects only proposals and keeps actual network separate',()=>{
 const js=require('node:fs').readFileSync(require('node:path').join(__dirname,'../logistics.js'),'utf8');
 assert.match(js,/data-proposal-action="recommend"/);assert.match(js,/data-proposal-target/);
 assert.match(js,/if\(proposedRoutes.length\)result.proposedRoutes=/);
 assert.match(js,/function actualNetwork\(\)\{return networkResults\(scenarioGraph\(data\(\),false\),lookup\)\}/);
});
