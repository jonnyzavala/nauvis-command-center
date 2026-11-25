/* Live milestones, derived from factory records. Never creates inventory or awards for empty demand. */
(function(root){
'use strict';
const count=(rows)=>Array.isArray(rows)?rows.reduce((n,r)=>n+Math.max(0,Number(r?.count)||0),0):0;
function milestones(s){
 const q=s?.setup||{},p=s?.plan||{},sm=q.smelt||{},oil=q.oil||{},projects=Array.isArray(p.projects)?p.projects:[],active=projects.filter(x=>x.status!=='archived'),tasks=active.flatMap(x=>x.tasks||[]);
 const furnaces=['ironFurnaces','copperFurnaces','steelFurnaces','brickFurnaces'].reduce((n,k)=>n+Math.max(0,Number(sm[k])||0),0);
 const machines=count(q.machines),refineries=Math.max(0,Number(oil.refineries)||0),crackers=Math.max(0,Number(oil.heavyCrackers)||0)+Math.max(0,Number(oil.lightCrackers)||0);
 const total=machines+furnaces+refineries+crackers;
 const lines=(q.machines||[]).filter(r=>Number(r.count)>0).length;
 const planned=tasks.reduce((n,t)=>n+Math.max(0,Number(t.planned)||0),0),built=tasks.reduce((n,t)=>n+Math.max(0,Number(t.built)||0),0);
 const complete=active.filter(x=>x.tasks?.length&&x.tasks.every(t=>t.planned>0&&t.built===t.planned)).length;
 return {total,machines,furnaces,refineries,crackers,lines,assets:count(q.assets),feeds:count(q.feeds),routes:(q.logistics?.edges||[]).length,drafts:(q.logisticsDrafts||[]).length,projects:active.length,planned,built,complete};
}
function coverage(rows){
 const demanded=(rows||[]).filter(r=>Number(r.needed)>1e-8);
 const covered=demanded.filter(r=>r.hasSource&&Number(r.produced)+1e-8>=Number(r.needed));
 const buffered=covered.filter(r=>Number(r.produced)>=Number(r.needed)*1.25-1e-8);
 const routeShort=covered.filter(r=>r.routeLimited&&Number(r.modeledOutput)+1e-8<Number(r.needed));
 return {demanded:demanded.length,covered:covered.length,buffered:buffered.length,routeShort:routeShort.length,all:demanded.length>0&&demanded.length===covered.length&&routeShort.length===0};
}
function coverageBadge(row){
 if(!(row?.needed>1e-8)||!row.hasSource||row.produced+1e-8<row.needed)return null;
 const ratio=row.produced/row.needed;
 return {ratio,buffer:ratio>=1.25-1e-8,routeShort:!!row.routeLimited&&row.modeledOutput+1e-8<row.needed};
}
if(typeof module==='object'&&module.exports)module.exports={milestones,coverage,coverageBadge};
if(typeof document==='undefined')return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ledger=null,queued=false;
function panel(view,title,body,actions=[],awards=[]){
 const page=document.getElementById(view);if(!page)return;
 let el=page.querySelector(':scope > .factory-milestones');
 if(!el){el=document.createElement('section');el.className='factory-milestones';el.setAttribute('aria-label','Factory progress');const hero=page.querySelector(':scope > .hero');if(hero)hero.after(el);else page.prepend(el)}
 const html='<div class="milestone-main"><span class="milestone-symbol" aria-hidden="true">'+(awards.length?'◆':'✦')+'</span><div><small>FACTORY PROGRESS</small><strong>'+esc(title)+'</strong><p>'+esc(body)+'</p></div></div>'+
 (awards.length?'<div class="milestone-awards">'+awards.map(([name,detail])=>'<div class="milestone-award"><span aria-hidden="true">🏆</span><div><b>'+esc(name)+'</b><small>'+esc(detail)+'</small></div></div>').join('')+'</div>':'')+
 (actions.length?'<div class="milestone-actions">'+actions.map(([action,label])=>'<button type="button" data-milestone-action="'+esc(action)+'">'+esc(label)+'</button>').join('')+'</div>':'');
 if(el.innerHTML!==html)el.innerHTML=html;
}
function refresh(){
 const s=root.NauvisLocal?.snapshot?.();if(!s)return;
 const m=milestones(s),v=coverage(ledger?.rows||[]);
 const invAwards=[];
 if(m.furnaces>0)invAwards.push(['First sparks',m.furnaces+' furnaces recorded']);
 if(m.lines>0)invAwards.push(['Factory online',m.lines+' production arrays']);
 if(m.refineries>0)invAwards.push(['Black gold',m.refineries+' advanced-oil refineries']);
 if(m.total>=100)invAwards.push(['Industrial scale',m.total+' recorded production machines']);
 panel('setup',m.total||m.assets||m.feeds?'Your factory is taking shape':'Nothing here yet. The factory must grow.',
 m.total||m.assets||m.feeds?m.total+' production machines · '+m.lines+' arrays · '+m.assets+' infrastructure items. Keep recording what you actually build.':'Record your first physical production chain, or initialize your existing save with guided setup.',
 [['onboard','Guided setup'],['record','Record machines']],invAwards);
 const balanceAwards=[];
 if(v.covered)balanceAwards.push(['Supply matched',v.covered+' / '+v.demanded+' demanded resources at rated 100%+']);
 if(v.buffered)balanceAwards.push(['Room to grow',v.buffered+' resources at rated 125%+']);
 if(v.all)balanceAwards.push(['Ledger in balance','All recorded material demand covered; no known route-limited deficit']);
 panel('balance',!v.demanded?'No recorded demand yet':v.all?'Look at that supply ledger!':v.covered+' of '+v.demanded+' resources covered',
 !v.demanded?'Add your first production chain in Inventory to see useful coverage. Zero demand never earns a trophy.':'Coverage uses recorded existing demand, not hypothetical goals. '+(v.routeShort?v.routeShort+' rated-covered resource(s) have modeled transport/input shortages. ':'')+'Rated capacity is not verified physical delivery.',
 [['setup','Record production'],['logistics','Inspect routes']],balanceAwards);
 const logAwards=[];if(m.routes)logAwards.push(['Connected',m.routes+' recorded routes']);if(m.drafts)logAwards.push(['Architect',m.drafts+' saved proposed designs']);
 panel('logistics',!m.routes&&!m.drafts?'Nothing routed yet. Connect your first production chain!':'Your production network',
 m.routes||m.drafts?m.routes+' actual routes · '+m.drafts+' hypothetical drafts. They remain separate.':'Add recorded production arrays to your network, or send a calculated Blueprint to Logistics for a proposed design.',
 [['setup','Record arrays'],['build','Design a chain']],logAwards);
 const buildAwards=[];if(m.projects)buildAwards.push(['First blueprint queued',m.projects+' active projects']);
 panel('build','Your next production chain starts here', 'Pick a recipe and target rate. Preview transport or queue Construction; neither adds actual machines.',[['factory','View Construction']],buildAwards);
 const constructionAwards=[];
 if(m.built)constructionAwards.push(['First machine placed',m.built+' / '+m.planned+' recorded project items']);
 if(m.complete)constructionAwards.push(['Construction complete',m.complete+' finished active project'+(m.complete===1?'':'s')]);
 panel('factory',m.projects?(m.complete===m.projects?'All active projects complete!':'Construction in progress'):'Nothing queued. Plan your first build!',
 m.projects?m.built+' / '+m.planned+' project items recorded as built. Only mark equipment placed in-game.':'Create a production chain in Blueprint Designer and queue it when you are ready to build.',
 [['build','Plan production']],constructionAwards);
}
function schedule(){if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;refresh()})}
function updateBalance(result){ledger=result;schedule()}
function badge(row){const b=coverageBadge(row);if(!b)return '';return '<span class="milestone-ledger-badge'+(b.routeShort?' route-short':'')+'" title="Rated output divided by existing recorded demand; not a verified delivery">'+(b.routeShort?'△ ':b.buffer?'🏆 ':'✓ ')+esc(Math.round(b.ratio*100))+'% rated'+(b.routeShort?' · route short':'')+'</span>'}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-milestone-action]');if(!b)return;
 const a=b.dataset.milestoneAction;
 if(a==='onboard'){root.NauvisOnboarding?.open?.();return}
 if(a==='record'){root.activateWorkspace('setup',true);root.NauvisQuick?.openInventory?.('machine');return}
 if(['setup','balance','logistics','build','factory','learn'].includes(a))root.activateWorkspace(a,true);
});
root.NauvisMilestones={refresh:schedule,updateBalance,badge};
if(typeof root.NauvisLocal?.snapshot==='function'){renderBalance();schedule()}
})(typeof window==='undefined'?globalThis:window);
