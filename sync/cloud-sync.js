/* Nauvis Cloud Sync v1. All edits remain locally saved; network syncing is optional.
   Public Supabase URL + publishable key are safe to disclose. Recovery key is not. */
(function(){
'use strict';
const storage={cfg:'nauvis-cloud-config-v1',id:'nauvis-cloud-factory-v1',rev:'nauvis-cloud-revision-v1',pending:'nauvis-cloud-outbox-v1'};
const $=id=>document.getElementById(id);
const get=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
const put=(k,v)=>{try{localStorage.setItem(k,v)}catch(_){return false}return true};
const drop=k=>{try{localStorage.removeItem(k)}catch(_){}};
const json=(s,d)=>{try{return JSON.parse(s)}catch(_){return d}};
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
 ?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const settings=()=>json(get(storage.cfg),{})||{};
const offline=()=>navigator.onLine===false;
const errText=e=>String(e&&e.message||e||'Unknown error').slice(0,260);
let client=null,id='',rev=0,busy=false,conflict=false,open=false,pushTimer=null,sdkLoading=null,synced='',lastPoll=0;
const pending=()=>json(get(storage.pending),null);
const local=()=>window.NauvisLocal&&window.NauvisLocal.snapshot();
function showStatus(kind,note){
 const labels={local:'Local only',connecting:'Checking',saved:'Synced',syncing:'Syncing',offline:'Offline',error:'Sync error',conflict:'Sync conflict'};
 const el=$('cloudStatus');if(el){el.dataset.state=kind;el.title=note||labels[kind]||'';el.setAttribute('aria-label','Cloud synchronization: '+(labels[kind]||kind)+'. '+(note||'')+' Open settings.');}
 if($('cloudStatusText'))$('cloudStatusText').textContent=labels[kind]||kind;
 if($('cloudStatusDetail'))$('cloudStatusDetail').textContent=note||'';
 if($('cloudConflictActions'))$('cloudConflictActions').hidden=kind!=='conflict';
}
function say(t,isError){const el=$('cloudMessage');if(el){el.textContent=t;el.dataset.error=String(!!isError)}}
function backup(kind,data){
 if(!data)return;
 const prefix=kind==='local'?'nauvis-cloud-backup-':'nauvis-cloud-remote-backup-';
 try{
  const keys=[];
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix))keys.push(k)}
  keys.sort().slice(0,-4).forEach(drop);
 }catch(_){}
 put(prefix+Date.now(),JSON.stringify(data));
}
function saveBackup(){backup('local',local())}
function showDialog(){
 const cfg=settings();$('cloudUrl').value=cfg.url||'';$('cloudKey').value=cfg.key||'';
 if(!$('cloudDeviceName').value)$('cloudDeviceName').value=/iPhone|iPad/i.test(navigator.userAgent)?'iPhone':/Macintosh|Mac OS/i.test(navigator.userAgent)?'MacBook':'My device';
 $('cloudPairedInfo').textContent=id?'This browser is paired and will synchronize automatically.':'This browser currently saves only on this device. Pair it once to start syncing.';
 if(!$('cloudDialog').open)$('cloudDialog').showModal();
}
function hideDialog(){if($('cloudDialog').open)$('cloudDialog').close()}
async function getSDK(){
 if(window.supabase&&window.supabase.createClient)return;
 if(!sdkLoading)sdkLoading=new Promise((resolve,reject)=>{
  const tag=document.createElement('script');
  tag.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js';
  tag.id='nauvisSupabaseLibrary';
  tag.onload=resolve;tag.onerror=()=>reject(Error('Could not load the Supabase library.'));
  document.head.appendChild(tag);
 });
 await sdkLoading;
 if(!window.supabase||!window.supabase.createClient)throw Error('Cloud library unavailable.');
}
async function connect(){
 const cfg=settings();
 if(!cfg.url||!cfg.key)throw Error('Please enter the project URL and publishable key.');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url))throw Error('The URL should end in .supabase.co');
 if(!/^[a-zA-Z0-9._-]{20,}$/.test(cfg.key))throw Error('Invalid publishable key.');
 if(offline())throw Error('No internet connection.');
 await getSDK();
 if(!client)client=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'nauvis-auth-'+cfg.url.replace(/[^a-z0-9]/gi,'').slice(-42)}
 });
 return client;
}
async function authorize(){
 const c=await connect();
 const status=await c.auth.getSession();
 if(status.error)throw status.error;
 if(!status.data||!status.data.session){
  const signed=await c.auth.signInAnonymously();
  if(signed.error)throw Error('Anonymous device authorization failed: '+errText(signed.error));
 }
}
async function call(name,args){
 const c=await connect();
 const result=await c.rpc(name,args);
 if(result.error)throw result.error;
 return Array.isArray(result.data)?result.data[0]:result.data;
}
async function pull(){return call('nauvis_pull',{p_factory_id:id})}
function setRevision(value){rev=Number(value)||0;put(storage.rev,String(rev))}
function restore(remote){
 if(!remote||!remote.snapshot||typeof remote.snapshot!=='object'||!('setup' in remote.snapshot)||!('guide' in remote.snapshot)||!('plan' in remote.snapshot))throw Error('Cloud save has an unexpected format.');
 saveBackup();
 window.NauvisLocal.apply(remote.snapshot);
 setRevision(remote.revision);
 synced=stable(remote.snapshot);
 drop(storage.pending);
 conflict=false;
 showStatus('saved','This device has the latest shared factory.');
}
function queuePush(){
 if(pushTimer)clearTimeout(pushTimer);
 pushTimer=setTimeout(()=>{pushTimer=null;upload()},1200);
}
async function upload(){
 if(!id||busy||conflict)return;
 const data=pending();
 if(!data){showStatus('saved','Changes confirmed by the cloud database.');return true}
 if(offline()){showStatus('offline','Changes are stored locally and waiting for internet.');return false}
 let success=false;
 busy=true;showStatus('syncing','Uploading local changes...');
 try{
  await authorize();
  const result=await call('nauvis_push',{p_factory_id:id,p_expected_revision:rev,p_snapshot:data});
  if(typeof result?.revision!=='number')throw Error('No save confirmation received.');
  setRevision(result.revision);
  synced=stable(data);
  success=true;
  if(stable(pending())===stable(data))drop(storage.pending);
  showStatus(pending()?'syncing':'saved',pending()?'Latest save confirmed; more changes are queued.':'Your factory is synchronized.');
 }catch(e){
  const t=errText(e);
  if(/REVISION_CONFLICT/i.test(t)){conflict=true;showStatus('conflict','Another device saved a different version. Choose which copy to keep.');}
  else if(offline()||/fetch|network|Failed to fetch/i.test(t))showStatus('offline','Saved locally. Waiting to reconnect.');
  else showStatus('error',t);
 }finally{
  busy=false;
  // Retry only after a confirmed save, or after an explicit edit/reconnect.
  // A persistent auth/server failure must not cause an endless upload loop.
  if(success&&pending()&&!conflict&&!offline())queuePush();
 }
 return success;
}
function changed(){
 if(window.NauvisCloudApplying||!id)return;
 const data=local();if(!data)return;
 if(stable(data)===synced&&!pending())return;
 put(storage.pending,JSON.stringify(data));
 if(offline())showStatus('offline','Changes are stored locally. They will upload when online.');
 else{showStatus('syncing','Saving changes to the cloud...');queuePush();}
}
async function refresh(){
 if(!id||busy||conflict)return;
 if(offline()){showStatus('offline','Offline; changes remain saved locally.');return}
 const quiet=!pending()&&!!synced;
 busy=true;if(!quiet)showStatus('connecting','Checking for updates...');
 try{
  await authorize();
  const remote=await pull();if(!remote)throw Error('Cloud save was not returned.');
  if(pending()){
   if(Number(remote.revision)!==rev){
    if(stable(remote.snapshot)===stable(pending())){
     // Server may have accepted a previous upload whose confirmation got lost.
     // Identical snapshots are already in sync, not a user-facing conflict.
     setRevision(remote.revision);synced=stable(remote.snapshot);drop(storage.pending);
     showStatus('saved','Cloud already contains your most recent edits.');
    }else{conflict=true;showStatus('conflict','Changes exist on both devices. Pick which copy to keep.');}
   }
   else showStatus('syncing','Local edits are queued for upload.');
  }else if(Number(remote.revision)>rev)restore(remote);
  else {setRevision(remote.revision);synced=stable(remote.snapshot);showStatus('saved','Up to date with the cloud.');}
 }catch(e){const t=errText(e);showStatus(offline()||/fetch|network/i.test(t)?'offline':'error',t)}
 finally{busy=false;lastPoll=Date.now();if(pending()&&!conflict&&!offline())queuePush();}
}
async function pair(ev){
 ev.preventDefault();
 const button=$('cloudConnect');button.disabled=true;
 const previousConfig=settings(),previousId=id,previousRevision=rev;
 let paired=false;
 showStatus('connecting','Pairing this device...');
 try{
  const url=$('cloudUrl').value.trim(),key=$('cloudKey').value.trim();
  const recovery=$('cloudRecovery').value.trim().toLowerCase().replace(/\s/g,'');
  if(!/^[0-9a-f]{64}$/.test(recovery))throw Error('Enter the full 64-character recovery key.');
  const prior=settings();
  if(prior.url!==url||prior.key!==key){client=null;drop(storage.id);drop(storage.rev);id='';rev=0;}
  put(storage.cfg,JSON.stringify({url,key}));
  await authorize();
  const d=await call('nauvis_pair',{p_recovery_key:recovery,p_device_name:$('cloudDeviceName').value.trim()||'My device'});
  if(!d||!d.factory_id)throw Error('Pairing was not confirmed.');
  id=d.factory_id;put(storage.id,id);setRevision(d.revision);
  $('cloudRecovery').value='';
  if(rev===0){put(storage.pending,JSON.stringify(local()));queuePush();}
  else restore(d);
  paired=true;
  say('Paired successfully. The recovery key was not stored in your browser.');
  $('cloudPairedInfo').textContent='This browser is paired. All changes will sync automatically.';
 }catch(e){
  $('cloudRecovery').value='';
  if(!paired){
   // A mistyped key or an unavailable server must not silently unpair a working device.
   put(storage.cfg,JSON.stringify(previousConfig));id=previousId;rev=previousRevision;client=null;
   if(id){put(storage.id,id);put(storage.rev,String(rev));}else{drop(storage.id);drop(storage.rev);}
  }
  showStatus(offline()?'offline':'error',errText(e));say(errText(e),true);
 }
 finally{button.disabled=false;}
}
async function resolve(useCloud){
 $('cloudKeepCloud').disabled=true;$('cloudKeepLocal').disabled=true;
 showStatus('syncing','Resolving edits...');
 try{
  await authorize();const remote=await pull();
  if(useCloud){restore(remote);say('Restored the cloud copy. Your previous local data was backed up.');}
  else{backup('remote',remote.snapshot);setRevision(remote.revision);conflict=false;
   if(!pending())put(storage.pending,JSON.stringify(local()));
   const uploaded=await upload();
   say(uploaded?'Your local changes are now synchronized.':'The local copy is preserved. Upload has not been confirmed yet.',!uploaded);
  }
 }catch(e){conflict=true;showStatus('conflict',errText(e));say(errText(e),true)}
 finally{$('cloudKeepCloud').disabled=false;$('cloudKeepLocal').disabled=false;}
}
async function detach(){
 if(!id){say('This browser is already local only.');return;}
 if(offline()){showStatus('offline','Reconnect to revoke device authorization securely.');say('Reconnect before unpairing so this device can be revoked on the server.',true);return;}
 if(!window.confirm('Unpair this browser? Its current factory information will stay saved locally.'))return;
 if(pending()){say('There are unsynced changes. Resolve them before unpairing.',true);return;}
 try{
  await authorize();await call('nauvis_unpair',{p_factory_id:id});
  if(client)await client.auth.signOut();
 }catch(e){say('Unable to unpair securely: '+errText(e),true);return;}
 id='';rev=0;conflict=false;drop(storage.id);drop(storage.rev);
 showStatus('local','This browser is no longer paired.');
 say('Device unpaired. Local data was preserved.');
 $('cloudPairedInfo').textContent='Local only. Pair again using your recovery key.';
}
async function start(){
 $('cloudStatus')?.addEventListener('click',showDialog);
 $('cloudClose')?.addEventListener('click',hideDialog);
 $('cloudDialog')?.addEventListener('click',e=>{if(e.target===$('cloudDialog'))hideDialog()});
 $('cloudConnectForm')?.addEventListener('submit',pair);
 $('cloudKeepCloud')?.addEventListener('click',()=>resolve(true));
 $('cloudKeepLocal')?.addEventListener('click',()=>resolve(false));
 $('cloudRetry')?.addEventListener('click',refresh);
 $('cloudExport')?.addEventListener('click',()=>document.getElementById('exportButton')?.click());
 $('cloudDisconnect')?.addEventListener('click',detach);
 window.addEventListener('online',()=>{if(id)refresh()},{passive:true});
 window.addEventListener('offline',()=>{if(id)showStatus('offline','Changes will be stored here until connected.')},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&id)refresh()});
 setInterval(()=>{if(!document.hidden&&id&&Date.now()-lastPoll>20000)refresh()},25000);
 id=get(storage.id)||'';rev=Number(get(storage.rev)||0);
 window.NauvisCloud={changed,showDialog};
 if(!id){showStatus('local','Stored on this device. Cloud syncing has not been connected.');return;}
 if(!settings().url||!settings().key){showStatus('error','Cloud project settings missing.');return;}
 showStatus('connecting','Connecting to your shared factory...');
 await refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();