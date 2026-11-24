/* NAUVIS v0.27 · Explicit backup-first DATA-ONLY factory fresh start.
   Never runs automatically and never clears app settings or Supabase credentials. */
(function(root){
'use strict';
const RESET_PHRASE='RESET FACTORY';
function resetPlanBuiltCounts(projects){
 return (Array.isArray(projects)?projects:[]).map(p=>({
  ...p,tasks:(Array.isArray(p.tasks)?p.tasks:[]).map(t=>({...t,built:0}))
 }));
}
function resetSnapshotData(snapshot){
 if(!snapshot||!snapshot.setup||!snapshot.plan)throw Error('Full factory snapshot is required.');
 const cleaner=root.NauvisAssets?.cleanFactorySetup;
 const base=snapshot.setup;
 const clean=typeof cleaner==='function'?cleaner(base):{
  smelt:Object.fromEntries(Object.keys(base.smelt||{}).map(k=>[k,['furnaceSpeed','beltTier'].includes(k)?base.smelt[k]:0])),
  oil:Object.fromEntries(Object.keys(base.oil||{}).map(k=>[k,0])),
  machines:[],feeds:[],assets:[]
 };
 return {...snapshot,setup:clean,plan:{...snapshot.plan,projects:resetPlanBuiltCounts(snapshot.plan.projects)}};
}
if(typeof module==='object'&&module.exports)module.exports={resetPlanBuiltCounts,resetSnapshotData,RESET_PHRASE};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const backup=$('factoryBackupBtn'),agree=$('factoryBackupConfirmed'),launch=$('factoryResetLaunch');
const modal=$('factoryResetDialog'),phrase=$('factoryResetPhrase'),commit=$('factoryResetCommit');
let backedUp=false;
const status=s=>{if($('factoryResetStatus'))$('factoryResetStatus').textContent=s};
function download(){
 const snapshot=root.NauvisLocal?.snapshot?.();
 if(!snapshot)throw Error('Factory snapshot unavailable; no reset allowed.');
 const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;
 a.download='NAUVIS-factory-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 backedUp=true;agree.disabled=false;
 status('Backup download requested. Locate and save the JSON file before confirming below.');
}
function updateReady(){
 launch.disabled=!(backedUp&&agree.checked);
}
function open(){
 if(!(backedUp&&agree.checked)){status('First download a backup and confirm that you saved it.');return}
 phrase.value='';commit.disabled=true;
 modal.showModal();phrase.focus();
}
function execute(){
 if(!(backedUp&&agree.checked)||phrase.value.trim()!==RESET_PHRASE)throw Error('Backup confirmation and exact reset phrase required.');
 const before=root.NauvisLocal?.snapshot?.();
 if(!before)throw Error('Could not read a full backup snapshot. Reset refused.');
 const next=resetSnapshotData(before);
 // Assign only active Factory records and project built states. Keep all plans,
 // journal history, presets, guide, cloud pairing and UI settings untouched.
 Object.assign(setup.smelt,next.setup.smelt);
 Object.assign(setup.oil,next.setup.oil);
 setup.machines=next.setup.machines;
 setup.feeds=next.setup.feeds;
 setup.assets=next.setup.assets;
 factory.projects=next.plan.projects;
 const priorAssets=(before.setup.assets||[]).reduce((a,x)=>a+(Number(x.count)||0),0);
 root.NauvisJournal?.refreshBaseline?.();
 root.NauvisJournal?.record?.({type:'reset',source:'Factory Inventory',
  title:'Active Factory inventory reset to zero',
  detail:'Backup-first reset · '+(before.setup.machines||[]).length+' production lines, '+
    (before.setup.feeds||[]).length+' belt routes and '+priorAssets+' placed infrastructure items cleared. '+
    'Smelting and oil quantities set to zero. Project designs and history preserved; project built counts set to 0. '+
    'All paired devices will receive this new empty active Factory snapshot.'});
 saveSetup();save();
 renderSetup();renderBalance();
 root.NauvisProjects?.refresh?.();
 root.NauvisAssets?.render?.();
 root.NauvisWorkspace?.refresh?.();
 modal.close();
 backedUp=false;agree.checked=false;agree.disabled=true;updateReady();
 status('Clean Factory inventory saved locally and queued for cloud synchronization. All blueprint designs and journal history were kept.');
}
backup?.addEventListener('click',()=>{try{download()}catch(err){status(err.message)}});
agree?.addEventListener('change',updateReady);
launch?.addEventListener('click',open);
phrase?.addEventListener('input',()=>{commit.disabled=phrase.value.trim()!==RESET_PHRASE});
$('factoryResetCancel')?.addEventListener('click',()=>modal.close());
$('factoryResetForm')?.addEventListener('submit',e=>{
 e.preventDefault();
 try{execute()}catch(err){if($('factoryResetError'))$('factoryResetError').textContent=err.message}
});
})(typeof window==='undefined'?globalThis:window);
