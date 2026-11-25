/* Guided, non-modal walkthroughs. Coaching never creates or modifies factory data. */
(function(root){
'use strict';
const KEY='nauvis-coach-seen-v1';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lessons={
 build:{name:'Design a production chain',intro:'Try a real blueprint calculation with step-by-step guidance. Nothing is built or queued automatically.',steps:[
 {view:'build',target:'#build .ratio-picker',title:'Choose a recipe',body:'Try iron gears, or choose an item you actually want to produce. Search for it and select the recipe.',events:['#build [data-ratio-field="id"]','#build [data-recipe-pick]'],next:'Recipe selected'},
 {view:'build',target:'#build [data-ratio-field="rate"]',title:'Set an output target',body:'Enter 60 items/min for a simple example, or your own target. The planner works backward from that rate.',events:['#build [data-ratio-field="rate"]'],next:'Target selected'},
 {view:'build',target:'#build .ratio-preset-panel',title:'Try a production preset',body:'Starter, Balanced and More suggest different scales. Pick one to recalculate, or keep your custom target.',events:['#build [data-ratio-preset]'],next:'Keep my target'},
 {view:'build',target:'#build [data-ratio-flow-root]',title:'Inspect your production chain',body:'Follow the arrows from ingredients to output. The rounded machine counts tell you what to build; this is still a plan.',next:'I see the chain'},
 {view:'build',target:'#build [data-ratio-logistics-preview]',title:'Preview the network',body:'Click Advanced network preview to inspect proposed arrays and routing. It will not add actual production machines.',events:['#build [data-ratio-logistics-preview]'],expect:'logistics'},
 {view:'logistics',target:'#logisticsEditor [data-proposal-action="recommend"]',fallback:'#logisticsEditor',title:'Generate proposed belt connections',body:'Use the recommended connections control if available. Review capacity and any unresolved inputs. These are hypothetical routes, not actual Inventory.',events:['[data-proposal-action="recommend"]'],next:'Review proposal'},
 {view:'logistics',target:'#logisticsEditor [data-log-preview-action="queue"]',fallback:'#logisticsEditor',title:'Decide whether to queue it',body:'If this is a plan you genuinely want to build, click Queue and name it. Otherwise finish the exercise without saving. Queuing creates a real plan, never actual machines.',events:['[data-log-preview-action="queue"]'],next:'Finish without queuing',finish:true,modal:true},
 {view:'logistics',target:'#projectsName',modal:'#projectsDialog',title:'Name your real construction plan',body:'Enter a useful name and explicitly queue the project only if you intend to build it. Cancel if this was just practice.',events:['#projectsDialogSubmit'],success:'project',next:null},
 {view:'factory',target:'#projectsList',title:'Your construction checklist',body:'Your plan is now queued. Mark Built only when a machine is physically placed in Factorio. This updates actual Inventory once.',next:'Finish walkthrough'}
 ]},
 setup:{name:'Record an existing production array',intro:'Use your real factory counts. This exercise guides you through Quick Change without creating sample inventory.',steps:[
 {view:'setup',target:'#setupAddMachine',title:'Open Quick Change',body:'Click Record machines / Add production line to open the actual Inventory editor.',events:['#setupAddMachine','#quickAddToggle','[data-milestone-action="record"]'],expectPanel:true},
 {view:'setup',target:'#quickRecipe',panel:true,title:'Choose what you built',body:'Select the recipe produced by an existing physical array. For example, green circuits if you really have green-circuit assemblers.',events:['#quickRecipe'],next:'Recipe selected'},
 {view:'setup',target:'#quickCount',panel:true,title:'Enter the real machine count',body:'Enter the number of physical machines in this array. Do not enter the count suggested by a future blueprint.',events:['#quickCount','#quickCountPlus','#quickCountMinus'],next:'Count entered'},
 {view:'setup',target:'#quickDestination',panel:true,title:'Identify its allocation',body:'Choose where the output actually goes. Mark Available for new build only if it truly is spare; set the assembler tier if applicable.',next:'Review my entry'},
 {view:'setup',target:'#quickAddSave',panel:true,title:'Record only real equipment',body:'Check the recipe, count, tier and destination. Save if these machines really exist. You can finish without saving if you were practicing.',events:['#quickAddSave'],success:'inventory',next:'Finish without saving',finish:true},
 {view:'setup',target:'#setupMachinesPanel',title:'Your array is recorded',body:'The real production line now feeds Inventory and Balance. Use Quick Change again whenever you expand it.',next:'Finish walkthrough'}
 ]},
 balance:{name:'Read your resource coverage',intro:'Learn the difference between rated output, recorded demand and delivery limits.',steps:[
 {view:'balance',target:'#balanceSummary',title:'Read the overview',body:'Known shortages and unrecorded sources are separate. No recorded demand does not mean your factory is balanced.',next:'Next'},
 {view:'balance',target:'#balanceLedger',title:'Read each resource row',body:'Compare rated output with existing use. A 100%+ coverage badge means rated demand is covered, not that every belt physically delivers it.',next:'Next'},
 {view:'balance',target:'#balanceIncludeGoal',title:'Try the what-if scenario',body:'Toggle Include current goal to see hypothetical demand separately. It does not change actual machine counts.',events:['#balanceIncludeGoal'],next:'Skip scenario'},
 {view:'balance',target:'#balanceAlerts',title:'Investigate bottlenecks',body:'Read the shortage or missing-source notes. Open Logistics to inspect modeled routes.',next:'Finish walkthrough'}
 ]},
 logistics:{name:'Explore production routing',intro:'Inspect the real resource network or a hypothetical design without automatically adding routes.',steps:[
 {view:'logistics',target:'#logisticsEditor',title:'Actual versus proposed',body:'Actual routing describes equipment you have recorded. Proposed designs are hypothetical until you explicitly queue a build.',next:'Next'},
 {view:'logistics',target:'#logisticsEditor [data-log-resource]',fallback:'#logisticsEditor',title:'Inspect a resource',body:'In the resource network view, select the resource you want to inspect. Existing source and destination records can be linked without adding machines.',next:'Next'},
 {view:'logistics',target:'#logisticsEditor [data-log-action="picker"]',fallback:'#logisticsEditor',title:'Choose network nodes',body:'Use Add to network if you are modeling a real connection. You may inspect the available groups without saving a route. For a safe proposed example, replay the Blueprint Designer walkthrough.',next:'Finish walkthrough'}
 ]},
 factory:{name:'Work through your construction queue',intro:'Learn how a saved plan turns into actual Inventory.',steps:[
 {view:'factory',target:'#projectsList',title:'Inspect a queued project',body:'A queue entry is a plan, not production. If there are no projects, use the Blueprint Designer walkthrough to create a real one when ready.',next:'Next'},
 {view:'factory',target:'#projectsList [data-project-plus]:not(:disabled)',fallback:'#projectsList',title:'Record real construction',body:'Expand a project’s tasks. A plus button records one physically placed machine or structure and updates Inventory exactly once. Never click it just to practice.',next:'Finish walkthrough'}
 ]},
 flow:{name:'Check a belt split',intro:'Check a resource inside Planner without creating factory records.',steps:[{view:'build',target:'#build [data-flow-belt-toggle]',title:'Show the required belts',body:'Enable Show belts in the blueprint to compare assigned transport capacity with demand.',next:'Next'},{view:'build',target:'#plannerQuickCheck',title:'Check supply and splits',body:'Open this optional checker to enter available supply and test destinations. It stays inside Planner.',next:'Finish walkthrough'}]},
 log:{name:'Keep an engineer’s log',intro:'Save a note for your next session.',steps:[{view:'log',target:'#journalNoteInput',title:'Record your next objective',body:'Write what you want to remember for the next session. Save only if you want the note added to your actual journal.',next:'Next'},{view:'log',target:'#journalList',title:'Review your history',body:'Construction actions and notes use the same journal in both modes. No duplicate records are created.',next:'Finish walkthrough'}]},
 learn:{name:'Explore the Quick Guide',intro:'Find explanations and replay any walkthrough whenever you need help.',steps:[{view:'learn',target:'#learn .hero',title:'Your reference desk',body:'Use this guide for explanations, then tap the bottom-left question button to select a hands-on walkthrough.',next:'Finish walkthrough'}]}
};
function lessonKeys(){return Object.keys(lessons)}
function matchingEvent(target,selectors){return !!target?.closest&&!!selectors?.some(s=>target.closest(s))}
if(typeof module==='object'&&module.exports)module.exports={lessons,lessonKeys,matchingEvent};
if(typeof document==='undefined')return;
let seen={};try{seen=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
const card=document.createElement('aside');card.id='nauvisCoach';card.className='nauvis-coach';card.setAttribute('aria-label','Interactive factory walkthrough');card.hidden=true;document.body.append(card);
let current=null,index=0,highlight=null,menu=false,wait=null,previousWorkspace=null,prior=null;
const $=s=>document.querySelector(s),snap=()=>root.NauvisLocal?.snapshot?.();
function persist(view){seen[view]=true;try{localStorage.setItem(KEY,JSON.stringify(seen))}catch{}}
function clearHighlight(){highlight?.classList.remove('nauvis-coach-target');highlight=null}
function visible(el){return !!el&&el.getClientRects().length>0&&!el.closest('[hidden]')}
function find(step){const el=$(step.target);return visible(el)?el:step.fallback?$(step.fallback):null}
function clear(){clearHighlight();if(wait!==null){clearTimeout(wait);wait=null}card.hidden=true;card.className='nauvis-coach';document.body.append(card);current=null;menu=false;prior=null}
function close(){clear()}
function header(kicker,title,body){return '<div class="coach-head"><div><small>'+esc(kicker)+'</small><strong>'+esc(title)+'</strong></div><button type="button" data-coach-action="close" aria-label="Close walkthrough">×</button></div><p>'+esc(body)+'</p>'}
function menuHTML(){
 const here=document.body.dataset.workspace,keys=root.NauvisFocus?.getMode?.()==='focus'?['build','factory','log','flow','logistics','setup','balance','learn']:lessonKeys(),order=[here,...keys.filter(k=>k!==here)].filter(k=>lessons[k]);
 return '<div class="help-training-intro"><strong>Hands-on walkthroughs</strong><p>Follow real controls at your own pace. No sample inventory is added.</p></div><div class="coach-menu">'+order.map(k=>'<button type="button" data-coach-lesson="'+k+'" '+(k===here?'class="coach-current"':'')+'><strong>'+esc(lessons[k].name)+'</strong><small>'+esc(k===here?'Current workspace':root.NauvisFocus?.getMode?.()==='focus'&&['setup','balance','learn'].includes(k)?'Full mode · advanced':seen[k]?'Replay walkthrough':'Guided example')+'</small></button>').join('')+'</div>';
}
function mountMenu(host){
 if(!host)return;
 if(current){host.innerHTML='<p>A walkthrough is already in progress.</p><button type="button" data-coach-action="resume">Resume walkthrough</button><button type="button" data-coach-action="restart-menu">End walkthrough and browse lessons</button>';return}
 menu=true;host.replaceChildren(card);card.className='nauvis-coach coach-inline coach-help-menu';card.hidden=false;card.innerHTML=menuHTML();
}
function unmountMenu(){if(menu){clear();}}
function openMenu(){if(root.NauvisGuide){root.NauvisGuide.open('walkthroughs');return}clear();menu=true;card.hidden=false;card.innerHTML=menuHTML()}
function renderPrompt(view){
 const page=document.getElementById(view),lesson=lessons[view];if(!page||!lesson||seen[view]||current||menu||page.querySelector('.coach-first-use'))return;
 const prompt=document.createElement('div');prompt.className='coach-first-use';prompt.innerHTML='<div><strong>Want a guided example?</strong><span>'+esc(lesson.intro)+'</span></div><div><button type="button" data-coach-lesson="'+view+'">Yes, walk me through it</button><button type="button" data-coach-dismiss="'+view+'">Not now</button></div>';
 const anchor=page.querySelector(':scope > .factory-milestones')||page.querySelector(':scope > .hero');if(anchor)anchor.after(prompt);else page.prepend(prompt);
}
function removePrompt(view){document.getElementById(view)?.querySelector('.coach-first-use')?.remove()}
function onActivate(view){if(!current&&!menu)renderPrompt(view);else if(current&&lessons[current].steps[index]?.view!==view&&!lessons[current].steps[index]?.expect){/* Keep explicit coaching session available; never hijack ordinary navigation. */}}
function start(key){
 if(!lessons[key])return;
 root.NauvisGuide?.close?.();clear();current=key;index=0;prior=snap();persist(key);removePrompt(key);
 previousWorkspace=document.body.dataset.workspace;show(true);
}
function attach(step){
 const modal=step.modal&&typeof step.modal==='string'?$(step.modal):null,panel=step.panel?$('#quickAddPanel'):null;
 const host=modal?.open?modal.querySelector('form')||modal:panel&&!panel.hidden?panel:null;
 if(host){card.className='nauvis-coach coach-inline';host.insertBefore(card,host.firstChild)}
 else{card.className='nauvis-coach';document.body.append(card)}
}
function focusTarget(step,scroll){
 clearHighlight();const t=find(step);if(!t)return;
 highlight=t;highlight.classList.add('nauvis-coach-target');
 if(scroll){const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.body.dataset.sensoryMotion==='off';try{t.scrollIntoView({block:'center',inline:'nearest',behavior:reduced?'instant':'smooth'})}catch{}}
 if(!card.classList.contains('coach-inline')){
  const r=t.getBoundingClientRect(),h=window.innerHeight;
  card.classList.toggle('coach-top',r.top>h*.58);
 }
}
function show(scroll=false){
 if(!current)return;
 const lesson=lessons[current],step=lesson.steps[index];if(!step){clear();return}
 if(!(step.view==='logistics'&&root.NauvisFocus?.getMode?.()==='focus'&&document.body.dataset.workspace==='build'&&$('#plannerNetwork')?.open)&&document.body.dataset.workspace!==step.view&&!(typeof step.modal==='string'&&$(step.modal)?.open))root.activateWorkspace(step.view,false);
 if(step.panel&&$('#quickAddPanel')?.hidden){root.NauvisQuick?.openInventory?.('machine')}
 // Native project dialogs stay functional. Put instructions inside the actual dialog.
 if(typeof step.modal==='string'&&!$(step.modal)?.open){clear();return}
 attach(step);card.hidden=false;
 const last=index===lesson.steps.length-1;
 card.innerHTML=header('WALKTHROUGH · '+(index+1)+' / '+lesson.steps.length,step.title,step.body)+'<div class="coach-track"><span style="width:'+((index+1)/lesson.steps.length*100)+'%"></span></div><div class="coach-actions">'+(index>0&&!step.panel&&typeof step.modal!=='string'?'<button type="button" data-coach-action="back">Back</button>':'')+'<button type="button" data-coach-action="locate">Show me</button>'+(step.next?'<button type="button" class="coach-primary" data-coach-action="'+(last||step.finish?'finish':'next')+'">'+esc(step.next)+'</button>':'')+'<button type="button" data-coach-action="close">Exit</button></div>';
 requestAnimationFrame(()=>{if(current&&lessons[current].steps[index]===step)focusTarget(step,scroll)});
}
function advance(){if(!current)return;index++;if(index>=lessons[current].steps.length){clear();return}prior=snap();show(true)}
function afterAction(step){
 if(!current||lessons[current].steps[index]!==step)return;
 if(step.expect&&document.body.dataset.workspace!==step.expect&&!(step.expect==='logistics'&&root.NauvisFocus?.getMode?.()==='focus'&&$('#plannerNetwork')?.open))return;
 if(step.expectPanel&&$('#quickAddPanel')?.hidden)return;
 if(step.success==='project'&&(snap()?.plan.projects.length||0)<=(prior?.plan.projects.length||0))return;
 if(step.success==='inventory'&&(snap()?.setup.machines.length||0)<=(prior?.setup.machines.length||0))return;
 if(step.modal===true&&!$('#projectsDialog')?.open)return;
 if(step.success==='inventory')root.NauvisQuick?.close?.();
 advance();
}
// Capture before controls rerender their own DOM; advance only after their normal handlers.
function eventAction(e){
 if(!current||e.target.closest?.('#nauvisCoach'))return;
 const step=lessons[current].steps[index];
 if(!matchingEvent(e.target,step.events))return;
 if(e.type==='click'&&e.target.closest('input,select,textarea'))return;
 if(e.type==='change'&&e.target.closest('button'))return;
 if(wait!==null)clearTimeout(wait);wait=setTimeout(()=>{wait=null;afterAction(step)},80);
}
document.addEventListener('click',eventAction,true);document.addEventListener('change',eventAction,true);
document.addEventListener('click',e=>{
 const lesson=e.target.closest('[data-coach-lesson]')?.dataset.coachLesson;
 if(lesson){start(lesson);return}
 const dismiss=e.target.closest('[data-coach-dismiss]')?.dataset.coachDismiss;
 if(dismiss){persist(dismiss);removePrompt(dismiss);return}
 const b=e.target.closest('[data-coach-action]');if(!b)return;
 const a=b.dataset.coachAction;
 if(a==='resume'){root.NauvisGuide?.close?.();show(true);return}
 if(a==='restart-menu'){clear();openMenu();return}
 if(a==='close'||a==='finish'){close();return}
 if(a==='locate'){if(current)show(true);return}
 if(a==='next'){advance();return}
 if(a==='back'&&current&&index>0){index--;prior=snap();show(true)}
});
document.addEventListener('click',e=>{if(!current)return;const step=lessons[current].steps[index];if(e.target.closest('#quickAddClose,#quickAddBackdrop,#projectsDialogClose')&&(step.panel||typeof step.modal==='string'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden)close()});
root.NauvisCoach={openMenu,mountMenu,unmountMenu,start,onActivate,close,state:()=>({lesson:current,index,menu}),refresh:()=>{if(current)focusTarget(lessons[current].steps[index],false)}};
onActivate(document.body.dataset.workspace||'balance');
})(typeof window==='undefined'?globalThis:window);
