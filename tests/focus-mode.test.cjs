'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{progress}=require('../focus-mode.js');
test('construction progress derives existing active tasks and excludes archives',()=>{assert.deepEqual(progress([{tasks:[{planned:12,built:6},{planned:4,built:4}]},{status:'archived',tasks:[{planned:99,built:99}]}]),{active:1,planned:16,built:10,remaining:6,pct:62.5,complete:0})});
test('construction totals exclude hidden legacy deployment records as well as archives',()=>{assert.deepEqual(progress([{tasks:[{planned:3,built:1}]},{type:'deployment',tasks:[{planned:99,built:50}]},{tasks:[{kind:'asset',planned:5,built:3}]}]),{active:1,planned:3,built:1,remaining:2,pct:1/3*100,complete:0})});

test('summary and completed project count include logistics independently of machines',()=>{
 const p={tasks:[{planned:3,built:3}],logisticsTasks:[{planned:2,built:1},{planned:1,built:0}]};
 assert.deepEqual(progress([p]),{active:1,planned:6,built:4,remaining:2,pct:4/6*100,complete:0});
 assert.equal(progress([{...p,logisticsTasks:p.logisticsTasks.map(t=>({...t,built:t.planned}))}]).complete,1);
});
