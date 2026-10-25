// A separate, one-shot presentation timeline. Gameplay data is not reinterpreted.
export class EndingSequence {
  constructor(total) { this.total=total; this.reset(); }
  reset() { this.phase='playing'; this.elapsed=0; this.index=null; this.bug=null; }
  get active() { return this.phase!=='playing'; }
  count(state) { return this.active ? this.total : [...state.pinnedSpecimens.values()].filter(s=>s.stage==='pinned').length; }
  start(state) {
    if(this.active || state.draggingBug || state.roamingBugs.length || this.count(state)!==this.total) return false;
    [this.index,{bug:this.bug}]=[...state.pinnedSpecimens.entries()].at(-1);
    this.phase='still'; this.elapsed=0; return true;
  }
  advance(dt) {
    if(!this.active || this.phase==='complete') return;
    this.elapsed+=Math.max(0,Math.min(.05,dt));
    const phases=[['still',2],['twitch',1.3],['release',.45],['label',.65],['escape',2.5],['empty',1.15]];
    const i=phases.findIndex(([p])=>p===this.phase);
    if(this.elapsed>=phases[i][1]) { this.elapsed-=phases[i][1]; this.phase=phases[i+1]?.[0]||'complete'; }
  }
}

export function endingPosition(phase,t,start,label,exit,route=null) {
  const mix=(a,b,f)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
  const freed={x:start.x+8,y:start.y+10};
  if(phase==='release') return mix(start,freed,Math.min(1,t/.45));
  if(phase==='label') return mix(freed,label,Math.min(1,t/.65));
  if(phase==='escape') return routePosition(route||[label,exit],Math.min(1,t/2.5));
  return start;
}

// Uses the existing animation loop, never adds a repeating timer.
export class RestartCountdown {
  constructor() { this.reset(); }
  reset() { this.deadline=null; }
  start(now) { if(this.deadline===null)this.deadline=now+10000; }
  remaining(now) { return this.deadline===null ? null : Math.max(0,Math.ceil((this.deadline-now)/1000)); }
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
  return [label,{x:x1,y:y1},{x:x2,y:y2},{x:left?-bugWidth:viewportWidth+bugWidth,y:y2+board.height*.04}];
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
