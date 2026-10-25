// A separate, one-shot presentation timeline. Gameplay data is not reinterpreted.
export const ENDING_PHASES=[['smile',2],['countdown',5],['fade',.25],['still',.75],['dim',.4],['twitch',1.5],['release',.9],['label',1.0],['escape',5.2],['empty',1.65]];
export class EndingSequence {
  constructor(total) { this.total=total; this.reset(); }
  reset() { this.phase='playing'; this.elapsed=0; this.index=null; this.bug=null; this.classificationRecord=null; }
  get active() { return this.phase!=='playing'; }
  count(state) { return this.active ? this.total : [...state.pinnedSpecimens.values()].filter(s=>s.stage==='pinned').length; }
  get countdown() { return this.phase==='countdown'?Math.max(1,Math.ceil(5-this.elapsed)):null; }
  start(state) {
    if(this.active || state.hitMine!==null || state.draggingBug || state.roamingBugs.length || state.pinnedSpecimens.size!==this.total || state.hiddenBugCells.size!==this.total || ![...state.hiddenBugCells].every(i=>state.pinnedSpecimens.get(i)?.stage==='pinned')) return false;
    // Keep the completed classification independent of the escaping body's presentation.
    this.classificationRecord=Object.freeze([...state.pinnedSpecimens.keys()]);
    const entries=[...state.pinnedSpecimens.entries()].sort(([a],[b])=>Math.hypot(a%8-3.5,Math.floor(a/8)-3.5)-Math.hypot(b%8-3.5,Math.floor(b/8)-3.5));
    [this.index,{bug:this.bug}]=entries[0];
    this.phase='smile'; this.elapsed=0; return true;
  }
  advance(dt) {
    if(!this.active || this.phase==='complete') return;
    // Countdown uses real seconds; visual scenes pause rather than skip on a hidden tab.
    this.elapsed+=Math.max(0,this.phase==='countdown'?dt:Math.min(.05,dt));
    const i=ENDING_PHASES.findIndex(([p])=>p===this.phase);
    if(this.elapsed>=ENDING_PHASES[i][1]) { this.elapsed=0; this.phase=ENDING_PHASES[i+1]?.[0]||'complete'; }
  }
}
export function heldBlink(elapsedMs) { return elapsedMs>=3000 && elapsedMs%3000<140; }

export function endingPosition(phase,t,start,label,exit,route=null) {
  const mix=(a,b,f)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
  const freed={x:start.x+8,y:start.y+10};
  if(phase==='release') return mix(start,freed,Math.min(1,t/.9));
  if(phase==='label') return mix(freed,label,Math.min(1,t/1.0));
  if(phase==='escape') return routePosition(route||[label,exit],Math.min(1,t/5.2));
  return start;
}

// End temporary common tracking without changing any face's immutable hint.
export function restoreEndingFaces(faces, elapsed) {
  const t=Math.min(1,Math.max(0,elapsed)/.15);
  for(const face of faces) {
    face.endingReturnFrom ??= {...face.currentDirection};
    const from=face.endingReturnFrom, normal=face.normalDirection;
    face.currentDirection=t===1?{...normal}:{x:from.x+(normal.x-from.x)*t,y:from.y+(normal.y-from.y)*t};
    face.phase=t===1?'normal':'returningEnding';
    face.render(face.currentDirection);
  }
}

// A deliberate bent escape, independent of mines, hints and gameplay pathfinding.
export function endingRoute(label,board,viewportWidth,bugWidth) {
  const left=label.x>board.left+board.width/2;
  const x1=board.left+board.width*(left?.18:.82);
  const y1=Math.max(board.top+board.height*.18,Math.min(board.top+board.height*.82,label.y));
  const x2=board.left+board.width*(left?.12:.88);
  const y2=board.top+board.height*(y1>board.top+board.height/2?.20:.80);
  const bend={x:board.left+board.width*(left?.55:.45),y:board.top+board.height*(y2>board.top+board.height/2?.65:.35)};
  return [label,{x:x1,y:y1},bend,{x:x2,y:y2},{x:left?-bugWidth:viewportWidth+bugWidth,y:y2+board.height*.04}];
}
export function routePosition(points,t) {
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
  let distance=Math.max(0,Math.min(1,t))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++) {
    if(distance<=lengths[i]||i===lengths.length-1) {
      const f=lengths[i]?Math.min(1,distance/lengths[i]):1;
      return {x:points[i].x+(points[i+1].x-points[i].x)*f,y:points[i].y+(points[i+1].y-points[i].y)*f};
    }
    distance-=lengths[i];
  }
  return points.at(-1);
}
