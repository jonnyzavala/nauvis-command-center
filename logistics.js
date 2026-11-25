/* NAUVIS v0.42 · Editable single-resource logistics networks.
   Planning capacity, not game telemetry. Pure graph engine + mobile editor. */
(function(root){
'use strict';
const TIERS={yellow:900,red:1800,blue:2700},KINDS=['source','splitter','merger','destination'];
const num=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
const laneCount=e=>e.lanes===1?1:2;
const cap=e=>num(e.belts)*(TIERS[e.tier]||0)*laneCount(e)/2;
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
  const demand=n.kind==='destination'?(missing||n.entityAnchor&&!edges.some(e=>e.to===k)?null:n.link?num(linked.rate):n.amount===''||n.amount==null?null:num(n.amount)*(TIERS[n.tier]||1800)):null;
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
function layoutBelts(graph,stage,options={}){
 const pitch=5,margin=20,nodeH=options.nodeHeight||82,ins=new Map(graph.nodes.map(n=>[n.id,[]])),outs=new Map(graph.nodes.map(n=>[n.id,[]]));
 for(const e of graph.edges){outs.get(e.from).push(e);ins.get(e.to).push(e)}
 const count=l=>l.reduce((s,e)=>s+e.belts,0);
 const nodeW=Math.max(options.nodeWidth||156,...graph.nodes.map(n=>Math.max(count(ins.get(n.id)),count(outs.get(n.id)))*pitch+28));
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
// A recorded production group can consume several resources. Propagate only
// shortages on explicitly modeled inputs; absent inputs remain unverified.
function scenarioGraph(raw,include=false){
 const g=normalize(raw);if(include)return g;
 const excluded=new Set(g.nodes.filter(n=>n.link?.startsWith('project:')).map(n=>n.id));
 return {nodes:g.nodes.filter(n=>!excluded.has(n.id)),edges:g.edges.filter(e=>!excluded.has(e.from)&&!excluded.has(e.to))};
}
function groupKey(n){
 if(!n?.link)return null;
 if(n.link==='smelt:steel-input'||n.link==='smelt:steel-plate')return 'smelt:steel';
 if(n.link==='smelt:iron-gross'||n.link==='smelt:iron-plate'||n.link==='smelt:iron-input')return 'smelt:iron';
 if(n.link==='smelt:copper-plate'||n.link==='smelt:copper-input')return 'smelt:copper';
 if(n.link==='smelt:stone-brick'||n.link==='smelt:brick-input')return 'smelt:brick';
 return n.link.startsWith('machine:')?n.link:null;
}
// Shared final feeders reserve one physical lane per resource.
function compatiblePair(g,a,b){
 if(!a||!b||a.id===b.id||a.bundle||b.bundle||laneCount(a)!==1||laneCount(b)!==1||a.tier!==b.tier||a.belts!==b.belts)return false;
 const x=g.nodes.find(n=>n.id===a.to),y=g.nodes.find(n=>n.id===b.to);
 return !!(x&&y&&x.kind==='destination'&&y.kind==='destination'&&x.item!==y.item&&groupKey(x)&&groupKey(x)===groupKey(y));
}
function sanitizeBundles(raw){
 const g=normalize(raw),groups=new Map();
 for(const e of g.edges)if(typeof e.bundle==='string'&&e.bundle){if(!groups.has(e.bundle))groups.set(e.bundle,[]);groups.get(e.bundle).push(e)}
 for(const e of g.edges)if(e.bundle&&(!groups.has(e.bundle)||groups.get(e.bundle).length!==2))delete e.bundle;
 for(const pair of groups.values())if(pair.length===2){const [a,b]=pair;if(!compatiblePair(g,{...a,bundle:null},{...b,bundle:null})){delete a.bundle;delete b.bundle}}
 return g;
}
function pairLanes(raw,first,second,bundle){
 const g=sanitizeBundles(raw),a=g.edges.find(e=>e.id===first),b=g.edges.find(e=>e.id===second);
 if(!compatiblePair(g,a,b))throw Error('Pair two unused half-belt routes with matching tier and count feeding different ingredients into the same recorded array.');
 if(typeof bundle!=='string'||!bundle||g.edges.some(e=>e.bundle===bundle))throw Error('Shared belt identity must be unique.');
 a.bundle=b.bundle=bundle;return g;
}
function unpairLanes(raw,key){
 const g=sanitizeBundles(raw),e=g.edges.find(x=>x.id===key);if(e?.bundle){const bundle=e.bundle;for(const x of g.edges)if(x.bundle===bundle)delete x.bundle}return g;
}
function updateRoute(raw,key,patch){
 const g=sanitizeBundles(raw),e=g.edges.find(x=>x.id===key);if(!e)throw Error('Route not found.');
 if(patch.lanes!==undefined&&![1,2].includes(patch.lanes))throw Error('Choose one or two lanes.');
 if(e.bundle&&patch.lanes!==undefined&&patch.lanes!==1)throw Error('Unpair the mixed feeder before assigning both lanes to one resource.');
 if(patch.tier!==undefined&&!TIERS[patch.tier])throw Error('Invalid belt tier.');
 if(patch.belts!==undefined&&(!Number.isSafeInteger(patch.belts)||patch.belts<1||patch.belts>100))throw Error('Choose 1–100 physical belts.');
 Object.assign(e,patch);
 if(e.bundle)for(const partner of g.edges.filter(x=>x.id!==key&&x.bundle===e.bundle)){
  if(patch.tier!==undefined)partner.tier=patch.tier;
  if(patch.belts!==undefined)partner.belts=patch.belts;
 }
 return g;
}
function physicalFeeders(raw){
 const g=sanitizeBundles(raw),seen=new Set(),out=[];
 for(const e of g.edges){if(e.bundle&&seen.has(e.bundle))continue;if(e.bundle)seen.add(e.bundle);
  const members=e.bundle?g.edges.filter(x=>x.bundle===e.bundle):[e];out.push({id:e.bundle||e.id,tier:e.tier,belts:e.belts,members,mixed:members.length===2});
 }
 return out;
}
function networkResults(raw,lookup){
 const g=normalize(raw),networks=new Map();
 for(const n of g.nodes){if(!networks.has(n.item))networks.set(n.item,{nodes:[],edges:[]});networks.get(n.item).nodes.push(n)}
 const by=new Map(g.nodes.map(n=>[n.id,n]));
 for(const e of g.edges)networks.get(by.get(e.from).item).edges.push(e);
 const records=new Map(g.nodes.filter(n=>n.link).map(n=>[n.id,lookup(n)]));
 let factors=new Map(),results=new Map(),converged=false;
 const getRecord=n=>records.get(n.id)||null;
 const effective=n=>{const r=getRecord(n);if(!r)return null;return n.kind==='source'?{...r,rate:num(r.rate)*(factors.get(groupKey(n))??1)}:r};
 for(let pass=0;pass<64;pass++){
  results=new Map();const next=new Map(factors);
  for(const [item,graph] of networks){
   try{const a=analyze(graph,effective);results.set(item,a);
    for(const n of graph.nodes){const group=groupKey(n),v=a.nodes[n.id];if(n.kind!=='destination'||!group||v.missing||!(v.demand>0))continue;
     next.set(group,Math.min(next.get(group)??1,v.received/v.demand,1));
    }
   }catch(err){results.set(item,{error:err.message})}
  }
  const delta=Math.max(0,...[...next].map(([key,v])=>Math.abs(v-(factors.get(key)??1))));
  factors=next;if(delta<1e-9){converged=true;break}
 }
 // Re-evaluate with final factors (including when a cyclic cross-resource
 // dependency has not converged within the bounded iteration).
 for(const [item,graph] of networks)try{results.set(item,analyze(graph,effective))}catch(err){results.set(item,{error:err.message})}
 return {results,factors,converged,effective,records};
}
function diagnostics(graph,a,lookup){
 const g=normalize(graph),sinks=g.nodes.filter(n=>n.kind==='destination'),sources=g.nodes.filter(n=>n.kind==='source'),by=new Map(g.nodes.map(n=>[n.id,n]));
 const sum=xs=>xs.reduce((s,v)=>s+v,0);
 const known=sinks.filter(n=>a.nodes[n.id].demand!==null&&!a.nodes[n.id].missing);
 const missing=known.filter(n=>a.nodes[n.id].margin<-.01);
 const totalDemand=sum(known.map(n=>a.nodes[n.id].demand)),totalSupply=sum(sources.map(n=>a.nodes[n.id].supply));
 const upstream=id=>{const seen=new Set([id]),todo=[id];while(todo.length){const to=todo.pop();for(const e of g.edges)if(e.to===to&&!seen.has(e.from)){seen.add(e.from);todo.push(e.from)}}return seen};
 const findings=[];
 for(const n of sinks){
  const v=a.nodes[n.id],incoming=g.edges.filter(e=>e.to===n.id),capacity=sum(incoming.map(cap)),short=v.demand===null?null:Math.max(0,v.demand-v.received);
  const parents=upstream(n.id),reachable=sources.filter(s=>parents.has(s.id)),reachableSupply=sum(reachable.map(s=>a.nodes[s.id].supply));
  const uncertain=reachable.some(s=>a.nodes[s.id].missing);
  const status=v.demand===null||v.missing?'unknown':short>.01?'short':v.demand>0&&v.received<v.demand*1.15?'tight':'ok';
  const finding={id:n.id,status,demand:v.demand,received:v.received,short,capacity,reachableSupply,uncertain,utilization:v.demand>0?Math.min(1,v.received/v.demand):null,actions:[]};
  if(status==='short'){
   if(!incoming.length)finding.actions.push({type:'connect',text:'Connect a supply route to this destination.'});
   if(incoming.length&&capacity<v.demand-.01){
    const e=incoming[0],extra=Math.ceil((v.demand-capacity)/(TIERS[e.tier]*laneCount(e)/2)-1e-10);
    finding.actions.push({type:'transport',edge:e.id,extra,tier:e.tier,text:'Incoming belt capacity is insufficient. Add at least '+extra+' '+e.tier+' belt(s) at the current lane allocation.'});
   }
   if(incoming.length&&reachableSupply<v.demand-.01){
    finding.actions.push({type:'source',amount:v.demand-reachableSupply,text:'Connected producers cannot supply this destination even if it receives all their output.'});
   }
   if(uncertain)finding.actions.push({type:'unknown',text:'At least one upstream linked record is unavailable. Verify it before expanding.'});
   // Try discrete changes against the existing allocation model. Only call
   // an alternative beneficial when it improves this sink without reducing
   // delivery to any other known destination.
   const candidates=g.edges.filter(e=>parents.has(e.to)&&parents.has(e.from)).slice(0,40);
   const tryChange=(edges,action)=>{
    let next;try{next=analyze({...g,edges},lookup)}catch(_e){return}
    const gain=Math.min(v.demand,next.nodes[n.id].received)-Math.min(v.demand,v.received);
    if(gain>.01&&known.every(k=>k.id===n.id||next.nodes[k.id].received>=Math.min(a.nodes[k.id].received,a.nodes[k.id].demand)-.01))
     return {...action,gain,remaining:Math.max(0,v.demand-next.nodes[n.id].received)};
   };
   const alternatives=[];
   for(const e of candidates){
    const extra=Math.max(1,Math.ceil(short/(TIERS[e.tier]*laneCount(e)/2)-1e-10)),belts=Math.min(100,e.belts+extra);
    if(!e.bundle&&belts>e.belts){const x=tryChange(g.edges.map(z=>z.id===e.id?{...z,belts}:z),{type:'test-belt',edge:e.id,belts,tier:e.tier});if(x)alternatives.push(x)}
    for(const tier of Object.keys(TIERS).filter(t=>!e.bundle&&TIERS[t]>TIERS[e.tier])){
     const x=tryChange(g.edges.map(z=>z.id===e.id?{...z,tier}:z),{type:'test-belt',edge:e.id,belts:e.belts,tier});if(x)alternatives.push(x)
    }
    const siblings=g.edges.filter(z=>z.from===e.from);
    if(siblings.length>1){
     const current=a.routes[e.id].share;
     for(const share of [Math.min(1,current+.1),Math.min(1,current+.25),1]){
      if(share<=current+1e-9)continue;
      const otherTotal=sum(siblings.filter(z=>z.id!==e.id).map(z=>a.routes[z.id].share));
      const edges=g.edges.map(z=>z.from!==e.from?z:{...z,weight:z.id===e.id?share:otherTotal>0?(1-share)*a.routes[z.id].share/otherTotal:(1-share)/(siblings.length-1)});
      const x=tryChange(edges,{type:'test-share',edge:e.id,share});if(x)alternatives.push(x);
     }
    }
   }
   alternatives.sort((x,y)=>y.gain-x.gain||((x.type==='test-share'?0:1)-(y.type==='test-share'?0:1)));
   const best=alternatives[0];if(best)finding.actions.push(best);
   if(candidates.some(e=>e.bundle))finding.actions.push({type:'shared',text:'A mixed feeder is involved. Review both lanes together before changing its tier or count; single-resource upgrade tests exclude shared feeders.'});
   if(!best&&incoming.length&&capacity>=v.demand-.01&&reachableSupply>=v.demand-.01)finding.actions.push({type:'trace',text:'Check upstream route capacities and branch allocation. No tested single change improves this destination without reducing another known destination below its current supported demand. Multiple coordinated changes may help.'});
   if(totalSupply>reachableSupply+.01)finding.actions.push({type:'other-source',amount:totalSupply-reachableSupply,text:'Other recorded producers exist outside this route. Check their commitments before connecting them.'});
  }
  findings.push(finding);
 }
 return {findings,totalDemand,totalSupply,productionGap:Math.max(0,totalDemand-totalSupply),knownShort:missing.length,unknown:sinks.length-known.length,unrouted:sum(sources.map(n=>a.nodes[n.id].remaining)),unknownSources:sources.filter(n=>a.nodes[n.id].missing).length};
}
// Entity projection is deliberately non-destructive: existing endpoint IDs and
// physical routes remain the storage model, linked groups become a single card.
function entityProjection(raw,records=[]){
 const g=normalize(raw),groups=new Map(),nodeToEntity=new Map(),catalog=new Map(records.map(r=>[r.key,r]));
 for(const n of g.nodes){
  const key=groupKey(n)||'node:'+n.id;
  if(!groups.has(key)){
   const record=catalog.get(key);
   groups.set(key,{key,label:record?.label||n.label,ports:(record?.ports||[]).map(p=>({...p,nodeId:null})),nodes:[],linked:!!groupKey(n)});
  }
  const entity=groups.get(key);entity.nodes.push(n);nodeToEntity.set(n.id,key);
  // Gross and bus iron are alternate representations, never additional output.
  const port=entity.ports.find(p=>p.kind===n.kind&&p.item===n.item&&(p.link===n.link||key==='smelt:iron'&&p.kind==='source'&&p.item==='iron-plate'));
  if(port){port.nodeId=n.id;port.link=n.link;}
  else entity.ports.push({kind:n.kind,item:n.item,link:n.link||'',nodeId:n.id,rate:null});
 }
 const edges=g.edges.map(e=>({...e,from:nodeToEntity.get(e.from),to:nodeToEntity.get(e.to),item:g.nodes.find(n=>n.id===e.from)?.item,sourceEndpoint:e.from,targetEndpoint:e.to}));
 return {entities:[...groups.values()],edges};
}
function ensureEntityPort(graph,port,entity,idFactory){
 if(port.nodeId){if(!graph.nodes.some(n=>n.id===port.nodeId))throw Error('That port is no longer available.');return port.nodeId}
 if(!port.link||!['source','destination'].includes(port.kind))throw Error('Select a compatible recorded input or output.');
 const existing=graph.nodes.find(n=>n.kind===port.kind&&n.item===port.item&&n.link===port.link);
 if(existing)return existing.id;
 const key=idFactory();graph.nodes.push({id:key,item:port.item,kind:port.kind,label:entity.label,link:port.link,autoLabel:true,amount:'',tier:'red',entityAnchor:port.kind==='destination'});return key;
}
if(typeof module==='object'&&module.exports)module.exports={normalize,connect,analyze,order,TIERS,layoutBelts,groupKey,networkResults,diagnostics,scenarioGraph,entityProjection,ensureEntityPort,laneCount,cap,compatiblePair,sanitizeBundles,pairLanes,unpairLanes,updateRoute,physicalFeeders};
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:1}),opts=(arr,v)=>arr.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('');
const materialName=k=>R[k]?.[0]||names[k]||k.replaceAll('-',' ');
const itemColor=k=>root.NauvisIcons?.color?.(k)||'#86c2f1';
let includeScenario=false,entityMode=true,entityPicker=false,entityPending=null,entityFilter='all',entityView=null;
let item='iron-plate',selected=null,connecting=null,undo=null,notice='',brushTier='red',brushCount=1,brushLanes=2,drag=null,picker=false,ignoreClickUntil=0;
const materials=[...new Set([...Object.keys(R),...Object.keys(names),'uranium-ore'])].filter(k=>!FLUID.has(k)&&!['crude-oil','sulfuric-acid'].includes(k)).sort((a,b)=>materialName(a).localeCompare(materialName(b)));
function data(){return sanitizeBundles(setup.logistics)}
function sub(g){const nodes=g.nodes.filter(n=>n.item===item),ids=new Set(nodes.map(n=>n.id));return {nodes,edges:g.edges.filter(e=>ids.has(e.from)&&ids.has(e.to))}}
function catalog(kind,resource=item){
 const item=resource;
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
 if(kind==='destination')for(const [resource,countKey,key,per] of [['iron-ore','ironFurnaces','iron',s.perPlate],['copper-ore','copperFurnaces','copper',s.perPlate],['stone','brickFurnaces','brick',s.perPlate*2]])if(item===resource&&num(sm[countKey])>0)choices.push({key:'smelt:'+key+'-input',label:num(sm[countKey])+' '+key+' smelters',rate:num(sm[countKey])*per});
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
 if(kind==='destination'&&includeScenario)for(const p of factory.projects||[]){
  if(p.status==='archived'||!p.goal||p.type==='deployment')continue;
  try{const plan=root.NauvisRecipeMath(R,p.goal,{stopBus:STOP_BUS,stopRaw:STOP_RAW,fluids:FLUID,names});const demand=plan.external.find(x=>x.key===item)?.needed||0;if(demand>0)choices.push({key:'project:'+p.id,label:p.name+' · planned full external demand',rate:demand})}catch(_e){}
 }
 return choices;
}
function lookup(n){return catalog(n.kind,n.item).find(x=>x.key===n.link)||null}
const linkKey=k=>k==='smelt:iron-gross'?'smelt:iron-plate':k;
function used(g,kind,link,except){return g.nodes.some(n=>n.id!==except&&n.item===item&&n.kind===kind&&n.link&&linkKey(n.link)===linkKey(link))}
const nodeLabel=n=>n?.autoLabel&&n.link?lookup(n)?.label||n.label:n?.label||'';
function commit(next,msg){
 undo=clone(data());next=sanitizeBundles(next);setup.logistics=normalize(next);saveSetup();notice=msg||'Saved to factory.';root.NauvisWorkspace?.refresh?.('logistics');render();
}
function editNode(key,patch){const g=data();g.nodes=g.nodes.map(n=>n.id===key?{...n,...patch}:n);commit(g,'Node updated.')}
function add(kind,link=''){
 const g=data();if(g.nodes.filter(n=>n.item===item).length>=36){notice='This resource diagram is limited to 36 nodes for readability.';render();return}
 const entry=link?catalog(kind).find(x=>x.key===link):null;
 if(link&&(!entry||used(g,kind,link))){notice='This factory group is unavailable or already added.';render();return}
 const n={id:id(),item,kind,label:entry?.label||(kind==='source'?materialName(item)+' supply':kind==='destination'?'New destination':kind==='splitter'?'Splitter':'Merger'),link,autoLabel:!!entry,amount:kind==='source'?1:'',tier:brushTier};
 g.nodes.push(n);picker=false;
 if(connecting&&kind!=='source'){try{const next=connect(g,{id:id(),from:connecting,to:n.id,tier:brushTier,belts:brushCount,lanes:brushLanes,weight:''});selected=n.id;connecting=null;commit(next,'Network node linked and connected; Inventory unchanged.');return}catch(e){notice=e.message}}
 selected=n.id;connecting=null;commit(g,'Added to network only. Inventory unchanged.');
}
function join(from,to){
 try{const g=connect(data(),{id:id(),from,to,tier:brushTier,belts:brushCount,lanes:brushLanes,weight:''});selected=g.edges.at(-1).id;connecting=null;commit(g,'Belt route connected.')}catch(e){notice=e.message;connecting=null;render()}
}
function selectNode(key){
 if(connecting&&key!==connecting){
  join(connecting,key);
 }else{selected=selected===key?null:key;render()}
}
function renderGraph(g,result){
 if(!g.nodes.length)return '<div class="log-empty"><strong>Start your resource network</strong><p>Tap Add to network to reference an existing factory group or enter a manual assumption. Connect its output to another node.</p></div>';
 const layout=layoutBelts(g,result.stage),links=g.edges.map(e=>({from:e.from,to:e.to})),focus=root.NauvisRatioFlow.focusGraph(links,selected,true);
 const graphWidth=$('logGraph')?.clientWidth||Math.max(180,Math.min(900,($('logisticsEditor')?.clientWidth||root.innerWidth)-36)),scale=Math.max(.68,Math.min(1,(graphWidth-10)/layout.width));
 const selectedEdge=g.edges.find(e=>e.id===selected);
 if(selectedEdge){focus.edges.add(selectedEdge.from+'|'+selectedEdge.to);focus.nodes.add(selectedEdge.from);focus.nodes.add(selectedEdge.to)}
 const paths=layout.routes.map(r=>{
  const e=r.edge,active=focus.edges.has(e.from+'|'+e.to),color=({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[e.tier]);
  const lines=r.lanes.map(points=>{const d=root.NauvisRatioFlow.roundedPath(points,5);return '<path d="'+d+'" fill="none" stroke="#101f2b" stroke-width="3.6"/><path data-physical-belt="'+esc(e.id)+'" d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+(active?3:2.5)+'" '+(laneCount(e)===1?'stroke-dasharray="6 3" ':'')+'stroke-linecap="round" stroke-linejoin="round"/>'}).join('');
  const hits=r.lanes.map(points=>'<path data-log-edge="'+esc(e.id)+'" d="'+root.NauvisRatioFlow.roundedPath(points,5)+'" fill="none" stroke="transparent" stroke-width="10" class="log-edge-hit"/>').join('');
  return '<g opacity="'+(selected&&!active&&!connecting?.48:1)+'">'+lines+'</g>'+hits;
 }).join('');
 const boxes=layout.boxes.map(b=>{const n=g.nodes.find(n=>n.id===b.key),v=result.nodes[n.id],short=v.margin!==null&&v.margin<-.01,health=n.kind==='destination'?(v.demand===null||v.missing?'unknown':short?'short':v.demand>0&&v.received<v.demand*1.15?'tight':'ok'):v.missing?'unknown':'',rate=n.kind==='source'?v.supply:n.kind==='destination'?v.received:v.sent;
 return '<div class="log-node-wrap" style="left:'+b.x+'px;top:'+b.y+'px;width:'+b.w+'px;height:'+b.h+'px;--log-color:'+esc(itemColor(item))+'"><button type="button" class="log-node'+(n.id===selected?' selected':'')+(n.id===connecting?' connecting':'')+(short?' shortage':'')+(health?' log-health-'+health:'')+(selected&&!connecting&&!focus.nodes.has(n.id)?' unrelated':'')+'" data-log-node="'+esc(n.id)+'" aria-pressed="'+(n.id===selected)+'"><small>'+({source:'PRODUCER',splitter:'SPLITTER',merger:'MERGER',destination:'DESTINATION'}[n.kind])+'</small><b>'+esc(nodeLabel(n))+'</b><span>'+fmt(rate)+'/min'+(health==='short'?' · SHORT':health==='tight'?' · TIGHT':health==='ok'?' · OK':health==='unknown'?' · UNKNOWN':'')+'</span></button>'+
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
 const e=g.edges.find(e=>e.id===selected),tier=e?.tier||brushTier,count=e?.belts||brushCount,lanes=e?laneCount(e):brushLanes;
 return '<div class="log-brush"><div class="log-brush-head"><strong>'+(e?'Edit selected route':'New connection')+'</strong><span id="logBrushReadout">'+count+' '+tier+' · '+fmt(count*TIERS[tier]*lanes/2)+'/min</span></div><div class="log-brush-tiers">'+Object.keys(TIERS).map(t=>'<button type="button" data-log-tier="'+t+'" aria-pressed="'+(tier===t)+'" style="--belt:'+({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[t])+'">'+t+'</button>').join('')+'</div><div class="log-mode log-lane-mode"><button data-log-lanes="2" aria-pressed="'+(lanes===2)+'" '+(e?.bundle?'disabled':'')+'>Full belt · both lanes</button><button data-log-lanes="1" aria-pressed="'+(lanes===1)+'">Half belt · one lane</button></div>'+(e?.bundle?'<p class="log-muted">Mixed feeder: count and tier changes apply to both lanes.</p>':'')+'<div class="log-brush-count"><button type="button" data-log-step="-1" aria-label="One fewer belt">−</button><input aria-label="Physical belts" data-log-slider type="range" min="1" max="'+Math.max(16,count)+'" step="1" value="'+count+'"><button type="button" data-log-step="1" aria-label="One more belt">+</button><input aria-label="Exact belt count" data-log-exact type="number" inputmode="numeric" min="1" max="100" step="1" value="'+count+'"></div></div>';
}
function applyBrush(patch,preview=false){
 let g=data();const e=g.edges.find(e=>e.id===selected);
 if(!e){if(patch.tier)brushTier=patch.tier;if(patch.belts)brushCount=patch.belts;if(patch.lanes)brushLanes=patch.lanes;if(!preview)render();else $('logBrushReadout').textContent=brushCount+' '+brushTier+' · '+fmt(brushCount*TIERS[brushTier]*brushLanes/2)+'/min';return}
 try{g=updateRoute(g,e.id,patch);Object.assign(e,g.edges.find(x=>x.id===e.id))}catch(err){notice=err.message;render();return}
 if(preview){
  $('logBrushReadout').textContent=e.belts+' '+e.tier+' · '+fmt(cap(e))+'/min';
  const modeled=scenarioGraph(g,includeScenario),next=sub(modeled),target=$('logGraph'),sx=target.scrollLeft,sy=target.scrollTop;const network=networkResults(modeled,lookup),preview=network.results.get(item);target.innerHTML=renderGraph(next,preview&&!preview.error?preview:analyze(next,lookup));target.scrollLeft=sx;target.scrollTop=sy;
 }else commit(g,'Belt route updated.');
}
function addPicker(g){
 if(!picker)return '';
 const records=['source','destination'].flatMap(kind=>catalog(kind).filter(x=>!used(data(),kind,x.key)).map(x=>({kind,...x})));
 return '<div class="log-picker"><div class="log-brush-head"><strong>Add a node · '+esc(materialName(item))+'</strong><button data-log-action="picker">Close</button></div><p class="log-muted">Link a recorded group without adding machinery to Inventory. Manual nodes are network assumptions only.</p><div class="log-picker-list">'+(records.map(x=>'<button data-log-add="'+x.kind+'" data-log-link="'+esc(x.key)+'"><b>'+esc(x.label)+'</b><small>'+ (x.kind==='source'?'SUPPLY':'DEMAND')+' · '+fmt(x.rate)+'/min</small></button>').join('')||'<p class="log-muted">No unused compatible factory records yet.</p>')+'</div><div class="log-toolbar">'+[['source','Manual supply'],['destination','Manual demand'],['splitter','Splitter'],['merger','Merger']].map(([k,name])=>'<button data-log-add="'+k+'">'+name+'</button>').join('')+'</div></div>';
}

function laneInspector(e){
 const g=data(),other=e.bundle?g.edges.find(x=>x.id!==e.id&&x.bundle===e.bundle):null;
 const routeItem=x=>g.nodes.find(n=>n.id===x.from)?.item;
 const candidates=g.edges.filter(x=>compatiblePair(g,e,x));
 return '<div class="log-lane-detail"><b>'+ (other?'Mixed feeder · shared physical belts':laneCount(e)===1?'Half belt · other lane unused':'Full belt · same resource on both lanes')+'</b>'+
 '<div class="log-lane-visual" style="--belt:'+({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[e.tier])+'">'+
 [routeItem(e),other?routeItem(other):laneCount(e)===2?routeItem(e):null].map(k=>'<div style="--material:'+esc(k?itemColor(k):'#41515e')+'"><span>'+ (k?esc(materialName(k)):'Unused lane')+'</span><b>'+fmt(k?e.belts*TIERS[e.tier]/2:0)+'/min</b></div>').join('')+'</div>'+
 (other?'<button data-log-unpair="'+esc(e.id)+'">Unpair lanes</button><p class="log-muted">Shared final feeder only; upstream supply routes remain separate.</p>':candidates.length?'<label>Share the other lane with<select data-log-pair="'+esc(e.id)+'">'+opts([['','Select another half-belt route'],...candidates.map(x=>[x.id,materialName(routeItem(x))+' · '+nodeLabel(g.nodes.find(n=>n.id===x.from))])],'')+'</select></label>':laneCount(e)===1?'<p class="log-muted">Connect another half-belt ingredient to the same recorded array with matching tier and belt count to pair the lanes.</p>':'')+'</div>';
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
 if(e){const v=a.routes[e.id];return '<div class="log-inspect-head"><div><small>BELT ROUTE</small><h3>'+esc(nodeLabel(g.nodes.find(n=>n.id===e.from)))+' → '+esc(nodeLabel(g.nodes.find(n=>n.id===e.to)))+'</h3></div><button data-log-action="clear">×</button></div><div class="log-form-grid"><label>Physical belts<input type="number" inputmode="numeric" min="1" max="100" step="1" data-log-field="belts" value="'+e.belts+'"></label><label>Belt tier<select data-log-field="tier">'+opts(Object.keys(TIERS).map(k=>[k,k]),e.tier)+'</select></label></div><label>Relative allocation weight (blank = automatic; 0 = no share)<input type="number" min="0" step="0.25" inputmode="decimal" data-log-field="weight" value="'+e.weight+'"></label><div class="log-stat-grid"><div><small>Capacity/min</small><b>'+fmt(v.capacity)+'</b></div><div><small>Planned/min</small><b>'+fmt(v.delivered)+'</b></div><div><small>Share</small><b>'+fmt(v.share*100)+'%</b></div></div>'+laneInspector(e)+'<button data-log-action="delete">Remove connection</button>';
 }
 return '<p class="log-muted">Drag a + output port onto any compatible receiving card, or tap + then tap the destination. Tap a belt to edit its quantity and tier above the canvas.</p>';
}
function diagnosticPanel(g,a,report,network){
 const by=new Map(g.nodes.map(n=>[n.id,n])),label=id=>nodeLabel(by.get(id)),f=report.findings;
 const rows=f.map(x=>{
  const n=by.get(x.id),status={short:'Insufficient',tight:'Near capacity',ok:'Sufficient',unknown:'Unknown'}[x.status];
  const actions=x.actions.map(y=>{
   let text=y.text||'';
   if(y.type==='test-belt'){const e=g.edges.find(e=>e.id===y.edge);text='Tested improvement: '+label(e.from)+' → '+label(e.to)+': '+y.belts+' '+y.tier+' belt(s) adds '+fmt(y.gain)+'/min here.'}
   if(y.type==='test-share'){const e=g.edges.find(e=>e.id===y.edge);text='Tested redistribution: '+label(e.from)+' → '+label(e.to)+' at '+fmt(y.share*100)+'% allocation adds '+fmt(y.gain)+'/min here.'}
   if(y.type==='source')text+=' Short by at least '+fmt(y.amount)+'/min.';
   if(y.type==='other-source')text+=' '+fmt(y.amount)+'/min rated or conditionally supported.';
   return '<div class="log-recommendation"><p>'+esc(text)+'</p>'+(y.edge?'<button data-log-edge="'+esc(y.edge)+'">Inspect route</button>':'')+'</div>';
  }).join('');
  return '<details class="log-finding log-health-'+x.status+'"'+(x.status==='short'&&(selected===x.id||report.knownShort===1)?' open':'')+'><summary><span><b>'+esc(nodeLabel(n))+'</b><small>'+esc(status)+' · '+fmt(x.received)+' / '+(x.demand===null?'?':fmt(x.demand))+'/min</small></span><strong>'+ (x.short>.01?'−'+fmt(x.short):x.utilization===null?'?':fmt(x.utilization*100)+'%')+'</strong></summary><div class="log-finding-body">'+(x.utilization!==null?'<div class="log-support-meter"><i style="width:'+x.utilization*100+'%"></i></div>':'')+(x.status==='unknown'?'<p>Link a recorded group or enter demand to assess this node.</p>':x.status==='short'?actions||'<p>Review the connected supply.</p>':'<p>Modeled delivery meets recorded demand; unrecorded inputs remain unverified.</p>')+'<button data-log-select="'+esc(x.id)+'">Inspect node</button></div></details>';
 }).join('');
 const limited=g.nodes.filter(n=>n.kind==='source'&&groupKey(n)&&(network.factors.get(groupKey(n))??1)<.999999);
 const ratedTotal=g.nodes.filter(n=>n.kind==='source'&&!a.nodes[n.id].missing).reduce((s,n)=>s+(n.link?num(network.records.get(n.id)?.rate):a.nodes[n.id].supply),0),ratedGap=Math.max(0,report.totalDemand-ratedTotal);
 const plan=ratedGap>.01&&R[item]&&ratedGap<=25000&&!report.unknownSources&&network.converged;
 return '<section class="log-diagnostics"><div class="log-brush-head"><strong>Network diagnostics</strong><span>'+report.knownShort+' short · '+report.unknown+' unknown</span></div>'+
 '<div class="log-stat-grid"><div><small>Supported supply/min</small><b>'+fmt(report.totalSupply)+'</b></div><div><small>Known demand/min</small><b>'+fmt(report.totalDemand)+'</b></div><div><small>Network supply gap/min</small><b class="'+(report.productionGap>.01?'log-danger':'')+'">'+fmt(report.productionGap)+'</b></div></div>'+
 (limited.length?'<p class="log-warning">Modeled input shortages reduce output: '+esc(limited.map(n=>nodeLabel(n)+' ('+fmt((network.factors.get(groupKey(n))??1)*100)+'%)').join('; '))+'.</p>':'')+
 (!network.converged?'<p class="log-warning">Cross-resource calculations did not converge. Treat these estimates as provisional.</p>':'')+
 (report.productionGap>.01?'<div class="log-expansion"><b>Additional '+esc(materialName(item))+' supply needed: '+fmt(report.productionGap)+'/min</b><p>Known network demand exceeds supported supply. '+(ratedGap>.01?'Even at recorded rated output, the network is short '+fmt(ratedGap)+'/min. Additional production still needs a connected route.':'Rated production is sufficient; address modeled upstream input shortages before adding machines.')+'</p>'+(plan?'<button data-log-plan="'+ratedGap+'" class="log-primary">Plan expansion · '+fmt(ratedGap)+'/min →</button>':'')+'</div>':'')+
 (report.unrouted>.01?'<p class="log-muted">'+fmt(report.unrouted)+'/min of source capacity is not routed by the current allocation.</p>':'')+
 (rows||'<p class="log-muted">Add a destination with known demand to diagnose the network.</p>')+
 '<p class="log-muted">Predictions use recorded routes only. Missing input networks, fluids, power, fuel and inserters are unverified. Tested changes are local counterfactuals, not automatic edits or guarantees of full downstream performance.</p></section>';
}
function entityCatalog(){
 const resourceSet=new Set(['iron-ore','copper-ore','stone','iron-plate','copper-plate','steel-plate','stone-brick']);
 for(const row of setup.machines){if(!R[row.recipe]||!num(row.count))continue;resourceSet.add(row.recipe);for(const k of Object.keys(R[row.recipe][4]||{}))resourceSet.add(k)}
 const groups=new Map();
 for(const resource of resourceSet)for(const kind of ['source','destination'])for(const rec of catalog(kind,resource)){
  const key=groupKey({link:rec.key});if(!key)continue;
  // The gross iron output is the natural starting port for a new entity.
  if(rec.key==='smelt:iron-plate')continue;
  if(!groups.has(key))groups.set(key,{key,label:rec.label,ports:[]});
  const entity=groups.get(key);if(kind==='source')entity.label=rec.label.replace(' · before steel allocation','');
  entity.ports.push({kind,item:resource,link:rec.key,rate:rec.rate,solid:materials.includes(resource)});
 }
 return [...groups.values()].filter(e=>e.ports.some(p=>p.solid&&p.rate>0)).sort((a,b)=>a.label.localeCompare(b.label));
}
function modeBar(){return '<div class="log-mode"><button data-log-mode="entities" aria-pressed="'+entityMode+'">Production network</button><button data-log-mode="resource" aria-pressed="'+!entityMode+'">Resource detail</button></div>'}
function entityPort(key,index){const entity=entityView?.entities.find(e=>e.key===key);return entity&&entity.ports[index]?{entity,port:entity.ports[index]}:null}
function addEntity(key){
 const record=entityCatalog().find(e=>e.key===key);if(!record)return;
 const g=data(),projection=entityProjection(g,[record]);if(projection.entities.some(e=>e.key===key)){notice='Already represented in this network.';render();return}
 const port=record.ports.find(p=>p.solid&&p.kind==='source'&&p.rate>0)||record.ports.find(p=>p.solid&&p.rate>0);
 if(!port)return;ensureEntityPort(g,port,record,id);entityPicker=false;commit(g,'Production entity linked. Actual Inventory unchanged.');
}
function connectEntity(from,to){
 const a=entityPort(from.key,from.index),b=entityPort(to.key,to.index);
 if(!a||!b||a.entity.key===b.entity.key||a.port.item!==b.port.item) {notice='Choose a matching input on a different entity.';render();return}
 const g=data();try{
  const source=ensureEntityPort(g,a.port,a.entity,id),dest=ensureEntityPort(g,b.port,b.entity,id);
  const next=connect(g,{id:id(),from:source,to:dest,tier:brushTier,belts:brushCount,lanes:brushLanes,weight:''});entityPending=null;commit(next,'Connected '+materialName(a.port.item)+'. Inventory unchanged.');
 }catch(err){notice=err.message;render()}
}
function inspectResource(resource,key=null){
 entityMode=false;item=resource;selected=key;connecting=null;entityPending=null;picker=false;render();
}
function mixedFeederPanel(graph){
 const groups=physicalFeeders(graph),pairs=groups.filter(x=>x.mixed);
 const candidates=graph.edges.filter(x=>laneCount(x)===1&&!x.bundle);
 const itemOf=e=>graph.nodes.find(n=>n.id===e.from)?.item;
 const pairRows=pairs.map(p=>'<div class="log-shared-row"><div><b>'+p.belts+' '+p.tier+' mixed feeder'+(p.belts===1?'':'s')+'</b><small>'+esc(nodeLabel(graph.nodes.find(n=>n.id===p.members[0].to)))+'</small></div>'+laneInspector(p.members[0])+'</div>').join('');
 const offers=candidates.map(e=>{const others=candidates.filter(x=>compatiblePair(graph,e,x)&&x.id.localeCompare(e.id)>0);return others.length?'<div class="log-shared-row"><b>'+esc(materialName(itemOf(e)))+' → '+esc(nodeLabel(graph.nodes.find(n=>n.id===e.to)))+'</b><label>Pair with<select data-log-pair="'+esc(e.id)+'">'+opts([['','Select compatible ingredient'],...others.map(x=>[x.id,materialName(itemOf(x))])],'')+'</select></label></div>':''}).join('');
 return '<section class="log-mixed-panel"><div class="log-brush-head"><strong>Shared final feeders</strong><span>'+pairs.length+' paired groups</span></div>'+
 (pairRows||'<p class="log-muted">No paired lanes yet. Use Half belt for two ingredients going to the same recorded production array.</p>')+offers+
 '<p class="log-muted">A paired feeder counts once at the receiving array. Dashed map routes show each resource allocation, not duplicate physical shared belt segments. Upstream routes are not merged geometrically.</p></section>';
}
function renderEntities(host){
 const graph=scenarioGraph(data(),includeScenario),records=entityCatalog(),projection=entityProjection(graph,records);
 entityView=projection;
 const network=networkResults(graph,lookup),linked=new Set(projection.entities.map(e=>e.key));
 const candidates=records.filter(e=>!linked.has(e.key)&&(entityFilter==='all'||(entityFilter==='smelt'?e.key.startsWith('smelt:'):e.key.startsWith('machine:'))));
 const pending=entityPending&&entityPort(entityPending.key,entityPending.index);
 if(!pending)entityPending=null;
 const controls=brush({edges:[]});
 const pickerHTML=entityPicker?'<div class="log-picker"><div class="log-brush-head"><strong>Select an existing array</strong><button data-log-entity-action="picker">Close</button></div><div class="log-mode">'+[['all','All'],['smelt','Smelting'],['machine','Production']].map(([key,label])=>'<button data-log-entity-filter="'+key+'" aria-pressed="'+(key===entityFilter)+'">'+label+'</button>').join('')+'</div><div class="log-picker-list">'+(candidates.map(e=>'<button data-log-entity-add="'+esc(e.key)+'"><b>'+esc(e.label)+'</b><small>'+esc(e.ports.filter(p=>p.kind==='source').map(p=>materialName(p.item)).join(', ')||'Input group')+'</small></button>').join('')||'<p class="log-muted">No unused recorded groups in this category.</p>')+'</div><button data-log-entity-action="manual">Manual supply, demand, splitter or merger → Resource detail</button></div>':'';
 const cards=projection.entities.map(e=>{
  const factor=network.factors.get(e.key)??1;
  const requiredInputs=e.ports.filter(p=>p.kind==='destination'),verifiedInputs=requiredInputs.filter(p=>p.nodeId&&graph.edges.some(x=>x.to===p.nodeId)&&!network.results.get(p.item)?.nodes?.[p.nodeId]?.missing),unknownInputs=requiredInputs.length-verifiedInputs.length;
  const ports=e.ports.map((p,i)=>{
   const v=p.nodeId?network.results.get(p.item)?.nodes?.[p.nodeId]:null;
   const linkedPort=p.nodeId&&graph.edges.some(x=>p.kind==='source'?x.from===p.nodeId:p.kind==='destination'?x.to===p.nodeId:x.from===p.nodeId||x.to===p.nodeId);
   const solid=p.solid??materials.includes(p.item),compatible=pending&&pending.entity.key!==e.key&&pending.port.item===p.item&&p.kind==='destination';
   const rate=p.kind==='destination'?(v?.demand??p.rate):p.kind==='source'?(v?.supply??(p.rate===null?null:p.rate*factor)):v?.sent;
   const label=p.kind==='destination'?(linkedPort?fmt(v?.received)+' / '+(rate==null?'?':fmt(rate)):'Required '+(rate==null?'?':fmt(rate))):rate==null?'Unknown':fmt(rate);
   const active=entityPending?.key===e.key&&entityPending?.index===i;
   return '<div class="log-entity-port'+(compatible?' compatible':'')+(active?' active':'')+'"><span class="log-port-dot" style="background:'+esc(itemColor(p.item))+'"></span><span><b>'+esc(materialName(p.item))+'</b><small>'+esc(label)+'/min · '+(!solid?'pipe not modeled':linkedPort?'connected':'unverified')+'</small></span>'+
    (solid&&['source','destination'].includes(p.kind)?'<button data-log-entity-port="'+esc(e.key)+'" data-port-index="'+i+'" aria-label="'+(p.kind==='source'?'Connect output ':'Connect input ')+esc(materialName(p.item))+'" '+(p.kind==='destination'&&!compatible&&!p.nodeId?'disabled':'')+'>'+(p.kind==='source'?'＋':compatible?'＋':'↗')+'</button>':'')+
    (p.nodeId?'<button data-log-resource-open="'+esc(p.item)+'" data-port-node="'+esc(p.nodeId)+'" aria-label="Inspect resource route">↗</button>':'')+'</div>';
  });
  const inputs=ports.filter((_,i)=>e.ports[i].kind==='destination'),outputs=ports.filter((_,i)=>e.ports[i].kind==='source'),other=ports.filter((_,i)=>!['source','destination'].includes(e.ports[i].kind));
  return '<article class="log-entity-card" data-entity-card="'+esc(e.key)+'"><header><small>'+(e.linked?'RECORDED ARRAY':'NETWORK ASSUMPTION')+'</small><strong>'+esc(e.label)+'</strong>'+(e.linked?'<span class="'+(factor<.999?'log-danger':'')+'">'+(verifiedInputs.length?fmt(factor*100)+'% supported by modeled inputs':'Input supply unverified')+(verifiedInputs.length&&unknownInputs?' · '+unknownInputs+' unverified':'')+'</span>':'')+'</header>'+
   (inputs.length?'<div class="log-entity-section">INPUTS</div>'+inputs.join(''):'')+(outputs.length?'<div class="log-entity-section">OUTPUTS</div>'+outputs.join(''):'')+other.join('')+
   '<button class="log-entity-remove" data-log-entity-remove="'+esc(e.key)+'">Remove from network</button></article>';
 }).join('');
 const routes=projection.edges.map(e=>'<button data-log-resource-open="'+esc(e.item)+'" data-port-node="'+esc(e.id)+'"><span>'+esc(projection.entities.find(x=>x.key===e.from)?.label)+' → '+esc(projection.entities.find(x=>x.key===e.to)?.label)+'</span><b style="color:'+({yellow:'#dfbf65',red:'#e17b71',blue:'#79b5f6'}[e.tier])+'">'+esc(materialName(e.item))+' · '+e.belts+' '+e.tier+(laneCount(e)===1?' · half lane':'')+(e.bundle?' · mixed':'')+' · '+fmt(network.results.get(e.item)?.routes?.[e.id]?.delivered)+'/min</b></button>').join('');
 // A compact map collapses endpoints belonging to one recorded production
 // array. If the cross-resource projection contains a cycle, preserve the
 // graph and show its explicit route list instead of inventing a layout.
 let map='';
 if(projection.entities.length&&projection.edges.length)try{
  const visual={nodes:projection.entities.map(e=>({id:e.key})),edges:projection.edges};
  const stage=order(visual.nodes,visual.edges).stage,layout=layoutBelts(visual,stage,{nodeWidth:164,nodeHeight:60}),scale=Math.max(.65,Math.min(1,((host.clientWidth||root.innerWidth)-24)/layout.width));
  const paths=layout.routes.map(r=>r.lanes.map(points=>'<path d="'+root.NauvisRatioFlow.roundedPath(points,5)+'" stroke="'+({yellow:'#e5c35f',red:'#e17b71',blue:'#79b5f6'}[r.edge.tier])+'" stroke-width="2.5" '+(laneCount(r.edge)===1?'stroke-dasharray="6 3" ':'')+'fill="none"/>').join('')).join('');
  const boxes=layout.boxes.map(b=>{const e=projection.entities.find(x=>x.key===b.key);return '<button data-log-entity-focus="'+esc(e.key)+'" class="log-map-node" style="left:'+b.x+'px;top:'+b.y+'px;width:'+b.w+'px;height:'+b.h+'px">'+esc(e.label)+'</button>'}).join('');
  map='<div class="log-graph log-entity-map"><div class="log-scaled" style="width:'+Math.ceil(layout.width*scale)+'px;height:'+Math.ceil(layout.height*scale)+'px"><div class="log-canvas" style="width:'+layout.width+'px;height:'+layout.height+'px;transform:scale('+scale+')"><svg width="'+layout.width+'" height="'+layout.height+'" viewBox="0 0 '+layout.width+' '+layout.height+'">'+paths+'</svg>'+boxes+'</div></div></div>';
 }catch(_e){map='<p class="log-muted">Cross-resource cycle: inspect the connected entity cards and route list below.</p>'}
 host.innerHTML=modeBar()+'<div class="log-brush-head"><strong>Production entities · '+projection.entities.length+'</strong><button data-log-action="undo" '+(!undo?'disabled':'')+'>↶ Undo</button></div>'+
 '<label class="log-scenario-toggle"><input type="checkbox" data-log-scenario '+(includeScenario?'checked':'')+'> Include queued project demand (hypothetical)</label>'+
 '<button class="log-primary log-add-main" data-log-entity-action="picker">＋ Add recorded array</button>'+pickerHTML+controls+
 (pending?'<div class="log-connect-status">Connect '+esc(materialName(pending.port.item))+' from '+esc(pending.entity.label)+' <button data-log-entity-action="cancel">Cancel</button></div>':'')+
 map+'<div class="log-entity-grid">'+(cards||'<div class="log-empty"><strong>Choose a recorded production array</strong><p>Inputs and outputs are generated from your inventory and recipe. Adding an entity does not add machines.</p></div>')+'</div>'+
 '<details class="log-routes"><summary>Resource routes · '+projection.edges.length+'</summary><div class="log-route-list">'+routes+'</div></details>'+mixedFeederPanel(graph)+
 '<p class="log-message" role="status">'+esc(notice||'Tap an output +, then a matching input +. Tap ↗ to inspect or edit its resource-specific network.')+'</p>'+
 '<p class="log-muted">One card per linked production group. Unconnected ingredient ports are unverified, not assumed supplied or starved. Pipe transport and proposed arrays are not yet supported. Mixed feeders share one final segment; map lines show resource allocations. All existing resource routes remain editable in Resource detail. Network changes do not modify Inventory.</p>';
}
function render(){
 const host=$('logisticsEditor');if(!host||!$('logistics')?.classList.contains('active'))return;
 if(entityMode){renderEntities(host);return}
 const oldGraph=$('logGraph'),sx=oldGraph?.scrollLeft||0,sy=oldGraph?.scrollTop||0;const g=sub(scenarioGraph(data(),includeScenario));if(!g.nodes.some(n=>n.id===selected)&&!g.edges.some(e=>e.id===selected))selected=null;
 let a,network;try{network=networkResults(scenarioGraph(data(),includeScenario),lookup);a=network.results.get(item)||analyze(g,lookup);if(a.error)throw Error(a.error)}catch(e){host.innerHTML='<p class="log-danger">'+esc(e.message)+'</p><button data-log-action="clear-graph">Clear this resource diagram</button>';return}
 const report=diagnostics(g,a,network.effective);
 const src=g.nodes.filter(n=>n.kind==='source').reduce((s,n)=>s+a.nodes[n.id].supply,0),sinks=g.nodes.filter(n=>n.kind==='destination'),short=sinks.filter(n=>a.nodes[n.id].margin!==null&&a.nodes[n.id].margin<-.01).length;
 host.innerHTML=modeBar()+'<div class="log-top"><label>Resource<select data-log-resource>'+opts(materials.map(k=>[k,materialName(k)+(data().nodes.some(n=>n.item===k)?' · network':'')]),item)+'</select></label><button data-log-action="undo" '+(!undo?'disabled':'')+'>↶ Undo</button></div>'+
 '<label class="log-scenario-toggle"><input type="checkbox" data-log-scenario '+(includeScenario?'checked':'')+'> Include queued project demand (hypothetical; may overlap built machines)</label><div class="log-stat-grid"><div><small>Rated supply/min</small><b>'+fmt(src)+'</b></div><div><small>Destinations</small><b>'+sinks.length+'</b></div><div><small>Known shortages</small><b class="'+(short?'log-danger':'')+'">'+short+'</b></div></div>'+
 '<button type="button" class="log-primary log-add-main" data-log-action="picker">＋ Add to network</button>'+addPicker(g)+brush(g)+splitControl(g,a)+
 '<div class="log-connect-status" '+(!connecting?'hidden':'')+'>Select a receiving node, or add a new node <button data-log-action="cancel">Cancel</button></div>'+
 '<div id="logGraph" class="log-graph">'+renderGraph(g,a)+'</div>'+
 '<details class="log-routes"><summary>Route list · '+g.edges.length+'</summary><div class="log-route-list">'+g.edges.map(e=>'<button data-log-edge="'+esc(e.id)+'" class="'+(selected===e.id?'selected':'')+'"><span>'+esc(nodeLabel(g.nodes.find(n=>n.id===e.from)))+' → '+esc(nodeLabel(g.nodes.find(n=>n.id===e.to)))+'</span><b style="color:'+({yellow:'#dfbf65',red:'#e17b71',blue:'#79b5f6'}[e.tier])+'">'+e.belts+' '+e.tier+(laneCount(e)===1?' · half':'')+(e.bundle?' · mixed':'')+' · '+fmt(a.routes[e.id].delivered)+'/min</b></button>').join('')+'</div></details>'+
 '<div class="log-inspector">'+inspector(g,a)+'</div>'+diagnosticPanel(g,a,report,network)+'<p class="log-message" role="status">'+esc(notice||a.warnings.join(' ')||'Changes save and sync with your factory.')+'</p>'+
 '<p class="log-muted">Planning estimate: lane-aware belt capacity and rated machine capacity, not measured throughput. Default splitters share equally; ordinary branches share by transport capacity. Enter relative weights (e.g. 1 and 3 for 25:75); blank uses automatic shares, 0 reserves no flow. No automatic backpressure redistribution. Linked iron supply can represent gross output or post-steel bus output (not both); planned project demand is a scenario, not added to actual inventory. Network edits change connections and assumptions only.</p>';if($('logGraph')){$('logGraph').scrollLeft=sx;$('logGraph').scrollTop=sy}
}
function init(){
 const host=$('logisticsEditor');if(!host)return;
 host.addEventListener('click',ev=>{
  if(Date.now()<ignoreClickUntil){ev.preventDefault();return}
  const mode=ev.target.closest('[data-log-mode]');if(mode){entityMode=mode.dataset.logMode==='entities';selected=null;connecting=null;entityPending=null;picker=false;render();return}
  const ef=ev.target.closest('[data-log-entity-filter]');if(ef){entityFilter=ef.dataset.logEntityFilter;render();return}
  const ea=ev.target.closest('[data-log-entity-add]');if(ea){addEntity(ea.dataset.logEntityAdd);return}
  const ep=ev.target.closest('[data-log-entity-port]');if(ep){const target={key:ep.dataset.logEntityPort,index:Number(ep.dataset.portIndex)},p=entityPort(target.key,target.index);if(!p)return;if(p.port.kind==='source'){entityPending=target;render()}else if(entityPending)connectEntity(entityPending,target);else if(p.port.nodeId)inspectResource(p.port.item,p.port.nodeId);return}
  const focus=ev.target.closest('[data-log-entity-focus]');if(focus){[...host.querySelectorAll('[data-entity-card]')].find(x=>x.dataset.entityCard===focus.dataset.logEntityFocus)?.scrollIntoView({block:'center',behavior:'smooth'});return}
  const remove=ev.target.closest('[data-log-entity-remove]');if(remove){const e=entityView?.entities.find(x=>x.key===remove.dataset.logEntityRemove);if(!e||!root.confirm('Remove this entity and its attached routes from the network? Actual Inventory is unchanged.'))return;const ids=new Set(e.nodes.map(n=>n.id)),g=data();g.nodes=g.nodes.filter(n=>!ids.has(n.id));g.edges=g.edges.filter(x=>!ids.has(x.from)&&!ids.has(x.to));entityPending=null;commit(g,'Removed network reference only.');return}
  const resource=ev.target.closest('[data-log-resource-open]');if(resource){inspectResource(resource.dataset.logResourceOpen,resource.dataset.portNode||null);return}
  const entityAction=ev.target.closest('[data-log-entity-action]')?.dataset.logEntityAction;
  if(entityAction){if(entityAction==='picker')entityPicker=!entityPicker;else if(entityAction==='cancel')entityPending=null;else if(entityAction==='manual'){entityMode=false;picker=true;entityPending=null}render();return}
  const plan=ev.target.closest('[data-log-plan]');if(plan){const rate=Number(plan.dataset.logPlan);if(R[item]&&rate>0&&rate<=25000){root.NauvisRatioExplorer?.setGoal({id:item,rate,source:'bus',belt:TIERS[brushTier],machine:guide.machine===1.25?1.25:.75,moduleType:'none',moduleCount:0,moduleType2:'none',moduleCount2:0,machineQuality:'normal',beaconSpeed:0});activateWorkspace('build',true);root.NauvisRatioExplorer?.openAt('build')}return}
  const select=ev.target.closest('[data-log-select]');if(select){selected=select.dataset.logSelect;connecting=null;render();$('logGraph')?.scrollIntoView({block:'nearest',behavior:'smooth'});return}
  const addBtn=ev.target.closest('[data-log-add]');if(addBtn){add(addBtn.dataset.logAdd,addBtn.dataset.logLink||'');return}
  const port=ev.target.closest('[data-log-port]');if(port){connecting=port.dataset.logPort;selected=connecting;notice='';render();return}
  const unpair=ev.target.closest('[data-log-unpair]');if(unpair){commit(unpairLanes(data(),unpair.dataset.logUnpair),'Shared lanes separated into independent half-belt routes.');return}
  const lanes=ev.target.closest('[data-log-lanes]');if(lanes){applyBrush({lanes:Number(lanes.dataset.logLanes)});return}
  const tier=ev.target.closest('[data-log-tier]');if(tier){applyBrush({tier:tier.dataset.logTier});return}
  const step=ev.target.closest('[data-log-step]');if(step){const e=data().edges.find(e=>e.id===selected),n=Math.max(1,Math.min(100,(e?.belts||brushCount)+Number(step.dataset.logStep)));applyBrush({belts:n});return}
  const node=ev.target.closest('[data-log-node]');if(node){selectNode(node.dataset.logNode);return}
  const edge=ev.target.closest('[data-log-edge]');if(edge){selected=selected===edge.dataset.logEdge?null:edge.dataset.logEdge;connecting=null;render();return}
  const action=ev.target.closest('[data-log-action]')?.dataset.logAction;if(!action)return;
  if(action==='auto-split'){const g=data(),e=g.edges.find(e=>e.id===selected),from=e?.from||selected,ids=new Set(scenarioGraph(g,includeScenario).edges.map(e=>e.id));g.edges=g.edges.map(x=>x.from===from&&ids.has(x.id)?{...x,weight:''}:x);commit(g,'Automatic allocation restored.');return}
  if(action==='picker'){picker=!picker;render();return}
  if(action==='connect'){connecting=selected;notice='';render();return}
  if(action==='cancel'||action==='clear'){connecting=null;if(action==='clear')selected=null;render();return}
  if(action==='undo'&&undo){const next=undo;undo=null;entityPending=null;setup.logistics=normalize(next);saveSetup();selected=null;connecting=null;notice='Last logistics edit undone.';root.NauvisWorkspace?.refresh?.('logistics');render();return}
  if(action==='delete'){const g=data();g.nodes=g.nodes.filter(n=>n.id!==selected);g.edges=g.edges.filter(e=>e.id!==selected&&e.from!==selected&&e.to!==selected);selected=null;connecting=null;commit(g,'Removed. Undo is available.');return}
  if(action==='clear-graph'&&root.confirm('Clear only this resource network?')){const g=data(),ids=new Set(g.nodes.filter(n=>n.item===item).map(n=>n.id));g.nodes=g.nodes.filter(n=>!ids.has(n.id));g.edges=g.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));commit(g,'Resource diagram cleared.');}
 });
 host.addEventListener('change',ev=>{
  const input=ev.target;if(input.matches('[data-log-pair]')){if(input.value)try{commit(pairLanes(data(),input.dataset.logPair,input.value,id()),'Mixed feeder paired. Both resources reserve one lane. Inventory unchanged.')}catch(err){notice=err.message;render()}return}if(input.matches('[data-log-scenario]')){includeScenario=input.checked;selected=null;connecting=null;render();return}if(input.matches('[data-log-split]')){const g=data(),visible=scenarioGraph(g,includeScenario),ids=new Set(visible.edges.map(e=>e.id)),edges=g.edges.filter(e=>e.from===input.dataset.logSplit&&ids.has(e.id)),v=Number(input.value);if(edges.length===2&&Number.isFinite(v)&&v>=0&&v<=100){edges[0].weight=v;edges[1].weight=100-v;commit(g,'Branch allocation updated.')}return}if(input.matches('[data-log-slider],[data-log-exact]')){const v=Number(input.value);if(Number.isSafeInteger(v)&&v>=1&&v<=100)applyBrush({belts:v});else render();return}if(input.matches('[data-log-resource]')){item=input.value;selected=null;connecting=null;picker=false;notice='';render();return}
  const field=input.dataset.logField;if(!field)return;
  const g=data(),n=g.nodes.find(n=>n.id===selected),e=g.edges.find(e=>e.id===selected);
  if(n){let v=input.value;if(field==='label'&&!v.trim())v=n.kind;if(field==='amount'&&v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)){notice='Use a nonnegative belt equivalent.';render();return}const patch={[field]:v};if(field==='label'||(field==='link'&&!v))patch.autoLabel=false;
   if(field==='link'&&v){if(used(g,n.kind,v,n.id)){notice='This record is already represented in this resource network.';render();return}patch.label=catalog(n.kind).find(x=>x.key===v)?.label||n.label;patch.autoLabel=true}
   editNode(n.id,patch);
  }else if(e){const v=field==='tier'||(field==='weight'&&input.value==='')?input.value:Number(input.value);if(field==='belts'&&(!Number.isSafeInteger(v)||v<1||v>100)||field==='weight'&&v!==''&&(!Number.isFinite(v)||v<0)){notice='Invalid belt count or weight.';render();return}try{commit(updateRoute(g,e.id,{[field]:v}),'Connection updated.')}catch(err){notice=err.message;render()}}
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
 root.NauvisLogistics={render,invalidate(){undo=null;selected=null;connecting=null;picker=false;drag=null;includeScenario=false;entityPending=null;entityPicker=false;notice='';render()}};
 render();
}
init();
})(typeof window==='undefined'?globalThis:window);
