// Run with: node --test tests/*.test.cjs
// Uses the LIVE recipe table from index.html to catch changes to engine inputs.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {analyzeRecipeRatios}=require('../recipe-ratios.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const modelText=html.match(/const R=(\{[\s\S]*?\});\nconst STOP_BUS/)?.[1];
assert.ok(modelText,'Unable to extract the live recipe table from the app');
const R=vm.runInNewContext('('+modelText+')');
const setFrom=name=>{
 const match=html.match(new RegExp('const '+name+'=new Set\\((\\[[^\\]]*\\])\\)'));
 assert.ok(match,'Missing live '+name+' definition');
 return new Set(vm.runInNewContext(match[1]));
};
const ctx={
 stopBus:setFrom('STOP_BUS'),stopRaw:setFrom('STOP_RAW'),fluids:setFrom('FLUID'),
 names:{'iron-ore':'Iron ore','copper-ore':'Copper ore','coal':'Coal','water':'Water'}
};
const run=(id='advanced-circuit',rate=90,machine=.75,source='bus',belt=900)=>
 analyzeRecipeRatios(R,{id,rate,machine,source,belt},ctx);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,actual+' != '+expected);

test('33 known base recipes remain available to the ratio explorer',()=>{
 assert.equal(Object.keys(R).length,33);
 for(const id of Object.keys(R)){
   const result=run(id,30);
   assert.ok(result.entries.length>=1,id);
   assert.ok(result.roundedTotal>0,id);
 }
});
test('90 red circuits/min: exactly 5 cable, 2 green circuits and 12 reds',()=>{
 const result=run();
 assert.deepEqual(result.entries.map(x=>[x.key,x.count]),[
  ['copper-cable',5],['electronic-circuit',2],['advanced-circuit',12]
 ]);
 assert.equal(result.roundedTotal,19);
 close(result.exactTotal,19);
 assert.equal(result.external.find(x=>x.key==='plastic-bar')?.needed,180);
 assert.equal(result.external.find(x=>x.key==='iron-plate')?.needed,180);
 assert.equal(result.external.find(x=>x.key==='copper-plate')?.needed,450);
});
test('aggregates copper cable for both red circuits and their green circuits before rounding',()=>{
 const result=run();
 const cable=result.entries.find(x=>x.key==='copper-cable');
 const green=result.entries.find(x=>x.key==='electronic-circuit');
 assert.equal(cable.needed,900);
 assert.equal(green.needed,180);
 assert.equal(cable.perMachine,180);
 assert.equal(green.perMachine,90);
 assert.equal(result.entries.find(x=>x.key==='advanced-circuit').perMachine,7.5);
});
test('small goals expose exact machine equivalents before per-recipe integer rounding',()=>{
 const result=run('advanced-circuit',30);
 assert.equal(result.entries.find(x=>x.key==='advanced-circuit')?.count,4);
 assert.ok(result.exactTotal<result.roundedTotal);
 assert.ok(result.entries.some(x=>x.exact!==x.count));
});
test('assembler tiers alter production rate, but not fixed furnace/chemical speeds',()=>{
 close(run('advanced-circuit',90,.5).entries.at(-1).perMachine,5);
 close(run('advanced-circuit',90,.75).entries.at(-1).perMachine,7.5);
 close(run('advanced-circuit',90,1.25).entries.at(-1).perMachine,12.5);
 close(run('plastic-bar',120,.5).entries.at(-1).perMachine,120);
 close(run('plastic-bar',120,1.25).entries.at(-1).perMachine,120);
});
test('raw mode includes modeled smelting and chemistry, unlike bus-fed mode',()=>{
 const bus=run('advanced-circuit',90,.75,'bus');
 const raw=run('advanced-circuit',90,.75,'raw');
 assert.ok(raw.entries.length>bus.entries.length);
 assert.ok(raw.entries.some(x=>x.kind==='furnace'));
 assert.ok(raw.entries.some(x=>x.key==='plastic-bar'));
 assert.ok(!bus.entries.some(x=>x.kind==='furnace'));
 assert.ok(!bus.entries.some(x=>x.key==='plastic-bar'));
});
test('external ingredients are not double counted and solids have explicit belt counts',()=>{
 const r=run();
 assert.equal(r.external.find(x=>x.key==='plastic-bar').belts,1);
 assert.equal(r.outputStream.belts,1);
 const cable=run('copper-cable',1800,.75,'bus',900);
 assert.equal(cable.outputStream.belts,2);
});
test('fluids are shown as pipes, not fake belt requirements',()=>{
 const acid=run('sulfuric-acid',30);
 assert.equal(acid.outputStream.isFluid,true);
 assert.equal(acid.outputStream.belts,null);
 const battery=run('battery',30);
 const input=battery.external.find(x=>x.key==='sulfuric-acid');
 assert.equal(input.isFluid,true);
 assert.equal(input.belts,null);
});
test('zero target gives no phantom machinery',()=>{
 const r=run('advanced-circuit',0);
 assert.equal(r.roundedTotal,0);
 assert.equal(r.exactTotal,0);
 assert.equal(r.entries.length,0);
 assert.equal(r.external.length,0);
});
test('invalid IDs, unsupported machines, and unreasonable input fail validation',()=>{
 assert.throws(()=>run('no-such-recipe'));
 assert.throws(()=>run('advanced-circuit',25001));
 assert.throws(()=>run('advanced-circuit',-1));
 assert.throws(()=>run('advanced-circuit',90,2));
 assert.throws(()=>analyzeRecipeRatios(R,{id:'advanced-circuit',rate:30,machine:.75,belt:9999,source:'bus'},ctx));
});
test('recipe ratio panels exist on existing workspaces without a sixth tab',()=>{
 for(const page of ['build','setup','balance'])assert.match(html,new RegExp('data-ratio-explorer="'+page+'"'));
 assert.equal((html.match(/data-ratio-explorer="/g)||[]).length,3);
 assert.equal((html.match(/<button data-view=/g)||[]).length,5);
 assert.match(html,/href="\.\/recipe-ratios\.css"/);
 assert.match(html,/src="\.\/recipe-ratios\.js" defer/);
});
test('send is an explicit hypothetical Build Next update, never a machine inventory write',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','recipe-ratios.js'),'utf8');
 assert.match(source,/guide\.goal=state\.id;guide\.rate=state\.rate;guide\.machine=state\.machine;guide\.source=state\.source;guide\.belt=state\.belt;/);
 assert.match(source,/renderGuide\(\)/);
 assert.match(source,/activateWorkspace\('build',true\)/);
 assert.doesNotMatch(source,/(?:setup\.machines|setup\.feeds)\s*=/);
 assert.doesNotMatch(source,/saveSetup\(\)/);
});
