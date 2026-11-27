/* NAUVIS v0.21 · Visual-first production chain
   A view of the existing recipe math. No independent machine counts or saves. */
(function(root){
'use strict';
const escapeHTML=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const formatted=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
const machineNoun=kind=>kind==='asm'?'assemblers':kind==='chem'?'chemical plants':'furnaces';
function buildFlowGraph(result){
 if(!result||!Array.isArray(result.entries)||!Array.isArray(result.external))throw Error('Recipe analysis is missing');
 const machineMap=new Map(result.entries.map(x=>[x.key,x]));
 const nodes=[];
 const existing=new Set();
 function machineNode(row){
  const key='m:'+row.key;
  if(existing.has(key))throw Error('Duplicate recipe node: '+row.key);
  existing.add(key);
  nodes.push({key,recipe:row.key,label:row.name,type:'machine',kind:row.kind,count:row.count,
   needed:row.needed,final:row.key===result.id,level:0});
 }
 function inputNode(row){
  const key='s:'+row.key;
  if(existing.has(key))throw Error('Duplicate supply node: '+row.key);
  existing.add(key);
  nodes.push({key,recipe:row.key,label:row.name,type:'supply',kind:row.isFluid?'fluid':'solid',
    count:null,needed:row.needed,final:false,level:0});
 }
 result.entries.forEach(machineNode);
 result.external.forEach(inputNode);
 // Reused rates are separate existing supplies, not machines to construct.
 const reused=new Map((result.reused||[]).filter(r=>r.rate>1e-9).map(r=>[r.key,r]));
 const gross=new Map(),fluids=new Map();
 for(const c of result.entries)for(const ing of c.ingredients){gross.set(ing.id,(gross.get(ing.id)||0)+ing.needed);fluids.set(ing.id,ing.fluid)}
 for(const r of reused.values()){
  const key='r:'+r.key;existing.add(key);
  nodes.push({key,recipe:r.key,label:r.name+' (existing)',type:'supply',kind:fluids.get(r.key)?'fluid':'solid',count:null,needed:r.rate,final:false,level:0});
 }
 const edges=[];
 for(const consumer of result.entries){
  for(const ingredient of consumer.ingredients){
   if(!(ingredient.needed>1e-9))continue;
   const from=machineMap.has(ingredient.id)?'m:'+ingredient.id:'s:'+ingredient.id;
   const to='m:'+consumer.key;
   const reusedRate=Math.min(ingredient.needed,ingredient.needed*(reused.get(ingredient.id)?.rate||0)/Math.max(1e-9,gross.get(ingredient.id)||ingredient.needed));
   const newRate=ingredient.needed-reusedRate;
   if(!existing.has(to)||newRate>1e-8&&!existing.has(from))throw Error('Missing upstream node: '+ingredient.id);
   if(newRate>1e-8)edges.push({from,to,rate:newRate,item:ingredient.id,fluid:ingredient.fluid});
   if(reusedRate>1e-8)edges.push({from:'r:'+ingredient.id,to,rate:reusedRate,item:ingredient.id,fluid:ingredient.fluid});
  }
 }
 const byKey=new Map(nodes.map(node=>[node.key,node]));
 const output='m:'+result.id;
 if(!byKey.has(output)&&result.rate>0)throw Error('Missing final production node');
 const reverse=new Map(nodes.map(n=>[n.key,[]]));
 edges.forEach(edge=>reverse.get(edge.to).push(edge.from));
 const visit=(key,level,trail=new Set())=>{
  if(trail.has(key))throw Error('Circular recipe dependencies');
  const node=byKey.get(key);if(!node)return;
  node.level=Math.max(node.level,level);
  const next=new Set(trail);next.add(key);
  for(const parent of reverse.get(key)||[])visit(parent,level+1,next);
 };
 if(byKey.has(output))visit(output,0);
 const maxLevel=Math.max(0,...nodes.map(n=>n.level));
 for(const node of nodes)node.stage=maxLevel-node.level;
 const columns=Array.from({length:maxLevel+1},(_,i)=>
  nodes.filter(n=>n.stage===i).sort((a,b)=>{
   if(a.type!==b.type)return a.type==='supply'?-1:1;
   return a.label.localeCompare(b.label);
  }));
 return {nodes,edges,columns,maxLevel};
}
// Lay out each dependency layer on a single row/column. Connections use
// exclusive channels between stages; skipping a stage uses an exterior rail.
function baseRouteLayout(columns,links,vertical=true,options={}){
 const nodeW=148,nodeH=82,cross=vertical?nodeW:nodeH,primary=vertical?nodeH:nodeW;
 const spacing=18,pad=14,trackPitch=10;
 const nodes=new Map(),outgoing=new Map(),incoming=new Map();
 columns.forEach((col,i)=>col.forEach((n,j)=>{nodes.set(n.key,{key:n.key,stage:i,index:j});outgoing.set(n.key,[]);incoming.set(n.key,[])}));
 const edges=links.map((e,i)=>({...e,i,source:nodes.get(e.from),target:nodes.get(e.to)}));
 const span=Math.max(cross,...columns.map(col=>col.length*cross+Math.max(0,col.length-1)*spacing));
 const localCross=n=> (span-(columns[n.stage].length*cross+Math.max(0,columns[n.stage].length-1)*spacing))/2+n.index*(cross+spacing);
 const gapTracks=Array.from({length:Math.max(0,columns.length-1)},()=>[]);
 const rails=[[],[]],groups=[];
 const center=n=>localCross(n)+cross/2;
 for(const e of edges){
  if(!e.source||!e.target||e.source.stage>=e.target.stage)throw Error('Invalid flow route');
  outgoing.get(e.from).push(e);incoming.get(e.to).push(e);
 }
 // One output port, departure track and (if necessary) bypass rail per producer.
 const producerOrder=[...outgoing].sort((a,b)=>{
  if(!options.trackOrder)return 0;
  const aa=nodes.get(a[0]),bb=nodes.get(b[0]);
  if(aa.stage!==bb.stage)return options.trackOrder===3?bb.stage-aa.stage:aa.stage-bb.stage;
  return options.trackOrder===2?bb.index-aa.index:aa.index-bb.index;
 });
 for(const [key,list] of producerOrder){
  if(!list.length)continue;
  const a=list[0].source,late=list.filter(e=>e.target.stage>a.stage+1);
  const g={key,source:a,edges:list,depart:gapTracks[a.stage].length,arrivals:new Map(),side:-1};
  gapTracks[a.stage].push(g);
  if(late.length){
   const mean=(localCross(a)+late.reduce((sum,e)=>sum+localCross(e.target),0)/late.length+cross)/2;
   g.side=options.sides?.[key]??(options.sideMode===1?0:options.sideMode===2?1:mean<=span/2?0:1);g.rail=rails[g.side].length;rails[g.side].push(g);
  }
  for(const e of list){
   const stage=e.target.stage-1;
   if(stage===a.stage)g.arrivals.set(stage,g.depart);
   else if(!g.arrivals.has(stage)){g.arrivals.set(stage,gapTracks[stage].length);gapTracks[stage].push(g);}
  }
  groups.push(g);
 }
 const groupByKey=new Map(groups.map(g=>[g.key,g]));
 // Inbound ports face their actual approach lane: outside rails or nearby producers.
 if(options.portOrder)for(const list of incoming.values())list.sort((a,b)=>{
  const approach=e=>{const g=groupByKey.get(e.from);return e.target.stage>e.source.stage+1?(g.side===0?-12-(g.rail+1)*trackPitch:span+12+(g.rail+1)*trackPitch):center(e.source)};
  const delta=approach(a)-approach(b);
  return (options.portOrder===2?-delta:delta)||a.i-b.i;
 });
 const margin=side=>pad+(rails[side].length?12+rails[side].length*trackPitch:0);
 const left=margin(0),right=margin(1),totalCross=left+span+right;
 const rowStart=[];let totalPrimary=pad;
 for(let i=0;i<columns.length;i++){
  rowStart.push(totalPrimary);totalPrimary+=primary;
  if(i<columns.length-1)totalPrimary+=Math.max(30,24+gapTracks[i].length*trackPitch);
 }
 totalPrimary+=pad;
 const xy=(c,p)=>vertical?{x:c,y:p}:{x:p,y:c};
 const boxes=Array.from(nodes.values()).map(n=>{
  n.c=left+localCross(n);n.p=rowStart[n.stage];
  return {key:n.key,...xy(n.c,n.p),w:nodeW,h:nodeH};
 });
 const inputPort=(n,e)=>{
  const list=incoming.get(n.key),i=list.indexOf(e);
  return n.c+10+(cross-20)*(i+1)/(list.length+1);
 };
 const channel=(stage,index)=>rowStart[stage]+primary+12+index*trackPitch;
 const routes=[],bundles=[];
 for(const g of groups){
  const a=g.source;
  const local=g.edges.filter(e=>e.target.stage===a.stage+1);
  const preferred=local.length?local.reduce((s,e)=>s+center(e.target),0)/local.length:center(a);
  const shift=options.portShift?Math.max(-cross*.25,Math.min(cross*.25,(preferred-center(a))*.35)):0;
  const sc=a.c+cross/2+shift,depart=channel(a.stage,g.depart);
  const lane=g.side<0?null:g.side===0?left-12-(g.rail+1)*trackPitch:left+span+12+(g.rail+1)*trackPitch;
  const groupRoutes=[];
  for(const e of g.edges){
   const b=e.target,tc=inputPort(b,e),arrive=channel(b.stage-1,g.arrivals.get(b.stage-1));
   const pts=[[sc,a.p+primary],[sc,depart]];
   if(b.stage>a.stage+1)pts.push([lane,depart],[lane,arrive]);
   pts.push([tc,arrive],[tc,b.p]);
   const route={edge:e,points:pts.map(([c,p])=>xy(c,p))};
   routes.push(route);groupRoutes.push(route);
  }
  bundles.push({key:g.key,routes:groupRoutes,...mergeRoutes(groupRoutes)});
 }
 return {vertical,width:vertical?totalCross:totalPrimary,height:vertical?totalPrimary:totalCross,boxes,routes,bundles};
}
// Convert overlapping paths from one producer into a single connected tree.
// Subdivide collinear runs at every endpoint, then draw each segment once.
function mergeRoutes(routes){
 const raw=[],points=new Map(),adj=new Map(),unique=new Map();
 const key=p=>p.x+','+p.y;
 const add=p=>{const k=key(p);points.set(k,p);if(!adj.has(k))adj.set(k,new Set());return k};
 for(const r of routes)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i];add(a);add(b);
  if(key(a)!==key(b))raw.push([a,b]);
 }
 for(const [a,b] of raw){
  const vertical=a.x===b.x,axis=vertical?'y':'x',fixed=vertical?'x':'y';
  const cuts=[...points.values()].filter(p=>p[fixed]===a[fixed]&&p[axis]>=Math.min(a[axis],b[axis])&&p[axis]<=Math.max(a[axis],b[axis])).sort((p,q)=>p[axis]-q[axis]);
  for(let i=1;i<cuts.length;i++){
   const u=key(cuts[i-1]),v=key(cuts[i]);if(u===v)continue;
   const id=[u,v].sort().join('|');if(unique.has(id))continue;
   unique.set(id,[u,v]);adj.get(u).add(v);adj.get(v).add(u);
  }
 }
 const source=key(routes[0].points[0]),terminals=new Map(routes.map(r=>[key(r.points.at(-1)),r.edge]));
 const junctions=[...adj].filter(([,v])=>v.size>2).map(([k])=>points.get(k));
 const paths=[],visited=new Set();
 // Traverse outwards from source; stop at junctions so shared trunks are not redrawn.
 function walk(u,v){
  const seq=[points.get(u)],start=u;
  while(true){
   const id=[u,v].sort().join('|');if(visited.has(id))return;
   visited.add(id);seq.push(points.get(v));
   const next=[...adj.get(v)].filter(w=>w!==u);
   if(next.length!==1||terminals.has(v)||v===source){
    paths.push({points:seq,edge:terminals.get(v)||null});
    for(const w of next)if(!visited.has([v,w].sort().join('|')))walk(v,w);
    return;
   }
   u=v;v=next[0];
  }
 }
 for(const v of adj.get(source)||[])walk(source,v);
 return {paths,junctions,source:points.get(source),terminals:[...terminals].map(([k,edge])=>({point:points.get(k),edge}))};
}
// Smooth only the corners; junctions and endpoints stay at exact coordinates.
function roundedPath(points,radius=16,obstacles=[]){
 if(!points.length)return '';
 const p=[];
 for(const q of points){
  const a=p[p.length-2],b=p[p.length-1];
  if(b&&b.x===q.x&&b.y===q.y)continue;
  if(a&&b&&((a.x===b.x&&b.x===q.x)||(a.y===b.y&&b.y===q.y))&&(b.x-a.x)*(q.x-b.x)+(b.y-a.y)*(q.y-b.y)>=0)p.pop();
  p.push({...q});
 }
 let d='M'+p[0].x+','+p[0].y;
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1];
  const l1=Math.hypot(b.x-a.x,b.y-a.y),l2=Math.hypot(c.x-b.x,c.y-b.y);
  if(!l1||!l2)continue;
  if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){d+=' L'+b.x+','+b.y;continue}
  let r=Math.min(radius,l1/2,l2/2);
  // A rounded elbow stays inside a disk about its original vertex.
  // Limit its reach near other resource lines, so smoothing cannot add a crossing.
  for(const s of obstacles){
   const x=Math.max(Math.min(s.a.x,s.b.x),Math.min(b.x,Math.max(s.a.x,s.b.x)));
   const y=Math.max(Math.min(s.a.y,s.b.y),Math.min(b.y,Math.max(s.a.y,s.b.y)));
   r=Math.min(r,Math.max(0,Math.hypot(b.x-x,b.y-y)-1));
  }
  if(r<.5){d+=' L'+b.x+','+b.y;continue}
  const u={x:b.x+(a.x-b.x)*r/l1,y:b.y+(a.y-b.y)*r/l1},v={x:b.x+(c.x-b.x)*r/l2,y:b.y+(c.y-b.y)*r/l2};
  d+=' L'+u.x+','+u.y+' Q'+b.x+','+b.y+' '+v.x+','+v.y;
 }
 const last=p.at(-1);return d+' L'+last.x+','+last.y;
}
// Compare the actual rendered trunk segments, not merely the abstract DAG.
// A collinear overlap is worse than a clean crossing because it hides a resource.
function routingScore(layout){
 const segments=[];
 let length=0,crossings=0,overlaps=0,touches=0;
 for(const bundle of layout.bundles)for(const path of bundle.paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i];
  if(a.x===b.x&&a.y===b.y)continue;
  const vertical=a.x===b.x;
  const lo=vertical?Math.min(a.y,b.y):Math.min(a.x,b.x),hi=vertical?Math.max(a.y,b.y):Math.max(a.x,b.x);
  length+=hi-lo;
  segments.push({key:bundle.key,vertical,at:vertical?a.x:a.y,lo,hi});
 }
 const eps=1e-6;
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const a=segments[i],b=segments[j];if(a.key===b.key)continue;
  if(a.vertical===b.vertical){
   if(Math.abs(a.at-b.at)<eps&&Math.min(a.hi,b.hi)-Math.max(a.lo,b.lo)>eps)overlaps++;
  }else{
   const v=a.vertical?a:b,h=a.vertical?b:a;
   if(v.at<h.lo-eps||v.at>h.hi+eps||h.at<v.lo-eps||h.at>v.hi+eps)continue;
   if(v.at>h.lo+eps&&v.at<h.hi-eps&&h.at>v.lo+eps&&h.at<v.hi-eps)crossings++;
   else touches++;
  }
 }
 return {crossings,overlaps,touches,length,cost:overlaps*30+crossings*5+touches*5};
}
function betterRoute(candidate,previous){
 const a=candidate.score,b=previous.score;
 return a.cost<b.cost||(a.cost===b.cost&&(a.length<b.length-1e-6||
  (Math.abs(a.length-b.length)<1e-6&&candidate.layout.width*candidate.layout.height<previous.layout.width*previous.layout.height)));
}
// Barycentric sweeps propose node orders, then score local swaps and channel choices.
// Keep the original routing as a fallback; optimization must never worsen its score.
function optimizeLayout(columns,links,vertical=true){
 const copy=cols=>cols.map(col=>col.slice());
 const baseline=baseRouteLayout(columns,links,vertical);
 let best={layout:baseline,score:routingScore(baseline),columns:copy(columns),options:{}};
 if(!links.length)return best.layout;
 const evaluate=(cols,opts)=>{
  const layout=baseRouteLayout(cols,links,vertical,opts);
  const candidate={layout,score:routingScore(layout),columns:copy(cols),options:opts};
  if(betterRoute(candidate,best))best=candidate;
 };
 const standard={portOrder:1,portShift:true,trackOrder:1};
 for(const opts of [standard,{...standard,trackOrder:2},{...standard,trackOrder:3},{...standard,portShift:false},{...standard,sideMode:1},{...standard,sideMode:2}])evaluate(columns,opts);
 const parents=new Map(),children=new Map();
 for(const e of links){if(!parents.has(e.to))parents.set(e.to,[]);parents.get(e.to).push(e.from);if(!children.has(e.from))children.set(e.from,[]);children.get(e.from).push(e.to)}
 function sweep(cols,forward){
  const out=copy(cols),order=Array.from({length:out.length},(_,i)=>i);
  if(!forward)order.reverse();
  for(const i of order){
   const positions=new Map(out.flatMap(col=>col.map((n,j)=>[n.key,(j+.5)/col.length])));
   const median=n=>{
    const ids=(forward?parents:children).get(n.key)||[];
    const neighbors=ids.map(id=>positions.get(id)).filter(Number.isFinite);
    return neighbors.length?neighbors.reduce((a,b)=>a+b,0)/neighbors.length:positions.get(n.key);
   };
   out[i].sort((a,b)=>median(a)-median(b));
  }
  return out;
 }
 for(const forward of [true,false]){
  const cols=sweep(columns,forward);evaluate(cols,standard);evaluate(sweep(cols,!forward),standard);
 }
 evaluate(columns.map(col=>col.slice().reverse()),standard);
 // Local hill climbing explores neighboring cards, then bypass sides.
 // Bound the search so large recipes remain responsive on mobile.
 for(let pass=0;pass<2;pass++){
  const initial=best.score.cost;
  let budget=24;
  for(let s=0;s<best.columns.length&&budget>0;s++){
   for(let j=0;j+1<best.columns[s].length&&budget>0;j++){
    const cols=copy(best.columns);[cols[s][j],cols[s][j+1]]=[cols[s][j+1],cols[s][j]];
    evaluate(cols,{...best.options,portOrder:1});budget--;
   }
  }
  const stages=new Map(best.columns.flatMap((col,i)=>col.map(n=>[n.key,i])));
  const bypass=[...new Set(links.filter(e=>stages.get(e.to)>stages.get(e.from)+1).map(e=>e.from))];
  for(const key of bypass.slice(0,8))for(const side of [0,1])evaluate(best.columns,{...best.options,sides:{...best.options.sides,[key]:side}});
  for(const trackOrder of [1,2,3])evaluate(best.columns,{...best.options,trackOrder,portOrder:1});
  if(best.score.cost===0||best.score.cost===initial)break;
 }
 return best.layout;
}
function routeLayout(columns,links,vertical=true){return optimizeLayout(columns,links,vertical)}
function fitLayout(columns,links,availableWidth,availableHeight,cachedLayouts){
 const width=Math.max(1,availableWidth),height=Math.max(1,availableHeight);
 const layouts=(cachedLayouts||[routeLayout(columns,links,true),routeLayout(columns,links,false)]).map(layout=>({...layout,scale:Math.min(1,width/layout.width,height/layout.height)}));
 return layouts[0].scale>=layouts[1].scale?layouts[0]:layouts[1];
}
// Focus is separate from layout: highlighting never changes geometry or rates.
const edgeKey=e=>e.from+'|'+e.to;
const toggleSelection=(current,next)=>current===next?null:next;
const focusTone=(selected,related)=>!selected?'normal':related?'active':'muted';
function focusGraph(links,selected,upstream=false){
 const nodes=new Set(),edges=new Set();
 if(!selected)return {nodes,edges};
 nodes.add(selected);
 const add=e=>{edges.add(edgeKey(e));nodes.add(e.from);nodes.add(e.to)};
 for(const e of links)if(e.to===selected||e.from===selected)add(e);
 if(upstream){
  const seen=new Set(),todo=[selected];
  while(todo.length){
   const node=todo.pop();if(seen.has(node))continue;seen.add(node);
   for(const e of links)if(e.to===node){add(e);todo.push(e.from)}
  }
 }
 return {nodes,edges};
}
// The merged paths are directed away from the producer. Highlight a shared
// trunk only when it leads to a focused terminal, not every sibling branch.
function focusBundle(bundle,edges){
 const key=p=>p.x+','+p.y;
 const byStart=new Map();
 for(const path of bundle.paths){
  const k=key(path.points[0]);
  if(!byStart.has(k))byStart.set(k,[]);
  byStart.get(k).push(path);
 }
 const active=new Set(),memo=new Map(),visiting=new Set(),points=new Set();
 function visit(path){
  if(memo.has(path))return memo.get(path);
  if(visiting.has(path))return false;
  visiting.add(path);
  let on=path.edge?edges.has(edgeKey(path.edge)):false;
  if(!path.edge)for(const child of byStart.get(key(path.points.at(-1)))||[])if(visit(child))on=true;
  visiting.delete(path);memo.set(path,on);
  if(on){active.add(path);for(const p of path.points)points.add(key(p));}
  return on;
 }
 for(const path of bundle.paths)visit(path);
 return {active,points};
}

/* One colored stroke represents one physical belt, independent of lane allocation. */
const BELT_CAPACITY={yellow:900,red:1800,blue:2700,green:3600};
function beltRequirement(rate,tier){const cap=BELT_CAPACITY[tier]||1800,equivalent=Math.max(0,Number(rate)||0)/cap;return {capacity:cap,equivalent,count:Math.ceil(equivalent-1e-10)}}
function beltCapacityStatus(rate,tier,count){
 const demand=Math.max(0,Number(rate)||0),required=beltRequirement(demand,tier),assigned=Math.max(0,Math.floor(Number(count)||0)),capacity=assigned*required.capacity,delta=capacity-demand,tolerance=1e-8*Math.max(1,demand,capacity);
 const status=delta < -tolerance?'starving':delta > tolerance?'excess':'meeting';
 return {demand,required:required.count,assigned,capacity,delta,utilization:capacity?demand/capacity*100:null,status};
}
function capacityLabel(status){return {starving:'Starving',meeting:'Meeting demand',excess:'Excess capacity'}[status]}
// Freeze the Planner's transport choices without changing production math.
function makeBeltPlan(result,tier,allocation={}){
 const selected=Object.keys(BELT_CAPACITY).includes(tier)?tier:Object.keys(BELT_CAPACITY).find(k=>BELT_CAPACITY[k]===result.belt)||'red';
 const counts={};
 for(const [key,rate] of solidTotals(buildFlowGraph(result))){
  const value=allocation instanceof Map?allocation.get(key):allocation?.[key];
  counts[key]=Number.isSafeInteger(value)&&value>=0?value:beltRequirement(rate,selected).count;
 }
 return {tier:selected,counts};
}
// Incoming supply boundary: external and reused supply nodes, not machine outputs.
function incomingLogistics(result,beltPlan){
 const graph=buildFlowGraph(result),plan=makeBeltPlan(result,beltPlan?.tier,beltPlan?.counts),totals=solidTotals(graph);
 return graph.nodes.filter(n=>n.type==='supply'&&graph.edges.some(e=>e.from===n.key)).map(n=>({key:n.key,recipe:n.recipe,label:n.label,kind:n.kind==='fluid'?'pipe':'belt',planned:n.kind==='fluid'?1:plan.counts[n.key]??0,built:0,rate:n.kind==='fluid'?graph.edges.filter(e=>e.from===n.key).reduce((sum,e)=>sum+e.rate,0):totals.get(n.key)||0})).filter(t=>t.planned>0);
}
function solidTotals(graph){const totals=new Map();for(const e of graph.edges){if(!e.fluid)totals.set(e.from,(totals.get(e.from)||0)+e.rate)}return totals}
function downstreamRate(bundle,path){
 const same=(a,b)=>a.x===b.x&&a.y===b.y;
 function visit(p,seen){if(seen.has(p))return 0;seen.add(p);return p.edge?p.edge.rate:bundle.paths.filter(x=>same(x.points[0],p.points.at(-1))).reduce((n,x)=>n+visit(x,seen),0)}
 return visit(path,new Set());
}
function parallelPoints(points,offset){
 return points.map((p,i)=>{const a=points[i-1],b=points[i+1],normal=(x,y)=>{const dx=y.x-x.x,dy=y.y-x.y,len=Math.hypot(dx,dy)||1;return {x:-dy/len,y:dx/len}};const n1=a?normal(a,p):null,n2=b?normal(p,b):null;const n=n1&&n2?{x:Math.abs(n1.x+n2.x)>1?Math.sign(n1.x+n2.x):n1.x+n2.x,y:Math.abs(n1.y+n2.y)>1?Math.sign(n1.y+n2.y):n1.y+n2.y}:n1||n2||{x:0,y:0};return {x:p.x+offset*n.x,y:p.y+offset*n.y}})
}
function beltLines(count,tier,vertical=false){
 const n=Math.max(0,Math.floor(Number(count)||0)),shown=Math.min(16,n);
 const color=({yellow:'#e5c35f',red:'#e87572',blue:'#79b5f6',green:'#91d79a'})[tier]||'#91a4b3';
 if(!n)return '<span class="physical-belt-empty">No belts</span>';
 const breadth=8+shown*7,w=vertical?breadth:100,h=vertical?100:breadth;
 const lines=Array.from({length:shown},(_,i)=>{const p=7+i*7;return '<line data-belt-line="'+(i+1)+'" x1="'+(vertical?p:0)+'" y1="'+(vertical?0:p)+'" x2="'+(vertical?p:100)+'" y2="'+(vertical?100:p)+'" stroke="'+color+'" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round"/>'}).join('');
 return '<span class="physical-belt-stack'+(vertical?' vertical':'')+'" role="img" aria-label="'+n+' '+escapeHTML(tier)+' physical belt'+(n===1?'':'s')+(n>shown?', '+shown+' lines shown':'')+'"><svg aria-hidden="true" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" style="'+(vertical?'width:'+breadth+'px;height:38px':'width:100%;height:'+breadth+'px')+'">'+lines+'</svg>'+(n>shown?'<small>+'+(n-shown)+' more belts</small>':'')+'</span>';
}
function feederLines(count,tier,a,b,capacity){
 const mixed=a&&b&&a!==b,half=!b;
 const desc=mixed?escapeHTML(a)+' + '+escapeHTML(b)+' · '+formatted(capacity/2)+'/min capacity per ingredient per belt':half?escapeHTML(a)+' · '+formatted(capacity/2)+'/min usable per belt (one lane)':escapeHTML(a||'Resource')+' · '+formatted(capacity)+'/min per full belt';
 return '<div class="physical-feeder"><div class="physical-feeder-label"><b>'+count+' × '+escapeHTML(tier)+' belt'+(count===1?'':'s')+'</b><span>'+desc+'</span></div>'+beltLines(count,tier)+'<small>'+formatted(count*capacity)+'/min physical capacity · '+(mixed?'shared ingredients':half?'one lane used':'both lanes')+'</small></div>';
}

if(typeof module==='object'&&module.exports)module.exports={incomingLogistics,makeBeltPlan,beltCapacityStatus,solidTotals,beltRequirement,downstreamRate,parallelPoints,beltLines,feederLines,buildFlowGraph,routeLayout,baseRouteLayout,routingScore,fitLayout,mergeRoutes,roundedPath,focusGraph,focusBundle,toggleSelection,focusTone};
if(typeof document==='undefined')return;
const browserViews=new Map();
function nodeColor(node){
 return root.NauvisIcons?.color?.(node.recipe)||(node.type==='supply'?'#94b6c9':'#bba5e5');
}
const itemGlyph=(id,size)=>root.NauvisIcons?.item?.(id,size)||'';
function nodeMarkup(node){
 const color=nodeColor(node),label=escapeHTML(node.label);
 return '<button class="ratio-flow-node'+(node.final?' ratio-flow-final':'')+
    (node.type==='supply'?' ratio-flow-supply':'')+'" type="button" data-flow-node="'+escapeHTML(node.key)+
    '" style="--node-color:'+color+(node.built!==undefined?';--built-pct:'+Math.min(100,node.built/Math.max(1,node.count)*100)+'%':'')+'"'+(node.built!==undefined?' data-built-state="'+(node.built>=node.count?'done':node.built>0?'partial':'waiting')+'"':'')+' aria-pressed="false">'+
   '<span class="ratio-flow-node-dot" aria-hidden="true"></span>'+
   (node.type==='machine'?
     itemGlyph(node.recipe,40)+'<span class="ratio-flow-count">'+(node.built!==undefined?formatted(node.built)+'/'+formatted(node.count):formatted(node.count))+'</span>'+
     '<span class="ratio-flow-node-label"><strong>'+label+'</strong><b>'+machineNoun(node.kind)+'</b><small>Needs '+formatted(node.needed)+'/min output</small></span>':
     itemGlyph(node.recipe,34)+
     (node.built!==undefined?'<span class="ratio-flow-count">'+formatted(node.built)+'/'+formatted(node.count)+'</span>':'')+'<span class="ratio-flow-node-label"><strong>'+label+'</strong><b>'+(node.built!==undefined?(node.kind==='fluid'?'Pipe connection':'Incoming belts'):'Input supply')+'</b><small>'+formatted(node.needed)+'/min</small></span>')+
   '</button>';
}
function captureBeltPlan(cardKey,result){const state=browserViews.get(cardKey);return makeBeltPlan(result,state?.beltTier,state?.allocation)}
function updateProgress(cardKey,counts){
 const state=browserViews.get(cardKey);if(!state)return;
 for(const node of state.graph.nodes){
  if(node.type!=='machine'||!Object.prototype.hasOwnProperty.call(counts,node.recipe))continue;
  node.built=Math.max(0,Math.min(node.count,Number(counts[node.recipe])||0));
  const el=[...state.holder.querySelectorAll('[data-flow-node]')].find(b=>b.dataset.flowNode===node.key);
  const chip=[...state.holder.querySelectorAll('[data-flow-review]')].find(b=>b.dataset.flowReview===node.key);
  const pct=100*node.built/Math.max(1,node.count),status=node.built>=node.count?'done':node.built>0?'partial':'waiting';
  if(el){el.style.setProperty('--built-pct',pct+'%');el.dataset.builtState=status;el.querySelector('.ratio-flow-count').textContent=formatted(node.built)+'/'+formatted(node.count)}
  if(chip){chip.dataset.builtState=status;chip.querySelector('strong').textContent=formatted(node.built)+'/'+formatted(node.count)}
 }
}
function updateLogisticsProgress(cardKey,tasks,{preview=false}={}){
 const state=browserViews.get(cardKey);if(!state)return;
 for(const task of tasks||[]){
  const n=state.graph.nodes.find(x=>x.key===task.key&&x.type==='supply');if(!n)continue;
  n.count=task.planned;n.built=Math.max(0,Math.min(task.planned,task.built));const pct=100*n.built/Math.max(1,n.count),status=n.built>=n.count?'done':n.built>0?'partial':'waiting';
  const el=[...state.holder.querySelectorAll('[data-flow-node]')].find(b=>b.dataset.flowNode===n.key);
  if(el){el.style.setProperty('--built-pct',pct+'%');el.dataset.builtState=status;const count=el.querySelector('.ratio-flow-count');if(count)count.textContent=formatted(n.built)+'/'+formatted(n.count)}
  const row=[...state.holder.querySelectorAll('[data-logistics-row]')].find(r=>r.dataset.logisticsRow===task.key);
  if(row){row.classList.toggle('project-task-done',status==='done');row.querySelector('[data-built-preview]').textContent=n.built;const input=row.querySelector('[data-project-logistics-built]'),check=row.querySelector('[data-project-logistics-check]');if(!preview){input.value=n.built;input.dataset.soundValue=n.built;check.checked=status==='done'}}
  if(!preview)state.logistics.set(task.key,{...task,built:n.built});
 }
}
function celebrateProgress(cardKey,recipe,logistics=false){
 const state=browserViews.get(cardKey);if(!state||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches||root.NauvisSensory?.getPrefs?.().motion==='off')return;
 const node=state.graph.nodes.find(n=>logistics?n.type==='supply'&&n.key===recipe:n.type==='machine'&&n.recipe===recipe),el=node&&[...state.holder.querySelectorAll('[data-flow-node]')].find(b=>b.dataset.flowNode===node.key);
 if(!el)return;el.classList.remove('flow-complete-shine');void el.offsetWidth;el.classList.add('flow-complete-shine');el.addEventListener('animationend',()=>el.classList.remove('flow-complete-shine'),{once:true});
}
function unmount(cardKey){const s=browserViews.get(cardKey);s?.observer?.disconnect();s?.cancel?.();s?.cleanup?.();browserViews.delete(cardKey)}
function mount(target,result,cardKey,options={}){
 const holder=target.querySelector('[data-ratio-flow-root]');if(!holder)return;
 const graph=buildFlowGraph(result),logistics=new Map((options.logistics||[]).map(t=>[t.key,{...t}]));
 for(const node of graph.nodes){const task=logistics.get(node.key);if(task){node.count=task.planned;node.built=task.built}}
 if(options.progress)for(const node of graph.nodes)if(node.type==='machine')node.built=options.progress[node.recipe]??0;
 const older=browserViews.get(cardKey);
 older?.observer?.disconnect();
 older?.cancel?.();
 older?.cleanup?.();
 const inputVisible=root.NauvisRatioFlow?.inputByCard?.get(cardKey)??true;
 const upstream=root.NauvisRatioFlow?.upstreamByCard?.get(cardKey)??false;
 const beltMode=root.NauvisRatioFlow.beltModeByCard.get(cardKey)??false;
 const savedPlan=options.progress?makeBeltPlan(result,options.beltPlan?.tier,options.beltPlan?.counts):null;
 const tierList=Object.keys(BELT_CAPACITY),beltTier=savedPlan?.tier||root.NauvisRatioFlow.beltTierByCard.get(cardKey)||tierList.find(k=>BELT_CAPACITY[k]===result.belt)||'red';
 const totals=solidTotals(graph);
 const allocationKey=cardKey+'|'+result.id;
 const allocation=savedPlan?new Map(Object.entries(savedPlan.counts)):(root.NauvisRatioFlow.beltAllocationByCard.get(allocationKey)||new Map());
 if(!savedPlan)root.NauvisRatioFlow.beltAllocationByCard.set(allocationKey,allocation);
 holder.innerHTML=
  '<div class="ratio-flow-top"><h3>Production flow</h3>'+
  '<div class="ratio-flow-total">'+result.roundedTotal+'<small>machines total</small></div></div>'+
  '<div class="flow-machine-review"><div class="flow-machine-grid">'+graph.nodes.filter(n=>n.type==='machine').map(n=>'<div class="flow-machine-chip" data-flow-review="'+escapeHTML(n.key)+'"'+(n.built!==undefined?' data-built-state="'+(n.built>=n.count?'done':n.built>0?'partial':'waiting')+'"':'')+' style="--node-color:'+nodeColor(n)+'">'+itemGlyph(n.recipe,27)+'<strong>'+(n.built!==undefined?formatted(n.built)+'/':'')+formatted(n.count)+'</strong><span>'+escapeHTML(n.label)+'</span></div>').join('')+'</div></div>'+
  '<div class="ratio-flow-controls"><div class="ratio-flow-options" data-flow-options>'+
  '<label class="ratio-flow-input-toggle"><input data-flow-input-toggle type="checkbox"'+(inputVisible?' checked':'')+'><span>Inputs</span></label>'+
  '<label class="ratio-flow-input-toggle"><input data-flow-upstream-toggle type="checkbox"'+(upstream?' checked':'')+'><span>Upstream tree</span></label><label class="ratio-flow-input-toggle"><input data-flow-belt-toggle type="checkbox"'+(beltMode?' checked':'')+'><span>Show belts</span></label></div></div>'+
  '<div data-flow-display></div>'+
  '<section class="flow-belt-allocation" data-flow-belt-allocation hidden><div class="flow-belt-controls flow-belt-slider" data-flow-belt-controls><label>Belt tier <strong data-flow-belt-tier-label></strong><input type="range" min="0" max="3" step="1" value="'+tierList.indexOf(beltTier)+'" data-flow-belt-tier aria-label="Belt tier"></label><div class="flow-belt-tier-labels"><span>Yellow</span><span>Red</span><span>Blue</span><span>Green</span></div><button type="button" class="flow-capacity-reset" data-flow-belt-reset>Fit belts to demand</button></div><div data-flow-belt-summary></div></section>';
 const display=holder.querySelector('[data-flow-display]');
 const checkbox=holder.querySelector('[data-flow-input-toggle]');
 const upstreamToggle=holder.querySelector('[data-flow-upstream-toggle]');
 const state={graph,display,holder,result,cardKey,logistics,inputVisible,upstream,beltMode,beltTier,totals,allocation,selected:older?.result?.id===result.id?(older.selected||null):null,observer:null,
  cancel:null,redraw:null};
 browserViews.set(cardKey,state);
 if(options.progress){holder.classList.add('construction-flow');checkbox.closest('label').hidden=true;upstreamToggle.closest('label').hidden=true;holder.querySelector('[data-flow-belt-tier]').disabled=true;holder.querySelector('[data-flow-belt-reset]').hidden=true;holder.querySelector('[data-flow-belt-toggle]').nextElementSibling.textContent=options.beltPlan?'Show saved logistics':'Show estimated logistics';}
 function update(){
  updateBeltControls();
  state.observer?.disconnect();
  state.cancel?.();
  state.cleanup?.();
  state.refreshFocus=null;state.redraw=null;
  drawLayout(state);
 }
 const beltToggle=holder.querySelector('[data-flow-belt-toggle]'),slider=holder.querySelector('[data-flow-belt-tier]'),beltControls=holder.querySelector('[data-flow-belt-controls]');
 function updateBeltControls(){
  beltControls.hidden=!state.beltMode;
  holder.querySelector('[data-flow-belt-allocation]').hidden=!state.beltMode;
  if(beltControls.hidden)return;
  const tier=state.beltTier,cap=BELT_CAPACITY[tier];
  for(const [key,rate] of totals)if(!allocation.has(key))allocation.set(key,beltRequirement(rate,tier).count);
  holder.querySelector('[data-flow-belt-tier-label]').textContent=tier.toUpperCase()+' · '+formatted(cap)+'/min per belt';
  if(options.progress){const label=beltControls.querySelector('label');label.firstChild.textContent=options.beltPlan?'Saved belt tier ':'Estimated belt tier ';slider.hidden=true;beltControls.querySelector('.flow-belt-tier-labels').hidden=true;}
  const summary=holder.querySelector('[data-flow-belt-summary]');
  const row=([key,rate])=>{
   const node=graph.nodes.find(n=>n.key===key);
   const task=options.progress&&logistics.get(key);
   if(task){
    const pipe=task.kind==='pipe',done=task.built===task.planned;
    return '<div class="project-task flow-logistics-task'+(done?' project-task-done':'')+'" data-logistics-row="'+escapeHTML(key)+'" data-flow-resource="'+escapeHTML(key)+'" style="--project-task-accent:'+nodeColor(node)+'">'+
    '<div class="project-task-identity"><span class="project-task-led" aria-hidden="true"></span>'+itemGlyph(node.recipe,32)+'<div><strong>'+escapeHTML(node.label)+'</strong><small>'+task.planned+' '+(pipe?'pipe connection':tier+' belt'+(task.planned===1?'':'s'))+' planned</small></div></div>'+
    '<div class="flow-logistics-stats">'+(pipe?'':'<div class="flow-resource-ring" aria-label="Planned capacity utilization"><b data-flow-util></b></div>')+'<div class="flow-resource-main"><small data-flow-rates></small><small data-flow-status></small></div></div>'+
    '<div class="project-task-controls project-slider-controls"><label class="project-built-slider"><span class="project-task-counter"><b data-built-preview>'+task.built+'</b><small>/ '+task.planned+' built</small></span><input type="range" min="0" max="'+task.planned+'" step="1" value="'+task.built+'" data-sound-value="'+task.built+'" data-project-logistics-built="'+escapeHTML(options.projectId)+'" data-logistics-key="'+escapeHTML(key)+'" aria-label="Built incoming '+escapeHTML(node.label)+' '+(pipe?'pipe connection':'belts')+'"></label><label class="project-check"><input type="checkbox" data-project-logistics-check="'+escapeHTML(options.projectId)+'" data-logistics-key="'+escapeHTML(key)+'" '+(done?'checked':'')+'> Done</label></div></div>';
   }
   return '<div class="flow-belt-resource" data-flow-resource="'+escapeHTML(key)+'"><div class="flow-resource-ring" aria-label="Capacity utilization"><b data-flow-util></b></div><div class="flow-resource-main"><b>'+itemGlyph(node.recipe,20)+escapeHTML(node.label)+'</b><small data-flow-rates></small><small data-flow-status></small><label class="flow-resource-slider"><input type="range" min="0" step="1" data-flow-belt-count data-flow-material="'+escapeHTML(key)+'" aria-label="Assigned belts for '+escapeHTML(node.label)+'"><span><b data-flow-assigned></b> belts</span></label></div></div>';
  };
  const entries=[...totals];
  if(options.progress)for(const task of logistics.values())if(task.kind==='pipe')entries.push([task.key,task.rate]);
  if(!summary.children.length)summary.innerHTML='<div class="flow-capacity-grid">'+entries.map(row).join('')+'</div>';
  for(const el of summary.querySelectorAll('[data-flow-resource]')){
   const key=el.dataset.flowResource,task=logistics.get(key),rate=totals.get(key)??task?.rate??0;
   if(task?.kind==='pipe'){el.querySelector('[data-flow-rates]').textContent=formatted(rate)+'/min required flow';el.querySelector('[data-flow-status]').textContent='One incoming pipe connection · capacity not modeled';continue}
   const r=beltCapacityStatus(rate,tier,allocation.get(key)),pct=r.utilization;
   el.dataset.capacityStatus=r.status;
   el.querySelector('[data-flow-util]').textContent=pct===null?'—':formatted(Math.round(pct))+'%';
   el.querySelector('.flow-resource-ring').style.setProperty('--ring-p',Math.min(100,pct??(rate?100:0))+'%');
   el.querySelector('[data-flow-rates]').textContent=task?'Required '+formatted(rate)+'/min · capacity '+formatted(r.capacity)+'/min · '+r.required+' belts required':formatted(rate)+' / '+formatted(r.capacity)+'/min · '+r.required+' required';
   el.querySelector('[data-flow-status]').textContent=capacityLabel(r.status)+' · '+(r.status==='starving'?formatted(-r.delta)+'/min short':r.status==='excess'?formatted(r.delta)+'/min spare':'Demand matched');
   if(task)continue;
   el.querySelector('[data-flow-assigned]').textContent=r.assigned;
   const input=el.querySelector('[data-flow-belt-count]');input.max=String(Math.max(4,r.required*2,r.assigned));input.value=String(r.assigned);if(options.progress){input.hidden=true;input.disabled=true;}input.setAttribute('aria-valuetext',r.assigned+' '+tier+' belts');
  }
 }
 function refreshCapacity(){updateBeltControls();state.refreshDetails?.();state.redraw?.()}
 holder.querySelector('[data-flow-belt-reset]').addEventListener('click',()=>{for(const [key,rate] of totals)allocation.set(key,beltRequirement(rate,state.beltTier).count);refreshCapacity()});
 holder.querySelector('[data-flow-belt-summary]').addEventListener('input',event=>{
  const input=event.target.closest('[data-flow-belt-count]');if(!input||options.progress)return;
  const key=input.dataset.flowMaterial;if(!totals.has(key))return;
  allocation.set(key,Math.max(0,Math.floor(Number(input.value)||0)));refreshCapacity();
 });
 beltToggle.addEventListener('change',()=>{state.beltMode=beltToggle.checked;root.NauvisRatioFlow.beltModeByCard.set(cardKey,state.beltMode);update()});
 slider.addEventListener('input',()=>{state.beltTier=tierList[Number(slider.value)];root.NauvisRatioFlow.beltTierByCard.set(cardKey,state.beltTier);updateBeltControls();state.refreshDetails?.();state.redraw?.()});
 checkbox.addEventListener('change',()=>{
  state.inputVisible=checkbox.checked;
  root.NauvisRatioFlow.inputByCard.set(cardKey,state.inputVisible);
  state.selected=null;
  update();
 });
 upstreamToggle.addEventListener('change',()=>{
  state.upstream=upstreamToggle.checked;
  root.NauvisRatioFlow.upstreamByCard.set(cardKey,state.upstream);
  state.refreshFocus?.();
  state.redraw?.();
 });
 update();
}
function drawLayout(state){
 const {graph,display,result}=state;
 const columns=graph.columns.map(col=>col.filter(n=>state.inputVisible||n.type==='machine')).filter(col=>col.length);
 const visible=new Set(columns.flat().map(n=>n.key));
 const links=graph.edges.filter(e=>visible.has(e.from)&&visible.has(e.to));
 const nCols=columns.length;
 const stages=columns.flat().map(nodeMarkup).join('');
 const nNodes=columns.reduce((acc,list)=>acc+list.length,0);
 if(!nNodes){
  display.innerHTML='<p class="ratio-muted">Enter a positive output target to see its production flow.</p>';return;
 }
 display.innerHTML='<p class="ratio-flow-hint">Tap a block to inspect rates and connections.</p>'+
  '<div class="ratio-flow-viewport ratio-flow-auto" tabindex="0" aria-label="Visual production chain">'+
  '<div class="ratio-flow-scaled-space"><div class="ratio-flow-canvas" style="--flow-stages:'+nCols+'">'+
  '<svg class="ratio-flow-svg" aria-hidden="true" focusable="false"></svg>'+
  '<div class="ratio-flow-columns">'+stages+'</div></div></div></div>'+
  '<div class="ratio-flow-selection" aria-live="polite"></div>';
 const canvas=display.querySelector('.ratio-flow-canvas');
 const viewport=display.querySelector('.ratio-flow-viewport');
 const scaledSpace=display.querySelector('.ratio-flow-scaled-space');
 const svg=display.querySelector('.ratio-flow-svg');
 const cards=[...display.querySelectorAll('[data-flow-node]')];
 const summary=display.querySelector('.ratio-flow-selection');
 const nodeByKey=new Map(graph.nodes.map(x=>[x.key,x]));
 const layouts=[routeLayout(columns,links,true),routeLayout(columns,links,false)];
 if(!visible.has(state.selected))state.selected=null;
 let focus;
 function refreshFocus(){
  focus=focusGraph(links,state.selected,state.upstream);
  for(const b of cards){
   const key=b.dataset.flowNode,selected=key===state.selected;
   b.setAttribute('aria-pressed',String(selected));
   b.dataset.flowHighlight=!state.selected?'normal':selected?'selected':focus.nodes.has(key)?'related':'muted';
  }
 }
 state.refreshFocus=refreshFocus;
 function showDetails(){
  refreshFocus();
  const node=nodeByKey.get(state.selected);
  if(!node){summary.innerHTML='';return}
  const inputs=graph.edges.filter(e=>e.to===node.key);
  const outputs=graph.edges.filter(e=>e.from===node.key);
  const toText=(edge,direction)=>{
   const other=nodeByKey.get(direction==='in'?edge.from:edge.to);
   const from=direction==='in'?(other?.label||edge.item):node.label;
   const to=direction==='in'?node.label:(other?.label||edge.to);
   return '<span class="ratio-flow-connection"><b>'+formatted(edge.rate)+'/min'+(state.beltMode&&!edge.fluid?' · '+beltRequirement(edge.rate,state.beltTier).count+' '+state.beltTier+' belt(s) required':'')+'</b> '+escapeHTML(from)+
     '<span class="ratio-flow-connection-arrow">→ '+escapeHTML(to)+'</span></span>';
  };
  summary.innerHTML='<div class="ratio-flow-detail-top"><span class="ratio-flow-selected-title">'+itemGlyph(node.recipe,27)+escapeHTML(node.label)+'</span>'+
    (node.type==='machine'?'<strong>'+formatted(node.count)+' '+machineNoun(node.kind)+'</strong>':'<strong>'+formatted(node.needed)+'/min supplied</strong>')+'</div>'+
   '<div class="ratio-flow-detail-lanes">'+
   '<div><small>REQUIRES</small>'+(inputs.length?inputs.map(e=>toText(e,'in')).join(''):'<span class="ratio-muted">External input or no modeled upstream recipe</span>')+'</div>'+
   '<div><small>FEEDS</small>'+(outputs.length?outputs.map(e=>toText(e,'out')).join(''):'<span class="ratio-muted">Final output</span>')+'</div></div>';
 }
 function redraw(){
  if(document.hidden||!canvas.isConnected||!viewport.clientWidth)return;
  const width=viewport.clientWidth;
  const screenHeight=root.visualViewport?.height||root.innerHeight||800;
  const chromeHeight=document.querySelector('.command-chrome')?.getBoundingClientRect().height||0;
  const availableHeight=Math.max(120,Math.floor(screenHeight-chromeHeight-36));
  const layout=fitLayout(columns,links,width,availableHeight,layouts);
  canvas.style.width=layout.width+'px';canvas.style.height=layout.height+'px';
  canvas.style.transform='scale('+layout.scale+')';
  scaledSpace.style.width=Math.ceil(layout.width*layout.scale)+'px';
  scaledSpace.style.height=Math.ceil(layout.height*layout.scale)+'px';
  const boxes=new Map(layout.boxes.map(b=>[b.key,b]));
  for(const card of cards){
   const b=boxes.get(card.dataset.flowNode);if(!b)continue;
   Object.assign(card.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});
  }
  svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);
  svg.setAttribute('width',String(layout.width));svg.setAttribute('height',String(layout.height));
  const markers=[],paths=[],dots=[];
  const segments=layout.bundles.flatMap(bundle=>bundle.paths.flatMap(path=>path.points.slice(1).map((b,i)=>({key:bundle.key,a:path.points[i],b}))));
  const pointKey=p=>p.x+','+p.y;
  for(const bundle of layout.bundles){
   const color=nodeColor(nodeByKey.get(bundle.key));
   const highlight=focusBundle(bundle,focus.edges);
   const id='ratio-arrow-'+state.cardKey+'-'+bundle.routes[0].edge.i;
   // Arrowhead geometry is 12% larger at all scales; the viewBox preserves shape.
   for(const active of [false,true]){
    const markerId=id+(active?'-on':'-off');
    markers.push('<marker id="'+markerId+'" markerWidth="5.6" markerHeight="5.6" viewBox="0 0 5 5" refX="5" refY="2.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L5 2.5 L0 5Z" fill="'+color+'" opacity="'+(active||!state.selected?1:.46)+'"/></marker>');
   }
   const obstacles=segments.filter(s=>s.key!==bundle.key);
   for(const path of bundle.paths){
    const active=highlight.active.has(path),tone=focusTone(state.selected,active),d=roundedPath(path.points,16,obstacles);
    if(state.beltMode&&!bundle.routes[0].edge.fluid){
     const rate=downstreamRate(bundle,path),r=beltRequirement(rate,state.beltTier),n=Math.min(r.count,12),tierColor=({yellow:'#e5c35f',red:'#e87572',blue:'#79b5f6',green:'#91d79a'})[state.beltTier];
     const check=beltCapacityStatus(state.totals.get(bundle.key)||rate,state.beltTier,state.allocation.get(bundle.key)),statusColor=({starving:'#ff8c83',meeting:'#91d79a',excess:'#83caff'})[check.status];
     const isRoot=path.points[0].x===bundle.source.x&&path.points[0].y===bundle.source.y;
     const markup=Array.from({length:n},(_,i)=>'<path data-blueprint-belt="'+(i+1)+'" d="'+roundedPath(parallelPoints(path.points,(i-(n-1)/2)*4),10,obstacles)+'" fill="none" stroke="'+tierColor+'" stroke-width="2" stroke-linecap="round" opacity="'+(state.selected&&!active?.35:1)+'"/>').join('');
     const seg=path.points.slice(1).map((p,i)=>({a:path.points[i],b:p,len:Math.hypot(p.x-path.points[i].x,p.y-path.points[i].y)})).sort((a,b)=>b.len-a.len)[0];
     const annotation=seg?'<text x="'+(seg.a.x+seg.b.x)/2+'" y="'+((seg.a.y+seg.b.y)/2-8-n*2)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+(isRoot?statusColor:tierColor)+'" stroke="#152b3b" stroke-width="2.5" paint-order="stroke" opacity="'+(state.selected&&!active?.35:1)+'">'+r.count+' '+state.beltTier+(isRoot?' · '+capacityLabel(check.status):'')+'</text>':'';
     paths.push({active,markup:markup+annotation});continue;
    }
    const dashed=bundle.routes[0].edge.fluid?' stroke-dasharray="6 5" data-fluid-route="true"':'';
    const line='<path class="ratio-link-underlay" d="'+d+'"'+dashed+'/>'+
     (active?'<path class="ratio-link-glow" style="stroke:'+color+'" d="'+d+'"'+dashed+'/>':'')+
     '<path class="ratio-link '+tone+'" style="stroke:'+color+'" d="'+d+'"'+dashed+(path.edge?' marker-end="url(#'+id+(active?'-on':'-off')+')"':'')+'/>';
    paths.push({active,markup:line});
   }
   const dot=(p,kind,r)=>{
    const active=highlight.points.has(pointKey(p)),tone=focusTone(state.selected,active);
    const cls=kind==='junction'?'ratio-flow-junction':'ratio-flow-port';
    dots.push({active,markup:'<circle class="'+cls+' '+tone+'" cx="'+p.x+'" cy="'+p.y+'" r="'+(active?r*1.16:r)+'" fill="'+color+'"/>'});
   };
   for(const p of bundle.junctions)dot(p,'junction',3.2);
   dot(bundle.source,'port',3);
   for(const {point:p} of bundle.terminals)dot(p,'port',2.4);
  }
  paths.sort((a,b)=>Number(a.active)-Number(b.active));
  dots.sort((a,b)=>Number(a.active)-Number(b.active));
  svg.innerHTML='<defs>'+markers.join('')+'</defs>'+paths.map(p=>p.markup).join('')+dots.map(p=>p.markup).join('');

 }
 let lastDimensions='';
 function onResize(){const dims=viewport.clientWidth+'|'+Math.floor(root.visualViewport?.height||root.innerHeight||0)+'|'+Math.ceil(document.querySelector('.command-chrome')?.getBoundingClientRect().height||0);if(dims===lastDimensions)return;lastDimensions=dims;queueRedraw()}
 function queueRedraw(){
  if(document.hidden||!canvas.isConnected||!viewport.clientWidth)return;
  state.cancel?.();
  let id=requestAnimationFrame(redraw);
  state.cancel=()=>cancelAnimationFrame(id);
 }
 cards.forEach(b=>b.addEventListener('click',()=>{state.selected=toggleSelection(state.selected,b.dataset.flowNode);showDetails();queueRedraw()}));
 showDetails();
 state.refreshDetails=showDetails;
 state.redraw=queueRedraw;
 root.addEventListener('resize',onResize,{passive:true});
 root.visualViewport?.addEventListener('resize',onResize,{passive:true});
 const onVisible=()=>{if(!document.hidden){lastDimensions='';onResize()}};document.addEventListener('visibilitychange',onVisible);
 state.cleanup=()=>{root.removeEventListener('resize',onResize);root.visualViewport?.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisible)};
 redraw();
 if(typeof ResizeObserver!=='undefined'){
  state.observer=new ResizeObserver(onResize);
  state.observer.observe(viewport);
  const chrome=document.querySelector('.command-chrome');if(chrome)state.observer.observe(chrome);
 }
}
root.NauvisRatioFlow={incomingLogistics,makeBeltPlan,solidTotals,downstreamRate,parallelPoints,captureBeltPlan,updateProgress,updateLogisticsProgress,celebrateProgress,beltCapacityStatus,beltAllocationByCard:new Map(),beltRequirement,beltLines,feederLines,beltModeByCard:new Map(),beltTierByCard:new Map(),mount,unmount,buildFlowGraph,routeLayout,roundedPath,focusGraph,focusBundle,inputByCard:new Map(),upstreamByCard:new Map()};
})(typeof window==='undefined'?globalThis:window);
