/* NAUVIS v0.24 — original industrial item icon illustrations.
   Copyright © NAUVIS contributors. These are newly drawn geometric symbols,
   not Wube/Factorio game sprites and require no external image requests. */
(function(root){
'use strict';
const S={
 'iron-ore':['ore','#a8c0d1','#5e7687'],
 'copper-ore':['ore','#e8a56d','#9c5a38'],
 'stone':['ore','#c0b6a7','#6d716f'],
 'coal':['ore','#8396a6','#35444e'],
 'iron-plate':['plate','#bac9d7','#6e8291'],
 'copper-plate':['plate','#efb978','#ab643c'],
 'steel-plate':['plate','#c3d5df','#657e98'],
 'stone-brick':['brick','#b7b2a6','#807b77'],
 'copper-cable':['cable','#f1c17c','#b6723b'],
 'iron-gear-wheel':['gear','#cbd9e3','#748c9e'],
 'iron-stick':['rod','#b8c9d8','#647f91'],
 'pipe':['pipe','#bfccd7','#6d8497'],
 'electronic-circuit':['circuit','#71dfa1','#236b54'],
 'advanced-circuit':['circuit','#f28a88','#8e3542'],
 'processing-unit':['circuit','#7ac3ff','#3357a4'],
 'low-density-structure':['lds','#eac181','#a67a48'],
 'engine-unit':['engine','#b3cad7','#546e82'],
 'electric-engine-unit':['engine','#85d9ed','#277b9e'],
 'battery':['battery','#b2e0cb','#328d86'],
 'flying-robot-frame':['robot','#b9addf','#7065a7'],
 'plastic-bar':['plastic','#9ea7bc','#48556d'],
 'sulfur':['crystal','#f6d76e','#ad8126'],
 'sulfuric-acid':['flask','#ecdc65','#a29c35'],
 'explosives':['explosives','#f4a380','#a84b3f'],
 'solid-fuel':['fuel','#a0a7b3','#596272'],
 'rocket-fuel':['rocketfuel','#f3c16f','#af6735'],
 'rail':['rail','#c6ced8','#788595'],
 'productivity-module':['module','#ce9df0','#8549b9'],
 'electric-furnace':['furnace','#9ebbd2','#566b91'],
 'transport-belt':['belt','#f1c369','#ac7b33'],
 'fast-transport-belt':['belt','#ed777e','#a53448'],
 'inserter':['inserter','#e6c877','#9f7b46'],
 'automation-science-pack':['science','#f28f8f','#a1454a'],
 'logistic-science-pack':['science','#85e1b2','#43836b'],
 'chemical-science-pack':['science','#89c4f9','#4a709e'],
 'production-science-pack':['science','#ca9aee','#72539e'],
 'utility-science-pack':['science','#f2dd79','#ad893f'],
 'water':['fluid','#83d7f5','#3e82af'],
 'petroleum-gas':['fluid','#becbd9','#566c84'],
 'heavy-oil':['fluid','#b19c76','#675741'],
 'light-oil':['fluid','#edc774','#a97e3e'],
 'lubricant':['fluid','#72dbba','#357e71']
};
const line=(d,color,w=2.5)=>'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
const rect=(x,y,w,h,r,fill,stroke='',sw=2)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';
const circle=(x,y,r,fill,stroke='',sw=2)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+sw+'"':'')+'/>';
const poly=(points,fill,stroke='',width=2)=>'<polygon points="'+points+'" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="'+width+'"':'')+'/>';
const teeth=(cx,cy,outer,inner,count)=>{
 const coords=[];for(let i=0;i<count*4;i++){
  const a=(i/(count*4))*Math.PI*2-Math.PI/2;
  const r=(i%4===0||i%4===3)?outer:inner;
  coords.push((cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2));
 }
 return coords.join(' ');
};
function symbol(type,id,light,dark){
 const ink='#142636',silver='#d6e7ef';
 const shine='#ffffff70';
 if(type==='ore')return [
  poly('13,44 12,31 21,21 34,24 41,37 36,50 21,52',dark,ink),
  poly('27,43 31,26 43,18 54,30 51,46 39,51',light,ink),
  line('33 28 L43 21 L49 30 M20 29 L27 34',shine,2),
  poly('21,42 18,36 25,29 29,39',light)
 ].join('');
 if(type==='plate')return [
  poly('12,39 42,32 53,39 24,48',dark,ink),
  poly('12,33 42,26 53,33 24,42',light,ink),
  poly('12,25 42,18 53,25 24,34',light,ink),
  line('17 25 L42 19',shine,2)
 ].join('');
 if(type==='brick')return [
  rect(10,28,44,22,3,dark,ink),
  rect(12,15,40,20,3,light,ink),
  line('12 26 H52 M33 26 V35 M22 35 V50 M45 35 V50',ink,2.5)
 ].join('');
 if(type==='cable')return [
  circle(30,33,17,dark,ink,2.5),circle(30,33,11,'#243747',light,4),
  circle(30,33,5,ink,light,2),
  line('13 35 C7 30 7 24 13 23 M47 31 L56 26 M48 39 L56 43',light,4)
 ].join('');
 if(type==='gear')return [
  poly(teeth(32,32,25,20,10),dark,ink,2.6),circle(32,32,17,light,ink),
  circle(32,32,8,'#233b4a',ink),circle(32,32,3,light)
 ].join('');
 if(type==='rod')return [
  line('16 16 L45 45',ink,9),line('16 16 L45 45',light,6),
  line('14 29 L35 50',dark,7),line('14 29 L35 50',silver,3),
  line('29 12 L50 33',light,6)
 ].join('');
 if(type==='pipe')return [
  line('16 15 V43 H47',ink,16),line('16 15 V43 H47',light,11),
  rect(8,10,16,8,2,dark,ink),rect(43,34,9,18,2,dark,ink),
  line('11 43 H43',shine,2)
 ].join('');
 if(type==='circuit'){
  const pc=id==='advanced-circuit'?3:id==='processing-unit'?4:2;
  const darkBody= id==='advanced-circuit'?'#743039':id==='processing-unit'?'#284d81':'#24694d';
  const pins=Array.from({length:4},(_,i)=>line((15+i*9)+' 9 V16 M'+(15+i*9)+' 48 V55',light,2.7)).join('');
  return [
    rect(11,13,42,38,5,darkBody,ink,3),rect(16,18,32,28,3,light,dark,1.7),
    rect(22,24,20,16,3,darkBody,ink,2),
    pins,
    line('16 26 H22 M42 32 H50 M16 39 H22 M42 26 H48',shine,2),
    circle(32,32,pc+1,'#183241',light,1.8),
    circle(39,21,2,light),circle(17,44,2,dark)
  ].join('');
 }
 if(type==='lds')return [
  poly('12,42 23,17 50,25 53,45 36,51',dark,ink),
  poly('23,17 47,13 54,27 36,42 12,42',light,ink),
  line('23 17 L35 42 M47 13 L36 42',shine,3)
 ].join('');
 if(type==='engine')return [
  rect(13,22,41,26,5,dark,ink,3),
  rect(17,17,28,12,4,light,ink),
  circle(33,36,10,'#243a4e',light,2.5),
  circle(33,36,4,light,ink),
  line('27 29 L39 43 M39 29 L27 43',silver,2),
  rect(8,26,8,18,2,light,ink)
 ].join('');
 if(type==='battery')return [
  rect(19,13,25,40,5,dark,ink,2.5),
  rect(25,8,13,7,2,light,ink),
  rect(23,19,17,28,3,light,ink,1.5),
  line('32 26 V39 M26 33 H38',ink,3)
 ].join('');
 if(type==='robot')return [
  rect(24,24,17,18,5,light,ink,2.7),
  line('24 26 L14 16 M41 26 L51 16 M24 41 L14 51 M41 41 L51 51',dark,4),
  circle(14,16,7,light,ink),circle(51,16,7,light,ink),
  circle(14,51,7,light,ink),circle(51,51,7,light,ink),
  circle(32,32,4,dark)
 ].join('');
 if(type==='plastic')return [
  rect(10,33,38,13,3,dark,ink),rect(17,20,37,14,3,light,ink),
  line('22 24 H47 M15 37 H40',shine,2),
  line('12 46 L16 49 H47 L50 46',dark,3)
 ].join('');
 if(type==='crystal')return [
  poly('10,43 17,24 30,18 38,35 33,49 18,52',light,ink),
  poly('27,47 35,24 49,20 56,40 48,53',dark,ink),
  poly('22,23 30,18 32,35 26,46 17,43',shine),
  line('35 24 L49 20 L45 34',shine,2)
 ].join('');
 if(type==='flask')return [
  rect(25,9,15,7,2,light,ink),line('28 16 V27 L18 44 Q14 54 29 54 H44 Q52 54 46 44 L37 27 V16',ink,3.5),
  poly('21,43 44,42 48,50 42,53 24,53 18,48',light),
  line('23 42 H44',dark,3),circle(30,47,2,silver),circle(40,49,2,dark)
 ].join('');
 if(type==='explosives')return [
  rect(17,24,12,28,2,dark,ink),rect(31,20,12,32,2,light,ink),
  line('35 20 L41 11 L48 13',dark,2.7),
  line('17 36 H29 M31 34 H43',shine,2),
  circle(48,12,4,'#f9d480')
 ].join('');
 if(type==='fuel')return [
  poly('13,24 41,20 53,33 45,51 15,46',dark,ink,3),
  poly('13,24 41,20 37,40 15,46',light,ink),
  line('19 30 L35 27 M20 39 L30 35',shine,2)
 ].join('');
 if(type==='rocketfuel')return [
  rect(20,16,25,38,4,dark,ink,3),rect(24,12,17,6,2,light,ink),
  poly('33,21 24,36 34,35 28,49 43,30 33,32 40,21',light,ink,1),
  line('22 53 H44',shine,2)
 ].join('');
 if(type==='rail')return [
  line('15 12 L9 54 M49 12 L55 54',light,6),
  line('12 18 H52 M11 29 H53 M10 41 H54 M9 51 H55',dark,5),
  line('15 12 L9 54 M49 12 L55 54',ink,2)
 ].join('');
 if(type==='turret')return [
  rect(10,39,44,14,5,dark,ink,2.8),rect(18,29,28,17,5,light,ink,2.7),
  circle(32,31,10,dark,ink,2.5),circle(32,31,4,light,ink),
  rect(29,11,7,16,3,light,ink),line('33 13 L40 8',silver,3)
 ].join('');
 if(type==='solar')return [
  poly('7,23 47,16 56,37 15,44',dark,ink,2.6),poly('11,25 45,19 51,35 17,40',light,ink,1.6),
  line('24 23 L29 39 M36 21 L41 37 M13 31 L49 26',ink,2),line('33 42 V52 M20 54 H45',silver,3)
 ].join('');
 if(type==='chest')return [
  rect(14,23,37,32,5,dark,ink,3),poly('14,23 26,14 56,20 51,29',light,ink,2),
  rect(27,32,14,9,2,light,ink,2),line('19 27 L19 50 M45 31 L45 51',shine,2)
 ].join('');
 if(type==='drill')return [
  rect(12,29,41,25,5,dark,ink,3),poly('27,8 41,21 32,39 22,21',light,ink,2.5),
  rect(17,44,31,9,2,light,ink),line('8 54 H57',ink,3)
 ].join('');
 if(type==='module')return [
  rect(14,11,36,42,5,dark,ink,3),
  rect(19,17,26,27,3,light,ink,2),
  poly('32,21 23,33 32,40 41,33',dark,ink),
  Array.from({length:4},(_,i)=>rect(18+i*8,49,4,7,1,light,ink,1)).join('')
 ].join('');
 if(type==='furnace')return [
  rect(12,12,42,41,5,dark,ink,3),
  rect(17,19,32,23,3,'#2c394a',light,2),
  poly('32,22 26,33 30,30 28,40 41,31 36,32 38,26',light,ink),
  rect(19,45,29,5,2,light,ink)
 ].join('');
 if(type==='belt')return [
  rect(10,17,44,32,7,dark,ink,3),
  rect(14,23,36,19,4,'#243a47',light,2),
  circle(20,32,4,light),circle(32,32,4,light),circle(44,32,4,light),
  line('13 18 H50 M13 48 H50',light,3)
 ].join('');
 if(type==='inserter')return [
  rect(22,45,24,10,3,dark,ink),
  circle(33,44,7,light,ink),line('31 39 L23 25 L42 13',light,6),
  circle(23,25,5,dark,ink),
  line('42 13 L50 18 M42 13 L37 7',ink,3.6)
 ].join('');
 if(type==='science')return [
  rect(17,41,31,11,5,dark,ink,2.5),
  rect(24,12,17,7,2,light,ink),
  line('27 19 V29 L20 42 Q20 50 32 50 Q44 50 44 42 L37 29 V19',ink,3.3),
  poly('23,36 40,34 45,43 42,49 23,49 20,43',light,ink,1),
  circle(30,41,3,'#ffffff90'),circle(38,44,2,dark)
 ].join('');
 if(type==='fluid')return [
  '<path d="M32 8 C27 21 15 31 15 42 A17 17 0 0 0 49 42 C49 31 37 18 32 8Z" fill="'+dark+'" stroke="'+ink+'" stroke-width="3"/>',
  '<path d="M31 17 C23 30 22 34 22 41" stroke="'+light+'" stroke-width="5" fill="none" stroke-linecap="round"/>',
  circle(37,45,4,light)
 ].join('');
 return [rect(14,14,36,36,7,dark,ink),circle(32,32,10,light,ink)].join('');
}
function derivedSpec(id){
 if(/turret|cannon|artillery|gun-/.test(id))return ['turret','#e7aa7e','#996243'];
 if(/solar-panel/.test(id))return ['solar','#89c7ee','#356d9e'];
 if(/mining-drill|pumpjack/.test(id))return ['drill','#cbd4dd','#687c95'];
 if(/chest|storage|container/.test(id))return ['chest','#c69d77','#765d47'];
 if(/module|beacon/.test(id))return ['module','#ba9ae1','#6c55a5'];
 if(/accumulator|battery/.test(id))return ['battery','#86d9c2','#368a86'];
 if(/science-pack/.test(id))return ['science','#bda6ee','#634fa8'];
 if(/robot|roboport/.test(id))return ['robot','#acc4dd','#537da5'];
 if(/belt|splitter/.test(id))return ['belt','#eac576','#a47536'];
 if(/inserter/.test(id))return ['inserter','#eac576','#a47536'];
 if(/circuit|combinator|processor/.test(id))return ['circuit','#82c6db','#396c91'];
 if(/engine|locomotive|wagon|car|tank/.test(id))return ['engine','#becbd5','#6b8196'];
 if(/furnace|machine|refinery|plant|centrifuge|silo|boiler|generator/.test(id))return ['furnace','#b6c4d3','#627b9b'];
 if(/plate|steel|concrete|brick|wall|stone/.test(id))return ['plate','#b9c5d4','#637a94'];
 if(/pipe/.test(id))return ['pipe','#b9c7d8','#657e94'];
 if(/rail|signal/.test(id))return ['rail','#b8c3d0','#63788e'];
 if(/ammo|magazine|round|explosive|grenade|rocket|shell|bomb/.test(id))return ['rocketfuel','#e9ad83','#9f5e42'];
 if(/gear|stick|cable/.test(id))return ['gear','#dfc89e','#9b7e56'];
 return ['ore','#a7c4d5','#5c7891'];
}
function item(id,size=32){
 const safeId=String(id||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
 const spec=S[safeId]||derivedSpec(safeId);
 const px=Number.isFinite(Number(size))?Math.min(96,Math.max(16,Number(size))):32;
 const label=safeId.replace(/-/g,' ');
 return '<span class="item-icon" data-item-icon="'+safeId+'" style="--item-tone:'+spec[1]+';--item-back:'+spec[2]+';--icon-size:'+px+'px" aria-hidden="true">'+
 '<svg class="item-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false" aria-hidden="true">'+
 symbol(spec[0],safeId,spec[1],spec[2])+'</svg></span>';
}
root.NauvisIcons={item,ids:Object.freeze(Object.keys(S)),version:'original-1'};
if(typeof module==='object'&&module.exports)module.exports={item,specs:S,symbol,derivedSpec};
})(typeof window==='undefined'?globalThis:window);
