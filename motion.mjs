import { SIZE, WANDER_SPEED, BUG_COUNT } from './config.mjs?v=tray1';
const MARGIN = .24;
// Individual traits stay with the same body through grabbing and re-marking.
export function createMotionProfile(id,random=Math.random) {
  return Object.freeze({
    speed:id>=BUG_COUNT-3 ? .8+(id-(BUG_COUNT-3))*.27+random()*.08 : WANDER_SPEED*(.55+id/Math.max(1,BUG_COUNT-1)*1.1+random()*.08),
    turnStrength:.45+random()*2.3,
    turnInterval:.55+random()*2.0,
    pauseChance:.08+random()*.34,
    pauseDuration:.18+random()*.85,
    paceFrequency:.7+random()*1.8,
    phase:random()*Math.PI*2
  });
}
export function pinSpeedMultiplier(count) { return 1 + Math.max(0, Math.min(BUG_COUNT, count)) * .18; }
export function advanceBugs(bugs, dt, random = Math.random, onLand = () => {}, pinnedCount = 0) {
  dt = Math.max(0, Math.min(.05, dt));
  for (const bug of bugs) {
    if (bug.mode === 'droppedInvalid') {
      const before=bug.elapsed;
      bug.elapsed += dt;
      if(before<.0825 && bug.elapsed>=.0825)onLand(bug);
      if (bug.elapsed >= .15) { bug.mode = 'flee'; bug.elapsed = 0; }
      continue;
    }
    if (bug.mode === 'flee') {
      bug.elapsed += dt;
      const t = Math.min(1, bug.elapsed / .60);
      const oldX=bug.x,oldY=bug.y,pos=fleePosition(bug,t);
      bug.x=pos.x;bug.y=pos.y;
      if(Math.hypot(bug.x-oldX,bug.y-oldY)>.0001)bug.angle=Math.atan2(bug.y-oldY,bug.x-oldX);
      if (t === 1) { bug.mode = 'roaming'; bug.turn = 0; bug.untilTurn = .8; bug.pauseLeft = 0; delete bug.escape; delete bug.origin; delete bug.escapeTurn; }
      continue;
    }
    if(bug.mode && bug.mode!=='roaming')continue;
    const profile=bug.motionProfile ??= createMotionProfile(bug.id,random);
    bug.motionTime=(bug.motionTime||0)+dt;
    if((bug.pauseLeft||0)>0){bug.pauseLeft=Math.max(0,bug.pauseLeft-dt);continue;}
    bug.untilTurn -= dt;
    if(bug.untilTurn<=0) {
      bug.turn=(random()-.5)*2*profile.turnStrength;
      bug.untilTurn=profile.turnInterval*(.65+random()*.7);
      if(random()<profile.pauseChance){bug.pauseLeft=profile.pauseDuration*(.6+random()*.8);continue;}
    }
    bug.angle += bug.turn*dt;
    const speed=pinSpeedMultiplier(pinnedCount)*profile.speed*(.85+.15*Math.sin(bug.motionTime*profile.paceFrequency+profile.phase));
    bug.x += Math.cos(bug.angle) * speed * dt; bug.y += Math.sin(bug.angle) * speed * dt;
    if (bug.x < MARGIN || bug.x > SIZE - MARGIN) { bug.x = Math.min(SIZE - MARGIN, Math.max(MARGIN, bug.x)); bug.angle = Math.PI - bug.angle; bug.turn = 0; }
    if (bug.y < MARGIN || bug.y > SIZE - MARGIN) { bug.y = Math.min(SIZE - MARGIN, Math.max(MARGIN, bug.y)); bug.angle = -bug.angle; bug.turn = 0; }
  }
}

// Two straight legs, one sharp turn. All three points remain inside the board.
export function createEscapeRoute(bug,random=Math.random) {
  const clamp=v=>Math.max(MARGIN,Math.min(SIZE-MARGIN,v));
  const origin={x:clamp(bug.x),y:clamp(bug.y)};
  const seed=random()*Math.PI*2, sign=random()<.5?-1:1;
  const turnAngle=sign*(1.55+random()*.45), desired=2.5+random()*.5;
  const leg=(p,a)=>{
    const dx=Math.cos(a),dy=Math.sin(a);
    const roomX=Math.abs(dx)<1e-8?Infinity:((dx>0?SIZE-MARGIN:MARGIN)-p.x)/dx;
    const roomY=Math.abs(dy)<1e-8?Infinity:((dy>0?SIZE-MARGIN:MARGIN)-p.y)/dy;
    const length=Math.max(0,Math.min(desired,roomX,roomY));
    return {point:{x:clamp(p.x+dx*length),y:clamp(p.y+dy*length)},length};
  };
  let best=null;
  for(let i=0;i<32;i++){
    const angle=seed+i*Math.PI*2/32,first=leg(origin,angle),second=leg(first.point,angle+turnAngle);
    const score=Math.min(first.length,second.length)*2+first.length+second.length;
    if(!best||score>best.score)best={score,origin,escapeTurn:first.point,escape:second.point};
  }
  return best;
}
export function fleePosition(bug,t) {
  const a=bug.origin,b=bug.escapeTurn,c=bug.escape;
  const first=Math.hypot(b.x-a.x,b.y-a.y),second=Math.hypot(c.x-b.x,c.y-b.y);
  const distance=Math.max(0,Math.min(1,t))*(first+second);
  const from=distance<=first?a:b,to=distance<=first?b:c;
  const fraction=distance<=first?distance/(first||1):(distance-first)/(second||1);
  return {x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction};
}
