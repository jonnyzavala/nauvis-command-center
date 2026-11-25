'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),E=require('../production-effects.js'),{reuseCandidates}=require('../logistics.js'),{applyBuildDelta,validateReuseClaims}=require('../projects.js'),{applyQuickEdit}=require('../quick-add.js');
const old={recipe:'a',count:2,tier:.75,destination:'Available for new build'},R={a:['A',1,1,'asm',{}]},key='machine:a|Available for new build',rate=(_,r,row)=>({output:row.count*45}),graph={nodes:[],edges:[]};
test('legacy route keys survive migration and allocation edits',()=>{
 const rows=E.materializeMachineKeys([old,{...old,count:3}]);assert.equal(E.machineKey(rows[0]),key);assert.equal(E.machineKey(rows[1]),key);
 assert.equal(E.machineKey({...rows[0],destination:'Main bus'}),key);assert.equal(E.machineKey({...rows[0],count:4}),key);
 assert.equal(reuseCandidates(rows,R,graph,new Map(),rate)[0].rate,225);
 assert.equal(reuseCandidates([{...rows[0],destination:'Main bus'},rows[1]],R,graph,new Map(),rate).length,0);
 assert.equal(reuseCandidates(rows,R,graph,new Map(),rate,new Map([[key,60]]))[0].rate,165);
});
test('new identical lines have independent identities and commitments',()=>{
 const a={...old,entityKey:E.newMachineKey('a','one')},b={...old,entityKey:E.newMachineKey('a','two')};
 const candidates=reuseCandidates([a,b],R,graph,new Map(),rate,new Map([[a.entityKey,30]]));
 assert.deepEqual(candidates.map(x=>x.rate),[60,90]);
 assert.equal(reuseCandidates([b],R,graph,new Map(),rate,new Map([[a.entityKey,30]]))[0].rate,90);
 assert.doesNotThrow(()=>validateReuseClaims({reused:[{key:'a',rate:60}]},[{key:a.entityKey,item:'a',rate:60}]));
});
test('Quick Change preserves identity during allocation edits and replaces identity with a new recipe',()=>{
 const ctx={machineRecipes:['a','b'],destinations:['Main bus','Available for new build'],recipeKinds:{a:'asm',b:'asm'},newMachineKey:r=>E.newMachineKey(r,'new')};
 const state={setup:{machines:E.materializeMachineKeys([old]),feeds:[]},checked:{}};
 const edit=(s,recipe,destination,target='0')=>applyQuickEdit(s,{kind:'machine',target,recipe,destination,count:2,tier:.75},ctx).state;
 const a=edit(state,'a','Main bus');assert.equal(a.setup.machines[0].entityKey,key);
 const b=edit(a,'b','Main bus');assert.equal(b.setup.machines[0].entityKey,'machine:b|id:new');
 assert.equal(edit(a,'a','Main bus','new').setup.machines[1].entityKey,'machine:a|id:new');
});
test('Construction task identity survives reversal to zero and rebuilding',()=>{
 const p={id:'p',goal:{machine:.75},tasks:[{recipe:'a',kind:'asm',planned:2,built:0}]};
 const one=applyBuildDelta(p,'a',1,[]),zero=applyBuildDelta(one.project,'a',-1,one.rows),again=applyBuildDelta(zero.project,'a',1,zero.rows);
 assert.equal(one.rows[0].entityKey,again.rows[0].entityKey);assert.equal(zero.rows.length,0);
});
test('route-linked available groups cannot be offered again after destination changes',()=>{
 const a={...old,entityKey:E.newMachineKey('a','one')},g={nodes:[{id:'s',kind:'source',item:'a',link:a.entityKey},{id:'d',kind:'destination',item:'a'}],edges:[{id:'e',from:'s',to:'d',tier:'yellow',belts:1}]};
 assert.equal(reuseCandidates([a],R,g,new Map(),rate).length,0);
});
