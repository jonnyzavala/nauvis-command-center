/* NAUVIS v0.29 · Explicit, backup-first reset of all factory-specific data. */
(function(root){
'use strict';
const RESET_PHRASE='RESET FACTORY';
const DISTRICT_KEYS=['redBlocks','blueMachines','greenBus','ldsMachines','purpleSPM','yellowSPM','redReserve','blueReserve','ldsReserve','copperBelts','ironBelts','plasticPlants'];
const SMELT_KEYS=['ironFurnaces','ironBelts','ironToSteel','steelFurnaces','steelBelts','copperFurnaces','copperBelts','brickFurnaces','brickBelts'];
const OIL_KEYS=['refineries','heavyCrackers','lightCrackers'];
function resetSnapshotData(snapshot){
 if(!snapshot||!snapshot.setup||!snapshot.plan||!snapshot.guide)throw Error('Full factory snapshot is required.');
 const smelt={...Object.fromEntries(SMELT_KEYS.map(k=>[k,0])),
  furnaceSpeed:snapshot.setup.smelt?.furnaceSpeed??2,beltTier:snapshot.setup.smelt?.beltTier??1800};
 const oil=Object.fromEntries(OIL_KEYS.map(k=>[k,0]));
 const plan={...Object.fromEntries(DISTRICT_KEYS.map(k=>[k,0])),checked:{},projects:[],journal:[]};
 return {...snapshot,setup:{smelt,oil,machines:[],feeds:[],assets:[]},plan,
  balancePrefs:{...snapshot.balancePrefs,includeGoal:false}};
}
if(typeof module==='object'&&module.exports)module.exports={resetSnapshotData,RESET_PHRASE};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id);
const backup=$('factoryBackupBtn'),agree=$('factoryBackupConfirmed'),launch=$('factoryResetLaunch');
const modal=$('factoryResetDialog'),phrase=$('factoryResetPhrase'),commit=$('factoryResetCommit');
let backedUp=false,backupJSON=null;
const status=s=>{if($('factoryResetStatus'))$('factoryResetStatus').textContent=s};
function updateReady(){launch.disabled=!(backedUp&&agree.checked)}
function invalidateBackup(){backedUp=false;backupJSON=null;agree.checked=false;agree.disabled=true;updateReady()}
function download(){
 const snapshot=root.NauvisLocal?.snapshot?.();
 if(!snapshot)throw Error('Factory snapshot unavailable; no reset allowed.');
 backupJSON=JSON.stringify(snapshot);
 const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;
 a.download='NAUVIS-factory-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3000);
 backedUp=true;agree.checked=false;agree.disabled=false;updateReady();
 status('Backup download requested. Locate and save the JSON file before confirming below.');
}
function open(){
 if(!(backedUp&&agree.checked)){status('First download a backup and confirm that you saved it.');return}
 phrase.value='';commit.disabled=true;$('factoryResetError').textContent='';
 modal.showModal();phrase.focus();
}
function execute(){
 if(!(backedUp&&agree.checked)||phrase.value.trim()!==RESET_PHRASE)throw Error('Backup confirmation and exact reset phrase required.');
 const before=root.NauvisLocal?.snapshot?.();
 if(!before)throw Error('Could not read a full backup snapshot. Reset refused.');
 if(JSON.stringify(before)!==backupJSON){
  invalidateBackup();modal.close();status('Factory data changed after backup. Download a new backup before resetting.');return;
 }
 const next=resetSnapshotData(before);
 // Apply one complete snapshot under the existing cloud-apply guard.
 root.NauvisLocal.apply(next);
 root.NauvisJournal?.refreshBaseline?.();
 root.NauvisJournal?.render?.();
 if($('journalNoteInput'))$('journalNoteInput').value='';
 if($('journalMessage'))$('journalMessage').textContent='';
 root.NauvisWorkspace?.refresh?.();
 root.NauvisCloud?.changed?.();
 modal.close();invalidateBackup();
 status('All factory data cleared locally. The empty snapshot will sync to paired devices through the normal cloud connection. Your downloaded backup contains the old records.');
 root.NauvisOnboarding?.open?.('reset');
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
