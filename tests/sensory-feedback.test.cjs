'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,SOUNDS,ELECTRONIC,NOISE,soundDefinition,CATEGORIES,canPlay,cloudCue,gained,makeEngine,renderWav,makeMediaEngine,makeCueGate,makeAwardTracker,sliderPitches,sliderNotes}=require('../sensory-feedback.js');
test('sensory preferences default to silent and clamp unsafe values',()=>{const p=normalize({volume:900,motion:'weird',haptics:'true',categories:{sync:false}});assert.equal(p.enabled,false);assert.equal(p.volume,100);assert.equal(p.motion,'full');assert.equal(p.haptics,false);assert.equal(p.categories.sync,false);assert.equal(p.categories.controls,true);assert.equal(normalize({volume:NaN}).volume,35)});
test('every original cue has a category and finite bounded synthesis parameters',()=>{assert.equal(Object.keys(SOUNDS).length,30);for(const [category,notes] of Object.values(SOUNDS)){assert.ok(CATEGORIES.includes(category));assert.ok(notes.length>0);for(const [from,to,length,offset,wave,gain] of notes){assert.ok(from>0&&to>0&&length>0&&length<1&&offset>=0&&offset<2);assert.ok(['sine','triangle','sawtooth'].includes(wave));assert.ok(gain>0&&gain<=1)}}});
test('muted master, volume and category gates prevent playback',()=>{assert.equal(canPlay(normalize(null),'click'),false);assert.equal(canPlay(normalize({enabled:true,volume:0}),'click'),false);assert.equal(canPlay(normalize({enabled:true,categories:{achievements:false}}),'achievement'),false);assert.equal(canPlay(normalize({enabled:true}),'achievement'),true);assert.equal(canPlay(normalize({enabled:true}),'unknown'),false)});
test('cloud cues only represent meaningful state changes',()=>{assert.equal(cloudCue('syncing','saved'),'sync');assert.equal(cloudCue('connecting','saved'),null);assert.equal(cloudCue('saved','saved'),null);assert.equal(cloudCue('saved','conflict'),'warning');assert.equal(cloudCue('conflict','error'),null);assert.equal(cloudCue('error','syncing'),null)});
test('reward differences exclude existing awards and deduplicate',()=>{assert.deepEqual(gained(['first','coverage:iron'],['first','coverage:iron','buffer:iron','buffer:iron']),['buffer:iron']);assert.deepEqual(gained(['first'],[]),[]);assert.deepEqual(gained(['first'],['first']),[])});
test('engine handles absent API, mute, unlock, cooldown, synthesis and visibility',async()=>{let p=normalize({enabled:false}),now=0,visible=true;const events=[];let instance;class Audio{constructor(){this.state='suspended';this.currentTime=2;this.destination={};instance=this}resume(){this.state='running';return Promise.resolve()}createOscillator(){return {frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(t){events.push(['start',t])},stop(t){events.push(['stop',t])}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
const absent=makeEngine(null,()=>p);assert.equal(await absent.unlock(),false);const e=makeEngine(Audio,()=>p,()=>visible,()=>now);assert.equal(await e.unlock(),false);p=normalize({enabled:true});assert.equal(e.play('click'),false);assert.equal(await e.unlock(),true);assert.equal(instance.state,'running');assert.equal(e.play('click'),true);assert.equal(e.play('tick'),false);now=100;assert.equal(e.play('tick'),true);now=110;assert.equal(e.play('complete'),true);assert.ok(events.some(x=>x[0]==='start'));visible=false;assert.equal(e.play('achievement'),false);visible=true;p=normalize({enabled:false});assert.equal(e.play('build'),false);e.stop()});

test('industrial palette defaults to distinct foley layers and classic remains available',()=>{assert.equal(normalize(null).palette,'industrial');assert.equal(normalize({palette:'garbage'}).palette,'industrial');const p=normalize({palette:'electronic'});assert.equal(soundDefinition(p,'click'),ELECTRONIC.click);assert.equal(soundDefinition(p,'countUp'),ELECTRONIC.tick);assert.equal(soundDefinition(normalize(null),'click'),SOUNDS.click);assert.equal(Object.keys(NOISE).length,24);assert.notDeepEqual(NOISE.countUp,NOISE.countDown);assert.notDeepEqual(NOISE.check,NOISE.uncheck);for(const layers of Object.values(NOISE))for(const [length,offset,hz,q,gain,texture,shape] of layers){assert.ok(length>0&&length<.4&&offset>=0&&offset<.5&&hz>0&&hz<8000&&q>0&&q<4&&gain>0&&gain<=1);assert.equal(texture,'white');assert.ok(['impact','swell'].includes(shape))}});
test('industrial playback uses noise buffer/filter path; classic stays tonal',async()=>{let p=normalize({enabled:true}),now=100,bufs=0,filters=0,sources=0;const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({connect(){},disconnect(){},start(){},stop(){}});class Audio{constructor(){this.state='running';this.sampleRate=44100;this.currentTime=0;this.destination={}}createOscillator(){return {...node(),frequency:param()}}createGain(){return {...node(),gain:param()}}createBuffer(_channels,n){bufs++;const arr=new Float32Array(n);return{getChannelData(){return arr}}}createBufferSource(){sources++;return node()}createBiquadFilter(){filters++;return {...node(),frequency:param(),Q:param()}}}const e=makeEngine(Audio,()=>p,()=>true,()=>now);await e.unlock();assert.ok(e.play('build'));assert.equal(bufs,1);assert.equal(sources,NOISE.build.length);assert.equal(filters,sources);const n=sources;now+=100;assert.ok(e.play('check'));assert.equal(bufs,1);assert.ok(sources>n);const before=sources;p=normalize({enabled:true,palette:'electronic'});assert.ok(e.play('click',true));assert.equal(sources,before);e.stop()});

test('a new audio gesture can recover from a pending resume, and restart creates a fresh context',async()=>{let resumes=0,created=0,closed=0,started=0;const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});class Audio{constructor(){created++;this.state='suspended';this.currentTime=1;this.destination={}}resume(){if(++resumes===1)return new Promise(()=>{});this.state='running';return Promise.resolve()}close(){closed++;this.state='closed';return Promise.resolve()}createOscillator(){return{frequency:param(),connect(){},disconnect(){},start(){started++},stop(){}}}createGain(){return{gain:param(),connect(){},disconnect(){}}}}const p=normalize({enabled:true,volume:50,categories:Object.fromEntries(CATEGORIES.map(k=>[k,false]))});const e=makeEngine(Audio,()=>p);const first=e.unlock();assert.equal(await e.unlock(true),true);assert.equal(e.testTone(),true);assert.equal(started,1);assert.equal(e.play('click'),false);e.reset();assert.equal(closed,1);assert.equal(e.state(),'locked');assert.equal(await e.unlock(true),true);assert.equal(created,2);assert.equal(await first,false);assert.equal(e.state(),'running')});
test('diagnostic tone still respects master mute, zero volume and visibility',async()=>{let p=normalize({enabled:false}),visible=true;class Audio{constructor(){this.state='running'}resume(){return Promise.resolve()}}const e=makeEngine(Audio,()=>p,()=>visible);assert.equal(e.testTone(),false);p=normalize({enabled:true,volume:0});await e.unlock();assert.equal(e.testTone(),false);p=normalize({enabled:true});visible=false;assert.equal(e.testTone(),false)});

test('independent media renderer produces non-silent valid PCM WAV and respects volume',()=>{for(const palette of ['industrial','electronic'])for(const event of ['test',...Object.keys(SOUNDS)]){const p=normalize({enabled:true,volume:60,palette}),bytes=renderWav(p,event),v=new DataView(bytes.buffer);assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'RIFF');assert.equal(v.getUint32(4,true),bytes.length-8);assert.equal(v.getUint32(40,true),bytes.length-44);assert.ok(bytes.length>44);let peak=0;for(let i=44;i<bytes.length;i+=2)peak=Math.max(peak,Math.abs(v.getInt16(i,true)));assert.ok(peak>0&&peak<=32767)}const quiet=renderWav(normalize({volume:0}),'test');assert.ok(quiet.slice(44).every(v=>v===0))});
test('media playback invokes play synchronously and reports rejection; respects mute and category',async()=>{let p=normalize({enabled:true,volume:70}),now=0,calls=0,blocked=false;const audio={src:'',pause(){},getAttribute(){return this.src},play(){calls++;return blocked?Promise.reject(new Error('blocked')):Promise.resolve()},addEventListener(){}};const e=makeMediaEngine(audio,()=>p,()=>true,()=>now,bytes=>'wav:'+bytes.length);assert.ok(e.testTone());assert.equal(calls,1);assert.ok(await e.result());blocked=true;now+=100;assert.ok(e.play('click'));assert.equal(await e.result(),false);assert.equal(e.state(),'blocked');p=normalize({enabled:true,categories:{controls:false}});assert.equal(e.play('click',true),false);p=normalize({enabled:false});assert.equal(e.testTone(),false);e.reset();assert.equal(e.state(),'ready')});

test('reward cues have distinct durations and tabs have distinct motifs',()=>{for(const palette of [SOUNDS,ELECTRONIC]){const duration=k=>Math.max(...palette[k][1].map(n=>n[2]+n[3]));assert.ok(duration('complete')>1.5);assert.ok(duration('achievement')>1.5);assert.ok(duration('phase')>.5);assert.notDeepEqual(palette.navPlanner,palette.navConstruction);assert.notDeepEqual(palette.navConstruction,palette.navLog)}});

test('each crossed notch plays in pitch order, including zero reversal and five-step jumps',()=>{
 const up=sliderPitches(2,7,0,10),down=sliderPitches(7,2,0,10);
 assert.equal(up.length,5);assert.equal(down.length,5);
 assert.ok(up.every((v,i)=>!i||v>up[i-1]));
 assert.ok(down.every((v,i)=>!i||v<down[i-1]));
 assert.equal(sliderPitches(1,0,0,10)[0],850);
 assert.equal(sliderPitches(9,10,0,10)[0],1870);
 assert.deepEqual(sliderPitches(3,3,0,10),[]);
 assert.equal(sliderPitches(0,100000,0,100000).length,48);
 assert.equal(sliderNotes(up).length,5);
 assert.ok(renderWav(normalize({enabled:true}),'ratchet',24000,up).length>renderWav(normalize({enabled:true}),'ratchet',24000,[up[0]]).length);
});
test('reversible coverage and restored milestones never trigger reward sounds',()=>{
 const t=makeAwardTracker();assert.deepEqual(t.update([]),[]);
 assert.deepEqual(t.update(['First machine placed','Supply matched','coverage:iron'],{eligible:false}),[]);
 assert.deepEqual(t.update([],{eligible:true}),[]);
 assert.deepEqual(t.update(['First machine placed','Supply matched','coverage:iron'],{eligible:true}),[]);
 assert.deepEqual(t.update(['Industrial scale','Construction complete'],{eligible:true}),['Industrial scale']);
 t.reset();assert.deepEqual(t.update(['Black gold'],{eligible:true}),[]);
});
test('reward gate blocks sync and generic controls, permits committed change',()=>{
 let now=0;const p=normalize({enabled:true}),g=makeCueGate(()=>now);
 g.played('complete',p,180);assert.equal(g.allow('sync'),false);assert.equal(g.allow('ratchet'),false);assert.equal(g.allow('reverse'),true);
 now=2000;assert.equal(g.allow('sync'),true);g.played('phase',p);g.reset();assert.equal(g.active(),false);
});
test('media queues one sequence of five ticks then actual completion, not sync; reset discards queued reward',async()=>{
 let now=0,ends,played=[];const audio={src:'',pause(){},getAttribute(){return this.src},play(){played.push(this.src);return Promise.resolve()},addEventListener(event,fn){if(event==='ended')ends=fn}};
 const e=makeMediaEngine(audio,()=>normalize({enabled:true}),()=>true,()=>now,bytes=>'wav:'+bytes.length);
 assert.ok(e.playSlider(sliderPitches(0,5,0,10)));await e.result();
 assert.equal(played.length,1);assert.equal(e.play('sync'),false);assert.ok(e.play('phase'));assert.equal(played.length,1);
 ends();await e.result();assert.equal(played.length,2);
 e.stop();assert.ok(e.playSlider([300]));await e.result();assert.ok(e.play('complete'));e.stop();ends();assert.equal(played.length,3);
});
test('Web Audio schedules five separate rising ticks and the committed completion afterward',async()=>{
 let times=[],hz=[];const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});class Audio{constructor(){this.state='running';this.currentTime=0;this.destination={}}createOscillator(){return{frequency:{setValueAtTime(v){hz.push(v)},exponentialRampToValueAtTime(){}},connect(){},disconnect(){},start(t){times.push(t)},stop(){}}}createGain(){return{gain:param(),connect(){},disconnect(){}}}}
 const e=makeEngine(Audio,()=>normalize({enabled:true,palette:'electronic'}),()=>true,()=>0);await e.unlock();
 const pitches=sliderPitches(0,5,0,10);assert.ok(e.playSlider(pitches));assert.deepEqual(hz,pitches);assert.equal(times.length,5);
 assert.equal(e.play('sync'),false);assert.ok(e.play('phase'));assert.ok(times[5]>times[4]);e.stop();
});

test('slider clicks are crisp, higher pitched and separated by silence without frequency sweeps',()=>{
 const pitches=sliderPitches(0,5,0,5),notes=sliderNotes(pitches);
 for(const [from,to,duration] of notes){assert.ok(from>=850&&from<=1870);assert.equal(from,to);assert.ok(duration<=.012)}
 for(let i=1;i<notes.length;i++)assert.ok(notes[i][3]-notes[i-1][3]-notes[i-1][2]>.03);
 const wav=renderWav(normalize({enabled:true,volume:60}),'ratchet',24000,pitches),v=new DataView(wav.buffer);
 for(let i=0;i<4;i++){const midpoint=Math.round((notes[i][3]+.025)*24000);assert.equal(v.getInt16(44+midpoint*2,true),0)}
});

test('startup music is an original timed score with a separate opt-out and master volume gating',()=>{
 const {STARTUP_NOTES,STARTUP_DURATION}=require('../sensory-feedback.js'),p=normalize({enabled:true});
 assert.equal(p.startupMusic,true);assert.equal(canPlay(p,'startup'),true);
 assert.equal(canPlay(normalize({enabled:true,startupMusic:false}),'startup'),false);
 assert.equal(canPlay(normalize({enabled:true,volume:0}),'startup'),false);
 assert.equal(canPlay(normalize(null),'startup'),false);
 assert.ok(STARTUP_DURATION>=3.5&&STARTUP_DURATION<4.5);
 for(const reveal of [0,.55,1.15])assert.ok(STARTUP_NOTES.some(n=>n[3]===reveal));
 assert.ok(STARTUP_NOTES.some(n=>n[4]==='square'));
 assert.deepEqual(soundDefinition(p,'startup'),soundDefinition(normalize({enabled:true,palette:'electronic'}),'startup'));
 const wav=renderWav(p,'startup'),view=new DataView(wav.buffer);
 assert.ok(Math.abs((wav.length-44)/48000-STARTUP_DURATION)<.04);
 let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(view.getInt16(i,true)));assert.ok(peak>500&&peak<32767);
 assert.ok(renderWav(normalize({volume:0}),'startup').slice(44).every(b=>b===0));
});
test('Web Audio schedules all startup voices and stops future notes on skip',async()=>{
 const {STARTUP_NOTES}=require('../sensory-feedback.js');let started=[],stopped=0;
 const param=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
 class Audio{constructor(){this.state='running';this.currentTime=0;this.destination={}}createOscillator(){return{frequency:param(),connect(){},disconnect(){},start(t){started.push(t)},stop(t){if(t===undefined)stopped++}}}createGain(){return{gain:param(),connect(){},disconnect(){}}}}
 const e=makeEngine(Audio,()=>normalize({enabled:true}));assert.equal(await e.unlock(),true);assert.equal(e.play('startup',true),true);assert.equal(started.length,STARTUP_NOTES.length);assert.ok(started.some(t=>t>=3));e.stop();assert.equal(stopped,STARTUP_NOTES.length);
});
test('media startup playback is cancellable and shares the ordinary master mute',async()=>{
 let paused=0,played=0,p=normalize({enabled:true});const audio={src:'',pause(){paused++},getAttribute(){return this.src},play(){played++;return Promise.resolve()},addEventListener(){}};
 const e=makeMediaEngine(audio,()=>p,()=>true,()=>0,bytes=>'wav:'+bytes.length);
 assert.ok(e.play('startup',true));assert.ok(await e.result());e.stop();assert.ok(paused>=2);assert.equal(e.state(),'ready');
 p=normalize({enabled:true,startupMusic:false});assert.equal(e.play('startup',true),false);assert.equal(played,1);
});
