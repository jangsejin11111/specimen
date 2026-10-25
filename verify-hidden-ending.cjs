const assert=require('node:assert/strict');
(async()=>{
const {EndingSequence,ENDING_PHASES,heldBlink,restoreEndingFaces,endingRoute,endingPosition}=await import('./ending.mjs');
const {SpecimenState}=await import('./game-state.mjs');
const s=new SpecimenState(),ids=s.roamingBugs.map(b=>b.id),mines=[...s.hiddenBugCells];
const e=new EndingSequence(8);assert(!e.start(s));for(let i=0;i<8;i++){s.grab(ids[i]);s.drop(mines[i]);}for(let i=0;i<8;i++)s.specimenPins.advance(.05);assert(e.start(s));assert.equal(e.phase,'smile');
for(let i=0;i<40;i++)e.advance(.05);assert.equal(e.phase,'countdown');assert.equal(e.countdown,5);
for(let n=4;n>=1;n--){e.advance(1);assert.equal(e.countdown,n);}e.advance(1);assert.equal(e.phase,'fade');
let seen=new Set([e.phase]);for(let i=0;i<300;i++){e.advance(.05);seen.add(e.phase);}assert.equal(e.phase,'complete');assert.equal(e.count(s),8);assert.equal(e.classificationRecord.length,8);assert.equal(s.pinnedSpecimens.size,8);
for(const [phase] of ENDING_PHASES.slice(2))assert(seen.has(phase));
e.reset();assert.equal(e.phase,'playing');assert.equal(e.classificationRecord,null);assert(e.start(s));for(let i=0;i<40;i++)e.advance(.05);e.reset();for(let i=0;i<1000;i++)e.advance(.05);assert.equal(e.phase,'playing');
const f={currentDirection:{x:1,y:1},normalDirection:{x:-1,y:0},render(){}};restoreEndingFaces([f],.15);assert.deepEqual(f.currentDirection,f.normalDirection);
for(const ms of [0,2499,2640,4999,5140])assert(!heldBlink(ms));for(const ms of [2500,2550,5000,5100])assert(heldBlink(ms));
for(const x of [40,360]){const route=endingRoute({x,y:100},{left:0,top:0,width:400,height:400},450,20);const p=endingPosition('escape',5.2,{x,y:80},{x,y:100},route.at(-1),route);assert(p.x<0||p.x>450);}
console.log('PASS: exact 8 correct pins; 5-second countdown; all ending phases; persistent 8/8 record; restart cancels timeline; original gaze restore; 2.5-second blink; offscreen exit.');
})().catch(e=>{console.error(e);process.exitCode=1});
