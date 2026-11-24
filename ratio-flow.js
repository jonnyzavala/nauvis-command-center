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
function routeLayout(columns,links,vertical=true){
 const nodeW=148,nodeH=82,cross=vertical?nodeW:nodeH,primary=vertical?nodeH:nodeW;
 const spacing=18,pad=14,trackPitch=10;
 const nodes=new Map(),outgoing=new Map(),incoming=new Map();
 columns.forEach((col,i)=>col.forEach((n,j)=>{nodes.set(n.key,{key:n.key,stage:i,index:j});outgoing.set(n.key,[]);incoming.set(n.key,[])}));
 const edges=links.map((e,i)=>({...e,i,source:nodes.get(e.from),target:nodes.get(e.to)}));
 const span=Math.max(cross,...columns.map(col=>col.length*cross+Math.max(0,col.length-1)*spacing));
 const localCross=n=> (span-(columns[n.stage].length*cross+Math.max(0,columns[n.stage].length-1)*spacing))/2+n.index*(cross+spacing);
 const gapTracks=Array.from({length:Math.max(0,columns.length-1)},()=>[]);
 const rails=[[],[]],groups=[];
 for(const e of edges){
  if(!e.source||!e.target||e.source.stage>=e.target.stage)throw Error('Invalid flow route');
  outgoing.get(e.from).push(e);incoming.get(e.to).push(e);
 }
 // One output port, departure track and (if necessary) bypass rail per producer.
 for(const [key,list] of outgoing){
  if(!list.length)continue;
  const a=list[0].source,late=list.filter(e=>e.target.stage>a.stage+1);
  const g={key,source:a,edges:list,depart:gapTracks[a.stage].length,arrivals:new Map(),side:-1};
  gapTracks[a.stage].push(g);
  if(late.length){
   const mean=(localCross(a)+late.reduce((sum,e)=>sum+localCross(e.target),0)/late.length+cross)/2;
   g.side=mean<=span/2?0:1;g.rail=rails[g.side].length;rails[g.side].push(g);
  }
  for(const e of list){
   const stage=e.target.stage-1;
   if(stage===a.stage)g.arrivals.set(stage,g.depart);
   else if(!g.arrivals.has(stage)){g.arrivals.set(stage,gapTracks[stage].length);gapTracks[stage].push(g);}
  }
  groups.push(g);
 }
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
  const a=g.source,sc=a.c+cross/2,depart=channel(a.stage,g.depart);
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
function roundedPath(points,radius=5){
 if(!points.length)return '';
 const p=points.map(q=>({...q}));
 let d='M'+p[0].x+','+p[0].y;
 for(let i=1;i<p.length-1;i++){
  const a=p[i-1],b=p[i],c=p[i+1];
  const l1=Math.hypot(b.x-a.x,b.y-a.y),l2=Math.hypot(c.x-b.x,c.y-b.y);
  if(!l1||!l2)continue;
  if((a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){d+=' L'+b.x+','+b.y;continue}
  const r=Math.min(radius,l1/2,l2/2);
  const u={x:b.x+(a.x-b.x)*r/l1,y:b.y+(a.y-b.y)*r/l1},v={x:b.x+(c.x-b.x)*r/l2,y:b.y+(c.y-b.y)*r/l2};
  d+=' L'+u.x+','+u.y+' Q'+b.x+','+b.y+' '+v.x+','+v.y;
 }
 const last=p.at(-1);return d+' L'+last.x+','+last.y;
}
function fitLayout(columns,links,availableWidth,availableHeight){
 const width=Math.max(1,availableWidth),height=Math.max(1,availableHeight);
 const layouts=[routeLayout(columns,links,true),routeLayout(columns,links,false)].map(layout=>({...layout,scale:Math.min(1,width/layout.width,height/layout.height)}));
 return layouts[0].scale>=layouts[1].scale?layouts[0]:layouts[1];
}
if(typeof module==='object'&&module.exports)module.exports={buildFlowGraph,routeLayout,fitLayout,mergeRoutes,roundedPath};
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
  '<div data-flow-display></div>';
 const display=holder.querySelector('[data-flow-display]');
 const controls=[...holder.querySelectorAll('[data-flow-mode]')];
 const checkbox=holder.querySelector('[data-flow-input-toggle]');
 const panel=target.querySelector('[data-ratio-legacy-table]');
 const state={graph,display,holder,result,cardKey,inputVisible,selected:older?.selected||null,observer:null,
  cancel:null,redraw:null};
 browserViews.set(cardKey,state);
 function update(){
  const inFlow=root.NauvisRatioFlow.modeByCard.get(cardKey)!=='table';
  controls.forEach(b=>{
   const active=(b.dataset.flowMode==='flow')===inFlow;
   b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
  });
  checkbox.closest('label').hidden=!inFlow;
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
 display.innerHTML='<p class="ratio-flow-hint">Each resource uses one shared line that branches at junctions. Tap any block to see exact rates.</p>'+
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
 const selectedDefault=graph.nodes.find(n=>n.type==='machine'&&links.filter(e=>e.from===n.key).length>1)
   ||graph.nodes.find(n=>n.final)||cards.length&&nodeByKey.get(cards[0].dataset.flowNode);
 if(!state.selected||!visible.has(state.selected))state.selected=selectedDefault?.key||cards[0].dataset.flowNode;
 function showDetails(){
  cards.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flowNode===state.selected)));
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
  const layout=fitLayout(columns,links,width,availableHeight);
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
  for(const bundle of layout.bundles){
   const color=nodeColor(nodeByKey.get(bundle.key));
   const active=bundle.key===state.selected||bundle.routes.some(r=>r.edge.to===state.selected);
   const id='ratio-arrow-'+state.cardKey+'-'+bundle.routes[0].edge.i;
   markers.push('<marker id="'+id+'" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L5 2.5 L0 5Z" fill="'+color+'"/></marker>');
   const pathMarkup=bundle.paths.map(path=>{
    const d=roundedPath(path.points);
    return '<path class="ratio-link-underlay" d="'+d+'"/><path class="ratio-link'+(active?' active':'')+'" style="stroke:'+color+'" d="'+d+'"'+(path.edge?' marker-end="url(#'+id+')"':'')+'/>';
   }).join('');
   paths.push({active,markup:pathMarkup});
   for(const p of bundle.junctions)dots.push('<circle class="ratio-flow-junction" cx="'+p.x+'" cy="'+p.y+'" r="3.2" fill="'+color+'"/>');
   dots.push('<circle class="ratio-flow-port" cx="'+bundle.source.x+'" cy="'+bundle.source.y+'" r="3" fill="'+color+'"/>');
   for(const {point:p} of bundle.terminals)dots.push('<circle class="ratio-flow-port" cx="'+p.x+'" cy="'+p.y+'" r="2.4" fill="'+color+'"/>');
  }
  paths.sort((a,b)=>Number(a.active)-Number(b.active));
  svg.innerHTML='<defs>'+markers.join('')+'</defs>'+paths.map(p=>p.markup).join('')+dots.join('');

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
root.NauvisRatioFlow={mount,buildFlowGraph,modeByCard:new Map(),inputByCard:new Map()};
})(typeof window==='undefined'?globalThis:window);
