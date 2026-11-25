'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {constructionMaterials,expandConstructionMaterials,constructionSupply}=require('../projects.js');
const R=vm.runInNewContext('('+fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)[1]+')');
const lookup=(rows,k)=>rows.find(x=>x.key===k);
test('one assembler 2 expands shared circuits, gears and assembler 1 without double counting',()=>{
 const p={goal:{machine:.75},tasks:[{kind:'asm',planned:1,built:0}]};
 const bill=constructionMaterials(p,R),x=expandConstructionMaterials(bill.machines,R);
 assert.equal(lookup(bill.ingredients,'assembling-machine-1').quantity,1);
 assert.equal(lookup(x.stages,'electronic-circuit').quantity,6);
 assert.equal(lookup(x.stages,'copper-cable').quantity,18);
 assert.equal(lookup(x.external,'iron-ore').quantity,45);
 assert.equal(lookup(x.external,'copper-ore').quantity,9);
 assert.equal(x.external.length,2);
});
test('batch rounding occurs once after merging branches and exposes surplus',()=>{
 const recipes={a:['A',1,1,'asm',{c:1}],b:['B',1,1,'asm',{c:2}],c:['C',1,2,'asm',{'iron-ore':3}]};
 const x=expandConstructionMaterials([{key:'a',remaining:1},{key:'b',remaining:1}],recipes);
 assert.deepEqual(lookup(x.stages,'c'),{key:'c',quantity:3,crafts:2,produced:4,surplus:1});
 assert.equal(lookup(x.external,'iron-ore').quantity,6);
});
test('one type used as a finished item and an ingredient aggregates both needs',()=>{
 const x=expandConstructionMaterials([{key:'assembling-machine-1',remaining:1},{key:'assembling-machine-2',remaining:1}],R);
 assert.equal(lookup(x.stages,'assembling-machine-1').quantity,2);
});
test('all supported actual machine types fully expand with correct oil boundaries',()=>{
 for(const key of ['assembling-machine-2','assembling-machine-3','chemical-plant','steel-furnace','electric-furnace']){
  const x=expandConstructionMaterials([{key,remaining:13}],R);
  assert.equal(lookup(x.stages,key).quantity,13);
  assert.ok(x.external.length>0);
  assert.ok(x.external.every(r=>r.reason==='boundary'),key+': '+JSON.stringify(x.external));
  if(key==='electric-furnace'||key==='assembling-machine-3')assert.ok(lookup(x.external,'petroleum-gas'));
 }
});
test('zero remaining machines, missing ingredients, and cycles are explicit',()=>{
 assert.deepEqual(expandConstructionMaterials([{key:'electric-furnace',remaining:0}],R),{stages:[],external:[]});
 assert.equal(expandConstructionMaterials([{key:'not-modeled',remaining:1}],R).external[0].reason,'missing-recipe');
 assert.throws(()=>expandConstructionMaterials([{key:'a',remaining:1}],{a:['A',1,1,'asm',{b:1}],b:['B',1,1,'asm',{a:1}]}),/Cyclic/);
 assert.throws(()=>expandConstructionMaterials([{key:'a',remaining:1}],{a:['A',1,0,'asm',{}]}),/Invalid recipe/);
 assert.throws(()=>expandConstructionMaterials([{key:'a',remaining:1.5}],R),/whole number/);
});
test('build progress updates requirements; missing legacy furnace choice is flagged',()=>{
 const p={goal:{machine:.75},tasks:[{kind:'asm',planned:5,built:4},{kind:'furnace',planned:1,built:0}]};
 const bill=constructionMaterials(p,R);assert.equal(bill.machines[0].remaining,1);assert.ok(bill.unknown.length);
 const completed=constructionMaterials({...p,tasks:p.tasks.map(t=>({...t,built:t.planned}))},R);
 assert.equal(completed.ingredients.length,0);assert.equal(completed.unknown.length,0);
});
test('available production is a conditional independent reference, never inventory subtraction',()=>{
 const rows=[{key:'iron-plate',quantity:90},{key:'steel-plate',quantity:30},{key:'done',quantity:0}],before=JSON.stringify(rows);
 const x=constructionSupply(rows,[{item:'iron-plate',rate:30},{item:'iron-plate',rate:15},{item:'steel-plate',rate:0}]);
 assert.deepEqual(x,[{key:'iron-plate',quantity:90,rate:45,minutes:2},{key:'steel-plate',quantity:30,rate:0,minutes:null}]);assert.equal(JSON.stringify(rows),before);
});
