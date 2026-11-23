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
if(typeof module==='object'&&module.exports)module.exports={buildFlowGraph};
if(typeof document==='undefined')return;
const browserViews=new Map();
const colors={
  'advanced-circuit':'#f18b86','electronic-circuit':'#79d0ad',
  'processing-unit':'#82bdf0','copper-cable':'#eec277',
  asm:'#bba5e5',chem:'#7cc7d4',furnace:'#c4c9d3'
};
function nodeColor(node){
 return colors[node.recipe]||colors[node.kind]||(node.type==='supply'?'#94b6c9':'#bba5e5');
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
 const stages=columns.map((nodes,idx)=>
  '<section class="ratio-flow-stage" aria-label="Stage '+(idx+1)+'">'+
  '<span class="ratio-flow-stage-label">'+(idx===nCols-1?'FINAL OUTPUT':idx===0?'FIRST PRODUCTION STEP':'STAGE '+(idx+1))+'</span>'+
  nodes.map(nodeMarkup).join('')+
  '</section>'
 ).join('');
 const nNodes=columns.reduce((acc,list)=>acc+list.length,0);
 if(!nNodes){
  display.innerHTML='<p class="ratio-muted">Enter a positive output target to see its production flow.</p>';return;
 }
 display.innerHTML='<p class="ratio-flow-hint">Follow the arrows from ingredients to finished output. Tap any block to see its incoming materials and outgoing branches.</p>'+
  '<div class="ratio-flow-viewport" tabindex="0" aria-label="Visual production chain">'+
  '<div class="ratio-flow-canvas" style="--flow-stages:'+nCols+'">'+
  '<svg class="ratio-flow-svg" aria-hidden="true" focusable="false"></svg>'+
  '<div class="ratio-flow-columns">'+stages+'</div></div></div>'+
  '<div class="ratio-flow-selection" aria-live="polite"></div>';
 const canvas=display.querySelector('.ratio-flow-canvas');
 const viewport=display.querySelector('.ratio-flow-viewport');
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
  if(!canvas.isConnected)return;
  const canvasRect=canvas.getBoundingClientRect();
  const width=canvas.clientWidth,height=canvas.scrollHeight;
  if(!width||!height)return;
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));
  const vertical=window.matchMedia('(max-width:650px)').matches;
  const nodesEl=new Map(cards.map(x=>[x.dataset.flowNode,x]));
  const lineMarkup=[];
  // Only label all branches in small maps. Larger maps reveal rates on selection.
  const permanent=links.length<=6&&!vertical;
  for(let i=0;i<links.length;i++){
   const edge=links[i],src=nodesEl.get(edge.from),dst=nodesEl.get(edge.to);
   if(!src||!dst)continue;
   const a=src.getBoundingClientRect(),b=dst.getBoundingClientRect();
   const x1=vertical?a.left+a.width/2-canvasRect.left:a.right-canvasRect.left;
   const y1=vertical?a.bottom-canvasRect.top:a.top+a.height/2-canvasRect.top;
   const x2=vertical?b.left+b.width/2-canvasRect.left:b.left-canvasRect.left;
   const y2=vertical?b.top-canvasRect.top:b.top+b.height/2-canvasRect.top;
   const dist=vertical?(y2-y1):(x2-x1);
   const shift=Math.max(16,Math.abs(dist)*.48);
   const d=vertical?'M'+x1+','+y1+' C'+x1+','+(y1+shift)+' '+x2+','+(y2-shift)+' '+x2+','+y2:
     'M'+x1+','+y1+' C'+(x1+shift)+','+y1+' '+(x2-shift)+','+y2+' '+x2+','+y2;
   const highlighted=edge.from===state.selected||edge.to===state.selected;
   const activeClass=highlighted?' active':'';
   const label=(permanent||highlighted)&&dist>28;
   // Labels stay off the cards, sit near arrow midpoints and show per-branch throughput.
   const tx=vertical?(x1+x2)/2:(x1+x2)/2,ty=vertical?(y1+y2)/2:(y1+y2)/2;
   lineMarkup.push('<path class="ratio-link'+activeClass+'" d="'+d+'" marker-end="url(#ratio-arrow-'+state.cardKey+')" />'+
      (label?'<text class="ratio-link-text'+activeClass+'" x="'+tx+'" y="'+(ty-5)+'" text-anchor="middle">'+formatted(edge.rate)+'/min</text>':''));
  }
  svg.innerHTML='<defs><marker id="ratio-arrow-'+state.cardKey+'" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6Z" fill="#83aec8"/></marker></defs>'+lineMarkup.join('');
 }
 function queueRedraw(){
  state.cancel?.();
  let id=requestAnimationFrame(redraw);
  state.cancel=()=>cancelAnimationFrame(id);
 }
 cards.forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.flowNode;showDetails();queueRedraw()}));
 showDetails();
 queueRedraw();
 if(typeof ResizeObserver!=='undefined'){
  state.observer=new ResizeObserver(queueRedraw);
  state.observer.observe(canvas);
 }
}
root.NauvisRatioFlow={mount,buildFlowGraph,modeByCard:new Map(),inputByCard:new Map()};
})(typeof window==='undefined'?globalThis:window);
