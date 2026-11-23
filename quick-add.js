/* NAUVIS v0.18: Quick Add / Quick Change. One inventory, local-first, safe Undo.
   Pure model updater can be exercised from Node without a browser. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const smeltSpecs=[
 ['ironFurnaces','Iron plate furnaces'],['copperFurnaces','Copper plate furnaces'],
 ['steelFurnaces','Steel furnaces'],['brickFurnaces','Brick furnaces'],
 ['ironBelts','Iron output belts'],['ironToSteel','Iron belts to steel'],
 ['copperBelts','Copper output belts'],['steelBelts','Steel output belts'],
 ['brickBelts','Brick output belts'],['furnaceSpeed','Furnace speed'],
 ['beltTier','Smelting belt tier']
];
const oilSpecs=[['refineries','Advanced oil refineries'],['heavyCrackers','Heavy to light crackers'],['lightCrackers','Light to petroleum crackers']];
const asInteger=(value,field)=>{
 if(value===null||value===undefined||String(value).trim()==='')throw Error(field+' is required.');
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0||n>999999)throw Error(field+' must be a whole number from 0 to 999,999.');
 return n;
};
const validIndex=(list,value)=>{
 const n=Number(value);
 if(!Number.isInteger(n)||n<0||n>=list.length||String(n)!==String(value))throw Error('That saved line no longer exists. Select it again.');
 return n;
};
function tasksFor(plan){
 const tasks=[];
 for(let n=1;n<=Math.min(999,asInteger(plan.redBlocks||0,'Red blocks'));n++)tasks.push(['red'+n,'Red circuit block '+n]);
 return tasks.concat([['blue','Blue circuit block'],['greenbus','Bus green circuits'],['lds','Low-density structures'],['purple','Purple science'],['yellow','Yellow science']]);
}
/* state has exactly the existing app's setup + construction checklist; no shadow data. */
function applyQuickEdit(state,change,ctx){
 const next=clone(state);
 if(!next.setup||!next.checked||!Array.isArray(next.setup.machines)||!Array.isArray(next.setup.feeds))throw Error('Factory data is unavailable.');
 const labels=ctx||{};
 let label='';
 if(change.kind==='machine'){
   if(!Array.isArray(labels.machineRecipes)||!labels.machineRecipes.includes(change.recipe))throw Error('Choose a valid production recipe.');
   if(!labels.destinations?.includes(change.destination))throw Error('Choose a valid destination.');
   const count=asInteger(change.count,'Machine count');
   const isAssembler=labels.recipeKinds?.[change.recipe]==='asm';
   const tier=isAssembler?Number(change.tier):.75;
   if(isAssembler&&![.5,.75,1.25].includes(tier))throw Error('Choose a valid assembler tier.');
   const row={recipe:change.recipe,count,tier,destination:change.destination};
   if(change.target==='new'){
     if(count===0)throw Error('A new production line needs at least one machine.');
     next.setup.machines.push(row);
     label='Added '+count+' '+(labels.recipeNames?.[row.recipe]||row.recipe)+' machines';
   }else{
     const n=validIndex(next.setup.machines,change.target);
     next.setup.machines[n]=row;
     label='Updated '+(labels.recipeNames?.[row.recipe]||row.recipe)+' line';
   }
 }else if(change.kind==='remove-machine'){
   const n=validIndex(next.setup.machines,change.target);
   const row=next.setup.machines.splice(n,1)[0];
   label='Removed '+(labels.recipeNames?.[row.recipe]||row.recipe)+' line';
 }else if(change.kind==='belt'){
   if(!labels.feedRecipes?.includes(change.recipe))throw Error('Choose a valid belt resource.');
   if(!labels.destinations?.includes(change.destination))throw Error('Choose a valid belt destination.');
   if(!['yellow','red','blue'].includes(change.tier))throw Error('Choose a belt tier.');
   const count=asInteger(change.count,'Belt count');
   const row={recipe:change.recipe,count,tier:change.tier,destination:change.destination};
   if(change.target==='new'){
     if(count===0)throw Error('A new belt route needs at least one belt.');
     next.setup.feeds.push(row);
     label='Added '+count+' '+change.tier+' belt(s)';
   }else{
     const n=validIndex(next.setup.feeds,change.target);
     next.setup.feeds[n]=row;
     label='Updated '+change.tier+' belt route';
   }
 }else if(change.kind==='remove-belt'){
   const n=validIndex(next.setup.feeds,change.target);
   next.setup.feeds.splice(n,1);
   label='Removed belt route';
 }else if(change.kind==='smelt'||change.kind==='oil'){
   const group=change.kind==='smelt'?'smelt':'oil';
   const specs=group==='smelt'?smeltSpecs:oilSpecs;
   if(!specs.some(([key])=>key===change.field))throw Error('Choose a valid '+group+' setting.');
   const value=asInteger(change.value,'Quantity');
   if(group==='smelt'&&change.field==='furnaceSpeed'&&![1,2].includes(value))throw Error('Choose a valid furnace speed.');
   if(group==='smelt'&&change.field==='beltTier'&&![900,1800,2700].includes(value))throw Error('Choose a valid belt tier.');
   next.setup[group][change.field]=value;
   label='Updated '+(specs.find(([key])=>key===change.field)?.[1]||change.field);
 }else if(change.kind==='progress'){
   if(!tasksFor(labels.plan||{}).some(([k])=>k===change.task))throw Error('Choose a current construction goal.');
   next.checked[change.task]=!!change.complete;
   label=(change.complete?'Completed ':'Reopened ')+tasksFor(labels.plan).find(([k])=>k===change.task)[1];
 }else throw Error('Unknown quick action.');
 return {state:next,label};
}
if(typeof module==='object'&&module.exports)module.exports={applyQuickEdit,tasksFor,asInteger};
if(typeof document==='undefined')return;
function init(){
 const $=id=>document.getElementById(id),panel=$('quickAddPanel');
 if(!panel)return;
 const trigger=$('quickAddToggle'),shade=$('quickAddBackdrop'),body=$('quickAddBody'),
   feedback=$('quickAddFeedback'),undoButton=$('quickAddUndo'),saveButton=$('quickAddSave'),
   removeButton=$('quickAddRemove');
 const modeButtons=[...document.querySelectorAll('[data-quick-mode]')];
 const specs={smelt:smeltSpecs,oil:oilSpecs};
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const opts=(items,selected)=>items.map(([value,label])=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>').join('');
 const ctx={
   machineRecipes:itemsForSetup.slice(),
   feedRecipes:feedMaterials.map(x=>x[0]),
   destinations:destinations.slice(),
   recipeKinds:Object.fromEntries(itemsForSetup.map(x=>[x,R[x][3]])),
   recipeNames:Object.fromEntries(itemsForSetup.map(x=>[x,R[x][0]])),
   plan:factory
 };
 const snap=()=>clone({setup,checked:factory.checked});
 const serialized=()=>JSON.stringify(snap());
 let mode='machine',target='new',field='ironFurnaces',lastAction=null,opened=false;
 function notice(message,isError){
   feedback.textContent=message;
   feedback.dataset.error=isError?'true':'false';
 }
 function updateUndo(){
   undoButton.disabled=!lastAction;
   $('quickAddUndoNote').textContent=lastAction?'Last: '+lastAction.label:'Undo is available after saving a change.';
 }
 function existingTarget(){
   if(target==='new')return null;
   const rows=mode==='machine'?setup.machines:setup.feeds;
   const n=Number(target);
   return Number.isInteger(n)&&rows[n]?rows[n]:null;
 }
 function inputCount(value){
   return '<div class="quick-field"><label for="quickCount">Quantity</label><div class="quick-counter">'+
     '<button type="button" id="quickCountMinus" aria-label="Decrease quantity">−</button>'+
     '<input id="quickCount" type="number" min="0" max="999999" step="1" inputmode="numeric" value="'+esc(value)+'">'+
     '<button type="button" id="quickCountPlus" aria-label="Increase quantity">+</button></div></div>';
 }
 function selectField(id,label,options,value){
   return '<div class="quick-field"><label for="'+id+'">'+esc(label)+'</label><select id="'+id+'">'+opts(options,value)+'</select></div>';
 }
 function render(){
   modeButtons.forEach(b=>{const on=b.dataset.quickMode===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
   removeButton.hidden=true;
   let html='';
   if(mode==='machine'||mode==='belt'){
     const machine=mode==='machine',rows=machine?setup.machines:setup.feeds;
     if(target!=='new'&&!rows[Number(target)])target='new';
     const row=existingTarget()||(machine?{recipe:'advanced-circuit',count:1,tier:.75,destination:'Available for new build'}:{recipe:'plastic-bar',count:1,tier:'red',destination:'Main bus'});
     const rowOptions=[['new',machine?'＋ New production line':'＋ New belt route']].concat(rows.map((x,i)=>[String(i),(machine?ctx.recipeNames[x.recipe]||x.recipe:feedMaterials.find(a=>a[0]===x.recipe)?.[1]||x.recipe)+' · '+x.destination+' · '+x.count]));
     html+=selectField('quickTarget',machine?'Choose production line':'Choose belt route',rowOptions,target);
     html+='<div class="quick-fields">';
     html+=selectField('quickRecipe',machine?'Recipe':'Resource',machine?itemsForSetup.map(k=>[k,R[k][0]]):feedMaterials,row.recipe);
     html+=inputCount(row.count);
     html+='</div><div class="quick-fields">';
     html+=selectField('quickDestination','Destination',destinations.map(x=>[x,x]),row.destination);
     if(machine){
       html+='<div id="quickTierField"'+(R[row.recipe]?.[3]==='asm'?'':' hidden')+'>'+
         selectField('quickTier','Assembler tier',[['0.5','Assembler 1'],['0.75','Assembler 2'],['1.25','Assembler 3']],row.tier||.75)+'</div>';
     }else html+=selectField('quickTier','Belt tier',[['yellow','Yellow · 900/min'],['red','Red · 1,800/min'],['blue','Blue · 2,700/min']],row.tier);
     html+='</div>';
     const selectedLabel=machine?(ctx.recipeNames[row.recipe]||R[row.recipe]?.[0]||row.recipe):
      (feedMaterials.find(x=>x[0]===row.recipe)?.[1]||row.recipe);
     html+='<div id="quickItemPreview" class="quick-item-preview">'+(root.NauvisIcons?.item?.(row.recipe,38)||'')+
      '<span>'+esc(selectedLabel)+'<small>Original NAUVIS icon · local asset</small></span></div>';
     html+='<p class="quick-help">'+(machine?'New lines count actual assemblers or chemical plants, not planned machines.':'Belts represent transport capacity, not additional production.')+'</p>';
     removeButton.hidden=target==='new';
     saveButton.textContent=target==='new'?'Add to existing factory':'Save change';
   }else if(mode==='smelt'||mode==='oil'){
     const options=specs[mode];
     if(!options.some(([k])=>k===field))field=options[0][0];
     html+=selectField('quickMetric',mode==='smelt'?'Smelting and furnace setting':'Oil processing setting',options,field);
     const value=setup[mode][field];
     if(mode==='smelt'&&field==='furnaceSpeed'){
       html+=selectField('quickValue','Furnace type',[['1','Stone furnaces'],['2','Steel / electric furnaces']],value);
     }else if(mode==='smelt'&&field==='beltTier'){
       html+=selectField('quickValue','Smelting output belt type',[['900','Yellow · 900/min'],['1800','Red · 1,800/min'],['2700','Blue · 2,700/min']],value);
     }else html+=inputCount(value);
     html+='<p class="quick-help">Adjusts the existing factory totals directly. Furnace outputs still depend on available input and belt capacity.</p>';
     saveButton.textContent='Update factory total';
   }else if(mode==='progress'){
     const tasks=tasksFor(factory);
     if(!tasks.some(([k])=>k===field))field=tasks[0][0];
     html+=selectField('quickTask','Construction milestone',tasks,field);
     html+='<label class="quick-progress"><input type="checkbox" id="quickComplete"'+(factory.checked[field]?' checked':'')+'><span>Mark this build as completed</span></label>';
     html+='<p class="quick-help">Changes the original circuit-district checklist, not the current Factory inventory.</p>';
     saveButton.textContent='Update progress';
   }
   body.innerHTML=html;
   if(mode==='machine'||mode==='belt'){
     $('quickTarget').addEventListener('change',e=>{target=e.target.value;render()});
     $('quickRecipe').addEventListener('change',e=>{
       const key=e.target.value;
       if(mode==='machine')$('quickTierField').hidden=R[key]?.[3]!=='asm';
       const name=mode==='machine'?(ctx.recipeNames[key]||R[key]?.[0]||key):
        (feedMaterials.find(x=>x[0]===key)?.[1]||key);
       $('quickItemPreview').innerHTML=(root.NauvisIcons?.item?.(key,38)||'')+
        '<span>'+esc(name)+'<small>Original NAUVIS icon · local asset</small></span>';
      });
   }else if(mode==='smelt'||mode==='oil')$('quickMetric').addEventListener('change',e=>{field=e.target.value;render()});
   else $('quickTask').addEventListener('change',e=>{field=e.target.value;render()});
   const count=$('quickCount');
   if(count){
     $('quickCountMinus').addEventListener('click',()=>{count.value=String(Math.max(0,(Number(count.value)||0)-1));count.focus()});
     $('quickCountPlus').addEventListener('click',()=>{count.value=String(Math.min(999999,(Number(count.value)||0)+1));count.focus()});
   }
   updateUndo();
 }
 function currentChange(){
   if(mode==='machine'||mode==='belt')return {
     kind:mode,target,
     recipe:$('quickRecipe').value,
     count:$('quickCount').value,
     tier:$('quickTier')?.value,
     destination:$('quickDestination').value
   };
   if(mode==='smelt'||mode==='oil')return {kind:mode,field,value:$('quickCount')?.value??$('quickValue')?.value};
   if(mode==='progress')return {kind:'progress',task:$('quickTask').value,complete:$('quickComplete').checked};
   throw Error('Unknown mode');
 }
 function adopt(newState){
   Object.assign(setup.smelt,newState.setup.smelt);
   Object.assign(setup.oil,newState.setup.oil);
   setup.machines=clone(newState.setup.machines);
   setup.feeds=clone(newState.setup.feeds);
   factory.checked=clone(newState.checked);
 }
 function refreshAll(){
   saveSetup();
   renderSetup();
   renderFactory();
 }
 function commit(change){
   try{
     const before=serialized(),result=applyQuickEdit(snap(),change,ctx),after=JSON.stringify(result.state);
     if(before===after){notice('Nothing changed. Your factory is already up to date.',false);return}
     adopt(result.state);
     lastAction={before,after,label:result.label,kind:change.kind,task:change.task||null};
     if(change.kind==='progress')root.NauvisJournal?.record?.({
      type:'milestone',source:'Quick Change',
      title:(change.complete?'Checked':'Unchecked')+' legacy milestone',
      detail:String(change.task||'Unknown')+' · original district checklist only, not Factory inventory'
     });
     refreshAll();
     if(change.kind==='machine'&&change.target==='new')target=String(setup.machines.length-1);
     if(change.kind==='belt'&&change.target==='new')target=String(setup.feeds.length-1);
     if(change.kind==='remove-machine'||change.kind==='remove-belt')target='new';
     render();
     notice(result.label+'. Saved locally; cloud sync will follow when connected.',false);
   }catch(err){notice(err?.message||'Could not save this change.',true)}
 }
 function undo(){
   if(!lastAction)return;
   if(serialized()!==lastAction.after){
     lastAction=null;updateUndo();
     notice('Other factory data changed since this edit. Undo was disabled to avoid replacing newer changes.',true);
     return;
   }
   const previous=JSON.parse(lastAction.before);
   adopt(previous);
   if(lastAction.kind==='progress')root.NauvisJournal?.record?.({
    type:'milestone',source:'Quick Change',title:'Undid legacy checklist edit',
    detail:String(lastAction.task||'Unknown')+' · restored checklist state; no Factory machines affected'
   });
   lastAction=null;
   refreshAll();
   target='new';
   render();
   notice('Last quick change undone. The restored inventory is saved and will sync.',false);
 }
 function open(){
   root.NauvisGuide?.close?.();
   opened=true;shade.hidden=false;panel.hidden=false;
   trigger.setAttribute('aria-expanded','true');
   document.body.classList.add('quick-add-open');
   mode='machine';target='new';field='ironFurnaces';
   render();notice('Choose what you built or changed.',false);
   modeButtons[0].focus();
 }
 function close(restoreFocus=true){
   if(!opened)return;
   opened=false;shade.hidden=true;panel.hidden=true;
   trigger.setAttribute('aria-expanded','false');
   document.body.classList.remove('quick-add-open');
   if(restoreFocus)trigger.focus();
 }
 trigger.addEventListener('click',()=>opened?close():open());
 $('quickAddClose').addEventListener('click',close);
 shade.addEventListener('click',close);
 modeButtons.forEach(b=>b.addEventListener('click',()=>{
   mode=b.dataset.quickMode;target='new';field=mode==='oil'?'refineries':mode==='progress'?tasksFor(factory)[0][0]:'ironFurnaces';
   render();notice('Changes update your existing factory records.',false);
 }));
 saveButton.addEventListener('click',()=>commit(currentChange()));
 removeButton.addEventListener('click',()=>{
   if(target==='new')return;
   if(!confirm('Remove this saved line? You can undo right afterward.'))return;
   commit({kind:mode==='machine'?'remove-machine':'remove-belt',target});
 });
 undoButton.addEventListener('click',undo);
 document.addEventListener('keydown',event=>{
   if(!opened)return;
   if(event.key==='Escape'){event.preventDefault();close();return}
   if(event.key!=='Tab')return;
   const focusables=[...panel.querySelectorAll('button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]),select:not([hidden]):not([disabled])')]
     .filter(x=>x.getClientRects().length);
   if(!focusables.length)return;
   const first=focusables[0],last=focusables[focusables.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 root.NauvisQuick={
   invalidate(){lastAction=null;updateUndo();if(opened){target='new';render();notice('Factory updated from another device. Refreshed current options.',false)}},
   refresh(){if(opened)render()},
   close
 };
 updateUndo();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})(typeof window==='undefined'?globalThis:window);
