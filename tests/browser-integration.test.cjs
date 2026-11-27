'use strict';
// Actual Chromium DOM/runtime smoke test, using Node 22's built-in WebSocket.
// No credentials, npm dependency or real factory records. CI uses preinstalled Chrome.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const base=path.join(__dirname,'..');
const chrome=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(x=>x&&fs.existsSync(x));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(fn,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const x=await fn();if(x)return x;await sleep(100)}throw Error('Timed out waiting for browser');}
test('real browser: Inventory, draft, routes, construction, profile, backup/reset, reload and mobile', {timeout:90000,skip:!chrome&&!process.env.CI},async()=>{
 assert.ok(chrome,'CI needs its preinstalled Chromium/Chrome browser');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nauvis-e2e-'));
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg','.webp':'image/webp','.ico':'image/x-icon'};
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),p=path.resolve(base,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(!p.startsWith(base+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return}
  res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  const portFile=path.join(dir,'DevToolsActivePort');
  const port=await wait(()=>fs.existsSync(portFile)&&fs.readFileSync(portFile,'utf8').split('\n')[0]);
  const target=await wait(async()=>{try{return (await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(x=>x.type==='page')}catch{return null}});
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let seq=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',ev=>{
   const m=JSON.parse(ev.data);
   if(m.id){const cb=pending.get(m.id);if(cb){pending.delete(m.id);m.error?cb.reject(Error(m.error.message)):cb.resolve(m.result)}}
   if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
  const evaluate=async expression=>{const x=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(x.exceptionDetails.exception?.description||x.exceptionDetails.text);return x.result.value};
  const run=fn=>evaluate('('+fn.toString()+')()');
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url});
  const ready=()=>wait(()=>evaluate('document.readyState==="complete" && !!window.NauvisLocal && !!window.NauvisLogistics && !!window.NauvisQuick'));
  await ready();
  const init=await run(()=>{
   window.alert=m=>{throw Error('Unexpected alert: '+m)};window.confirm=()=>true;window.prompt=()=> 'E2E draft';
   const $=s=>document.querySelector(s), click=s=>{const e=$(s);if(!e||e.disabled)throw Error('Missing/disabled '+s);e.click()}, change=(s,v)=>{const e=$(s);if(!e)throw Error('Missing '+s);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
   const ok=(v,m)=>{if(!v)throw Error(m)};
   const state=()=>NauvisLocal.snapshot();
   // Use actual controls for a real recorded production row.
   click('#setupAddMachine');change('#quickRecipe','electronic-circuit');change('#quickCount','3');change('#quickDestination','Available for new build');click('#quickAddSave');click('#quickAddClose');
   const initial=state();ok(initial.setup.machines.length===1,'Quick Change did not add exactly one line');ok(initial.setup.machines[0].count===3,'Wrong machine count');ok(initial.setup.machines[0].entityKey.includes('|id:'),'No stable ID');
   const goal={id:'advanced-circuit',rate:90,machine:.75,belt:1800,source:'bus'};
   const plan=NauvisRecipeMath(R,goal,{stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names});
   NauvisLogistics.previewBlueprint(plan);
   click('[data-log-reuse]');click('[data-proposal-action="recommend"]');click('[data-log-preview-action="save-draft"]');
   const saved=state();ok(saved.setup.logisticsDrafts.length===1,'Draft was not saved');ok(saved.setup.logisticsDrafts[0].routes.length>0,'No proposed routes saved');ok(saved.setup.logisticsDrafts[0].routes.some(r=>r.from.startsWith('actual:machine:')),'No existing supply connection');
   ok(JSON.stringify(saved.setup.machines)===JSON.stringify(initial.setup.machines),'Draft changed actual machines');ok(JSON.stringify(saved.setup.logistics)===JSON.stringify(initial.setup.logistics),'Draft changed actual routes');ok(saved.plan.projects.length===0,'Draft queued a project');
   return saved.setup.logisticsDrafts[0].id;
  });
  assert.ok(init);
  await cdp('Page.reload',{ignoreCache:true});await ready();
  const result=await run(()=>{
   window.alert=m=>{throw Error('Unexpected alert: '+m)};window.confirm=()=>true;
   const $=s=>document.querySelector(s),click=s=>{const e=$(s);if(!e||e.disabled)throw Error('Missing/disabled '+s);e.click()},ok=(v,m)=>{if(!v)throw Error(m)},state=()=>NauvisLocal.snapshot();
   activateWorkspace('logistics');click('[data-log-mode="drafts"]');click('[data-log-draft-open]');
   ok(document.querySelectorAll('.log-proposal-route').length>0,'Reload lost proposed routes');
   click('[data-log-preview-action="queue"]');$('#projectsName').value='E2E construction';click('#projectsDialogSubmit');
   let s=state();ok(s.plan.projects.length===1,'Queue did not save project: '+$('#projectsDialogError').textContent);
   ok(s.setup.machines.length===1,'Queue changed actual inventory');
   const p=s.plan.projects[0],id=p.id;ok(p.design.analysis.proposedRoutes.length>0,'Queued design lost routes');
   click('[data-project-plus][data-task-recipe="advanced-circuit"]');
   s=state();ok(s.setup.machines.length===2,'Built did not create one line');const line=s.setup.machines.find(x=>x.projectId===id);ok(line.count===1,'Built count incorrect');
   const form=$('[data-project-profile][data-task-recipe="advanced-circuit"]').closest('.project-task-profile');form.querySelector('[data-task-profile-field="machine"]').value='1.25';form.querySelector('[data-task-profile-field="moduleType"]').value='speed3';form.querySelector('[data-task-profile-field="moduleCount"]').value='2';form.querySelector('[data-project-profile]').click();
   s=state();const upgraded=s.setup.machines.find(x=>x.projectId===id);ok(upgraded.tier===1.25&&upgraded.moduleCount===2,'Installed profile did not update');ok(upgraded.entityKey===line.entityKey,'Profile changed ID');ok(s.plan.projects[0].goal.machine===.75,'Original goal changed');
   click('[data-project-plus][data-task-recipe="advanced-circuit"]');s=state();ok(s.setup.machines.find(x=>x.projectId===id).count===2,'Second Built failed after upgrade');
   click('[data-project-minus][data-task-recipe="advanced-circuit"]');s=state();ok(s.setup.machines.find(x=>x.projectId===id).count===1,'Reverse Built failed');
   // Back up via the real Fresh Start UI, intercept only the download itself.
   activateWorkspace('setup');let backupText;const original=URL.createObjectURL;
   URL.createObjectURL=blob=>{backupText=blob.text();return original.call(URL,blob)};
   click('#factoryBackupBtn');ok(backupText,'Backup not generated');
   return backupText.then(text=>{
    const saved=JSON.parse(text);ok(saved.setup.logisticsDrafts.length===1,'Backup lacks draft');ok(saved.plan.projects.length===1,'Backup lacks project');
    $('#factoryBackupConfirmed').checked=true;$('#factoryBackupConfirmed').dispatchEvent(new Event('change',{bubbles:true}));
    click('#factoryResetLaunch');$('#factoryResetPhrase').value='RESET FACTORY';$('#factoryResetPhrase').dispatchEvent(new Event('input',{bubbles:true}));click('#factoryResetCommit');
    const empty=state();ok(empty.setup.machines.length===0&&empty.plan.projects.length===0&&!empty.setup.logisticsDrafts,'Fresh Start did not clear all records');
    NauvisLocal.apply(saved);ok(state().setup.machines.length===2&&state().plan.projects.length===1,'Restore failed');
    URL.createObjectURL=original;return {drafts:state().setup.logisticsDrafts.length,projects:state().plan.projects.length,machines:state().setup.machines.length};
   });
  });
  assert.deepEqual(result,{drafts:1,projects:1,machines:2});
  await cdp('Emulation.setDeviceMetricsOverride',{width:430,height:932,deviceScaleFactor:3,mobile:true});
  const mobile=await run(()=>{
   activateWorkspace('logistics');document.querySelector('[data-log-mode="drafts"]').click();document.querySelector('[data-log-draft-open]').click();
   return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,hasRoutes:!!document.querySelector('.log-proposal-route')};
  });
  assert.equal(mobile.hasRoutes,true);assert.ok(mobile.scrollWidth<=mobile.width+3,'Mobile page horizontal overflow '+JSON.stringify(mobile));
  assert.deepEqual(errors,[],'Unhandled browser exceptions');
 }finally{
  ws?.close();proc.kill();await new Promise(resolve=>server.close(resolve));try{fs.rmSync(dir,{recursive:true,force:true})}catch{}
 }
});
