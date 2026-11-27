/* Text-only opening: each line becomes its real header counterpart. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),dialog=$('nauvisIntro'),key='nauvis-intro-v1';
const pairs=[['introNauvis','headerNauvis'],['introCommand','headerCommand'],['introWelcome','headerWelcome']].map(([a,b])=>({line:$(a),target:$(b)}));
const typeProps=['fontFamily','fontWeight','fontStyle','fontSize','lineHeight','letterSpacing','color'];
let timer,safety,animations=[],running=false;
function enabled(){try{return localStorage.getItem(key)!=='off'}catch{return true}}
function finish(){if(!running)return;running=false;clearTimeout(timer);clearTimeout(safety);const old=animations;animations=[];for(const {line,target} of pairs){target.style.visibility='';line.removeAttribute('style')}if(dialog.open)dialog.close();for(const a of old)a.cancel()}
function typography(el){const s=getComputedStyle(el),out={};for(const prop of typeProps)out[prop]=s[prop];return out}
function prepare(){
 for(let i=0;i<pairs.length;i++){const {line,target}=pairs[i],style=typography(target);line.textContent=target.textContent.trim();Object.assign(line.style,style);if(i!==2){const normal=parseFloat(style.fontSize),size=i===0?Math.min(58,innerWidth*.135):Math.min(43,innerWidth*.09);const ratio=size/normal;line.style.fontSize=size+'px';line.style.lineHeight=(parseFloat(style.lineHeight)||normal*1.2)*ratio+'px';line.style.letterSpacing=(parseFloat(style.letterSpacing)||0)*ratio+'px'}target.style.visibility='hidden'}
}
function settle(){
 if(!running)return;
 try{
  if(!pairs.every(({line})=>line.animate))return finish();
  const measurements=pairs.map(({line,target})=>({line,target,a:line.getBoundingClientRect(),b:target.getBoundingClientRect(),from:typography(line),to:typography(target)}));
  if(measurements.some(({a,b})=>!a.width||!b.width||!a.height||!b.height||b.top<0||b.bottom>innerHeight))return finish();
  const origin=dialog.getBoundingClientRect(),opts={duration:760,easing:'cubic-bezier(.22,.78,.22,1)',fill:'forwards'};
  for(const [i,{line,a,b,from,to}] of measurements.entries()){
   // Move the same text, not a logo or a fading duplicate. Font sizes end at computed header values.
   Object.assign(line.style,{position:'absolute',left:(a.left-origin.left)+'px',top:(a.top-origin.top)+'px',margin:'0',whiteSpace:'nowrap',zIndex:'2',textAlign:'left'});
   const animation=line.animate([{left:(a.left-origin.left)+'px',top:(a.top-origin.top)+'px',...from},{left:(b.left-origin.left)+'px',top:(b.top-origin.top)+'px',...to}],opts);
   animations.push(animation);
  }
  animations.push(dialog.querySelector('.intro-back').animate([{opacity:1},{opacity:0}],{duration:650,delay:100,fill:'forwards'}),$('skipIntro').animate([{opacity:1},{opacity:0}],{duration:230,fill:'forwards'}));
  Promise.all(animations.map(a=>a.finished)).then(finish,finish);
 }catch{finish()}
}
function start(preview=false){
 if(running||(!preview&&!enabled())||matchMedia('(prefers-reduced-motion: reduce)').matches||root.NauvisSensory?.getPrefs?.().motion==='off')return;
 running=true;try{prepare();dialog.showModal();timer=setTimeout(settle,1370);safety=setTimeout(finish,2500)}catch{finish()}
}
$('introEnabled').checked=enabled();$('introEnabled').addEventListener('change',e=>{try{localStorage.setItem(key,e.target.checked?'on':'off')}catch{}});
$('previewIntro').addEventListener('click',()=>{$('sensoryDialog').close();root.scrollTo({top:0,behavior:'instant'});start(true)});
$('skipIntro').addEventListener('click',finish);dialog.addEventListener('cancel',e=>{e.preventDefault();finish()});root.addEventListener('pagehide',finish);root.addEventListener('resize',()=>{if(running)finish()});
root.NauvisIntro={active:()=>running};start();
})(window);
