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
 const edges=[];
 for(const consumer of result.entries){
  for(const ingredient of consumer.ingredients){
   if(!(ingredient.needed>1e-9))continue;
   const from=machineMap.has(ingredient.id)?'m:'+ingredient.id:'s:'+ingredient.id;
   const to='m:'+consumer.key;
   if(!existing.has(from)||!existing.has(to))throw Error('Missing upstream node: '+ingredient.id);
   edges.push({from,to,rate:ingredient.needed,item:ingredient.id,fluid:ingredient.fluid});
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
if(typeof module==='object'&&module.exports)module.exports={buildFlowGraph,routeLayout,baseRouteLayout,routingScore,fitLayout,mergeRoutes,roundedPath,focusGraph,focusBundle};
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
    '" style="--node-color:'+color+'" aria-pressed="false">'+
   '<span class="ratio-flow-node-dot" aria-hidden="true"></span>'+
   (node.type==='machine'?
     itemGlyph(node.recipe,40)+'<span class="ratio-flow-count">'+formatted(node.count)+'</span>'+
     '<span class="ratio-flow-node-label"><strong>'+label+'</strong><b>'+machineNoun(node.kind)+'</b><small>Needs '+formatted(node.needed)+'/min output</small></span>':
     itemGlyph(node.recipe,34)+
     '<span class="ratio-flow-node-label"><strong>'+label+'</strong><b>Input supply</b><small>'+formatted(node.needed)+'/min</small></span>')+
   '</button>';
}
function fullLabel(node){return node.label+' '+machineNoun(node.kind)}
function mount(target,result,cardKey){
 const holder=target.querySelector('[data-ratio-flow-root]');if(!holder)return;
 const graph=buildFlowGraph(result);
 const older=browserViews.get(cardKey);
 older?.observer?.disconnect();
 older?.cancel?.();
 older?.cleanup?.();
 const mode=(root.NauvisRatioFlow?.modeByCard?.get(cardKey)||'flow');
 const inputVisible=root.NauvisRatioFlow?.inputByCard?.get(cardKey)??true;
 const upstream=root.NauvisRatioFlow?.upstreamByCard?.get(cardKey)??false;
 const compact=graph.nodes.filter(n=>n.type==='machine');
 const buildList=compact.map(n=>
  '<span class="ratio-flow-build-chip" style="--node-color:'+nodeColor(n)+'">'+itemGlyph(n.recipe,35)+'<strong>'+
  formatted(n.count)+'</strong><span>'+escapeHTML(fullLabel(n))+'</span></span>'
 ).join('');
 holder.innerHTML=
  '<div class="ratio-flow-top"><div><h3>Build these machines</h3>'+
  '<p>The counts you need, before the calculations.</p></div>'+
  '<div class="ratio-flow-total">'+result.roundedTotal+'<small>machines total</small></div></div>'+
  '<div class="ratio-flow-build-list">'+(buildList||'<p class="ratio-muted">Enter a production target to see machine counts.</p>')+'</div>'+
  '<div class="ratio-flow-controls"><div class="ratio-flow-switch" role="group" aria-label="Choose ratio visualization">'+
  '<button type="button" data-flow-mode="flow" aria-pressed="'+(mode==='flow')+'">Flow view</button>'+
  '<button type="button" data-flow-mode="table" aria-pressed="'+(mode==='table')+'">Table view</button></div>'+
  '<label class="ratio-flow-input-toggle"><input data-flow-input-toggle type="checkbox"'+(inputVisible?' checked':'')+'>'+
  '<span>Show inputs</span></label></div>'+
  '<div class="ratio-flow-focus-controls" data-flow-focus-controls><span>Highlight</span><div class="ratio-flow-switch" role="group" aria-label="Connection highlight scope"><button type="button" data-flow-focus="direct" aria-pressed="'+(!upstream)+'">Direct</button><button type="button" data-flow-focus="upstream" aria-pressed="'+upstream+'">Upstream tree</button></div></div>'+
  '<div data-flow-display></div>';
 const display=holder.querySelector('[data-flow-display]');
 const controls=[...holder.querySelectorAll('[data-flow-mode]')];
 const checkbox=holder.querySelector('[data-flow-input-toggle]');
 const panel=target.querySelector('[data-ratio-legacy-table]');
 const focusControls=holder.querySelector('[data-flow-focus-controls]');
 const state={graph,display,holder,result,cardKey,inputVisible,upstream,selected:older?.selected||null,observer:null,
  cancel:null,redraw:null};
 browserViews.set(cardKey,state);
 function update(){
  const inFlow=root.NauvisRatioFlow.modeByCard.get(cardKey)!=='table';
  controls.forEach(b=>{
   const active=(b.dataset.flowMode==='flow')===inFlow;
   b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  checkbox.closest('label').hidden=!inFlow;
  focusControls.hidden=!inFlow;
  if(panel)panel.hidden=inFlow;
  display.hidden=!inFlow;
  state.observer?.disconnect();
  state.cancel?.();
  state.cleanup?.();
  if(!inFlow){display.innerHTML='';return}
  drawLayout(state);
 }
 controls.forEach(button=>button.addEventListener('click',()=>{
  root.NauvisRatioFlow.modeByCard.set(cardKey,button.dataset.flowMode);
  update();
 }));
 checkbox.addEventListener('change',()=>{
  state.inputVisible=checkbox.checked;
  root.NauvisRatioFlow.inputByCard.set(cardKey,state.inputVisible);
  state.selected=null;
  update();
 });
 focusControls.addEventListener('click',event=>{
  const button=event.target.closest('[data-flow-focus]');if(!button)return;
  state.upstream=button.dataset.flowFocus==='upstream';
  root.NauvisRatioFlow.upstreamByCard.set(cardKey,state.upstream);
  focusControls.querySelectorAll('[data-flow-focus]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.flowFocus==='upstream')===state.upstream)));
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
 display.innerHTML='<p class="ratio-flow-hint">Tap any block to highlight its connections. Direct shows immediate inputs and outputs; Upstream tree also traces all earlier ingredients.</p>'+
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
 const selectedDefault=graph.nodes.find(n=>n.type==='machine'&&links.filter(e=>e.from===n.key).length>1)
   ||graph.nodes.find(n=>n.final)||cards.length&&nodeByKey.get(cards[0].dataset.flowNode);
 if(!state.selected||!visible.has(state.selected))state.selected=selectedDefault?.key||cards[0].dataset.flowNode;
 let focus;
 function refreshFocus(){
  focus=focusGraph(links,state.selected,state.upstream);
  for(const b of cards){
   const key=b.dataset.flowNode,selected=key===state.selected;
   b.setAttribute('aria-pressed',String(selected));
   b.dataset.flowHighlight=selected?'selected':focus.nodes.has(key)?'related':'muted';
  }
 }
 state.refreshFocus=refreshFocus;
 function showDetails(){
  refreshFocus();
  const node=nodeByKey.get(state.selected),inputs=graph.edges.filter(e=>e.to===node.key);
  const outputs=graph.edges.filter(e=>e.from===node.key);
  const toText=(edge,direction)=>{
   const other=nodeByKey.get(direction==='in'?edge.from:edge.to);
   const from=direction==='in'?(other?.label||edge.item):node.label;
   const to=direction==='in'?node.label:(other?.label||edge.to);
   return '<span class="ratio-flow-connection"><b>'+formatted(edge.rate)+'/min</b> '+escapeHTML(from)+
     '<span class="ratio-flow-connection-arrow">→ '+escapeHTML(to)+'</span></span>';
  };
  summary.innerHTML='<div class="ratio-flow-detail-top"><span class="ratio-flow-selected-title">'+itemGlyph(node.recipe,27)+escapeHTML(node.label)+'</span>'+
    (node.type==='machine'?'<strong>'+formatted(node.count)+' '+machineNoun(node.kind)+'</strong>':'<strong>'+formatted(node.needed)+'/min supplied</strong>')+'</div>'+
   '<div class="ratio-flow-detail-lanes">'+
   '<div><small>REQUIRES</small>'+(inputs.length?inputs.map(e=>toText(e,'in')).join(''):'<span class="ratio-muted">External input or no modeled upstream recipe</span>')+'</div>'+
   '<div><small>FEEDS</small>'+(outputs.length?outputs.map(e=>toText(e,'out')).join(''):'<span class="ratio-muted">Final output</span>')+'</div></div>';
 }
 function redraw(){
  if(!canvas.isConnected||!viewport.clientWidth)return;
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
    markers.push('<marker id="'+markerId+'" markerWidth="5.6" markerHeight="5.6" viewBox="0 0 5 5" refX="5" refY="2.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L5 2.5 L0 5Z" fill="'+color+'" opacity="'+(active?1:.46)+'"/></marker>');
   }
   const obstacles=segments.filter(s=>s.key!==bundle.key);
   for(const path of bundle.paths){
    const active=highlight.active.has(path),d=roundedPath(path.points,16,obstacles);
    const line='<path class="ratio-link-underlay" d="'+d+'"/>'+
     (active?'<path class="ratio-link-glow" style="stroke:'+color+'" d="'+d+'"/>':'')+
     '<path class="ratio-link '+(active?'active':'muted')+'" style="stroke:'+color+'" d="'+d+'"'+(path.edge?' marker-end="url(#'+id+(active?'-on':'-off')+')"':'')+'/>';
    paths.push({active,markup:line});
   }
   const dot=(p,kind,r)=>{
    const active=highlight.points.has(pointKey(p));
    dots.push({active,markup:'<circle class="ratio-flow-'+kind+' '+(active?'active':'muted')+'" cx="'+p.x+'" cy="'+p.y+'" r="'+(active?r*1.16:r)+'" fill="'+color+'"/>'});
   };
   for(const p of bundle.junctions)dot(p,'junction',3.2);
   dot(bundle.source,'port',3);
   for(const {point:p} of bundle.terminals)dot(p,'port',2.4);
  }
  paths.sort((a,b)=>Number(a.active)-Number(b.active));
  dots.sort((a,b)=>Number(a.active)-Number(b.active));
  svg.innerHTML='<defs>'+markers.join('')+'</defs>'+paths.map(p=>p.markup).join('')+dots.map(p=>p.markup).join('');

 }
 function queueRedraw(){
  state.cancel?.();
  let id=requestAnimationFrame(redraw);
  state.cancel=()=>cancelAnimationFrame(id);
 }
 cards.forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.flowNode;showDetails();queueRedraw()}));
 showDetails();
 state.redraw=queueRedraw;
 root.addEventListener('resize',queueRedraw,{passive:true});
 root.visualViewport?.addEventListener('resize',queueRedraw,{passive:true});
 state.cleanup=()=>{root.removeEventListener('resize',queueRedraw);root.visualViewport?.removeEventListener('resize',queueRedraw)};
 queueRedraw();
 if(typeof ResizeObserver!=='undefined'){
  state.observer=new ResizeObserver(queueRedraw);
  state.observer.observe(viewport);
  const chrome=document.querySelector('.command-chrome');if(chrome)state.observer.observe(chrome);
 }
}
root.NauvisRatioFlow={mount,buildFlowGraph,modeByCard:new Map(),inputByCard:new Map(),upstreamByCard:new Map()};
})(typeof window==='undefined'?globalThis:window);
