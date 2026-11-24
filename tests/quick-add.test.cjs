// Run with: node --test tests/quick-add.test.cjs
// Tests the same inventory updater used by the live Quick Change modal.
'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {applyQuickEdit,tasksFor} = require('../quick-add.js');

const ctx={
 machineRecipes:['advanced-circuit','plastic-bar'],
 feedRecipes:['plastic-bar','coal'],
 destinations:['Main bus','Robot factory','Available for new build'],
 recipeKinds:{'advanced-circuit':'asm','plastic-bar':'chem'},
 recipeNames:{'advanced-circuit':'Advanced circuits','plastic-bar':'Plastic bars'},
 plan:{redBlocks:2}
};
const original=()=>({
 setup:{
  smelt:{ironFurnaces:48,copperFurnaces:24,steelFurnaces:28,ironBelts:1,
   ironToSteel:0,furnaceSpeed:2,beltTier:1800},
  oil:{refineries:12,heavyCrackers:2,lightCrackers:8},
  machines:[],feeds:[]
 },
 checked:{}
});
const machine=(overrides={})=>({
 kind:'machine',target:'new',recipe:'advanced-circuit',count:3,tier:.75,
 destination:'Robot factory',...overrides
});
const belt=(overrides={})=>({
 kind:'belt',target:'new',recipe:'coal',count:2,tier:'yellow',
 destination:'Main bus',...overrides
});

test('adds machines to the actual Existing Factory array without mutating the input',()=>{
 const source=original();
 const result=applyQuickEdit(source,machine(),ctx);
 assert.equal(source.setup.machines.length,0);
 assert.deepEqual(result.state.setup.machines,[{recipe:'advanced-circuit',count:3,tier:.75,destination:'Robot factory'}]);
 assert.match(result.label,/Added/);
});
test('updates an existing line in place without making a duplicate',()=>{
 const source=applyQuickEdit(original(),machine(),ctx).state;
 const result=applyQuickEdit(source,machine({target:'0',count:6,tier:1.25,destination:'Main bus'}),ctx);
 assert.equal(result.state.setup.machines.length,1);
 assert.equal(result.state.setup.machines[0].count,6);
 assert.equal(result.state.setup.machines[0].tier,1.25);
 assert.equal(result.state.setup.machines[0].destination,'Main bus');
});
test('chemical plants do not accept irrelevant assembler-tier assumptions',()=>{
 const result=applyQuickEdit(original(),machine({recipe:'plastic-bar',tier:99}),ctx);
 assert.equal(result.state.setup.machines[0].tier,.75);
});
test('removes a saved machine row without changing the input',()=>{
 const source=applyQuickEdit(original(),machine(),ctx).state;
 const result=applyQuickEdit(source,{kind:'remove-machine',target:'0'},ctx);
 assert.equal(result.state.setup.machines.length,0);
 assert.equal(source.setup.machines.length,1);
});
test('rejects invalid or stale edits before altering data',()=>{
 const source=original();
 for(const edit of [
  machine({count:0}),machine({count:-2}),machine({count:1.5}),
  machine({tier:2}),machine({recipe:'unrecognized'}),
  machine({destination:'not permitted'}),machine({target:'5'})
 ])assert.throws(()=>applyQuickEdit(source,edit,ctx));
 assert.deepEqual(source,original());
});
test('updates furnace counts and belt tiers in existing smelting state',()=>{
 const source=applyQuickEdit(original(),{kind:'smelt',field:'ironFurnaces',value:96},ctx).state;
 const result=applyQuickEdit(source,{kind:'smelt',field:'beltTier',value:2700},ctx).state;
 assert.equal(result.setup.smelt.ironFurnaces,96);
 assert.equal(result.setup.smelt.beltTier,2700);
 assert.throws(()=>applyQuickEdit(result,{kind:'smelt',field:'furnaceSpeed',value:3},ctx));
});
test('updates existing oil refinery and cracking counts',()=>{
 const result=applyQuickEdit(original(),{kind:'oil',field:'heavyCrackers',value:4},ctx);
 assert.equal(result.state.setup.oil.heavyCrackers,4);
});
test('adds, updates, then removes a belt route with no extra supply modeled',()=>{
 const source=applyQuickEdit(original(),belt(),ctx).state;
 const updated=applyQuickEdit(source,belt({target:'0',count:3,tier:'blue'}),ctx).state;
 assert.equal(updated.setup.feeds.length,1);
 assert.deepEqual(updated.setup.feeds[0],{recipe:'coal',count:3,tier:'blue',destination:'Main bus'});
 const removed=applyQuickEdit(updated,{kind:'remove-belt',target:'0'},ctx).state;
 assert.deepEqual(removed.setup.feeds,[]);
});
test('rejects invalid transport details',()=>{
 assert.throws(()=>applyQuickEdit(original(),belt({tier:'invalid'}),ctx));
 assert.throws(()=>applyQuickEdit(original(),belt({count:0}),ctx));
 assert.throws(()=>applyQuickEdit(original(),belt({recipe:'iron-ore'}),ctx));
});
test('progress changes the existing construction checklist only',()=>{
 const source=original();
 const complete=applyQuickEdit(source,{kind:'progress',task:'red1',complete:true},ctx).state;
 assert.equal(complete.checked.red1,true);
 assert.equal(complete.setup.machines.length,0);
 const undone=applyQuickEdit(complete,{kind:'progress',task:'red1',complete:false},ctx).state;
 assert.equal(undone.checked.red1,false);
 assert.throws(()=>applyQuickEdit(source,{kind:'progress',task:'red3',complete:true},ctx));
});
test('construction keys reflect the current plan instead of inventing tasks',()=>{
 assert.deepEqual(tasksFor(ctx.plan).map(x=>x[0]),['red1','red2','blue','greenbus','lds','purple','yellow']);
});
test('snapshots are plain JSON and permit safe equality checks before undo',()=>{
 const before=original();
 const after=applyQuickEdit(before,machine(),ctx).state;
 const restore=JSON.parse(JSON.stringify(before));
 assert.equal(JSON.stringify(after)===JSON.stringify(before),false);
 assert.deepEqual(restore,before);
 assert.equal(before.setup.machines.length,0);
});

test('quick corrections preserve module settings and production entity metadata',()=>{
 const s=original();s.setup.machines=[{recipe:'advanced-circuit',count:3,tier:.75,destination:'Robot factory',moduleType:'efficiency1',moduleCount:2,entityId:'stable'}];
 const next=applyQuickEdit(s,machine({target:'0',count:4}),ctx).state;
 assert.equal(next.setup.machines[0].moduleCount,2);assert.equal(next.setup.machines[0].entityId,'stable');
});
test('construction-linked records cannot be duplicated, removed, or change count or profile via Quick Change',()=>{
 const s=original();s.setup.machines=[{recipe:'advanced-circuit',count:3,tier:.75,destination:'Robot factory',projectId:'p1',projectTask:'advanced-circuit',moduleType:'efficiency1',moduleCount:2}];
 for(const change of [machine({target:'0',count:4}),machine({target:'0',tier:1.25}),machine({target:'0',recipe:'plastic-bar'}),{kind:'remove-machine',target:'0'}])assert.throws(()=>applyQuickEdit(s,change,ctx),/Construction/);
 const n=applyQuickEdit(s,machine({target:'0',destination:'Main bus'}),ctx).state;
 assert.equal(n.setup.machines[0].projectId,'p1');assert.equal(n.setup.machines[0].moduleCount,2);assert.equal(n.setup.machines[0].destination,'Main bus');
});
