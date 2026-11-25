// Actual Chrome, synthetic same-origin factory only. No real Supabase connection.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const harness=String.raw`<!doctype html><html><meta charset="utf-8"><title>NAUVIS isolated smoke</title><body><iframe id="app" style="width:1100px;height:820px;border:0"></iframe><script>
(async()=>{
 const checks=[],frame=document.getElementById('app');
 const assert=(v,label)=>{if(!v)throw Error(label);checks.push(label)};
 const load=()=>new Promise((resolve,reject)=>{frame.onload=()=>resolve(frame.contentWindow);frame.onerror=reject;frame.src='/index.html?smoke='+Date.now()});
 const prep=w=>{w.confirm=()=>true;w.prompt=()=> 'Smoke draft';w.alert=msg=>{throw Error(String(msg))};return w};
 const click=(w,sel)=>{const node=w.document.querySelector(sel);if(!node)throw Error('Missing control: '+sel);node.click()};
 const set=(w,sel,value,event='change')=>{const node=w.document.querySelector(sel);if(!node)throw Error('Missing field: '+sel);node.value=value;node.dispatchEvent(new w.Event(event,{bubbles:true}))};
 const snap=w=>w.NauvisLocal.snapshot();
 const count=w=>snap(w).setup.machines.reduce((n,r)=>n+Number(r.count),0);
 try{
  let w=prep(await load());
  assert(w.NauvisLocal&&w.NauvisLogistics&&w.NauvisRecipeMath,'Application and deferred modules initialized');
  const data=snap(w);
  data.plan.projects=[];data.plan.journal=[];
  data.setup.machines=[{recipe:'electronic-circuit',count:4,tier:.75,destination:'Available for new build'},{recipe:'copper-cable',count:2,tier:.75,destination:'Main bus'}];
  data.setup.logistics={nodes:[{id:'s',kind:'source',item:'copper-cable',label:'Cable',link:'machine:copper-cable|Main bus'},{id:'d',kind:'destination',item:'copper-cable',label:'Test demand',amount:.05,tier:'yellow'}],edges:[{id:'r',from:'s',to:'d',belts:1,tier:'yellow'}]};
  data.setup.smelt={...data.setup.smelt,ironFurnaces:48,ironBelts:1,ironToSteel:0,furnaceSpeed:2,beltTier:1800,profiles:[{recipe:'iron-plate',furnaceType:'electric',count:12,moduleType:'speed1',moduleCount:2}]};
  w.NauvisLocal.apply(data);
  w.activateWorkspace('setup');
  assert(count(w)===6,'Actual Inventory loaded from synthetic snapshot');
  set(w,'[data-row="1"][data-field="destination"]','Other');
  assert(snap(w).setup.machines[1].entityKey==='machine:copper-cable|Main bus','Destination change preserves route identity');
  assert(w.NauvisLogistics.actualNetwork().results.get('copper-cable').nodes.s.supply>0,'Existing route resolves after allocation edit');
  const goal=w.eval("NauvisRecipeMath(R,{id:'advanced-circuit',rate:90,machine:.75,belt:900,source:'bus'},{stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names})");
  w.NauvisLogistics.previewBlueprint(goal);
  click(w,'[data-log-reuse]');
  click(w,'[data-proposal-action="recommend"]');
  assert(w.document.querySelectorAll('[data-proposal-field]').length>0,'Proposed connections generated in browser');
  click(w,'[data-log-preview-action="save-draft"]');
  let saved=snap(w);
  assert(saved.setup.logisticsDrafts.length===1&&saved.setup.logisticsDrafts[0].routes.length>0,'Draft and proposed routes saved');
  assert(saved.plan.projects.length===0&&count(w)===6&&saved.setup.logistics.edges.length===1,'Draft does not mutate actual Inventory or routes');
  w=prep(await load());
  assert(snap(w).setup.logisticsDrafts.length===1,'Draft survives browser reload');
  w.activateWorkspace('logistics');
  click(w,'[data-log-mode="drafts"]');
  click(w,'[data-log-draft-open]');
  assert(w.document.querySelectorAll('[data-proposal-field]').length>0,'Saved draft restores editable route plan');
  click(w,'[data-log-preview-action="queue"]');
  click(w,'#projectsDialogSubmit');
  assert(snap(w).plan.projects.length===1&&count(w)===6,'Queue freezes proposal without adding actual machines');
  assert(snap(w).plan.projects[0].design.analysis.proposedRoutes.length>0,'Queued design retains proposed routing');
  click(w,'[data-project-plus][data-task-recipe="advanced-circuit"]');
  assert(count(w)===7,'One Built action records exactly one machine');
  const id=snap(w).setup.machines.find(r=>r.recipe==='advanced-circuit').entityKey;
  const profile=w.document.querySelector('[data-project-profile][data-task-recipe="advanced-circuit"]');
  assert(!!profile,'Installed profile editor is available');
  const panel=profile.closest('.project-task-profile');
  panel.querySelector('[data-task-profile-field="machine"]').value='1.25';
  panel.querySelector('[data-task-profile-field="moduleType"]').value='speed1';
  panel.querySelector('[data-task-profile-field="moduleCount"]').value='2';
  profile.click();
  const upgraded=snap(w).setup.machines.find(r=>r.recipe==='advanced-circuit');
  assert(upgraded.tier===1.25&&upgraded.moduleCount===2&&upgraded.entityKey===id&&count(w)===7,'Actual profile changes without count or identity changes');
  assert(snap(w).plan.projects[0].goal.machine===.75,'Historical blueprint remains unchanged');
  click(w,'[data-project-plus][data-task-recipe="advanced-circuit"]');
  assert(count(w)===8&&snap(w).setup.machines.find(r=>r.recipe==='advanced-circuit').count===2,'Further Built action uses reconciled profile');
  // Responsive viewports exercise each actual workspace in a real layout engine.
  for(const width of [1100,390]){
   frame.style.width=width+'px';
   await new Promise(r=>setTimeout(r,100));
   for(const mode of ['learn','setup','balance','logistics','factory','build']){
    w.activateWorkspace(mode);
    await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
    assert(w.document.querySelector('#'+mode+'.active'),'Workspace '+mode+' visible at '+width+'px');
    const over=w.document.documentElement.scrollWidth-w.innerWidth;
    assert(over<=3,'Workspace '+mode+' horizontal overflow '+over+'px at '+width+'px');
   }
  }
  w.activateWorkspace('setup');
  const backup=snap(w);
  // Suppress the test download itself; still exercise the real backup/reset UI.
  const originalClick=w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click=function(){if(!this.download)return originalClick.call(this)};
  click(w,'#factoryBackupBtn');click(w,'#factoryBackupConfirmed');click(w,'#factoryResetLaunch');
  set(w,'#factoryResetPhrase','RESET FACTORY','input');click(w,'#factoryResetCommit');
  const empty=snap(w);
  assert(empty.setup.machines.length===0&&empty.plan.projects.length===0&&!empty.setup.logisticsDrafts&&!empty.setup.logistics&&empty.setup.smelt.ironFurnaces===0,'Fresh Start removes all synthetic factory records');
  assert(empty.guide.goal===backup.guide.goal,'Fresh Start preserves planner preferences');
  w.NauvisLocal.apply(backup);
  assert(count(w)===8&&snap(w).setup.logisticsDrafts.length===1,'Complete backup restores actual inventory and draft');
  await fetch('/__result',{method:'POST',body:JSON.stringify({ok:true,checks})});
 }catch(err){await fetch('/__result',{method:'POST',body:JSON.stringify({ok:false,error:err.stack||String(err),checks})})}
})();
</script></body></html>`;
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'nauvis-smoke-'));
 let resolveResult;
 const result=new Promise(resolve=>{resolveResult=resolve});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/__smoke'){res.setHeader('Content-Type','text/html');res.end(harness);return}
  if(url.pathname==='/__result'&&req.method==='POST'){
   let data='';req.on('data',x=>data+=x);req.on('end',()=>{try{resolveResult(JSON.parse(data));res.end('ok')}catch(err){res.statusCode=400;res.end('invalid')}});return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;res.end();return}
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--no-first-run','--no-default-browser-check','--window-size=1280,1000','--user-data-dir='+profile,'http://127.0.0.1:'+server.address().port+'/__smoke'],{stdio:['ignore','ignore','pipe']});
 let stderr='';chrome.stderr.on('data',d=>stderr=(stderr+d).slice(-3000));
 chrome.on('error',e=>resolveResult({ok:false,error:e.message,checks:[]}));
 chrome.on('exit',code=>resolveResult({ok:false,error:'Chrome exited '+code+' '+stderr,checks:[]}));
 const timer=setTimeout(()=>resolveResult({ok:false,error:'Browser smoke timed out: '+stderr,checks:[]}),60000);
 try{
  const report=await result;for(const label of report.checks||[])console.log('PASS',label);
  if(!report.ok){console.error(report.error);process.exitCode=1}else console.log('Browser workflow passed: '+report.checks.length+' checks.');
 }finally{clearTimeout(timer);chrome.kill('SIGTERM');server.close();setTimeout(()=>{try{fs.rmSync(profile,{recursive:true,force:true})}catch{}},1000).unref()}
})().catch(err=>{console.error(err);process.exitCode=1});
