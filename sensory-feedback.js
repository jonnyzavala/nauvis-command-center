/* NAUVIS 1.0 sensory feedback. Original synthesized audio; device-local preferences only. */
(function(root){
'use strict';
const KEY='nauvis-sensory-v1';
const CATEGORIES=['controls','inputs','construction','achievements','sync'];
const DEFAULTS={enabled:false,volume:35,motion:'full',haptics:false,categories:Object.fromEntries(CATEGORIES.map(k=>[k,true]))};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function normalize(v){
 const x=v&&typeof v==='object'?v:{};
 return {enabled:x.enabled===true,volume:Number.isFinite(x.volume)?clamp(Math.round(x.volume),0,100):35,motion:['full','subtle','off'].includes(x.motion)?x.motion:'full',haptics:x.haptics===true,categories:Object.fromEntries(CATEGORIES.map(k=>[k,x.categories?.[k]!==false]))};
}
// [frequency, end frequency, duration sec, offset sec, oscillator, relative gain]
const SOUNDS={
 click:['controls',[[850,370,.045,0,'triangle',.28],[160,90,.045,0,'sine',.23]]],
 nav:['controls',[[220,490,.095,0,'sine',.25],[490,690,.07,.035,'triangle',.12]]],
 open:['controls',[[420,680,.065,0,'triangle',.24]]],
 close:['controls',[[540,290,.07,0,'triangle',.23]]],
 on:['controls',[[540,820,.045,0,'triangle',.35],[140,80,.038,0,'sine',.22]]],
 off:['controls',[[700,340,.055,0,'triangle',.28]]],
 tick:['inputs',[[980,590,.028,0,'triangle',.23],[180,105,.03,0,'sine',.13]]],
 edit:['inputs',[[460,620,.055,0,'sine',.25]]],
 select:['inputs',[[640,480,.04,0,'triangle',.22],[510,710,.04,.035,'sine',.17]]],
 build:['construction',[[115,63,.085,0,'triangle',.35],[570,350,.08,.018,'triangle',.26],[840,990,.06,.075,'sine',.17]]],
 queue:['construction',[[105,65,.11,0,'triangle',.3],[330,440,.08,.07,'sine',.3],[660,660,.09,.145,'triangle',.2]]],
 reverse:['construction',[[430,180,.09,0,'triangle',.25]]],
 saved:['construction',[[523,523,.09,0,'sine',.35],[784,784,.13,.08,'triangle',.23]]],
 complete:['construction',[[392,392,.12,0,'triangle',.3],[523,523,.13,.09,'sine',.35],[659,659,.13,.18,'triangle',.28],[784,784,.26,.27,'sine',.32]]],
 achievement:['achievements',[[523,523,.11,0,'triangle',.28],[659,659,.12,.085,'sine',.32],[784,784,.13,.17,'triangle',.26],[1047,1047,.28,.26,'sine',.28]]],
 sync:['sync',[[620,620,.07,0,'sine',.19],[880,880,.11,.07,'sine',.22]]],
 warning:['sync',[[230,170,.11,0,'triangle',.3],[170,130,.14,.12,'sine',.24]]]
};
function canPlay(p,event){const def=SOUNDS[event];return !!def&&p.enabled&&p.volume>0&&p.categories[def[0]]===true}
function cloudCue(before,after){if(before===after)return null;if(after==='saved'&&before==='syncing')return 'sync';if(['error','conflict','offline'].includes(after)&&!['error','conflict','offline'].includes(before))return 'warning';return null}
function gained(before,after){const old=new Set(before||[]);return [...new Set(after||[])].filter(x=>!old.has(x))}
function makeEngine(AudioContext,getPrefs,visible=()=>true,clock=()=>Date.now()){
 let context=null,last=-Infinity,voices=[],pending=null;
 function unlock(){
  if(!AudioContext||!getPrefs().enabled)return Promise.resolve(false);
  try{if(!context)context=new AudioContext();if(context.state==='running')return Promise.resolve(true);
   if(!pending)pending=Promise.resolve(context.resume()).then(()=>context.state==='running',()=>false).finally(()=>{pending=null});
   return pending;
  }catch{return Promise.resolve(false)}
 }
 function stop(){for(const v of voices){try{v.stop()}catch{}}voices=[]}
 function play(event){
  const p=getPrefs();if(!canPlay(p,event)||!visible()||context?.state!=='running')return false;
  const now=clock(),special=['complete','achievement','saved','queue','warning','build','reverse'].includes(event);
  if(!special&&now-last<55)return false;
  if(special)stop();
  if(voices.length>24)stop();
  last=now;
  try{const start=context.currentTime+.008;
   for(const [from,to,length,offset,wave,level] of SOUNDS[event][1]){
    const o=context.createOscillator(),g=context.createGain(),t=start+offset,end=t+length;
    o.type=wave;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,end);
    const amp=Math.max(.00011,p.volume/100*.20*level);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+Math.min(.008,length/4));g.gain.exponentialRampToValueAtTime(.0001,end);
    o.connect(g);g.connect(context.destination);voices.push(o);
    o.onended=()=>{voices=voices.filter(v=>v!==o);try{o.disconnect();g.disconnect()}catch{}};
    o.start(t);o.stop(end+.01);
   }return true;
  }catch{stop();return false}
 }
 return {unlock,play,stop,state:()=>context?.state||'locked'};
}
if(typeof module==='object'&&module.exports)module.exports={normalize,DEFAULTS,CATEGORIES,SOUNDS,canPlay,cloudCue,gained,makeEngine};
if(typeof document==='undefined')return;
let prefs=normalize(null);try{prefs=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{}
const $=id=>document.getElementById(id),dialog=$('sensoryDialog'),launcher=$('sensoryLaunch');
const engine=makeEngine(root.AudioContext||root.webkitAudioContext,()=>prefs,()=>!document.hidden);
const reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)');
let lastGesture=-Infinity,lastSemantic=-Infinity,localChange=false,priorAwards=null,lastAward=-Infinity,lastRange=new WeakMap();
let pendingPulse=null;
const status=text=>{const node=$('sensoryStatus');if(node)node.textContent=text};
function paint(){
 document.body.dataset.sensoryMotion=reduce?.matches?'off':prefs.motion;
 if(launcher){launcher.dataset.enabled=String(prefs.enabled);launcher.setAttribute('aria-label','Sensory settings · sound '+(prefs.enabled?'on':'off'))}
 if($('sensoryEnabled'))$('sensoryEnabled').checked=prefs.enabled;
 if($('sensoryVolume')){$('sensoryVolume').value=prefs.volume;$('sensoryVolumeValue').textContent=prefs.volume+'%'}
 if($('sensoryMotion'))$('sensoryMotion').value=prefs.motion;
 if($('sensoryHaptics')){$('sensoryHaptics').checked=prefs.haptics;$('sensoryHaptics').disabled=typeof navigator.vibrate!=='function'}
 for(const k of CATEGORIES){const e=$('sensoryCat-'+k);if(e)e.checked=prefs.categories[k]}
 if($('sensoryMotionNote'))$('sensoryMotionNote').textContent=reduce?.matches?'System reduced motion is active. Animations are disabled.':'Visual feedback is independent of sound.';
 if($('sensoryHapticNote'))$('sensoryHapticNote').textContent=typeof navigator.vibrate==='function'?'Short vibration pulses on supported devices.':'Haptics are unavailable in this browser (including iPhone Safari).';
}
function setPrefs(patch){prefs=normalize({...prefs,...patch});try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}if(!prefs.enabled||!prefs.volume)engine.stop();paint();return {...prefs,categories:{...prefs.categories}}}
function unlock(){return engine.unlock().then(ok=>{if(dialog?.open&&prefs.enabled)status(ok?'Audio ready. Try a sound below.': 'Audio unavailable or blocked. Tap Test sound to retry.');return ok})}
function pulse(el,cls='sensory-pulse'){
 if(!el||document.body.dataset.sensoryMotion==='off')return;
 el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
 setTimeout(()=>el.classList.remove(cls),cls==='sensory-award-flash'?850:230);
}
function vibrate(event){if(!prefs.haptics||document.hidden||!prefs.categories[SOUNDS[event]?.[0]]||typeof navigator.vibrate!=='function')return;
 try{navigator.vibrate(['complete','achievement'].includes(event)?[16,35,20]:event==='build'?12:7)}catch{}}
function cue(event,el,{semantic=false,haptic=true}={}){
 if(!SOUNDS[event])return false;
 if(semantic)lastSemantic=performance.now();
 const played=engine.play(event);if(haptic)vibrate(event);if(el)pulse(el);
 return played;
}
function semantic(event,el){if(performance.now()-lastGesture>1500||root.NauvisCloudApplying)return false;return cue(event,el,{semantic:true})}
function markLocalChange(){if(!root.NauvisCloudApplying&&performance.now()-lastGesture<1500)localChange=true}
function resetBaseline(){localChange=false;priorAwards=null}
function updateAwards(keys){
 const previous=priorAwards;priorAwards=[...new Set(keys||[])];
 const earned=previous===null?[]:gained(previous,priorAwards);
 const local=localChange;localChange=false;
 if(!local||!earned.length||performance.now()-lastGesture>1500||document.hidden)return [];
 const active=document.querySelector('.view.active .factory-milestones');
 if(active)pulse(active,'sensory-award-flash');
 // One reward sound per burst, never on initial load, cloud restore, or tab switch.
 if(performance.now()-lastAward>1800&&performance.now()-lastSemantic>250){cue('achievement',null,{semantic:true});lastAward=performance.now()}
 return earned;
}
function isUiSetting(el){return !!el.closest('#sensoryDialog,#sensoryLaunch')}
function interactive(e){return e.target?.closest?.('button,summary,a[href],input,select,textarea,[role="button"]')}
function gesture(e){if(!e.isTrusted)return;lastGesture=performance.now();if(prefs.enabled)unlock()}
document.addEventListener('pointerdown',gesture,true);
document.addEventListener('keydown',e=>{if(!e.repeat)gesture(e)},true);
document.addEventListener('click',e=>{
 const el=interactive(e);if(!e.isTrusted||!el||isUiSetting(el)||el.disabled||el.getAttribute('aria-disabled')==='true')return;
 if(el.matches('input,select,textarea'))return;
 const kind=el.matches('[data-view],[data-plan-target],[data-factory-target],[data-milestone-action]')?'nav':el.matches('summary')?(el.parentElement.open?'open':'close'):el.matches('[data-project-plus],[data-project-minus]')?null:'click';
 if(!kind)return;
 // Semantic success hooks run first (after actual writes). Generic feedback never claims success.
 if(performance.now()-lastSemantic<100)return;
 cue(kind,el);
},false);
document.addEventListener('change',e=>{
 const el=e.target;if(!e.isTrusted||!el?.matches?.('input,select,textarea')||isUiSetting(el)||el.disabled)return;
 if(performance.now()-lastSemantic<100)return;
 const kind=el.matches('[type="checkbox"],[type="radio"]')?(el.checked?'on':'off'):el.matches('select')?'select':el.matches('[type="range"]')?null:'edit';
 if(kind)cue(kind,el);
},false);
document.addEventListener('input',e=>{
 const el=e.target;if(!e.isTrusted||!el?.matches?.('input[type="range"],input[type="number"]')||isUiSetting(el)||el.disabled)return;
 const now=performance.now(),prev=lastRange.get(el);
 if(prev&&now-prev.time<85)return;lastRange.set(el,{time:now});cue('tick',null,{haptic:false});
},false);
document.addEventListener('invalid',e=>{if(e.isTrusted&&!isUiSetting(e.target))semantic('warning',e.target)},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)engine.stop()});
reduce?.addEventListener?.('change',paint);
launcher?.addEventListener('click',()=>{paint();status(prefs.enabled?(engine.state()==='running'?'Audio ready.':'Tap Test sound to enable audio in this session.'):'Sound is off. Enable it when you want tactile feedback.');dialog?.showModal()});
$('sensoryClose')?.addEventListener('click',()=>dialog.close());
$('sensoryEnabled')?.addEventListener('change',async e=>{setPrefs({enabled:e.target.checked});if(prefs.enabled){await unlock();cue('on',null,{haptic:false})}else status('Sound muted.')});
$('sensoryVolume')?.addEventListener('input',e=>setPrefs({volume:Number(e.target.value)}));
$('sensoryMotion')?.addEventListener('change',e=>setPrefs({motion:e.target.value}));
$('sensoryHaptics')?.addEventListener('change',e=>{setPrefs({haptics:e.target.checked});vibrate('click')});
for(const k of CATEGORIES)$('sensoryCat-'+k)?.addEventListener('change',e=>setPrefs({categories:{...prefs.categories,[k]:e.target.checked}}));
$('sensoryReset')?.addEventListener('click',()=>{setPrefs(DEFAULTS);status('Default sensory preferences restored.')});
dialog?.addEventListener('click',async e=>{const event=e.target.closest('[data-sensory-test]')?.dataset.sensoryTest;if(!event)return;if(!prefs.enabled||!prefs.volume){status('Enable sound and set volume above zero first.');return}if(!prefs.categories[SOUNDS[event]?.[0]]){status('Enable this sound category first.');return}if(await unlock()){cue(event,e.target,{haptic:false});status('Played '+event+' preview.')}});
let cloudBefore=$('cloudStatus')?.dataset.state;
if($('cloudStatus')&&typeof MutationObserver!=='undefined')new MutationObserver(()=>{const after=$('cloudStatus').dataset.state,event=cloudCue(cloudBefore,after);cloudBefore=after;if(event)cue(event,null,{haptic:false})}).observe($('cloudStatus'),{attributes:true,attributeFilter:['data-state']});
root.NauvisSensory={getPrefs:()=>normalize(prefs),setPrefs,unlock,semantic,markLocalChange,resetBaseline,updateAwards,state:engine.state};
paint();
})(typeof window==='undefined'?globalThis:window);
