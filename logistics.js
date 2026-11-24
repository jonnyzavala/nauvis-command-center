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
  const n=by.get(k),linked=n.link?lookup(n):null,duplicate=n.link&&usedLinks.has(n.kind+'|'+n.item+'|'+(n.link==='smelt:iron-gross'?'smelt:iron-plate':n.link));
  if(n.link)usedLinks.add(n.kind+'|'+n.item+'|'+(n.link==='smelt:iron-gross'?'smelt:iron-plate':n.link));
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
// Distinct physical belts: separate ports, tracks and bypass lanes, no shared trunks.
function layoutBelts(graph,stage){
 const pitch=5,margin=20,nodeH=82,ins=new Map(graph.nodes.map(n=>[n.id,[]])),outs=new Map(graph.nodes.map(n=>[n.id,[]]));
 for(const e of graph.edges){outs.get(e.from).push(e);ins.get(e.to).push(e)}
 const count=l=>l.reduce((s,e)=>s+e.belts,0);
 const nodeW=Math.max(156,...graph.nodes.map(n=>Math.max(count(ins.get(n.id)),count(outs.get(n.id)))*pitch+28));
 const max=Math.max(0,...stage.values()),columns=Array.from({length:max+1},(_,i)=>graph.nodes.filter(n=>stage.get(n.id)===i));
 const gap=24,span=Math.max(nodeW,...columns.map(c=>c.length*(nodeW+gap)-gap));
 const tracks=Array.from({length:max},()=>0),assign=new Map();let rails=0;
 for(const e of graph.edges){
  const a=stage.get(e.from),b=stage.get(e.to),depart=tracks[a];tracks[a]+=e.belts;
  const arrive=b===a+1?depart:tracks[b-1];if(b>a+1)tracks[b-1]+=e.belts;
  const rail=b>a+1?rails:null;if(rail!==null)rails+=e.belts;assign.set(e.id,{depart,arrive,rail});
 }
 const left=margin+rails*pitch,rowStart=[];let height=margin;
 columns.forEach((col,i)=>{rowStart.push(height);height+=nodeH;if(i<max)height+=Math.max(44,28+tracks[i]*pitch)});
 height+=margin;
 const pos=new Map(),boxes=[];
 columns.forEach((col,i)=>col.forEach((n,j)=>{
  const x=left+(span-(col.length*(nodeW+gap)-gap))/2+j*(nodeW+gap),y=rowStart[i];pos.set(n.id,{x,y});
  boxes.push({key:n.id,x,y,w:nodeW,h:nodeH});
 }));
 const ports=(list,e,n)=>pos.get(n).x+nodeW/2-(count(list)-1)*pitch/2+count(list.slice(0,list.indexOf(e)))*pitch;
 const routes=graph.edges.map(e=>{
  const a=stage.get(e.from),b=stage.get(e.to),p=pos.get(e.from),q=pos.get(e.to),t=assign.get(e.id),start=ports(outs.get(e.from),e,e.from),end=ports(ins.get(e.to),e,e.to);
  const lanes=Array.from({length:e.belts},(_,i)=>{
   const dep=p.y+nodeH+14+(t.depart+i)*pitch,arr=rowStart[b-1]+nodeH+14+(t.arrive+i)*pitch;
   const pts=[[start+i*pitch,p.y+nodeH],[start+i*pitch,dep]];
   if(t.rail!==null){const rail=left-12-(t.rail+i)*pitch;pts.push([rail,dep],[rail,arr])}
   pts.push([end+i*pitch,arr],[end+i*pitch,q.y]);
   return pts.map(([x,y])=>({x,y}));
  });return {edge:e,lanes};
 });
 return {boxes,routes,width:left+span+margin,height};
}
if(typeof module==='object'&&module.exports)module.exports={normalize,connect,analyze,order,TIERS,layoutBelts};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1}),opts=(arr,v)=>arr.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('');
const materialName=k=>R[k]?.[0]||names[k]||k.replaceAll('-',' ');
const itemColor=k=>root.NauvisIcons?.color?.(k)||'#86c2f1';
let item='iron-plate',selected=null,connecting=null,undo=null,notice='',brushTier='red',brushCount=1,drag=null,picker=false,ignoreClickUntil=0;
const materials=[...new Set([...Object.keys(R),...Object.keys(names),'uranium-ore'])].filter(k=>!FLUID.has(k)&&!['crude-oil','sulfuric-acid'].includes(k)).sort((a,b)=>materialName(a).localeCompare(materialName(b)));
function data(){return normalize(setup.logistics)}
function sub(g){const nodes=g.nodes.filter(n=>n.item===item),ids=new Set(nodes.map(n=>n.id));return {nodes,edges:g.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))}}
function catalog(kind){
 const choices=[],groups=new Map();
 const s=computeSetup(),sm=setup.smelt;
 if(kind==='source'){
  const smelt={'iron-plate':s.busIron,'copper-plate':s.copper,'steel-plate':s.steel,'stone-brick':s.bricks};
  if(Object.hasOwn(smelt,item)){
   const countKey={'iron-plate':'ironFurnaces','copper-plate':'copperFurnaces','steel-plate':'steelFurnaces','stone-brick':'brickFurnaces'}[item];
   choices.push({key:'smelt:'+item,label:num(sm[countKey])+' '+materialName(item)+' smelters'+(item==='iron-plate'?' · bus output':''),rate:smelt[item]});
   if(item==='iron-plate')choices.push({key:'smelt:iron-gross',label:num(sm.ironFurnaces)+' iron plate smelters · before steel allocation',rate:s.iron});
  }
 }
 if(kind==='destination'&&item==='iron-plate'&&num(sm.steelFurnaces)>0)choices.push({key:'smelt:steel-input',label:num(sm.steelFurnaces)+' steel smelters',rate:s.steelCapMachines*5});
 for(const row of setup.machines){
  const r=R[row.recipe];if(!r)continue;
  const rate=setupLineOutput(row),dest=row.destination||'Unspecified',key='machine:'+row.recipe+'|'+dest;
  let value=kind==='source'?(row.recipe===item?rate:0):0;
  if(kind==='destination'&&r[4]?.[item]){
   try{const effect=root.NauvisEffects.forRecipe(row.recipe,r[3],{...row,machine:r[3]==='asm'?Number(row.tier||.75):1});value=rate*r[4][item]/(r[2]*(1+effect.productivityBonus))}catch(_e){value=rate*r[4][item]/r[2]}
  }
  if(value>0){const old=groups.get(key)||{key,label:r[0]+' · '+dest,rate:0,count:0};old.rate+=value;old.count+=num(row.count);groups.set(key,old)}
 }
 choices.push(...[...groups.values()].map(x=>({...x,label:x.count+' × '+x.label})));
 if(kind==='destination')for(const p of factory.projects||[]){
  if(p.status==='archived'||!p.goal||p.type==='deployment')continue;
  try{const plan=root.NauvisRecipeMath(R,p.goal,{stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names});const demand=plan.external.find(x=>x.key===item)?.needed||0;if(demand>0)choices.push({key:'project:'+p.id,label:p.name+' · planned full external demand',rate:demand})}catch(_e){}
 }
 return choices;
}
function lookup(n){return catalog(n.kind).find(x=>x.key===n.link)||null}
const linkKey=k=>k==='smelt:iron-gross'?'smelt:iron-plate':k;
function used(g,kind,link,except){return g.nodes.some(n=>n.id!==except&&n.item===item&&n.kind===kind&&n.link&&linkKey(n.link)===linkKey(link))}
const nodeLabel=n=>n?.autoLabel&&n.link?lookup(n)?.label||n.label:n?.label||'';
function commit(next,msg){
 undo=clone(data());setup.logistics=normalize(next);saveSetup();notice=msg||'Saved to factory.';root.NauvisWorkspace?.refresh?.('logistics');render();
}
function editNode(key,patch){const g=data();g.nodes=g.nodes.map(n=>n.id===key?{...n,...patch}:n);commit(g,'Node updated.')}
function add(kind,link=''){
 const g=data();if(g.nodes.filter(n=>n.item===item).length>=36){notice='This resource diagram is limited to 36 nodes for readability.';render();return}
 const entry=link?catalog(kind).find(x=>x.key===link):null;
 if(link&&(!entry||used(g,kind,link))){notice='This factory group is unavailable or already added.';render();return}
 const n={id:id(),item,kind,label:entry?.label||(kind==='source'?materialName(item)+' supply':kind==='destination'?'New destination':kind==='splitter'?'Splitter':'Merger'),link,autoLabel:!!entry,amount:kind==='source'?1:'',tier:brushTier};
 g.nodes.push(n);picker=false;
 if(connecting&&kind!=='source'){try{const next=connect(g,{id:id(),from:connecting,to:n.id,tier:brushTier,belts:brushCount,weight:''});selected=n.id;connecting=null;commit(next,'Node added and connected.');return}catch(e){notice=e.message}}
 selected=n.id;connecting=null;commit(g,'Node added.');
}
function join(from,to){
 try{const g=connect(data(),{id:id(),from,to,tier:brushTier,belts:brushCount,weight:''});selected=g.edges.at(-1).id;connecting=null;commit(g,'Belt route connected.')}catch(e){notice=e.message;connecting=null;render()}
}
function selectNode(key){
 if(connecting&&key!==connecting){
  join(connecting,key);
 }else{selected=selected===key?null:key;render()}
}
function renderGraph(g,result){
 if(!g.nodes.length)return '<div class="log-empty"><strong>Start your resource network</strong><p>Tap Add node to choose an existing factory group or add a manual supply. Connect its output to another node.</p></div>';
 const layout=layoutBelts(g,result.stage),links=g.edges.map(e=>({from:e.from,to:e.to})),focus=root.NauvisRatioFlow.focusGraph(links,selected,true);
 const graphWidth=$('logGraph')?.clientWidth||Math.max(180,Math.min(900,($('logisticsEditor')?.clientWidth||root.innerWidth)-36)),scale=Math.max(.68,Math.min(1,(graphWidth-10)/layout.width));
 const selectedEdge=g.edges.find(e=>e.id===selected);
 if(selectedEdge){focus.edges.add(selectedEdge.from+'|'+selectedEdge.to);focus.nodes.add(selectedEdge.from);focus.nodes.add(selectedEdge.to)}
 const paths=layout.routes.map(r=>{
  const e=r.edge,active=focus.edges.has(e.from+'|'+e.to),color=({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[e.tier]);
  const lines=r.lanes.map(points=>{const d=root.NauvisRatioFlow.roundedPath(points,5);return '<path d="'+d+'" fill="none" stroke="#101f2b" stroke-width="3.6"/><path data-physical-belt="'+esc(e.id)+'" d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+(active?3:2.5)+'" stroke-linecap="round" stroke-linejoin="round"/>'}).join('');
  const hits=r.lanes.map(points=>'<path data-log-edge="'+esc(e.id)+'" d="'+root.NauvisRatioFlow.roundedPath(points,5)+'" fill="none" stroke="transparent" stroke-width="10" class="log-edge-hit"/>').join('');
  return '<g opacity="'+(selected&&!active&&!connecting?.48:1)+'">'+lines+'</g>'+hits;
 }).join('');
 const boxes=layout.boxes.map(b=>{const n=g.nodes.find(n=>n.id===b.key),v=result.nodes[n.id],short=v.margin!==null&&v.margin<-.01,rate=n.kind==='source'?v.supply:n.kind==='destination'?v.received:v.sent;
 return '<div class="log-node-wrap" style="left:'+b.x+'px;top:'+b.y+'px;width:'+b.w+'px;height:'+b.h+'px;--log-color:'+esc(itemColor(item))+'"><button type="button" class="log-node'+(n.id===selected?' selected':'')+(n.id===connecting?' connecting':'')+(short?' shortage':'')+(selected&&!connecting&&!focus.nodes.has(n.id)?' unrelated':'')+'" data-log-node="'+esc(n.id)+'" aria-pressed="'+(n.id===selected)+'"><small>'+({source:'PRODUCER',splitter:'SPLITTER',merger:'MERGER',destination:'DESTINATION'}[n.kind])+'</small><b>'+esc(nodeLabel(n))+'</b><span>'+fmt(rate)+'/min'+(short?' · SHORT':'')+'</span></button>'+
 (n.kind!=='source'?'<span class="log-input-port" aria-hidden="true"></span>':'')+
 (n.kind!=='destination'?'<button type="button" class="log-output-port" data-log-port="'+esc(n.id)+'" aria-label="Connect from '+esc(nodeLabel(n))+'" title="Drag or tap to connect">+</button>':'')+'</div>'}).join('');
 return '<div class="log-scaled" style="width:'+Math.ceil(layout.width*scale)+'px;height:'+Math.ceil(layout.height*scale)+'px"><div class="log-canvas" style="width:'+layout.width+'px;height:'+layout.height+'px;transform:scale('+scale+')"><svg viewBox="0 0 '+layout.width+' '+layout.height+'" width="'+layout.width+'" height="'+layout.height+'">'+paths+'<path id="logDragPreview" fill="none" stroke="var(--workspace-accent)" stroke-width="3" stroke-dasharray="7 4" stroke-linecap="round"/></svg>'+boxes+'</div></div>';
}
function splitControl(g,a){
 const e=g.edges.find(x=>x.id===selected),n=g.nodes.find(x=>x.id===selected);
 const from=e?.from||n?.id,edges=g.edges.filter(x=>x.from===from);
 if(edges.length!==2)return '';
 const first=edges[0],second=edges[1],share=Math.round((a.routes[first.id]?.share||0)*100);
 return '<div class="log-brush"><div class="log-brush-head"><strong>Branch allocation</strong><button data-log-action="auto-split">Automatic</button></div><div class="log-brush-head"><span>'+esc(nodeLabel(g.nodes.find(n=>n.id===first.to)))+' <b id="logShareA">'+share+'%</b></span><span>'+esc(nodeLabel(g.nodes.find(n=>n.id===second.to)))+' <b id="logShareB">'+(100-share)+'%</b></span></div><div class="log-brush-count"><input type="range" min="0" max="100" step="5" value="'+share+'" data-log-split="'+esc(from)+'" aria-label="Share of first branch"></div><p class="log-muted">Planned allocation; physical belt count stays unchanged.</p></div>';
}
function brush(g){
 const e=g.edges.find(e=>e.id===selected),tier=e?.tier||brushTier,count=e?.belts||brushCount;
 return '<div class="log-brush"><div class="log-brush-head"><strong>'+(e?'Edit selected route':'New connection')+'</strong><span id="logBrushReadout">'+count+' '+tier+' · '+fmt(count*TIERS[tier])+'/min</span></div><div class="log-brush-tiers">'+Object.keys(TIERS).map(t=>'<button type="button" data-log-tier="'+t+'" aria-pressed="'+(tier===t)+'" style="--belt:'+({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[t])+'">'+t+'</button>').join('')+'</div><div class="log-brush-count"><button type="button" data-log-step="-1" aria-label="One fewer belt">−</button><input aria-label="Physical belts" data-log-slider type="range" min="1" max="'+Math.max(16,count)+'" step="1" value="'+count+'"><button type="button" data-log-step="1" aria-label="One more belt">+</button><input aria-label="Exact belt count" data-log-exact type="number" inputmode="numeric" min="1" max="100" step="1" value="'+count+'"></div></div>';
}
function applyBrush(patch,preview=false){
 const g=data(),e=g.edges.find(e=>e.id===selected);
 if(!e){if(patch.tier)brushTier=patch.tier;if(patch.belts)brushCount=patch.belts;if(!preview)render();else $('logBrushReadout').textContent=brushCount+' '+brushTier+' · '+fmt(brushCount*TIERS[brushTier])+'/min';return}
 Object.assign(e,patch);
 if(preview){
  $('logBrushReadout').textContent=e.belts+' '+e.tier+' · '+fmt(cap(e))+'/min';
  const next=sub(g),target=$('logGraph'),sx=target.scrollLeft,sy=target.scrollTop;target.innerHTML=renderGraph(next,analyze(next,lookup));target.scrollLeft=sx;target.scrollTop=sy;
 }else commit(g,'Belt route updated.');
}
function addPicker(g){
 if(!picker)return '';
 const records=['source','destination'].flatMap(kind=>catalog(kind).filter(x=>!used(data(),kind,x.key)).map(x=>({kind,...x})));
 return '<div class="log-picker"><div class="log-brush-head"><strong>Add a node · '+esc(materialName(item))+'</strong><button data-log-action="picker">Close</button></div><p class="log-muted">Choose a recorded group. Its role is determined by whether it produces or consumes this resource.</p><div class="log-picker-list">'+(records.map(x=>'<button data-log-add="'+x.kind+'" data-log-link="'+esc(x.key)+'"><b>'+esc(x.label)+'</b><small>'+ (x.kind==='source'?'SUPPLY':'DEMAND')+' · '+fmt(x.rate)+'/min</small></button>').join('')||'<p class="log-muted">No unused compatible factory records yet.</p>')+'</div><div class="log-toolbar">'+[['source','Manual supply'],['destination','Manual demand'],['splitter','Splitter'],['merger','Merger']].map(([k,name])=>'<button data-log-add="'+k+'">'+name+'</button>').join('')+'</div></div>';
}

function inspector(g,a){
 const n=g.nodes.find(n=>n.id===selected),e=g.edges.find(e=>e.id===selected);
 if(n){const v=a.nodes[n.id],linked=catalog(n.kind),isEndpoint=['source','destination'].includes(n.kind);
 const choices=[['','Manual belt assumption'],...linked.map(x=>[x.key,x.label+' · '+fmt(x.rate)+'/min'])];if(n.link&&!linked.some(x=>x.key===n.link))choices.push([n.link,'Unavailable linked record']);
 return '<div class="log-inspect-head"><div><small>'+esc(n.kind.toUpperCase())+'</small><h3>'+esc(nodeLabel(n))+'</h3></div><button data-log-action="clear">×</button></div><label>Display name<input data-log-field="label" maxlength="80" value="'+esc(nodeLabel(n))+'"></label>'+
 (isEndpoint?'<label>Link to Existing Factory / project<select data-log-field="link">'+opts(choices,n.link||'')+'</select></label>'+(!n.link?'<div class="log-form-grid"><label>'+(n.kind==='source'?'Full belt equivalents supplied':'Full belt equivalents required (optional)')+'<input type="number" inputmode="decimal" min="0" step="0.25" data-log-field="amount" value="'+esc(n.amount)+'"></label><label>Belt tier<select data-log-field="tier">'+opts(Object.keys(TIERS).map(k=>[k,k]),n.tier)+'</select></label></div>':''):'')+
 '<div class="log-stat-grid"><div><small>'+(n.kind==='source'?'Rated supply':'Incoming')+'</small><b>'+fmt(n.kind==='source'?v.supply:v.received)+'/min</b></div><div><small>'+(n.kind==='destination'?'Demand':'Outgoing')+'</small><b>'+(n.kind==='destination'?(v.demand===null?'Unknown':fmt(v.demand)):fmt(v.sent))+'</b></div><div><small>'+(n.kind==='destination'?'Balance':'Unrouted')+'</small><b class="'+(v.margin!==null&&v.margin<0?'log-danger':'')+'">'+(n.kind==='destination'?(v.margin===null?'—':fmt(v.margin)):fmt(v.remaining))+'</b></div></div>'+
 (v.missing?'<p class="log-danger">Linked record unavailable or already used by another node.</p>':'')+
 '<div class="log-actions">'+(n.kind!=='destination'?'<button data-log-action="connect" class="log-primary">Connect to another node</button>':'')+'<button data-log-action="delete">Remove node</button></div>';
 }
 if(e){const v=a.routes[e.id];return '<div class="log-inspect-head"><div><small>BELT ROUTE</small><h3>'+esc(nodeLabel(g.nodes.find(n=>n.id===e.from)))+' → '+esc(nodeLabel(g.nodes.find(n=>n.id===e.to)))+'</h3></div><button data-log-action="clear">×</button></div><div class="log-form-grid"><label>Physical belts<input type="number" inputmode="numeric" min="1" max="100" step="1" data-log-field="belts" value="'+e.belts+'"></label><label>Belt tier<select data-log-field="tier">'+opts(Object.keys(TIERS).map(k=>[k,k]),e.tier)+'</select></label></div><label>Relative allocation weight (blank = automatic; 0 = no share)<input type="number" min="0" step="0.25" inputmode="decimal" data-log-field="weight" value="'+e.weight+'"></label><div class="log-stat-grid"><div><small>Capacity/min</small><b>'+fmt(v.capacity)+'</b></div><div><small>Planned/min</small><b>'+fmt(v.delivered)+'</b></div><div><small>Share</small><b>'+fmt(v.share*100)+'%</b></div></div><button data-log-action="delete">Remove connection</button>';
 }
 return '<p class="log-muted">Drag a + output port onto any compatible receiving card, or tap + then tap the destination. Tap a belt to edit its quantity and tier above the canvas.</p>';
}
function render(){
 const host=$('logisticsEditor');if(!host||!$('logistics')?.classList.contains('active'))return;
 const oldGraph=$('logGraph'),sx=oldGraph?.scrollLeft||0,sy=oldGraph?.scrollTop||0;const g=sub(data());if(!g.nodes.some(n=>n.id===selected)&&!g.edges.some(e=>e.id===selected))selected=null;
 let a;try{a=analyze(g,lookup)}catch(e){host.innerHTML='<p class="log-danger">'+esc(e.message)+'</p><button data-log-action="clear-graph">Clear this resource diagram</button>';return}
 const src=g.nodes.filter(n=>n.kind==='source').reduce((s,n)=>s+a.nodes[n.id].supply,0),sinks=g.nodes.filter(n=>n.kind==='destination'),short=sinks.filter(n=>a.nodes[n.id].margin!==null&&a.nodes[n.id].margin<-.01).length;
 host.innerHTML='<div class="log-top"><label>Resource<select data-log-resource>'+opts(materials.map(k=>[k,materialName(k)+(data().nodes.some(n=>n.item===k)?' · network':'')]),item)+'</select></label><button data-log-action="undo" '+(!undo?'disabled':'')+'>↶ Undo</button></div>'+
 '<div class="log-stat-grid"><div><small>Rated supply/min</small><b>'+fmt(src)+'</b></div><div><small>Destinations</small><b>'+sinks.length+'</b></div><div><small>Known shortages</small><b class="'+(short?'log-danger':'')+'">'+short+'</b></div></div>'+
 '<button type="button" class="log-primary log-add-main" data-log-action="picker">＋ Add node</button>'+addPicker(g)+brush(g)+splitControl(g,a)+
 '<div class="log-connect-status" '+(!connecting?'hidden':'')+'>Select a receiving node, or add a new node <button data-log-action="cancel">Cancel</button></div>'+
 '<div id="logGraph" class="log-graph">'+renderGraph(g,a)+'</div>'+
 '<details class="log-routes"><summary>Route list · '+g.edges.length+'</summary><div class="log-route-list">'+g.edges.map(e=>'<button data-log-edge="'+esc(e.id)+'" class="'+(selected===e.id?'selected':'')+'"><span>'+esc(nodeLabel(g.nodes.find(n=>n.id===e.from)))+' → '+esc(nodeLabel(g.nodes.find(n=>n.id===e.to)))+'</span><b style="color:'+({yellow:'#dfbf65',red:'#e17b71',blue:'#79b5f6'}[e.tier])+'">'+e.belts+' '+e.tier+' · '+fmt(a.routes[e.id].delivered)+'/min</b></button>').join('')+'</div></details>'+
 '<div class="log-inspector">'+inspector(g,a)+'</div><p class="log-message" role="status">'+esc(notice||a.warnings.join(' ')||'Changes save and sync with your factory.')+'</p>'+
 '<p class="log-muted">Planning estimate: full-belt equivalents and rated machine capacity, not measured throughput. Default splitters share equally; ordinary branches share by transport capacity. Enter relative weights (e.g. 1 and 3 for 25:75); blank uses automatic shares, 0 reserves no flow. No automatic backpressure redistribution. Linked iron supply can represent gross output or post-steel bus output (not both); planned project demand is a scenario, not added to actual inventory.</p>';if($('logGraph')){$('logGraph').scrollLeft=sx;$('logGraph').scrollTop=sy}
}
function init(){
 const host=$('logisticsEditor');if(!host)return;
 host.addEventListener('click',ev=>{
  if(Date.now()<ignoreClickUntil){ev.preventDefault();return}
  const addBtn=ev.target.closest('[data-log-add]');if(addBtn){add(addBtn.dataset.logAdd,addBtn.dataset.logLink||'');return}
  const port=ev.target.closest('[data-log-port]');if(port){connecting=port.dataset.logPort;selected=connecting;notice='';render();return}
  const tier=ev.target.closest('[data-log-tier]');if(tier){applyBrush({tier:tier.dataset.logTier});return}
  const step=ev.target.closest('[data-log-step]');if(step){const e=data().edges.find(e=>e.id===selected),n=Math.max(1,Math.min(100,(e?.belts||brushCount)+Number(step.dataset.logStep)));applyBrush({belts:n});return}
  const node=ev.target.closest('[data-log-node]');if(node){selectNode(node.dataset.logNode);return}
  const edge=ev.target.closest('[data-log-edge]');if(edge){selected=selected===edge.dataset.logEdge?null:edge.dataset.logEdge;connecting=null;render();return}
  const action=ev.target.closest('[data-log-action]')?.dataset.logAction;if(!action)return;
  if(action==='auto-split'){const g=data(),e=g.edges.find(e=>e.id===selected),from=e?.from||selected;g.edges=g.edges.map(x=>x.from===from?{...x,weight:''}:x);commit(g,'Automatic allocation restored.');return}
  if(action==='picker'){picker=!picker;render();return}
  if(action==='connect'){connecting=selected;notice='';render();return}
  if(action==='cancel'||action==='clear'){connecting=null;if(action==='clear')selected=null;render();return}
  if(action==='undo'&&undo){const next=undo;undo=null;setup.logistics=normalize(next);saveSetup();selected=null;connecting=null;notice='Last logistics edit undone.';root.NauvisWorkspace?.refresh?.('logistics');render();return}
  if(action==='delete'){const g=data();g.nodes=g.nodes.filter(n=>n.id!==selected);g.edges=g.edges.filter(e=>e.id!==selected&&e.from!==selected&&e.to!==selected);selected=null;connecting=null;commit(g,'Removed. Undo is available.');return}
  if(action==='clear-graph'&&root.confirm('Clear only this resource network?')){const g=data(),ids=new Set(g.nodes.filter(n=>n.item===item).map(n=>n.id));g.nodes=g.nodes.filter(n=>!ids.has(n.id));g.edges=g.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));commit(g,'Resource diagram cleared.');}
 });
 host.addEventListener('change',ev=>{
  const input=ev.target;if(input.matches('[data-log-split]')){const g=data(),edges=g.edges.filter(e=>e.from===input.dataset.logSplit),v=Number(input.value);if(edges.length===2&&Number.isFinite(v)&&v>=0&&v<=100){edges[0].weight=v;edges[1].weight=100-v;commit(g,'Branch allocation updated.')}return}if(input.matches('[data-log-slider],[data-log-exact]')){const v=Number(input.value);if(Number.isSafeInteger(v)&&v>=1&&v<=100)applyBrush({belts:v});else render();return}if(input.matches('[data-log-resource]')){item=input.value;selected=null;connecting=null;picker=false;notice='';render();return}
  const field=input.dataset.logField;if(!field)return;
  const g=data(),n=g.nodes.find(n=>n.id===selected),e=g.edges.find(e=>e.id===selected);
  if(n){let v=input.value;if(field==='label'&&!v.trim())v=n.kind;if(field==='amount'&&v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)){notice='Use a nonnegative belt equivalent.';render();return}const patch={[field]:v};if(field==='label'||(field==='link'&&!v))patch.autoLabel=false;
   if(field==='link'&&v){if(used(g,n.kind,v,n.id)){notice='This record is already represented in this resource network.';render();return}patch.label=catalog(n.kind).find(x=>x.key===v)?.label||n.label;patch.autoLabel=true}
   editNode(n.id,patch);
  }else if(e){const v=field==='tier'||(field==='weight'&&input.value==='')?input.value:Number(input.value);if(field==='belts'&&(!Number.isSafeInteger(v)||v<1||v>100)||field==='weight'&&v!==''&&(!Number.isFinite(v)||v<0)){notice='Invalid belt count or weight.';render();return}g.edges=g.edges.map(x=>x.id===e.id?{...x,[field]:v}:x);commit(g,'Connection updated.')}
 });
 host.addEventListener('input',ev=>{if(ev.target.matches('[data-log-split]')){const v=Number(ev.target.value);$('logShareA').textContent=v+'%';$('logShareB').textContent=(100-v)+'%';return}if(ev.target.matches('[data-log-slider]')){const v=Number(ev.target.value),exact=host.querySelector('[data-log-exact]');if(exact)exact.value=v;applyBrush({belts:v},true)}});
 // Pointer capture keeps the cable drag alive when the finger leaves its source port.
 host.addEventListener('pointerdown',ev=>{
  const port=ev.target.closest('[data-log-port]');if(!port||ev.button!==0)return;
  const box=port.getBoundingClientRect();drag={port,from:port.dataset.logPort,id:ev.pointerId,x:box.left+box.width/2,y:box.top+box.height/2,startX:ev.clientX,startY:ev.clientY,moved:false};port.setPointerCapture(ev.pointerId);
 });
 host.addEventListener('pointermove',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;
  if(Math.hypot(ev.clientX-drag.startX,ev.clientY-drag.startY)>5)drag.moved=true;if(!drag.moved)return;
  const svg=$('logDragPreview')?.ownerSVGElement;if(!svg)return;const b=svg.getBoundingClientRect(),sx=svg.viewBox.baseVal.width/b.width,sy=svg.viewBox.baseVal.height/b.height;
  const x=(drag.x-b.left)*sx,y=(drag.y-b.top)*sy,xx=(ev.clientX-b.left)*sx,yy=(ev.clientY-b.top)*sy,mid=(y+yy)/2;
  $('logDragPreview').setAttribute('d','M'+x+' '+y+' C'+x+' '+mid+' '+xx+' '+mid+' '+xx+' '+yy);
  const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-log-node]'),candidate=target&&target.dataset.logNode!==drag.from&&data().nodes.find(n=>n.id===target.dataset.logNode)?.kind!=='source';
  host.querySelectorAll('.log-drop-target').forEach(n=>n.classList.remove('log-drop-target'));if(candidate)target.classList.add('log-drop-target');
 });
 host.addEventListener('pointerup',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;const d=drag;drag=null;if(!d.moved)return;
  ev.preventDefault();ignoreClickUntil=Date.now()+250;const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('[data-log-node]');
  if(target&&target.dataset.logNode!==d.from)join(d.from,target.dataset.logNode);else{connecting=d.from;selected=d.from;notice='Tap a destination or add one.';render()}
 });
 host.addEventListener('pointercancel',()=>{drag=null;render()});
 let lastWidth=root.innerWidth;root.addEventListener('resize',()=>{if(root.innerWidth!==lastWidth){lastWidth=root.innerWidth;if($('logistics')?.classList.contains('active'))render()}},{passive:true});
 root.NauvisLogistics={render,invalidate(){undo=null;selected=null;connecting=null;picker=false;drag=null;notice='';render()}};
 render();
}
init();
})(typeof window==='undefined'?globalThis:window);
