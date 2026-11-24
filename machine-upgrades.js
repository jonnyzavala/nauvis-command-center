/* v0.28 · Recorded production-machine module, quality and effective beacon controls.
   Does not invent power telemetry or count beacons from geometry. */
(function(root){
'use strict';
if(typeof document==='undefined')return;
const select=(pairs,value)=>pairs.map(([key,label])=>
 '<option value="'+key+'"'+(String(key)===String(value)?' selected':'')+'>'+label+'</option>').join('');
const kinds=root.NauvisEffects.MODULE_OPTIONS;
const qualities=[
 ['normal','Normal'],['uncommon','Uncommon (1.3×)'],
 ['rare','Rare (1.6×)'],['epic','Epic (1.9×)'],['legendary','Legendary (2.5×)']
];
let wired=false;
function attach(){
 const host=document.getElementById('setupMachineRows');
 if(!host)return;
 [...host.querySelectorAll('.setup-row')].forEach((element,i)=>{
  if(element.querySelector('.setup-machine-upgrades'))return;
  const row=setup.machines[i];if(!row||!R[row.recipe])return;
  const kind=R[row.recipe][3];
  const profile=root.NauvisEffects?.forRecipe?.(row.recipe,kind,{...row,machine:kind==='asm'?Number(row.tier||.75):1});
  const advanced=(row.moduleType&&row.moduleType!=='none')||(row.machineQuality&&row.machineQuality!=='normal')||row.beaconSpeed>0||(row.moduleType2&&row.moduleType2!=='none'&&row.moduleCount2>0);
  const details=document.createElement('details');
  details.className='setup-machine-upgrades';
  if(advanced)details.open=true;
  const applied=profile?.moduleApplied||0,slots=profile?.moduleSlots||0;
  const notice=profile?.moduleEligible===false?'Productivity modules are not allowed for this recipe; only eligible modules are applied.':
   profile?.moduleRequested>slots?'Only '+slots+' slots available; primary modules are applied first, then secondary modules.':
   'Settings apply to this recorded production line. Changing a project-linked machine profile can require reconciling its saved blueprint.';
  details.innerHTML='<summary><span>Machine upgrades</span> <span class="small">'+applied+'/'+slots+' modules active</span></summary>'+
   '<div class="setup-upgrade-fields">'+
   '<label>Module profile<select data-upgrade-field="moduleType">'+select(kinds,row.moduleType||'none')+'</select></label>'+
   '<label>Modules per machine<input data-upgrade-field="moduleCount" type="number" inputmode="numeric" min="0" max="4" step="1" value="'+Number(row.moduleCount||0)+'"></label>'+
   '<label>Second module type<select data-upgrade-field="moduleType2">'+select(kinds,row.moduleType2||'none')+'</select></label>'+
   '<label>Second module count<input data-upgrade-field="moduleCount2" type="number" inputmode="numeric" min="0" max="4" step="1" value="'+Number(row.moduleCount2||0)+'"></label>'+
   '<label>Machine quality<select data-upgrade-field="machineQuality">'+select(qualities,row.machineQuality||'normal')+'</select></label>'+
   '<label>Beacon speed bonus (%)<input data-upgrade-field="beaconSpeed" type="number" inputmode="decimal" min="0" max="300" step="1" value="'+Number(row.beaconSpeed||0)+'"></label>'+
   '</div><p class="setup-upgrade-note">'+notice+'</p>';
  element.append(details);
 });
 if(wired)return;
 wired=true;
 host.addEventListener('change',event=>{
  const input=event.target.closest('[data-upgrade-field]');if(!input)return;
  const element=input.closest('.setup-row'),index=[...host.querySelectorAll('.setup-row')].indexOf(element);
  if(index<0||!setup.machines[index])return;
  const row=setup.machines[index],field=input.dataset.upgradeField;
  const value=['moduleCount','moduleCount2','beaconSpeed'].includes(field)?Number(input.value):input.value;
  const candidate={...row,[field]:value};
  try{
   root.NauvisEffects.settings(candidate);
   setup.machines[index]=candidate;
   root.NauvisJournal?.record?.({
    type:'machine-settings',source:'Factory',recipe:row.recipe,projectId:row.projectId||null,
    title:'Updated '+(R[row.recipe]?.[0]||row.recipe)+' machine profile',
    detail:field+': '+String(row[field]??(field.startsWith('moduleType')?'none':field==='machineQuality'?'normal':0))+
     ' → '+String(value)+'. Throughput and input demand recalculated from recorded settings.'
   });
   saveSetup();renderSetupMachines();renderSetupSummaryOnly();
   const details=host.querySelectorAll('.setup-row')[index]?.querySelector('.setup-machine-upgrades');
   if(details)details.open=true;
  }catch(err){
   root.alert(err.message||'Invalid machine upgrade setting.');
   renderSetupMachines();
   const details=host.querySelectorAll('.setup-row')[index]?.querySelector('.setup-machine-upgrades');if(details)details.open=true;
  }
 });
}
root.NauvisMachineUpgrades={attach};
attach();
})(typeof window==='undefined'?globalThis:window);
