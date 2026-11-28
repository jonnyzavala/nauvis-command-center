/* NAUVIS 1.0 sensory feedback. Original synthesized audio; device-local preferences only. */
(function(root){
'use strict';
const KEY='nauvis-sensory-v1';
const CATEGORIES=['controls','inputs','construction','achievements','sync'];
const DEFAULTS={enabled:false,startupMusic:true,volume:35,palette:'industrial',backend:'auto',motion:'full',haptics:false,categories:Object.fromEntries(CATEGORIES.map(k=>[k,true]))};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function normalize(v){
 const x=v&&typeof v==='object'?v:{};
 return {enabled:x.enabled===true,startupMusic:x.startupMusic!==false,volume:Number.isFinite(x.volume)?clamp(Math.round(x.volume),0,100):35,palette:x.palette==='electronic'?'electronic':'industrial',backend:['auto','web','media'].includes(x.backend)?x.backend:'auto',motion:['full','subtle','off'].includes(x.motion)?x.motion:'full',haptics:x.haptics===true,categories:Object.fromEntries(CATEGORIES.map(k=>[k,x.categories?.[k]!==false]))};
}
// [frequency, end frequency, duration sec, offset sec, oscillator, relative gain]
const ELECTRONIC={
 click:['controls',[[850,370,.045,0,'triangle',.28],[160,90,.045,0,'sine',.23]]],
 nav:['controls',[[220,490,.095,0,'sine',.25],[490,690,.07,.035,'triangle',.12]]],
 open:['controls',[[420,680,.065,0,'triangle',.24]]],
 close:['controls',[[540,290,.07,0,'triangle',.23]]],
 on:['controls',[[540,820,.045,0,'triangle',.35],[140,80,.038,0,'sine',.22]]],
 off:['controls',[[700,340,.055,0,'triangle',.28]]],
 tick:['inputs',[[980,590,.028,0,'triangle',.23],[180,105,.03,0,'sine',.13]]],
 edit:['inputs',[[460,620,.055,0,'sine',.25]]],
 select:['inputs',[[640,480,.04,0,'triangle',.22],[510,710,.04,.035,'sine',.17]]],
 build:['construction',[[150,90,.075,0,'triangle',.30],[392,392,.13,.025,'sine',.28],[523,523,.14,.065,'sine',.19]]],
 queue:['construction',[[105,65,.11,0,'triangle',.3],[330,440,.08,.07,'sine',.3],[660,660,.09,.145,'triangle',.2]]],
 reverse:['construction',[[430,180,.09,0,'triangle',.25]]],
 saved:['construction',[[523,523,.09,0,'sine',.35],[784,784,.13,.08,'triangle',.23]]],
 complete:['construction',[[392,392,.12,0,'triangle',.3],[523,523,.13,.09,'sine',.35],[659,659,.13,.18,'triangle',.28],[784,784,.26,.27,'sine',.32]]],
 achievement:['achievements',[[523,523,.11,0,'triangle',.28],[659,659,.12,.085,'sine',.32],[784,784,.13,.17,'triangle',.26],[1047,1047,.28,.26,'sine',.28]]],
 sync:['sync',[[220,180,.045,0,'sine',.16],[280,230,.065,.075,'sine',.12]]],
 warning:['sync',[[230,170,.11,0,'triangle',.3],[170,130,.14,.12,'sine',.24]]]
};
// Industrial transients combine tonal resonances with shaped, filtered noise.
// The classic electronic palette is retained as an alternative.
const SOUNDS={
 click:['controls',[[160,85,.035,0,'triangle',.26]]],
 nav:['controls',[[120,72,.11,0,'sine',.21],[310,210,.045,.075,'triangle',.12]]],
 open:['controls',[[120,95,.09,0,'sine',.17]]],
 close:['controls',[[145,70,.065,.025,'triangle',.27]]],
 on:['controls',[[185,105,.055,0,'triangle',.32],[920,740,.019,.013,'sine',.12]]],
 off:['controls',[[125,62,.065,0,'triangle',.31]]],
 tick:['inputs',[[1170,930,.024,0,'sine',.12]]],
 edit:['inputs',[[145,90,.045,0,'triangle',.16]]],
 select:['inputs',[[190,95,.045,0,'triangle',.18]]],
 key:['inputs',[[290,150,.021,0,'triangle',.08]]],
 ratchet:['inputs',[[280,145,.025,0,'triangle',.12]]],
 countUp:['inputs',[[410,235,.032,0,'triangle',.17],[810,640,.019,0,'sine',.10]]],
 countDown:['inputs',[[260,130,.033,0,'triangle',.19]]],
 check:['controls',[[240,125,.055,0,'triangle',.24],[630,710,.065,.04,'sine',.14]]],
 uncheck:['controls',[[170,85,.045,0,'triangle',.24]]],
 build:['construction',[[110,65,.105,0,'sine',.38],[262,262,.12,.018,'triangle',.18],[392,392,.15,.045,'sine',.23]]],
 queue:['construction',[[95,52,.15,.05,'triangle',.31],[235,150,.09,.14,'triangle',.23],[440,660,.14,.22,'sine',.21]]],
 reverse:['construction',[[150,70,.115,0,'triangle',.25]]],
 saved:['construction',[[380,380,.12,.045,'sine',.21],[570,570,.16,.11,'triangle',.16]]],
 route:['construction',[[140,82,.06,0,'triangle',.25],[620,820,.10,.065,'sine',.18]]],
 complete:['construction',[[110,62,.15,0,'triangle',.26],[392,392,.24,.11,'triangle',.23],[523,523,.25,.19,'sine',.26],[659,659,.31,.28,'sine',.24],[784,784,.35,.38,'triangle',.16]]],
 achievement:['achievements',[[523,523,.23,0,'sine',.23],[659,659,.27,.10,'triangle',.21],[784,784,.30,.20,'sine',.23],[1047,1047,.40,.31,'sine',.22],[1568,1568,.27,.36,'sine',.08]]],
 sync:['sync',[[180,125,.045,0,'triangle',.12],[240,170,.055,.075,'sine',.10]]],
 warning:['sync',[[115,103,.14,0,'sawtooth',.13],[165,132,.18,.13,'triangle',.25]]]
};
// Longer original reward motifs and distinguishable navigation sounds in both palettes.
for(const palette of [SOUNDS,ELECTRONIC]){
 palette.phase=['construction',[[330,330,.16,0,'triangle',.25],[440,440,.22,.14,'sine',.24],[660,660,.36,.31,'sine',.22]]];
 palette.complete[1].push([523,523,.34,.58,'sine',.23],[659,659,.4,.78,'triangle',.22],[1047,1047,.65,1.02,'sine',.22],[784,784,.7,1.02,'sine',.12]);
 palette.achievement[1].push([784,784,.3,.7,'triangle',.20],[1047,1047,.35,.9,'sine',.24],[1319,1319,.65,1.12,'sine',.22],[1568,1568,.7,1.18,'triangle',.12]);
 for(const [name,hz] of Object.entries({navPlanner:392,navConstruction:262,navLog:523,navGuide:440,navInventory:330}))palette[name]=['controls',[[hz,hz*.8,.07,0,'triangle',.23],[hz*1.5,hz*1.5,.12,.065,'sine',.19]]];
}
// [duration, offset, center Hz, Q, gain, texture, envelope]
const NOISE={
 click:[[.026,0,1900,.9,.35,'white','impact'],[.018,.017,900,1.5,.18,'white','impact']],
 nav:[[.13,0,1100,.65,.20,'white','swell'],[.033,.095,2200,1.1,.20,'white','impact']],
 open:[[.11,0,1600,.65,.24,'white','swell']],
 close:[[.09,0,700,.8,.22,'white','swell'],[.038,.05,1200,1,.32,'white','impact']],
 on:[[.032,0,2600,.9,.40,'white','impact'],[.024,.022,1250,1.4,.19,'white','impact']],
 off:[[.040,0,1100,.85,.38,'white','impact']],
 tick:[[.018,0,3600,1.4,.25,'white','impact']],
 edit:[[.035,0,1500,1,.23,'white','impact']],
 select:[[.045,0,1900,.8,.27,'white','impact'],[.025,.035,850,1,.12,'white','impact']],
 key:[[.021,0,2600,1.1,.24,'white','impact']],
 ratchet:[[.017,0,2000,1.3,.28,'white','impact'],[.014,.018,3150,1,.13,'white','impact']],
 countUp:[[.025,0,3200,1.6,.33,'white','impact']],
 countDown:[[.030,0,1600,1.3,.33,'white','impact']],
 check:[[.024,0,3000,1,.35,'white','impact'],[.025,.036,1300,1.3,.16,'white','impact']],
 uncheck:[[.04,0,1000,1.3,.34,'white','impact']],
 build:[[.045,0,750,.75,.25,'white','impact'],[.025,.025,1050,1.2,.12,'white','impact']],
 queue:[[.15,0,1000,.75,.24,'white','swell'],[.065,.12,1500,1.5,.35,'white','impact']],
 reverse:[[.12,0,1350,.85,.28,'white','swell'],[.03,.095,800,1.2,.19,'white','impact']],
 saved:[[.032,0,2200,.9,.17,'white','impact']],
 route:[[.04,0,1450,1.4,.33,'white','impact'],[.04,.045,2600,1.4,.17,'white','impact']],
 complete:[[.13,0,850,1,.28,'white','impact'],[.14,.35,3900,.9,.10,'white','swell']],
 achievement:[[.27,.12,4600,1.1,.09,'white','swell']],
 sync:[[.028,0,1600,.8,.08,'white','impact']],
 warning:[[.07,0,480,1.2,.13,'white','impact']]
};
// Original Nauvis metal boot sting, 168 BPM, four bars of 4/4.
// Every instrument is composed on the same sixteenth-note grid.
// Three bars of pedal-tone power-chord riffs, then a D-minor landing.
const hz=m=>440*Math.pow(2,(m-69)/12);
const STARTUP_BEAT=60/168,step=STARTUP_BEAT/4,at=n=>n*step;
const riff=[
 [0,38,2],[2,38,2],[6,38,2],[8,41,2],[10,38,2],[14,36,1],[15,38,1],
 [16,34,2],[18,34,2],[22,34,2],[24,36,2],[26,34,2],[30,36,1],[31,37,1],
 [32,33,2],[34,33,2],[38,33,2],[40,40,2],[42,37,2],[44,33,1],[45,33,1],[46,37,1],[47,37,1]
];
const lead=[
 [62,0,3],[65,4,2],[69,6,5],[67,12,2],[65,14,2],
 [65,16,3],[69,20,2],[74,22,5],[72,28,2],[70,30,2],
 [69,32,3],[64,36,2],[67,38,3],[69,42,2],[73,46,2],
 [74,48,15.8]
];
const STARTUP_SCORE=[
 ...lead.map(([m,t,d])=>[m,at(t),at(d)*.94,'triangle',.62]),
 // Palm-muted fifth chords plus a separate octave bass, in lockstep with kicks.
 ...riff.flatMap(([t,m,d])=>[[m,at(t),at(d)*.85,'sawtooth',.32],[m+7,at(t),at(d)*.85,'sawtooth',.23],[m-12,at(t),at(d)*.9,'triangle',.18]]),
 [38,at(48),at(16),'sawtooth',.32],[45,at(48),at(16),'sawtooth',.23],
 [26,at(48),at(16),'triangle',.18],[53,at(48),at(16),'triangle',.13],
 [62,at(48),at(16),'sine',.10],[65,at(48),at(16),'sine',.12],
 [69,at(48),at(16),'sine',.10]
];
// Backbeat on beats 2 and 4, eighth-note hats, and double-kick pickups.
// No unsynchronized percussion events; the final bar is a single crash.
const kickSteps=[...riff.map(n=>n[0]),48];
const snareSteps=[4,12,20,28,36,44];
const hatSteps=Array.from({length:24},(_,i)=>i*2);
const STARTUP_DRUMS=[
 ...kickSteps.map(t=>[.12,at(t),118,43,'sine',.56]),
 ...snareSteps.map(t=>[.10,at(t),185,76,'triangle',.22]),
 ...hatSteps.map(t=>[.035,at(t),4100,1.2,t%4===0?.14:.095,'white','impact']),
 ...snareSteps.map(t=>[.12,at(t),1450,.85,.34,'white','impact']),
 [.24,at(48),680,.85,.30,'white','impact']
];
const STARTUP_PERCUSSION_TONES=STARTUP_DRUMS.filter(n=>n.length===6).map(([d,t,f,to,w,g])=>[f,to,d,t,w,g]);
const STARTUP_PERCUSSION_NOISE=STARTUP_DRUMS.filter(n=>n.length===7);
const STARTUP_NOTES=[...STARTUP_SCORE.map(([m,offset,duration,wave,gain])=>[hz(m),hz(m),duration,offset,wave,gain]),...STARTUP_PERCUSSION_TONES];
const STARTUP_DURATION=Math.max(...STARTUP_NOTES.map(n=>n[2]+n[3]));
const ALIASES={key:'tick',ratchet:'tick',countUp:'tick',countDown:'edit',check:'on',uncheck:'off',route:'saved'};
function soundDefinition(p,event){if(event==='startup')return ['startup',STARTUP_NOTES];return p.palette==='electronic'?(ELECTRONIC[event]||ELECTRONIC[ALIASES[event]]||SOUNDS[event]):SOUNDS[event]}
function canPlay(p,event){if(event==='startup')return p.enabled&&p.startupMusic&&p.volume>0;const def=SOUNDS[event];return !!def&&p.enabled&&p.volume>0&&p.categories[def[0]]===true}
function cloudCue(before,after){if(before===after)return null;if(after==='saved'&&before==='syncing')return 'sync';if(['error','conflict','offline'].includes(after)&&!['error','conflict','offline'].includes(before))return 'warning';return null}
function gained(before,after){const old=new Set(before||[]);return [...new Set(after||[])].filter(x=>!old.has(x))}
// Only committed construction actions can generate construction rewards.
// Legacy milestones are derived, reversible statistics, never completion events.
const REWARD_CUES=new Set(['phase','complete','achievement']);
const COMMIT_CUES=new Set(['build','reverse','phase','complete','queue','saved','route','warning']);
function makeCueGate(clock=()=>Date.now()){
 let until=0;
 return {allow:(event,preview=false)=>preview||clock()>=until||COMMIT_CUES.has(event),
  active:()=>clock()<until,
  played:(event,p,delay=0)=>{until=REWARD_CUES.has(event)?clock()+delay+1000*Math.max(...soundDefinition(p,event)[1].map(n=>n[2]+n[3])):0},
  reset:()=>{until=0}};
}
const DURABLE_AWARDS=new Set(['First sparks','Factory online','Black gold','Industrial scale','Connected','Architect','First blueprint queued','First machine placed']);
function makeAwardTracker(){
 let baseline=false;const seen=new Set();
 return {reset:()=>{baseline=false},update(keys,{eligible=false}={}){
  const fresh=[...new Set(keys||[])].filter(k=>!seen.has(k));for(const k of keys||[])seen.add(k);
  const earned=baseline&&eligible?fresh.filter(k=>DURABLE_AWARDS.has(k)):[];
  baseline=true;return earned;
 }};
}
// Render original sounds to standard mono 16-bit PCM WAV, without Web Audio.
// The media element is reused, and play() is invoked synchronously during user gestures.
// Each crossed notch has its own pitch. Limit very large jumps to the most
// recent 48 steps so dragging a 100,000-count range cannot queue minutes of audio.
function sliderPitches(from,to,min,max,step=1){
 if(![from,to,min,max,step].every(Number.isFinite)||step<=0||max<=min||from===to)return [];
 const a=Math.round((clamp(from,min,max)-min)/step),b=Math.round((clamp(to,min,max)-min)/step),dir=Math.sign(b-a),n=Math.min(48,Math.abs(b-a));
 return Array.from({length:n},(_,i)=>Math.round(850*Math.pow(2.2,(clamp(min+(b-dir*(n-1-i))*step,min,max)-min)/(max-min))));
}
const SLIDER_SPACING=.048;
function sliderNotes(pitches){return pitches.map((hz,i)=>[hz,hz,.011,i*SLIDER_SPACING,'triangle',.36])}
// Dedicated, deterministic startup mix. Separate drum and music buses keep
// the beat audible even through small phone speakers. No external samples.
function renderStartupMix(sr=24000){
 const length=Math.ceil((STARTUP_DURATION+.025)*sr),music=new Float32Array(length),drums=new Float32Array(length);
 const add=(bus,t,d,fn)=>{const start=Math.round(t*sr),n=Math.min(length-start,Math.ceil(d*sr));for(let i=0;i<n;i++)bus[start+i]+=fn(i/sr,i)};
 const tau=2*Math.PI;
 const env=(t,d,a=.012,r=.10)=>Math.min(1,t/a)*Math.min(1,Math.max(0,(d-t)/Math.min(r,d*.5)));
 for(const [m,at,d,w,g] of STARTUP_SCORE){
  const f=hz(m);let phase=0,phase2=0;
  // Band-limited additive pulse/saw voices; distorted through soft saturation.
  const saw=(p,freq)=>{let v=0;for(let k=1;k<=Math.min(9,Math.floor(sr*.45/freq));k++)v+=Math.sin(p*k)/k;return v*.64};
  if(g===.62){
   add(music,at,d,t=>{
    const bend=1-.026*Math.exp(-t/.018),vib=1+.008*Math.sin(tau*5.8*t)*Math.min(1,Math.max(0,(t-.12)/.14));
    phase+=tau*f*bend*vib/sr;phase2+=tau*f*1.004/sr;
    const v=.64*saw(phase,f)+.28*Math.sin(phase*2)+.27*saw(phase2,f);
    return Math.tanh(v*2.7)*.30*env(t,d,.004,d>1?.48:.035);
   });
  }else if(w==='sawtooth'){
   add(music,at,d,t=>{
    const palm=d<.5?Math.exp(-t/.105):Math.exp(-t/2.0);
    const p=tau*f*t,detune=tau*f*1.006*t;
    const v=saw(p,f)*.65+saw(detune,f)*.35;
    return Math.tanh(v*3.7)*g*.74*palm*env(t,d,.003,d>1?.46:.018);
   });
  }else{
   add(music,at,d,t=>{const p=tau*f*t,v=w==='triangle'?2/Math.PI*Math.asin(Math.sin(p)):Math.sin(p);
    return v*g*.72*env(t,d,.008,d>1?.46:.04)});
  }
 }
 let seed=0x6e617576;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1};
 for(const [from,to,d,at,w,g] of STARTUP_PERCUSSION_TONES){
  let phase=0;
  const kick=w==='sine';
  add(drums,at,kick?.105:.13,(t)=>{
   const f=to+(from*1.8-to)*Math.exp(-t/(kick?.033:.024));phase+=tau*f/sr;
   const decay=Math.exp(-t/(kick?.032:.042)),click=random()*Math.exp(-t/.009);
   // Harmonics translate the drum body into audible midrange on a phone.
   return Math.tanh((Math.sin(phase)+.48*Math.sin(phase*2)+.20*Math.sin(phase*3))*1.5)*decay*(kick?.98:.58)+click*(kick?.27:.18);
  });
 }
 for(const [d,at,f,q,g] of STARTUP_PERCUSSION_NOISE){
  let prev=0,lp=0;const hat=f>3000,fill=f<1200;
  add(drums,at,hat?d*1.3:d*1.55,t=>{
   const x=random();lp+=.23*(x-lp);const high=x-prev;prev=x;
   const decay=Math.exp(-t/(hat?.020:fill?.075:.060));
   const noise=hat?high*.45:(x-lp)*.75+lp*.42;
   const body=hat?0:Math.sin(tau*(fill?185:205)*t)*Math.exp(-t/.028)*.34;
   return (noise+body)*decay*(hat?.27:fill?.86:1.13);
  });
 }
 // Sidechain-like ducking lets each drum transient cut through the lead.
 const mix=new Float32Array(length);let follower=0,peak=0,drumEnergy=0,musicEnergy=0;
 for(let i=0;i<length;i++){
  follower=Math.max(Math.abs(drums[i]),follower*.997);
  const m=music[i]/(1+.18*follower),d=drums[i]*.85;
  drumEnergy+=d*d;musicEnergy+=m*m;
  const x=Math.tanh((m+d)*1.05);mix[i]=x;peak=Math.max(peak,Math.abs(x));
 }
 const scale=peak>0?.91/peak:1;for(let i=0;i<length;i++)mix[i]*=scale;
 return {samples:mix,drumRms:Math.sqrt(drumEnergy/length),musicRms:Math.sqrt(musicEnergy/length)};
}
function renderWav(p,event,sr=24000,pitches=null){
 const diagnostic=event==='test';
 const notes=pitches?.length?sliderNotes(pitches):diagnostic?[[660,660,.16,0,'sine',.65],[880,880,.24,.18,'sine',.65]]:soundDefinition(p,event)[1];
 const layers=event==='startup'?STARTUP_PERCUSSION_NOISE:!pitches&&!diagnostic&&p.palette==='industrial'?NOISE[event]||[]:[];
 const length=Math.ceil((Math.max(...notes.map(n=>n[2]+n[3]),...layers.map(n=>n[0]+n[1]))+.025)*sr),samples=new Float32Array(length);
 if(event==='startup')samples.set(renderStartupMix(sr).samples);
 const envelope=(t,d,a)=>Math.min(1,t/a)*Math.pow(Math.max(0,1-t/d),2);
 const musicEnvelope=(t,d)=>Math.min(1,t/Math.min(.018,d/5))*Math.min(1,Math.max(0,(d-t)/Math.min(.62,d*.55)))*(1-.22*t/d);
 for(const [from,to,d,offset,wave,gain] of event==='startup'?[]:notes){
  let phase=0;const start=Math.round(offset*sr);
  for(let i=0;i<Math.ceil(d*sr)&&start+i<length;i++){
   const t=i/sr;phase+=2*Math.PI*from*Math.pow(to/from,t/d)/sr;
   const v=wave==='triangle'?2/Math.PI*Math.asin(Math.sin(phase)):wave==='sawtooth'?2*(phase/(2*Math.PI)-Math.floor(phase/(2*Math.PI)+.5)):wave==='square'?Math.sign(Math.sin(phase)):Math.sin(phase);
   samples[start+i]+=v*gain*(event==='startup'&&from===to?musicEnvelope(t,d):envelope(t,d,Math.min(.008,d/4)));
  }
 }
 let seed=0x6e617576;
 for(const [d,offset,hz,q,gain,,shape] of event==='startup'?[]:layers){
  const start=Math.round(offset*sr),w=2*Math.PI*Math.min(hz,sr*.45)/sr,alpha=Math.sin(w)/(2*q),a0=1+alpha,b0=alpha/a0,b2=-b0,a1=-2*Math.cos(w)/a0,a2=(1-alpha)/a0;
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<Math.ceil(d*sr)&&start+i<length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/2147483648-1,y=b0*x+b2*x2-a1*y1-a2*y2;
   x2=x1;x1=x;y2=y1;y1=y;
   const t=i/sr;samples[start+i]+=y*gain*envelope(t,d,shape==='swell'?d*.38:Math.min(.002,d*.2));
  }
 }
 const buf=new ArrayBuffer(44+length*2),v=new DataView(buf);
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i))};
 str(0,'RIFF');v.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*2,true);
 // iOS may ignore HTMLMediaElement.volume, so encode the master volume in PCM.
 const amp=clamp(p.volume,0,100)/100*(diagnostic?.65:event==='startup'?.84:.48);
 for(let i=0;i<length;i++)v.setInt16(44+i*2,Math.round(clamp(samples[i]*amp,-1,1)*32767),true);
 return new Uint8Array(buf);
}
function makeMediaEngine(audio,getPrefs,visible=()=>true,clock=()=>Date.now(),encode=bytes=>{
 let s='';for(let i=0;i<bytes.length;i+=4096)s+=String.fromCharCode(...bytes.subarray(i,i+4096));return 'data:audio/wav;base64,'+btoa(s)
}){
 let state='ready',error='',last=-Infinity,serial=0,cache=new Map(),lastResult=Promise.resolve(false),ticks=[],tickPlaying=false,queuedReward=null,tickEnd=0;
 function stop(){serial++;ticks=[];tickPlaying=false;queuedReward=null;tickEnd=0;try{audio.pause()}catch{}state='ready';last=-Infinity}
 function play(event,preview=false,pitches=null){
  const p=getPrefs();if(!audio||!visible()||!p.enabled||p.volume<=0||event!=='test'&&!canPlay(p,event))return false;
  const now=clock();if(!pitches&&!preview&&event!=='test'&&!COMMIT_CUES.has(event)&&!REWARD_CUES.has(event)&&now-last<65)return false;
  if(!pitches&&!preview&&tickPlaying){
   if(event==='phase'||event==='complete'){queuedReward=event;return true}
   if(!COMMIT_CUES.has(event))return false;
  }
  if(!pitches){ticks=[];tickPlaying=false;queuedReward=null;tickEnd=0}
  const id=++serial;last=now;error='';
  try{
   const key=[p.palette,p.volume,event,pitches?.join(',')||''].join(':');let src=cache.get(key);
   if(!src){src=encode(renderWav(p,event,24000,pitches));if(cache.size>=64)cache.clear();cache.set(key,src)}
   audio.pause();if(audio.getAttribute('src')!==src)audio.src=src;try{audio.currentTime=0}catch{}
   state='starting';
   lastResult=Promise.resolve(audio.play()).then(()=>{if(id!==serial)return false;state='playing';return true},err=>{if(id===serial){state='blocked';error=err?.name+': '+(err?.message||'Media playback rejected')}return false});
   return true;
  }catch(err){state='error';error=err?.message||'Media audio error';lastResult=Promise.resolve(false);return false}
 }
 function flushTicks(){
  if(!ticks.length||!visible()||!canPlay(getPrefs(),'ratchet')){ticks=[];tickPlaying=false;return false}
  const batch=ticks.splice(0,12);tickPlaying=true;tickEnd=clock()+batch.length*SLIDER_SPACING*1000+30;
  const sent=play('ratchet',false,batch);if(!sent){tickPlaying=false;ticks=[]}
  else {const id=serial;lastResult.then(ok=>{if(!ok&&id===serial&&tickPlaying){tickPlaying=false;ticks=[];queuedReward=null}})}
  return sent;
 }
 function playSlider(pitches){
  if(!pitches.length||!visible()||!canPlay(getPrefs(),'ratchet'))return false;
  ticks.push(...pitches);if(ticks.length>48)ticks.splice(0,ticks.length-48);
  return tickPlaying||flushTicks();
 }
 audio.addEventListener?.('ended',()=>{if(state==='playing')state='ready';if(tickPlaying){tickPlaying=false;if(ticks.length)flushTicks();else if(queuedReward){const reward=queuedReward;queuedReward=null;play(reward)}}});
 return {play,playSlider,sliderDelay:()=>tickPlaying?Math.max(0,tickEnd-clock())+ticks.length*SLIDER_SPACING*1000+Math.ceil(ticks.length/12)*30:0,testTone:()=>play('test',true),stop,reset:()=>{stop();error=''},state:()=>state,error:()=>error,result:()=>lastResult};
}
function makeEngine(AudioContext,getPrefs,visible=()=>true,clock=()=>Date.now()){
 let context=null,last=-Infinity,voices=[],pending=null,noiseBuffer=null,lastError='',tickTail=0;
 function unlock(retry=false){
  if(!AudioContext||!getPrefs().enabled)return Promise.resolve(false);
  try{
   if(!context||context.state==='closed')context=new AudioContext();
   if(context.state==='running'){lastError='';return Promise.resolve(true)}
   if(pending&&!retry)return pending;
   const ctx=context;let timer,attempt;
   // A browser can leave resume() pending indefinitely when a gesture is not accepted.
   // A fresh trusted tap must be allowed to retry, not inherit a stuck promise.
   const resume=Promise.resolve(ctx.resume()).then(()=>ctx===context&&ctx.state==='running',err=>{if(ctx===context)lastError=err?.message||'Resume rejected';return false});
   attempt=Promise.race([resume,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),1200)})]).then(ok=>{if(ctx===context){if(ok)lastError='';else if(!lastError)lastError='Audio context did not resume';}return ok}).finally(()=>{clearTimeout(timer);if(pending===attempt)pending=null});
   pending=attempt;return attempt;
  }catch(err){lastError=err?.message||'Audio unavailable';return Promise.resolve(false)}
 }
 function reset(){
  stop();const old=context;context=null;pending=null;noiseBuffer=null;last=-Infinity;lastError='';
  try{if(old&&old.state!=='closed')Promise.resolve(old.close?.()).catch(()=>{})}catch{}
 }
 function testTone(){
  const p=getPrefs();if(!p.enabled||p.volume<=0||!visible()||context?.state!=='running')return false;
  stop();try{
   const t=context.currentTime+.015,o=context.createOscillator(),g=context.createGain();
   o.type='sine';o.frequency.setValueAtTime(660,t);o.frequency.setValueAtTime(880,t+.18);
   g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,.23*p.volume/100),t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.42);
   o.connect(g);g.connect(context.destination);voices.push(o);
   o.onended=()=>{voices=voices.filter(v=>v!==o);try{o.disconnect();g.disconnect()}catch{}};
   o.start(t);o.stop(t+.44);lastError='';return true;
  }catch(err){lastError=err?.message||'Could not schedule test tone';stop();return false}
 }
 function stop(){for(const v of voices){try{v.stop()}catch{}}voices=[];tickTail=0}
 function buffer(){
  if(noiseBuffer)return noiseBuffer;
  if(!context.createBuffer||!context.createBufferSource||!context.createBiquadFilter)return null;
  const sr=context.sampleRate||44100,b=context.createBuffer(1,Math.ceil(sr*.8),sr),samples=b.getChannelData(0);let seed=0x12345678;
  for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=(seed/4294967296)*2-1}
  noiseBuffer=b;return b;
 }
 function noise(layer,start,p){
  const b=buffer();if(!b)return;
  const [length,offset,hz,q,level,_texture,shape]=layer,t=start+offset,end=t+length;
  const src=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();
  src.buffer=b;f.type='bandpass';f.frequency.setValueAtTime(hz,t);f.Q.setValueAtTime(q,t);
  const amp=Math.max(.00011,p.volume/100*.26*level),attack=shape==='swell'?length*.38:Math.min(.002,length*.2);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+attack);g.gain.exponentialRampToValueAtTime(.0001,end);
  src.connect(f);f.connect(g);g.connect(context.destination);voices.push(src);
  src.onended=()=>{voices=voices.filter(v=>v!==src);try{src.disconnect();f.disconnect();g.disconnect()}catch{}};
  const position=(Math.floor(clock())%400)/1000;src.start(t,position,length);src.stop(end+.004);
 }
 function play(event,preview=false){
  const p=getPrefs();if(!canPlay(p,event)||!visible()||context?.state!=='running')return false;
  const now=clock(),special=['phase','complete','achievement','saved','queue','warning','build','reverse','route'].includes(event);
  if(!preview&&!special&&(now-last<55||tickTail>context.currentTime))return false;
  const followsTicks=!preview&&(event==='phase'||event==='complete')&&tickTail>context.currentTime;
  if((special||preview)&&!followsTicks)stop();
  if(voices.length>24&&!followsTicks)stop();
  last=now;
  try{const start=followsTicks?tickTail:context.currentTime+.008;
   if(event==='startup'&&context.createBuffer&&context.createBufferSource){
    const sr=context.sampleRate||44100,mix=renderStartupMix(sr).samples,b=context.createBuffer(1,mix.length,sr),data=b.getChannelData(0),g=context.createGain(),src=context.createBufferSource();
    for(let i=0;i<mix.length;i++)data[i]=mix[i];src.buffer=b;g.gain.setValueAtTime(p.volume/100*.84,start);src.connect(g);g.connect(context.destination);voices.push(src);src.onended=()=>{voices=voices.filter(v=>v!==src);try{src.disconnect();g.disconnect()}catch{}};src.start(start);return true;
   }
   for(const [from,to,length,offset,wave,level] of soundDefinition(p,event)[1]){
    const o=context.createOscillator(),g=context.createGain(),t=start+offset,end=t+length;
    o.type=wave;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,end);
    const amp=Math.max(.00011,p.volume/100*(event==='startup'?.28:p.palette==='electronic'?.20:.22)*level);
    g.gain.setValueAtTime(.0001,t);
    if(event==='startup'&&from===to){g.gain.exponentialRampToValueAtTime(amp,t+Math.min(.018,length/5));g.gain.exponentialRampToValueAtTime(Math.max(.00011,amp*.78),end-Math.min(.62,length*.55));}
    else g.gain.exponentialRampToValueAtTime(amp,t+Math.min(.008,length/4));
    g.gain.exponentialRampToValueAtTime(.0001,end);
    o.connect(g);g.connect(context.destination);voices.push(o);
    o.onended=()=>{voices=voices.filter(v=>v!==o);try{o.disconnect();g.disconnect()}catch{}};
    o.start(t);o.stop(end+.01);
   }
   if(event==='startup')for(const layer of STARTUP_PERCUSSION_NOISE)noise(layer,start,p);else if(p.palette==='industrial')for(const layer of NOISE[event]||[])noise(layer,start,p);
   return true;
  }catch(err){lastError=err?.message||'Sound synthesis failed';stop();return false}
 }
 function playSlider(pitches){
  const p=getPrefs();if(!pitches.length||!canPlay(p,'ratchet')||!visible()||context?.state!=='running')return false;
  try{
   if(tickTail-context.currentTime>1.75)stop();
   const start=Math.max(context.currentTime+.008,tickTail);
   for(const [from,to,length,offset,wave,level] of sliderNotes(pitches)){
    const o=context.createOscillator(),g=context.createGain(),t=start+offset,end=t+length;
    o.type=wave;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,end);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.00011,p.volume/100*.24*level),t+.0012);g.gain.exponentialRampToValueAtTime(.0001,end);
    o.connect(g);g.connect(context.destination);voices.push(o);
    o.onended=()=>{voices=voices.filter(v=>v!==o);try{o.disconnect();g.disconnect()}catch{}};
    o.start(t);o.stop(end+.003);
   }
   tickTail=start+pitches.length*SLIDER_SPACING;last=clock();return true;
  }catch(err){lastError=err?.message||'Slider audio failed';stop();return false}
 }
 return {unlock,play,playSlider,sliderDelay:()=>context?Math.max(0,tickTail-context.currentTime)*1000:0,stop,reset,testTone,error:()=>lastError,state:()=>context?.state||'locked'};
}
if(typeof module==='object'&&module.exports)module.exports={renderStartupMix,STARTUP_BEAT,kickSteps,snareSteps,hatSteps,riff,STARTUP_NOTES,STARTUP_DURATION,STARTUP_PERCUSSION_NOISE,normalize,DEFAULTS,CATEGORIES,SOUNDS,ELECTRONIC,NOISE,soundDefinition,canPlay,cloudCue,gained,makeEngine,renderWav,makeMediaEngine,makeCueGate,makeAwardTracker,sliderPitches,sliderNotes};
if(typeof document==='undefined')return;
let prefs=normalize(null);try{prefs=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{}
const $=id=>document.getElementById(id),dialog=$('sensoryDialog'),launcher=$('sensoryLaunch');
const engine=makeEngine(root.AudioContext||root.webkitAudioContext,()=>prefs,()=>!document.hidden);
const media=makeMediaEngine($('sensoryMediaAudio'),()=>prefs,()=>!document.hidden);
const appleMobile=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const useMedia=()=>prefs.backend==='media'||prefs.backend==='auto'&&(appleMobile||!root.AudioContext&&!root.webkitAudioContext);
const reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)');
let lastGesture=-Infinity,lastSemantic=-Infinity,localChange=null,lastRange=new WeakMap(),startupSerial=0,startupTimer=null,startupActive=false;
const gate=makeCueGate(()=>performance.now()),awards=makeAwardTracker();
const status=text=>{const node=$('sensoryStatus');if(node)node.textContent=text};
function paint(){
 document.body.dataset.sensoryMotion=reduce?.matches?'off':prefs.motion;
 if(launcher){launcher.dataset.enabled=String(prefs.enabled);launcher.setAttribute('aria-label','Sensory settings · sound '+(prefs.enabled?'on':'off'))}
 if($('sensoryEnabled'))$('sensoryEnabled').checked=prefs.enabled;
 if($('startupMusicEnabled'))$('startupMusicEnabled').checked=prefs.startupMusic;
 if($('sensoryPalette'))$('sensoryPalette').value=prefs.palette;
 if($('sensoryBackend'))$('sensoryBackend').value=prefs.backend;
 audioState();
 if($('sensoryVolume')){$('sensoryVolume').value=prefs.volume;$('sensoryVolumeValue').textContent=prefs.volume+'%'}
 if($('sensoryMotion'))$('sensoryMotion').value=prefs.motion;
 if($('sensoryHaptics')){$('sensoryHaptics').checked=prefs.haptics;$('sensoryHaptics').disabled=typeof navigator.vibrate!=='function'}
 for(const k of CATEGORIES){const e=$('sensoryCat-'+k);if(e)e.checked=prefs.categories[k]}
 if($('sensoryMotionNote'))$('sensoryMotionNote').textContent=reduce?.matches?'System reduced motion is active. Animations are disabled.':'Visual feedback is independent of sound.';
 if($('sensoryHapticNote'))$('sensoryHapticNote').textContent=typeof navigator.vibrate==='function'?'Short vibration pulses on supported devices.':'Haptics are unavailable in this browser (including iPhone Safari).';
}
function setPrefs(patch){const previousBackend=useMedia();prefs=normalize({...prefs,...patch});if(startupActive&&(!canPlay(prefs,'startup')||previousBackend!==useMedia()||patch.volume!==undefined))stopStartup();if(previousBackend!==useMedia()){engine.stop();media.stop();gate.reset()}try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}if(!prefs.enabled||!prefs.volume){engine.stop();media.stop();gate.reset()}paint();return {...prefs,categories:{...prefs.categories}}}
// Best-effort autoplay: never delay or restart the visual introduction if
// the browser requires a gesture. Preview is invoked in the trusted click.
function stopStartup(){
 startupSerial++;clearTimeout(startupTimer);startupTimer=null;
 if(startupActive){startupActive=false;engine.stop();media.stop();gate.reset()}
}
function startStartup(){
 stopStartup();if(!canPlay(prefs,'startup')||document.hidden)return Promise.resolve(false);
 const id=++startupSerial,started=performance.now();
 startupActive=true;engine.stop();media.stop();gate.reset();
 startupTimer=setTimeout(()=>{if(id===startupSerial)stopStartup()},(STARTUP_DURATION+.10)*1000);
 if(useMedia()){
  const sent=media.play('startup',true);
  return Promise.resolve(sent?media.result():false).then(ok=>{if(id!==startupSerial)return false;if(!ok)stopStartup();return ok});
 }
 return unlock(true).then(ok=>{
  if(id!==startupSerial)return false;
  if(!ok||performance.now()-started>250||document.hidden||!canPlay(prefs,'startup')){stopStartup();return false}
  const played=engine.play('startup',true);if(!played)stopStartup();return played;
 });
}
function audioState(){const node=$('sensoryAudioState');if(node)node.textContent=!prefs.enabled?'Sound off':useMedia()?'Media audio: '+media.state():!root.AudioContext&&!root.webkitAudioContext?'Web Audio unavailable':'Audio engine: '+engine.state()}
function unlock(retry=false){if(useMedia()){audioState();return Promise.resolve(true)}return engine.unlock(retry).then(ok=>{audioState();return ok})}
async function testAudio(restart=false){
 stopStartup();
 if(!prefs.enabled){status('Turn on Enable sound first.');return}
 if(!prefs.volume){status('Raise the volume above zero.');return}
 if(useMedia()){if(restart)media.reset();const sent=media.testTone();audioState();status('Testing media audio…');const played=sent&&await media.result();audioState();status(played?'Media test tone sent. Did you hear it?':'Media playback failed: '+media.error());return}
 if(restart)engine.reset();
 status(restart?'Restarting audio engine…':'Testing audio…');audioState();
 const ok=await unlock(true);
 if(!ok){status('Audio did not start ('+engine.state()+'). Try Restart audio, then reopen NAUVIS if needed.');return}
 const played=engine.testTone();audioState();
 status(played?'Test tone sent. If you heard nothing, check media volume, Silent Mode and audio output, then try Restart audio.':'Could not play test tone. '+engine.error());
}
function pulse(el,cls='sensory-pulse'){
 if(!el||document.body.dataset.sensoryMotion==='off')return;
 el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
 setTimeout(()=>el.classList.remove(cls),cls==='sensory-award-flash'?850:230);
}
function vibrate(event){if(!prefs.haptics||document.hidden||!prefs.categories[SOUNDS[event]?.[0]]||typeof navigator.vibrate!=='function')return;
 try{navigator.vibrate(['complete','achievement'].includes(event)?[16,35,20]:event==='build'?12:7)}catch{}}
function cue(event,el,{semantic=false,haptic=true,preview=false}={}){
 if(startupActive)return false;
 if(!SOUNDS[event]||(!preview&&document.hidden))return false;
 if(semantic)lastSemantic=performance.now();
 if(!gate.allow(event,preview))return false;
 const backend=useMedia()?media:engine,delay=backend.sliderDelay();
 const played=backend.play(event,preview);if(played)gate.played(event,prefs,preview?0:delay);if(haptic)vibrate(event);if(el)pulse(el);
 return played;
}
function semantic(event,el){if(performance.now()-lastGesture>1500||root.NauvisCloudApplying)return false;return cue(event,el,{semantic:true})}
function markLocalChange(){
 const workspace=document.body.dataset.workspace;
 // Focus-mode construction has its own exact completion events. Hidden legacy
 // milestones, sync, and non-construction edits must not compete with them.
 if(!root.NauvisCloudApplying&&document.body.dataset.appMode==='full'&&workspace!=='factory'&&performance.now()-lastGesture<1500)localChange=workspace;
}
function resetBaseline(){localChange=null;awards.reset();lastRange=new WeakMap();if(!startupActive){engine.stop();media.stop()}gate.reset()}
function updateAwards(keys){
 const eligible=!!localChange&&localChange===document.body.dataset.workspace&&document.body.dataset.appMode==='full'&&!root.NauvisCloudApplying&&!document.hidden&&performance.now()-lastGesture<1500;
 localChange=null;
 const earned=awards.update(keys,{eligible});
 if(!earned.length)return [];
 const active=document.querySelector('.view.active .factory-milestones');
 if(active)pulse(active,'sensory-award-flash');
 // No delayed reward queue: a later slider change can never replay an old win.
 if(performance.now()-lastSemantic>=250)cue('achievement',null,{semantic:true,haptic:false});
 return earned;
}
function isUiSetting(el){return !!el.closest('#sensoryDialog,#sensoryLaunch,#nauvisIntro')}
function interactive(e){return e.target?.closest?.('button,summary,a[href],input,select,textarea,[role="button"]')}
function gesture(e){if(!e.isTrusted)return;localChange=null;lastGesture=performance.now();if(prefs.enabled&&!useMedia()&&engine.state()!=='running'&&!e.target?.closest?.('#sensoryDialog,#sensoryLaunch'))unlock(true)}
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')gesture(e)},true);
document.addEventListener('pointerup',gesture,true);
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-project-built],[data-project-check],[data-project-logistics-built],[data-project-logistics-check]')){gesture(e);lastRange.delete(e.target)}},true);
document.addEventListener('touchend',gesture,{capture:true,passive:true});
document.addEventListener('click',gesture,true);
document.addEventListener('keydown',e=>{if(!e.repeat)gesture(e)},true);
document.addEventListener('click',e=>{
 const el=interactive(e);if(!e.isTrusted||!el||isUiSetting(el)||el.disabled||el.getAttribute('aria-disabled')==='true')return;
 if(el.matches('input,select,textarea'))return;
 const tab=el.dataset.focusView||el.dataset.view;
 const tabSound=({build:'navPlanner',factory:'navConstruction',log:'navLog',learn:'navGuide',setup:'navInventory'})[tab];
 const kind=tabSound|| (el.matches('[data-view],[data-plan-target],[data-factory-target],[data-milestone-action]')?'nav':el.matches('summary')?(el.parentElement.open?'close':'open'):el.matches('[data-project-plus],[data-project-minus]')?null:el.matches('#quickCountPlus,[data-quick-plus]')?'countUp':el.matches('#quickCountMinus,[data-quick-minus]')?'countDown':el.matches('[aria-pressed]')?(el.getAttribute('aria-pressed')==='true'?'on':'off'):'click');
 if(!kind)return;
 // Semantic success hooks run first (after actual writes). Generic feedback never claims success.
 if(performance.now()-lastSemantic<100)return;
 cue(kind,el);
},false);
document.addEventListener('change',e=>{
 const el=e.target;if(!e.isTrusted||!el?.matches?.('input,select,textarea')||isUiSetting(el)||el.disabled)return;
 if(performance.now()-lastSemantic<100)return;
 const kind=el.matches('[type="checkbox"],[type="radio"]')?(el.checked?'check':'uncheck'):el.matches('select')?'select':el.matches('[type="range"]')?null:'edit';
 if(kind)cue(kind,el);
},false);
document.addEventListener('input',e=>{
 const el=e.target;if(!e.isTrusted||!el?.matches?.('input[type="range"],input[type="number"],input[type="text"],input[type="search"],input:not([type]),textarea')||isUiSetting(el)||el.disabled)return;
 if(el.matches('[data-project-built],[data-project-logistics-built]')){
  if(root.NauvisCloudApplying)return;
  const prev=lastRange.get(el)?.value??Number(el.dataset.soundValue),value=Number(el.value);
  lastRange.set(el,{value});
  const pitches=sliderPitches(prev,value,Number(el.min),Number(el.max),Number(el.step)||1);
  if(!pitches.length)return;
  if(gate.active()){engine.stop();media.stop();gate.reset()}
  if(!document.hidden)(useMedia()?media:engine).playSlider(pitches);
  return;
 }
 const now=performance.now(),prev=lastRange.get(el);
 if(prev&&now-prev.time<85)return;lastRange.set(el,{time:now});cue(el.matches('[type="range"]')?'ratchet':el.matches('[type="number"]')?'tick':'key',null,{haptic:false});
},false);
document.addEventListener('invalid',e=>{if(e.isTrusted&&!isUiSetting(e.target))semantic('warning',e.target)},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopStartup();engine.stop();media.stop();gate.reset();localChange=null;lastRange=new WeakMap()}audioState()});
window.addEventListener('pageshow',audioState);
reduce?.addEventListener?.('change',paint);
launcher?.addEventListener('click',()=>{paint();status(prefs.enabled?'Tap Test sound to check audio output.':'Sound is off. Enable it when you want tactile feedback.');dialog?.showModal();if(prefs.enabled)unlock(true)});
$('startupMusicEnabled')?.addEventListener('change',e=>setPrefs({startupMusic:e.target.checked}));
$('previewStartupMusic')?.addEventListener('click',async()=>{if(!canPlay(prefs,'startup')){status('Enable sound and startup music, with volume above zero.');return}const ok=await startStartup();status(ok?'Playing original Nauvis startup theme.':'Startup music could not play or was stopped. Tap again to retry.')});
dialog?.addEventListener('close',()=>{if(startupActive&&!root.NauvisIntro?.active())stopStartup()});
$('sensoryTestSound')?.addEventListener('click',()=>testAudio(false));
$('sensoryRestartAudio')?.addEventListener('click',()=>testAudio(true));
$('sensoryClose')?.addEventListener('click',()=>dialog.close());
$('sensoryEnabled')?.addEventListener('change',async e=>{setPrefs({enabled:e.target.checked});if(prefs.enabled){const ok=await unlock(true);if(ok){cue('on',null,{haptic:false});status('Sound enabled. Tap Test sound to check output.')}else status('Tap Test sound to activate audio.')}else status('Sound muted.')});
$('sensoryVolume')?.addEventListener('input',e=>setPrefs({volume:Number(e.target.value)}));
$('sensoryBackend')?.addEventListener('change',e=>{setPrefs({backend:e.target.value});status('Playback method changed. Tap Test sound.');if(!useMedia()&&prefs.enabled)unlock(true)});
$('sensoryPalette')?.addEventListener('change',e=>{setPrefs({palette:e.target.value});if(prefs.enabled)unlock().then(ok=>{if(ok)cue('click',null,{haptic:false})})});
$('sensoryMotion')?.addEventListener('change',e=>setPrefs({motion:e.target.value}));
$('sensoryHaptics')?.addEventListener('change',e=>{setPrefs({haptics:e.target.checked});vibrate('click')});
for(const k of CATEGORIES)$('sensoryCat-'+k)?.addEventListener('change',e=>setPrefs({categories:{...prefs.categories,[k]:e.target.checked}}));
$('sensoryReset')?.addEventListener('click',()=>{setPrefs(DEFAULTS);status('Default sensory preferences restored.')});
dialog?.addEventListener('click',async e=>{const event=e.target.closest('[data-sensory-test]')?.dataset.sensoryTest;if(!event)return;stopStartup();if(!prefs.enabled||!prefs.volume){status('Enable sound and set volume above zero first.');return}if(!prefs.categories[SOUNDS[event]?.[0]]){status('Enable this sound category first.');return}if(useMedia()){const sent=cue(event,e.target,{haptic:false,preview:true});const ok=sent&&await media.result();audioState();status(ok?'Played '+event+' preview.':'Media playback failed: '+media.error());return}if(await unlock(true)){const played=cue(event,e.target,{haptic:false,preview:true});status(played?'Played '+event+' preview.':'Sound could not play. '+engine.error())}else status('Audio did not start. Tap Restart audio.')});
let cloudBefore=$('cloudStatus')?.dataset.state;
if($('cloudStatus')&&typeof MutationObserver!=='undefined')new MutationObserver(()=>{const after=$('cloudStatus').dataset.state,event=cloudCue(cloudBefore,after);cloudBefore=after;if(event)cue(event,null,{haptic:false})}).observe($('cloudStatus'),{attributes:true,attributeFilter:['data-state']});
root.NauvisSensory={startStartup,stopStartup,startupActive:()=>startupActive,getPrefs:()=>normalize(prefs),setPrefs,unlock,semantic,markLocalChange,resetBaseline,updateAwards,state:()=>useMedia()?media.state():engine.state()};
paint();
})(typeof window==='undefined'?globalThis:window);
