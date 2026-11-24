/* NAUVIS v0.42 · Editable single-resource logistics networks.
   Planning capacity, not game telemetry. Pure graph engine + mobile editor. */
(function(root){
'use strict';
const TIERS={yellow:900,red:1800,blue:2700},KINDS=['source','splitter','merger','destination'];
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const cap=e=>num(e.belts)*(TIERS[e.tier]||0);
const weight=v=>v===''||v==null?'':num(v);
const blank=()=>({nodes:[],edges:[]});
const id=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const clone=x=>JSON.parse(JSON.stringify(x));
function normalize(raw){
 const out=blank(),seen=new Set();
 for(const n of Array.isArray(raw?.nodes)?raw.nodes:[]){
  if(!n||typeof n.id!=='string'||seen.has(n.id)||!KINDS.includes(n.kind)||typeof n.item!=='string')continue;
  seen.add(n.id);out.nodes.push({...n,label:String(n.label||n.kind).slice(0,80)});
 }
 const by=new Map(out.nodes.map(n=>[n.id,n])),edges=new Set();
 for(const e of Array.isArray(raw?.edges)?raw.edges:[]){
  const a=by.get(e?.from),b=by.get(e?.to);
  if(!a||!b||a.item!==b.item||a.id===b.id||typeof e.id!=='string'||edges.has(e.id)||!TIERS[e.tier]||!Number.isSafeInteger(Number(e.belts))||Number(e.belts)<1||Number(e.belts)>100)continue;
  edges.add(e.id);out.edges.push({...e,belts:Number(e.belts),weight:weight(e.weight)});
 }
 return out;
}
function order(nodes,edges){
 const ids=new Set(nodes.map(n=>n.id)),degree=new Map(nodes.map(n=>[n.id,0])),out=new Map(nodes.map(n=>[n.id,[]])),stage=new Map(nodes.map(n=>[n.id,0]));
 for(const e of edges){if(!ids.has(e.from)||!ids.has(e.to))throw Error('Connection endpoint missing.');degree.set(e.to,degree.get(e.to)+1);out.get(e.from).push(e)}
 const queue=nodes.filter(n=>!degree.get(n.id)).map(n=>n.id),ordered=[];
 for(let i=0;i<queue.length;i++){const k=queue[i];ordered.push(k);for(const e of out.get(k)){stage.set(e.to,Math.max(stage.get(e.to),stage.get(k)+1));degree.set(e.to,degree.get(e.to)-1);if(!degree.get(e.to))queue.push(e.to)}}
 if(ordered.length!==nodes.length)throw Error('Circular belt routes are not supported. Use a one-way allocation graph.');
 return {ordered,stage,out};
}
function connect(graph,edge){
 const g=normalize(graph),a=g.nodes.find(n=>n.id===edge.from),b=g.nodes.find(n=>n.id===edge.to);
 if(!a||!b||a.id===b.id||a.item!==b.item)throw Error('Connect two different nodes carrying the same resource.');
 if(a.kind==='destination'||b.kind==='source')throw Error('Destinations receive material; producers supply it.');
 if(g.edges.some(e=>e.from===a.id&&e.to===b.id))throw Error('This route already exists. Edit its belt count instead.');
 if(!TIERS[edge.tier]||!Number.isSafeInteger(Number(edge.belts))||Number(edge.belts)<1||Number(edge.belts)>100)throw Error('Choose 1–100 physical belts and a supported tier.');
 g.edges.push({...edge,belts:Number(edge.belts),weight:weight(edge.weight)});
 order(g.nodes,g.edges);return g;
}
function analyze(graph,lookup=()=>null){
 const {nodes,edges}=normalize(graph),by=new Map(nodes.map(n=>[n.id,n])),{ordered,stage,out}=order(nodes,edges);
 const received=new Map(nodes.map(n=>[n.id,0])),results={},routes={},warnings=[],usedLinks=new Set();
 for(const k of ordered){
  const n=by.get(k),linked=n.link?lookup(n):null,duplicate=n.link&&usedLinks.has(n.kind+'|'+n.item+'|'+n.link);
  if(n.link)usedLinks.add(n.kind+'|'+n.item+'|'+n.link);
  const missing=!!n.link&&(!linked||duplicate);
  const supply=n.kind==='source'?(missing?0:n.link?num(linked.rate):num(n.amount)*(TIERS[n.tier]||1800)):received.get(k);
  const demand=n.kind==='destination'?(missing?null:n.link?num(linked.rate):n.amount===''||n.amount==null?null:num(n.amount)*(TIERS[n.tier]||1800)):null;
  const outgoing=out.get(k),totalCapacity=outgoing.reduce((s,e)=>s+cap(e),0),budget=Math.min(supply,totalCapacity);
  // Equal splitter shares by default; ordinary sources/mergers distribute in
  // proportion to route capacity. Explicit positive weights override defaults.
  const weights=outgoing.map(e=>e.weight!==''?Number(e.weight):n.kind==='splitter'?1:cap(e)),sum=weights.reduce((a,b)=>a+b,0);
  let sent=0;
  outgoing.forEach((e,i)=>{
   const allocation=sum?budget*weights[i]/sum:0,delivered=Math.min(cap(e),allocation);
   sent+=delivered;received.set(e.to,received.get(e.to)+delivered);
   routes[e.id]={capacity:cap(e),delivered,share:sum?weights[i]/sum:0};
  });
  results[k]={supply,received:received.get(k),sent,demand,margin:demand===null?null:received.get(k)-demand,remaining:n.kind==='destination'?0:Math.max(0,supply-sent),missing};
  if(missing)warnings.push(n.label+': linked record unavailable or duplicated.');
 }
 return {nodes:results,routes,stage,warnings};
}
if(typeof module==='object'&&module.exports)module.exports={normalize,connect,analyze,order,TIERS};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1}),opts=(arr,v)=>arr.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('');
const materialName=k=>R[k]?.[0]||names[k]||k.replaceAll('-',' ');
const itemColor=k=>root.NauvisIcons?.color?.(k)||'#86c2f1';
let item='iron-plate',selected=null,connecting=null,undo=null,notice='';
const materials=[...new Set([...Object.keys(R),...Object.keys(names),'uranium-ore'])].filter(k=>!FLUID.has(k)&&!['crude-oil','sulfuric-acid'].includes(k)).sort((a,b)=>materialName(a).localeCompare(materialName(b)));
function data(){return normalize(setup.logistics)}
function sub(g){const nodes=g.nodes.filter(n=>n.item===item),ids=new Set(nodes.map(n=>n.id));return {nodes,edges:g.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))}}
function catalog(kind){
 const choices=[],groups=new Map();
 if(kind==='source'){
  const s=computeSetup(),smelt={'iron-plate':s.busIron,'copper-plate':s.copper,'steel-plate':s.steel,'stone-brick':s.bricks};
  if(Object.hasOwn(smelt,item))choices.push({key:'smelt:'+item,label:materialName(item)+(item==='iron-plate'?' · Main bus after steel allocation':' · Smelting'),rate:smelt[item]});
 }
 for(const row of setup.machines){
  const r=R[row.recipe];if(!r)continue;
  const rate=setupLineOutput(row),dest=row.destination||'Unspecified',key='machine:'+row.recipe+'|'+dest;
  let value=kind==='source'?(row.recipe===item?rate:0):0;
  if(kind==='destination'&&r[4]?.[item]){
   try{const effect=root.NauvisEffects.forRecipe(row.recipe,r[3],{...row,machine:r[3]==='asm'?Number(row.tier||.75):1});value=rate*r[4][item]/(r[2]*(1+effect.productivityBonus))}catch(_e){value=rate*r[4][item]/r[2]}
  }
  if(value>0){const old=groups.get(key)||{key,label:r[0]+' · '+dest,rate:0};old.rate+=value;groups.set(key,old)}
 }
 choices.push(...groups.values());
 if(kind==='destination')for(const p of factory.projects||[]){
  if(p.status==='archived'||!p.goal||p.type==='deployment')continue;
  try{const plan=root.NauvisRecipeMath(R,p.goal,{stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names});const demand=plan.external.find(x=>x.key===item)?.needed||0;if(demand>0)choices.push({key:'project:'+p.id,label:p.name+' · planned full external demand',rate:demand})}catch(_e){}
 }
 return choices;
}
function lookup(n){return catalog(n.kind).find(x=>x.key===n.link)||null}
function commit(next,msg){
 undo=clone(data());setup.logistics=normalize(next);saveSetup();notice=msg||'Saved to factory.';root.NauvisWorkspace?.refresh?.('logistics');render();
}
function editNode(key,patch){const g=data();g.nodes=g.nodes.map(n=>n.id===key?{...n,...patch}:n);commit(g,'Node updated.')}
function add(kind){
 const g=data();if(g.nodes.filter(n=>n.item===item).length>=36){notice='This resource diagram is limited to 36 nodes for readability.';render();return}
 const n={id:id(),item,kind,label:kind==='source'?materialName(item)+' supply':kind==='destination'?'New destination':kind==='splitter'?'Splitter':'Merger',link:'',amount:kind==='source'?1:'',tier:'red'};
 g.nodes.push(n);selected=n.id;connecting=null;commit(g,'Node added. Select a linked record or enter belt assumptions.');
}
function selectNode(key){
 if(connecting&&key!==connecting){
  try{const g=connect(data(),{id:id(),from:connecting,to:key,tier:'red',belts:1,weight:''});selected=g.edges.at(-1).id;connecting=null;commit(g,'Belt route connected.');}catch(e){notice=e.message;render()}
 }else{selected=selected===key?null:key;render()}
}
function renderGraph(g,result){
 if(!g.nodes.length)return '<div class="log-empty"><strong>Start your resource network</strong><p>Add a Producer, then a Destination. Connect them with a belt route.</p></div>';
 const max=Math.max(0,...result.stage.values()),columns=Array.from({length:max+1},(_,i)=>g.nodes.filter(n=>result.stage.get(n.id)===i).map(n=>({key:n.id,label:n.label})));
 const links=g.edges.map(e=>({from:e.from,to:e.to,routeId:e.id}));
 const layout=root.NauvisRatioFlow.routeLayout(columns,links,true);
 const graphWidth=$('logGraph')?.clientWidth||Math.max(180,Math.min(900,($('logisticsEditor')?.clientWidth||root.innerWidth)-36)),scale=Math.max(.64,Math.min(1,(graphWidth-10)/layout.width)),focus=root.NauvisRatioFlow.focusGraph(links,selected,true);
 const marker='<marker id="log-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L7 3.5 L0 7Z" fill="'+esc(itemColor(item))+'"/></marker>';
 const selectedEdge=g.edges.find(e=>e.id===selected);
 if(selectedEdge)focus.edges.add(selectedEdge.from+'|'+selectedEdge.to);
 const paths=layout.bundles.flatMap(b=>{const lit=root.NauvisRatioFlow.focusBundle(b,focus.edges);return b.paths.map(p=>{
  const route=p.edge&&g.edges[p.edge.i],active=!!selected&&lit.active.has(p),color=route?({yellow:'#dfbf65',red:'#e17b71',blue:'#79b5f6'}[route.tier]):itemColor(item);
  const d=root.NauvisRatioFlow.roundedPath(p.points,12);
  return '<path d="'+d+'" fill="none" stroke="#101f2b" stroke-width="7"/><path d="'+d+'" fill="none" stroke="'+esc(color)+'" stroke-width="'+(active?4:2.7)+'" opacity="'+(selected&&!active?.45:1)+'" stroke-linecap="round" stroke-linejoin="round"'+(p.edge?' marker-end="url(#log-arrow)"':'')+'/>'+(route?'<path data-log-edge="'+esc(route.id)+'" d="'+d+'" fill="none" stroke="transparent" stroke-width="18" class="log-edge-hit"/>':'');
 })}).join('');
 const dots=layout.bundles.flatMap(b=>b.junctions.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.5" fill="'+esc(itemColor(item))+'"/>')).join('');
 const boxes=layout.boxes.map(b=>{const n=g.nodes.find(n=>n.id===b.key),v=result.nodes[n.id],short=v.margin!==null&&v.margin<-.01,rate=n.kind==='source'?v.supply:n.kind==='destination'?v.received:v.sent;
 return '<button type="button" class="log-node'+(n.id===selected?' selected':'')+(n.id===connecting?' connecting':'')+(short?' shortage':'')+(selected&&!selectedEdge&&!focus.nodes.has(n.id)?' unrelated':'')+'" data-log-node="'+esc(n.id)+'" aria-pressed="'+(n.id===selected)+'" style="left:'+b.x+'px;top:'+b.y+'px;width:'+b.w+'px;height:'+b.h+'px;--log-color:'+esc(itemColor(item))+'"><small>'+({source:'PRODUCER',splitter:'SPLITTER',merger:'MERGER',destination:'DESTINATION'}[n.kind])+'</small><b>'+esc(n.label)+'</b><span>'+fmt(rate)+'/min'+(short?' · SHORT':'')+'</span></button>'}).join('');
 return '<div class="log-scaled" style="width:'+Math.ceil(layout.width*scale)+'px;height:'+Math.ceil(layout.height*scale)+'px"><div class="log-canvas" style="width:'+layout.width+'px;height:'+layout.height+'px;transform:scale('+scale+')"><svg viewBox="0 0 '+layout.width+' '+layout.height+'" width="'+layout.width+'" height="'+layout.height+'"><defs>'+marker+'</defs>'+paths+dots+'</svg>'+boxes+'</div></div>';
}
function inspector(g,a){
 const n=g.nodes.find(n=>n.id===selected),e=g.edges.find(e=>e.id===selected);
 if(n){const v=a.nodes[n.id],linked=catalog(n.kind),isEndpoint=['source','destination'].includes(n.kind);
 const choices=[['','Manual belt assumption'],...linked.map(x=>[x.key,x.label+' · '+fmt(x.rate)+'/min'])];if(n.link&&!linked.some(x=>x.key===n.link))choices.push([n.link,'Unavailable linked record']);
 return '<div class="log-inspect-head"><div><small>'+esc(n.kind.toUpperCase())+'</small><h3>'+esc(n.label)+'</h3></div><button data-log-action="clear">×</button></div><label>Display name<input data-log-field="label" maxlength="80" value="'+esc(n.label)+'"></label>'+
 (isEndpoint?'<label>Link to Existing Factory / project<select data-log-field="link">'+opts(choices,n.link||'')+'</select></label>'+(!n.link?'<div class="log-form-grid"><label>'+(n.kind==='source'?'Full belt equivalents supplied':'Full belt equivalents required (optional)')+'<input type="number" inputmode="decimal" min="0" step="0.25" data-log-field="amount" value="'+esc(n.amount)+'"></label><label>Belt tier<select data-log-field="tier">'+opts(Object.keys(TIERS).map(k=>[k,k]),n.tier)+'</select></label></div>':''):'')+
 '<div class="log-stat-grid"><div><small>'+(n.kind==='source'?'Rated supply':'Incoming')+'</small><b>'+fmt(n.kind==='source'?v.supply:v.received)+'/min</b></div><div><small>'+(n.kind==='destination'?'Demand':'Outgoing')+'</small><b>'+(n.kind==='destination'?(v.demand===null?'Unknown':fmt(v.demand)):fmt(v.sent))+'</b></div><div><small>'+(n.kind==='destination'?'Balance':'Unrouted')+'</small><b class="'+(v.margin!==null&&v.margin<0?'log-danger':'')+'">'+(n.kind==='destination'?(v.margin===null?'—':fmt(v.margin)):fmt(v.remaining))+'</b></div></div>'+
 (v.missing?'<p class="log-danger">Linked record unavailable or already used by another node.</p>':'')+
 '<div class="log-actions">'+(n.kind!=='destination'?'<button data-log-action="connect" class="log-primary">Connect to another node</button>':'')+'<button data-log-action="delete">Remove node</button></div>';
 }
 if(e){const v=a.routes[e.id];return '<div class="log-inspect-head"><div><small>BELT ROUTE</small><h3>'+esc(g.nodes.find(n=>n.id===e.from)?.label)+' → '+esc(g.nodes.find(n=>n.id===e.to)?.label)+'</h3></div><button data-log-action="clear">×</button></div><div class="log-form-grid"><label>Physical belts<input type="number" inputmode="numeric" min="1" max="100" step="1" data-log-field="belts" value="'+e.belts+'"></label><label>Belt tier<select data-log-field="tier">'+opts(Object.keys(TIERS).map(k=>[k,k]),e.tier)+'</select></label></div><label>Relative allocation weight (blank = automatic; 0 = no share)<input type="number" min="0" step="0.25" inputmode="decimal" data-log-field="weight" value="'+e.weight+'"></label><div class="log-stat-grid"><div><small>Capacity/min</small><b>'+fmt(v.capacity)+'</b></div><div><small>Planned/min</small><b>'+fmt(v.delivered)+'</b></div><div><small>Share</small><b>'+fmt(v.share*100)+'%</b></div></div><button data-log-action="delete">Remove connection</button>';
 }
 return '<p class="log-muted">Tap a node or belt route to inspect and edit it. To connect, select a producer, splitter or merger and tap Connect, then the receiving node.</p>';
}
function render(){
 const host=$('logisticsEditor');if(!host||!$('logistics')?.classList.contains('active'))return;
 const g=sub(data());if(!g.nodes.some(n=>n.id===selected)&&!g.edges.some(e=>e.id===selected))selected=null;
 let a;try{a=analyze(g,lookup)}catch(e){host.innerHTML='<p class="log-danger">'+esc(e.message)+'</p><button data-log-action="clear-graph">Clear this resource diagram</button>';return}
 const src=g.nodes.filter(n=>n.kind==='source').reduce((s,n)=>s+a.nodes[n.id].supply,0),sinks=g.nodes.filter(n=>n.kind==='destination'),short=sinks.filter(n=>a.nodes[n.id].margin!==null&&a.nodes[n.id].margin<-.01).length;
 host.innerHTML='<div class="log-top"><label>Resource<select data-log-resource>'+opts(materials.map(k=>[k,materialName(k)+(data().nodes.some(n=>n.item===k)?' · network':'')]),item)+'</select></label><button data-log-action="undo" '+(!undo?'disabled':'')+'>↶ Undo</button></div>'+
 '<div class="log-stat-grid"><div><small>Rated supply/min</small><b>'+fmt(src)+'</b></div><div><small>Destinations</small><b>'+sinks.length+'</b></div><div><small>Known shortages</small><b class="'+(short?'log-danger':'')+'">'+short+'</b></div></div>'+
 '<div class="log-toolbar">'+[['source','▣','Producer'],['splitter','⑂','Splitter'],['merger','⑃','Merger'],['destination','◎','Destination']].map(([k,icon,name])=>'<button data-log-add="'+k+'"><span>'+icon+'</span>'+name+'</button>').join('')+'</div>'+
 '<div class="log-connect-status" '+(!connecting?'hidden':'')+'>Select the receiving node <button data-log-action="cancel">Cancel</button></div>'+
 '<div id="logGraph" class="log-graph">'+renderGraph(g,a)+'</div>'+
 '<div class="log-route-list">'+g.edges.map(e=>'<button data-log-edge="'+esc(e.id)+'" class="'+(selected===e.id?'selected':'')+'"><span>'+esc(g.nodes.find(n=>n.id===e.from)?.label)+' → '+esc(g.nodes.find(n=>n.id===e.to)?.label)+'</span><b style="color:'+({yellow:'#dfbf65',red:'#e17b71',blue:'#79b5f6'}[e.tier])+'">'+e.belts+' '+e.tier+' · '+fmt(a.routes[e.id].delivered)+'/min</b></button>').join('')+'</div>'+
 '<div class="log-inspector">'+inspector(g,a)+'</div><p class="log-message" role="status">'+esc(notice||a.warnings.join(' ')||'Changes save and sync with your factory.')+'</p>'+
 '<p class="log-muted">Planning estimate: full-belt equivalents and rated machine capacity, not measured throughput. Default splitters share equally; ordinary branches share by transport capacity. Enter relative weights (e.g. 1 and 3 for 25:75); blank uses automatic shares, 0 reserves no flow. No automatic backpressure redistribution. Linked smelting iron is bus output after the existing steel allocation; planned project demand is a scenario, not added to actual inventory.</p>';
}
function init(){
 const host=$('logisticsEditor');if(!host)return;
 host.addEventListener('click',ev=>{
  const addBtn=ev.target.closest('[data-log-add]');if(addBtn){add(addBtn.dataset.logAdd);return}
  const node=ev.target.closest('[data-log-node]');if(node){selectNode(node.dataset.logNode);return}
  const edge=ev.target.closest('[data-log-edge]');if(edge){selected=selected===edge.dataset.logEdge?null:edge.dataset.logEdge;connecting=null;render();return}
  const action=ev.target.closest('[data-log-action]')?.dataset.logAction;if(!action)return;
  if(action==='connect'){connecting=selected;notice='';render();return}
  if(action==='cancel'||action==='clear'){connecting=null;if(action==='clear')selected=null;render();return}
  if(action==='undo'&&undo){const next=undo;undo=null;setup.logistics=normalize(next);saveSetup();selected=null;connecting=null;notice='Last logistics edit undone.';root.NauvisWorkspace?.refresh?.('logistics');render();return}
  if(action==='delete'){const g=data();g.nodes=g.nodes.filter(n=>n.id!==selected);g.edges=g.edges.filter(e=>e.id!==selected&&e.from!==selected&&e.to!==selected);selected=null;connecting=null;commit(g,'Removed. Undo is available.');return}
  if(action==='clear-graph'&&root.confirm('Clear only this resource network?')){const g=data(),ids=new Set(g.nodes.filter(n=>n.item===item).map(n=>n.id));g.nodes=g.nodes.filter(n=>!ids.has(n.id));g.edges=g.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));commit(g,'Resource diagram cleared.');}
 });
 host.addEventListener('change',ev=>{
  const input=ev.target;if(input.matches('[data-log-resource]')){item=input.value;selected=null;connecting=null;notice='';render();return}
  const field=input.dataset.logField;if(!field)return;
  const g=data(),n=g.nodes.find(n=>n.id===selected),e=g.edges.find(e=>e.id===selected);
  if(n){let v=input.value;if(field==='label'&&!v.trim())v=n.kind;if(field==='amount'&&v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)){notice='Use a nonnegative belt equivalent.';render();return}const patch={[field]:v};
   if(field==='link'&&v){if(g.nodes.some(x=>x.id!==n.id&&x.item===item&&x.kind===n.kind&&x.link===v)){notice='This record is already represented in this resource network.';render();return}patch.label=catalog(n.kind).find(x=>x.key===v)?.label||n.label}
   editNode(n.id,patch);
  }else if(e){const v=field==='tier'||(field==='weight'&&input.value==='')?input.value:Number(input.value);if(field==='belts'&&(!Number.isSafeInteger(v)||v<1||v>100)||field==='weight'&&v!==''&&(!Number.isFinite(v)||v<0)){notice='Invalid belt count or weight.';render();return}g.edges=g.edges.map(x=>x.id===e.id?{...x,[field]:v}:x);commit(g,'Connection updated.')}
 });
 let lastWidth=root.innerWidth;root.addEventListener('resize',()=>{if(root.innerWidth!==lastWidth){lastWidth=root.innerWidth;if($('logistics')?.classList.contains('active'))render()}},{passive:true});
 root.NauvisLogistics={render,invalidate(){undo=null;selected=null;connecting=null;notice='';render()}};
 render();
}
init();
})(typeof window==='undefined'?globalThis:window);
