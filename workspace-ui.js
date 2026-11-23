/* NAUVIS v0.25: one Plan & Build destination, compact overviews, jump-to controls. */
(function(root){
'use strict';
const ids=['learn','setup','balance','build','factory'];
const config={
 learn:{title:'Guide overview',intro:'The concepts behind the ratios, construction tracking and actual Factory.',links:[['Basics','.rulegrid'],['Circuit example','#guide-example'],['Belt capacity','#guide-belts']]},
 setup:{title:'Factory overview',intro:'Records you entered, not live game telemetry.',links:[['Smelting','#setupSmeltingPanel'],['Oil','#setupOilPanel'],['Machines','#setupMachinesPanel'],['Belts','#setupBeltsPanel'],['Compare','#setupComparePanel'],['Inventory tools','#setupStorePanel']]},
 balance:{title:'Balance overview',intro:'Rated capacity versus recorded demand. Physical routing remains unmodeled.',links:[['Capacity ledger','.balance-ledger-panel'],['Warnings','.balance-insights'],['Recipe ratios','[data-ratio-explorer="balance"]'],['Explanation','#workspace-balance-interpret']]},
 build:{title:'Blueprint overview',intro:'Experiment with recipes and machine counts, then save a design to Construction.',links:[['Visual production flow','[data-ratio-explorer="build"]'],['Detailed calculator','#buildClassic']]},
 factory:{title:'Construction overview',intro:'Each built-machine check updates the project and the actual Factory record together.',links:[['Projects','#projectsListPanel'],['Journal','#journalPanel'],['Original circuit district','#legacyDistrict'],['Archived','#projectsArchivedWrapper']]}
};
const el=id=>document.getElementById(id);
const fmt=n=>(Number(n)||0).toLocaleString();
const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function stats(view){
 const snapshot=root.NauvisLocal?.snapshot?.()||{},p=snapshot.plan||{},setup=snapshot.setup||{};
 if(view==='learn')return [[Object.keys(R||{}).length,'Recipes modeled'],['4','Top-level workspaces'],['1','Factory inventory']];
 if(view==='setup')return [[(setup.machines||[]).length,'Recorded lines'],[(setup.machines||[]).reduce((n,x)=>n+Math.max(0,Number(x.count)||0),0),'Recorded machines'],[(setup.feeds||[]).length,'Belt routes']];
 if(view==='balance'){
  const values=[...document.querySelectorAll('#balanceSummary .balance-kpi b')].map(x=>x.textContent.trim());
  return [[values[0]||'—','Production lines'],[values[1]||'—','Known shortages'],[values[2]||'—','Unknown sources']];
 }
 if(view==='build'){
  const c=document.querySelector('#build .ratio-flow-total')?.textContent.match(/^\d[\d,.]*/)?.[0]||'—';
  return [[c,'Design machines'],[Object.keys(R||{}).length,'Available recipes'],['Flow','Default view']];
 }
 const projects=(p.projects||[]).filter(x=>x.status!=='archived'),built=projects.reduce((t,x)=>t+(x.tasks||[]).reduce((a,z)=>a+Math.max(0,Number(z.built)||0),0),0);
 return [[projects.length,'Active projects'],[built,'Built machines'],[root.NauvisJournal?.count?.()||0,'Journal entries']];
}
function injectOverview(view){
 const host=el(view),cfg=config[view];if(!host||host.querySelector(':scope > .workspace-overview'))return;
 const hero=host.querySelector(':scope > .hero');if(!hero)return;
 const box=document.createElement('section');box.className='workspace-overview';box.setAttribute('aria-label',cfg.title);
 box.innerHTML='<div class="workspace-overview-intro"><div><span class="workspace-eyebrow">WORKSPACE OVERVIEW</span><h2>'+escape(cfg.title)+'</h2><p>'+escape(cfg.intro)+'</p></div><span class="workspace-overview-led" aria-hidden="true"></span></div>'+
 '<div data-workspace-stats class="workspace-overview-stats"></div>'+
 '<div class="workspace-overview-jumps"><strong>Jump to</strong><div class="workspace-jump-list">'+cfg.links.map(([name],i)=>'<button type="button" data-workspace-jump="'+i+'">'+escape(name)+' <span aria-hidden="true">↗</span></button>').join('')+'</div></div>'+
 (view==='factory'?'<div class="workspace-recent"><div class="workspace-recent-head"><strong>Recent changes</strong><button type="button" data-workspace-journal>Open journal ↗</button></div><ul id="journalPreview" class="journal-preview-list"></ul></div>':'');
 hero.insertAdjacentElement('afterend',box);
 box.addEventListener('click',e=>{
  if(e.target.closest('[data-workspace-journal]')){jump(view,'#journalPanel');return}
  const button=e.target.closest('[data-workspace-jump]');if(!button)return;
  const next=cfg.links[Number(button.dataset.workspaceJump)]?.[1];if(next)jump(view,next);
 });
}
function makeModeSwitch(view){
 const host=el(view);if(!host||host.querySelector(':scope > .plan-build-switch'))return;
 const bar=document.createElement('div');bar.className='plan-build-switch';bar.setAttribute('role','group');bar.setAttribute('aria-label','Plan and Build modes');
 bar.innerHTML='<div class="plan-switch-caption"><span class="plan-switch-led" aria-hidden="true"></span> PLAN & BUILD <small>Design → Construct → Factory</small></div>'+
 '<div class="plan-switch-options"><button type="button" data-plan-target="build" aria-pressed="'+(view==='build')+'"><span class="plan-switch-light"></span>Blueprint Designer</button>'+
 '<button type="button" data-plan-target="factory" aria-pressed="'+(view==='factory')+'"><span class="plan-switch-light"></span>Construction Queue</button></div>';
 host.insertBefore(bar,host.firstElementChild);
 bar.addEventListener('click',e=>{const b=e.target.closest('[data-plan-target]');if(b)root.activateWorkspace(b.dataset.planTarget,true)});
}
function makeFold(node,initialClosed){
 if(!node||node.dataset.workspaceFoldReady)return;
 const head=node.querySelector(':scope > .section-head');if(!head)return;
 node.dataset.workspaceFoldReady='1';node.classList.add('workspace-foldable');
 const button=document.createElement('button');button.type='button';button.className='workspace-fold-toggle';
 button.setAttribute('aria-label','Toggle '+(head.querySelector('h2')?.textContent||'section'));head.append(button);
 const set=hidden=>{node.classList.toggle('workspace-folded',hidden);button.innerHTML=(hidden?'Expand':'Collapse')+' <span aria-hidden="true">⌄</span>';button.setAttribute('aria-expanded',String(!hidden))};
 set(initialClosed);node.workspaceExpand=()=>set(false);
 button.addEventListener('click',()=>set(!node.classList.contains('workspace-folded')));
}
function initFolds(){
 const learn=el('learn');if(learn){const sections=[...learn.querySelectorAll(':scope > .section.panel')];if(sections[0])sections[0].id='guide-example';if(sections[1])sections[1].id='guide-belts'}
 const balance=el('balance');
 if(balance){const explain=[...balance.querySelectorAll(':scope > .section.panel')].find(x=>x.textContent.includes('How to interpret this'));if(explain)explain.id='workspace-balance-interpret'}
 for(const [id,closed] of [['setupOilPanel',true],['setupBeltsPanel',true],['setupComparePanel',true],['setupStorePanel',true],['workspace-balance-interpret',true],['guide-example',false],['guide-belts',true]])makeFold(el(id),closed);
}
function jump(view,selector){
 const host=el(view),target=host?.querySelector(selector);if(!target||target.hidden)return;
 for(let node=target;node&&node!==host;node=node.parentElement){
  if(node.tagName==='DETAILS')node.open=true;
  node.workspaceExpand?.();
 }
 const reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 target.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});
}
function refresh(view){
 for(const id of (view?[view]:ids)){
  const container=el(id)?.querySelector(':scope > .workspace-overview [data-workspace-stats]');
  if(container)container.innerHTML=stats(id).map(([n,label])=>'<div class="workspace-mini-stat"><strong>'+escape(typeof n==='number'?fmt(n):n)+'</strong><small>'+escape(label)+'</small></div>').join('');
 }
}
function onActivate(view){
 for(const id of ['build','factory'])el(id)?.querySelectorAll('[data-plan-target]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.planTarget===view)));
 refresh(view);root.NauvisJournal?.render?.();
}
function init(){
 for(const id of ['build','factory'])makeModeSwitch(id);
 ids.forEach(injectOverview);
 initFolds();
 root.NauvisWorkspace={onActivate,refresh,jump};
 refresh();root.NauvisJournal?.render?.();
 onActivate(document.querySelector('.view.active')?.id||'balance');
}
if(typeof module==='object'&&module.exports)module.exports={stats};
if(typeof document!=='undefined')init();
})(typeof window==='undefined'?globalThis:window);
