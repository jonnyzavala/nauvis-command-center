/* Read-only canvas export from saved project snapshots. No DOM screenshot or external service. */
(function(root){
'use strict';
const fmt=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:1});
const cleanName=s=>String(s||'construction').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70).toLowerCase()||'construction';
const palette={bg:'#102132',panel:'#172d40',node:'#1b3549',line:'#4b718a',text:'#eff7ff',muted:'#a8c3d6',gold:'#ebbf79',teal:'#78e4cf',green:'#91d79a',red:'#ff8c83',blue:'#79b5f6'};
const beltColors={yellow:'#e5c35f',red:'#e87572',blue:'#79b5f6',green:'#91d79a'};
const W=1000,M=38;
function metrics(records,includeBelts,flow){
 const parts=records.map(p=>{
  let graph=null,layout=null,belts=null;
  if(p.analysis)try{graph=flow.buildFlowGraph(p.analysis);layout=flow.routeLayout(graph.columns,graph.edges,true);if(includeBelts)belts=flow.makeBeltPlan(p.analysis,p.beltPlan?.tier,p.beltPlan?.counts)}catch{graph=null;layout=null;belts=null}
  const scale=layout?Math.min((W-2*M-28)/layout.width,1.65):1;
  const graphHeight=layout?Math.ceil(layout.height*scale)+44:62;
  const beltRows=belts?[...flow.solidTotals(graph),...(p.logisticsTasks||[]).filter(t=>t.kind==='pipe').map(t=>[t.key,t.rate])]:[];
  const beltHeight=belts?58+Math.ceil(beltRows.length/2)*80:0;
  const height=186+graphHeight+beltHeight+54+p.tasks.length*70+24;
  return {p,graph,layout,scale,graphHeight,belts,beltRows,beltHeight,height};
 });
 const height=130+parts.reduce((n,p)=>n+p.height+20,0)+48;
 const scale=Math.min(2,4096/W,8192/height,Math.sqrt(14500000/(W*height)));
 if(scale<.75)throw Error('This sheet is too large for a readable PNG. Export projects individually.');
 return {width:W,height,scale,parts};
}
if(typeof module==='object'&&module.exports){module.exports={metrics,cleanName};return}
const $=id=>document.getElementById(id);
const dialog=$('projectExportDialog'),preview=$('projectExportPreview'),status=$('projectExportStatus'),download=$('projectExportDownload'),share=$('projectExportShare'),toggle=$('projectExportBelts');
let records=[],blob=null,objectURL='',generation=0,filename='';
function rect(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke()}}
function text(c,s,x,y,size=18,color=palette.text,weight=500,max=Infinity){c.font=weight+' '+size+'px system-ui, sans-serif';c.fillStyle=color;c.textAlign='left';c.textBaseline='middle';let value=String(s);if(c.measureText(value).width>max){while(value.length&&c.measureText(value+'…').width>max)value=value.slice(0,-1);value+='…'}c.fillText(value,x,y)}
function centered(c,s,x,y,size,color,weight=600){c.font=weight+' '+size+'px system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y)}
function bar(c,x,y,w,h,p,color){rect(c,x,y,w,h,h/2,'#304b60');if(p>0)rect(c,x,y,Math.min(1,p)*w,h,Math.min(h/2,p*w/2),color)}
function ring(c,x,y,r,p,color){c.lineWidth=7;c.strokeStyle='#304b60';c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();if(p>0){c.strokeStyle=color;c.lineCap='round';c.beginPath();c.arc(x,y,r,-Math.PI/2,-Math.PI/2+Math.min(1,p)*Math.PI*2);c.stroke();c.lineCap='butt'}}
const color=id=>root.NauvisIcons?.color(id)||palette.blue;
async function icons(ids){const map=new Map();await Promise.all([...new Set(ids)].map(async id=>{try{const svg=root.NauvisIcons.item(id,32).match(/<svg[\s\S]*?<\/svg>/)?.[0];if(!svg)return;const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);const img=new Image();await new Promise(resolve=>{img.onload=()=>{map.set(id,img);resolve()};img.onerror=resolve;img.src=url})}catch{}}));return map}
function icon(c,map,id,x,y,s){const img=map.get(id);if(img)c.drawImage(img,x,y,s,s);else rect(c,x+5,y+5,s-10,s-10,5,color(id))}
function graphDraw(c,part,y,map,flow){
 const {graph,layout,scale,p,belts}=part;if(!layout){text(c,'Historical flowchart unavailable; saved checklist preserved.',M+20,y+30,16,palette.muted);return}
 const nodeByKey=new Map(graph.nodes.map(n=>[n.key,n])),tasks=new Map(p.tasks.map(t=>[t.recipe,t])),logistics=new Map((p.logisticsTasks||[]).map(t=>[t.key,t]));
 c.save();c.translate((W-layout.width*scale)/2,y+32);c.scale(scale,scale);
 const segments=layout.bundles.flatMap(b=>b.paths.flatMap(path=>path.points.slice(1).map((q,i)=>({key:b.key,a:path.points[i],b:q}))));
 for(const b of layout.bundles){
  const tone=color(nodeByKey.get(b.key).recipe),obstacles=segments.filter(s=>s.key!==b.key);
  for(const path of b.paths){
   if(belts&&!b.routes[0].edge.fluid){
    const rate=flow.downstreamRate(b,path),r=flow.beltRequirement(rate,belts.tier),n=Math.min(12,r.count);
    c.strokeStyle=beltColors[belts.tier];c.lineWidth=1.7;c.lineCap='round';
    for(let i=0;i<n;i++)c.stroke(new Path2D(flow.roundedPath(flow.parallelPoints(path.points,(i-(n-1)/2)*4),10,obstacles)));
    const seg=path.points.slice(1).map((q,i)=>({a:path.points[i],b:q,len:Math.hypot(q.x-path.points[i].x,q.y-path.points[i].y)})).sort((a,b)=>b.len-a.len)[0];
    if(seg){const x=(seg.a.x+seg.b.x)/2,yy=(seg.a.y+seg.b.y)/2-8-n*2;const label=r.count+' '+belts.tier;c.font='700 9px system-ui';c.textAlign='center';c.textBaseline='middle';c.lineWidth=3;c.strokeStyle=palette.bg;c.strokeText(label,x,yy);c.fillStyle=beltColors[belts.tier];c.fillText(label,x,yy)}
   }else{c.strokeStyle=tone;c.lineWidth=2;c.lineJoin='round';c.setLineDash(b.routes[0].edge.fluid?[6,5]:[]);c.stroke(new Path2D(flow.roundedPath(path.points,16,obstacles)));c.setLineDash([])}
  }
  for(const point of [b.source,...b.junctions,...b.terminals.map(t=>t.point)]){c.fillStyle=tone;c.beginPath();c.arc(point.x,point.y,2.5,0,2*Math.PI);c.fill()}
 }
 for(const b of layout.boxes){
  const node=nodeByKey.get(b.key),machine=node.type==='machine',task=machine?tasks.get(node.recipe):logistics.get(node.key),done=!!task&&task.built>=task.planned,accent=done?palette.green:color(node.recipe);
  rect(c,b.x,b.y,b.w,b.h,9,palette.node,accent);if(node.final){c.lineWidth=2;c.strokeStyle=accent;c.stroke()}
  icon(c,map,node.recipe,b.x+7,b.y+7,29);
  text(c,node.label,b.x+39,b.y+17,11,palette.text,700,b.w-46);
  if(machine){text(c,fmt(task?.built)+' / '+fmt(node.count),b.x+9,b.y+43,20,accent,800,b.w-18);bar(c,b.x+9,b.y+b.h-10,b.w-18,4,(task?.built||0)/Math.max(1,node.count),accent)}
  else if(task){text(c,fmt(task.built)+' / '+fmt(task.planned)+' '+(task.kind==='pipe'?'pipe':'belts'),b.x+9,b.y+43,16,accent,800,b.w-18);bar(c,b.x+9,b.y+b.h-10,b.w-18,4,task.built/Math.max(1,task.planned),accent)}else text(c,'Input supply',b.x+9,b.y+43,10,palette.muted,500);
  text(c,fmt(node.needed)+'/min',b.x+9,b.y+62,10,palette.muted,500,b.w-18);
 }
 c.restore();
}
async function renderSheet(items,includeBelts){
 const flow=root.NauvisRatioFlow,model=metrics(items,includeBelts,flow),canvas=document.createElement('canvas');
 canvas.width=Math.ceil(model.width*model.scale);canvas.height=Math.ceil(model.height*model.scale);
 const c=canvas.getContext('2d');if(!c)throw Error('Image rendering unavailable.');
 c.scale(model.scale,model.scale);c.fillStyle=palette.bg;c.fillRect(0,0,W,model.height);
 c.strokeStyle='#294358';c.lineWidth=.6;for(let x=0;x<W;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,model.height);c.stroke()}for(let y=0;y<model.height;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke()}
 const map=await icons(model.parts.flatMap(({p,graph})=>[p.recipe,...p.tasks.map(t=>t.recipe),...(graph?.nodes||[]).map(n=>n.recipe)]));
 text(c,'N A U V I S',M,35,18,palette.gold,800);text(c,'Command Center  /  Construction',M,70,31,palette.text,800);
 const totals=items.reduce((a,p)=>({built:a.built+(p.overall||p.progress).built,planned:a.planned+(p.overall||p.progress).planned}),{built:0,planned:0});
 text(c,items.length+' project'+(items.length===1?'':'s')+'  ·  '+fmt(totals.built)+' / '+fmt(totals.planned)+' machines / supply connections built',M,108,18,palette.teal,700);
 let y=130;
 for(const part of model.parts){
  const {p,graphHeight,belts,beltRows,beltHeight,height}=part,progress=p.progress,total=p.overall||progress,frac=total.planned?total.built/total.planned:0;
  rect(c,M,y,W-2*M,height,18,palette.panel,palette.line);
  icon(c,map,p.recipe,M+20,y+19,52);
  text(c,p.name,M+82,y+32,28,palette.text,800,W-2*M-208);
  text(c,p.product+' · '+fmt(p.rate)+'/min · '+(p.source==='bus'?'Bus-fed':'Raw inputs'),M+82,y+63,17,palette.muted,500,W-2*M-208);
  ring(c,W-M-59,y+60,34,frac,palette.teal);centered(c,Math.floor(frac*100)+'%',W-M-59,y+60,20,palette.teal,800);
  text(c,p.archived?'ARCHIVED':frac===1?'COMPLETE':frac===0?'NOT STARTED':'IN PROGRESS',M+22,y+101,14,palette.teal,800);
  text(c,fmt(progress.built)+' / '+fmt(progress.planned)+' machines · '+(p.overall?.logistics?.planned?fmt(p.overall.logistics.built)+' / '+fmt(p.overall.logistics.planned)+' supply connections':progress.complete+' / '+progress.tasks+' groups complete'),M+22,y+130,20,palette.text,700);
  bar(c,M+22,y+150,W-2*M-44,8,frac,palette.teal);
  let yy=y+182;text(c,'CONSTRUCTION FLOW',M+20,yy+8,15,palette.blue,800);
  graphDraw(c,part,yy,map,flow);yy+=graphHeight;
  if(belts){text(c,(p.beltPlan?'SAVED':'ESTIMATED')+' LOGISTICS · '+belts.tier.toUpperCase(),M+20,yy+15,15,beltColors[belts.tier],800);text(c,'Solid lines = belts · dashed lines = fluid connections.',M+20,yy+36,12,palette.muted,500);for(const [i,[key,rate]] of beltRows.entries()){
   const node=part.graph.nodes.find(n=>n.key===key),task=(p.logisticsTasks||[]).find(t=>t.key===key),x=M+20+(i%2)*((W-2*M-40)/2),ry=yy+54+Math.floor(i/2)*80;
   if(task?.kind==='pipe'){icon(c,map,node.recipe,x,ry+6,40);text(c,node.label,x+52,ry+10,15,color(node.recipe),700,360);text(c,fmt(rate)+'/min required flow',x+52,ry+32,13,palette.muted,600,360);text(c,task.built+' / 1 pipe connection built',x+52,ry+54,13,task.built?palette.green:palette.muted,700,360);continue}
   const r=flow.beltCapacityStatus(rate,belts.tier,belts.counts[key]),tone=r.status==='starving'?palette.red:r.status==='meeting'?palette.green:palette.blue;
   ring(c,x+24,ry+24,18,(r.utilization||0)/100,tone);centered(c,r.utilization===null?'—':Math.round(r.utilization)+'%',x+24,ry+24,10,tone,800);
   text(c,node.label,x+52,ry+10,15,color(node.recipe),700,360);text(c,r.assigned+' assigned / '+r.required+' required · '+(r.status==='starving'?'Short':r.status==='meeting'?'Matched':'Spare'),x+52,ry+32,13,tone,600,360);text(c,fmt(rate)+' / '+fmt(r.capacity)+'/min',x+52,ry+49,12,palette.muted,500,360);if(task)text(c,task.built+' / '+task.planned+' incoming belts built',x+52,ry+66,12,task.built===task.planned?palette.green:palette.muted,700,360);
  }yy+=beltHeight}
  text(c,'MACHINE CHECKLIST',M+20,yy+18,15,palette.teal,800);yy+=46;
  for(const t of p.tasks){const done=t.planned>0&&t.built>=t.planned,accent=done?palette.green:color(t.recipe),x=M+20;
   rect(c,x,yy,W-2*M-40,62,9,'#122636','#36546b');icon(c,map,t.recipe,x+9,yy+9,42);text(c,t.label,x+61,yy+17,18,palette.text,700,510);text(c,t.kind+(t.profile?' · '+t.profile:''),x+61,yy+39,13,palette.muted,500,510);
   const count=fmt(t.built)+' / '+fmt(t.planned);text(c,count,x+W-2*M-300,yy+19,22,accent,800,205);rect(c,W-M-55,yy+12,24,24,5,done?palette.green:'#1b3549',accent);
   if(done){c.strokeStyle=palette.bg;c.lineWidth=3;c.beginPath();c.moveTo(W-M-50,yy+24);c.lineTo(W-M-44,yy+30);c.lineTo(W-M-35,yy+18);c.stroke()}
   bar(c,x+61,yy+52,W-2*M-125,4,t.built/Math.max(1,t.planned),accent);yy+=70;
  }
  y+=height+20;
 }
 text(c,'Factorio · Space Age  /  Planned construction snapshot',M,model.height-22,14,palette.muted,600);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>{canvas.width=1;canvas.height=1;b?resolve(b):reject(Error('PNG creation failed. Try exporting a single project.'))},'image/png'));
}
function resetPreview(){if(objectURL)URL.revokeObjectURL(objectURL);objectURL='';blob=null;preview.replaceChildren();download.disabled=true;share.disabled=true}
async function refresh(){const id=++generation;resetPreview();status.textContent='Rendering construction sheet…';try{const b=await renderSheet(records,toggle.checked);if(id!==generation)return;blob=b;objectURL=URL.createObjectURL(b);const img=document.createElement('img');img.src=objectURL;img.alt='Construction sheet preview';preview.append(img);const file=new File([blob],filename,{type:'image/png'});download.disabled=false;share.hidden=!(navigator.share&&navigator.canShare?.({files:[file]}));share.disabled=share.hidden;status.textContent='PNG ready · '+(blob.size/1024/1024).toFixed(2)+' MB'}catch(e){if(id===generation)status.textContent=e.message||'Unable to render this sheet.'}}
function open(items){if(!items.length){root.alert('Add a construction project first.');return}records=JSON.parse(JSON.stringify(items));filename='nauvis-'+(records.length===1?cleanName(records[0].name):'construction')+'.png';toggle.checked=false;$('projectExportNote').textContent=records.length+' project'+(records.length===1?'':'s')+' · Full flowcharts and checklists · no account or sync information';if(!dialog.open)dialog.showModal();refresh()}
download.addEventListener('click',()=>{if(!blob)return;const a=document.createElement('a');a.href=objectURL;a.download=filename;a.click()});
share.addEventListener('click',async()=>{if(!blob)return;try{await navigator.share({files:[new File([blob],filename,{type:'image/png'})],title:'Nauvis construction sheet'})}catch(e){if(e.name!=='AbortError')status.textContent='Sharing unavailable. Use Save PNG instead.'}});
toggle.addEventListener('change',refresh);$('projectExportClose').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{generation++;resetPreview();records=[]});
root.NauvisProjectExport={open,renderSheet};
})(typeof window==='undefined'?globalThis:window);
