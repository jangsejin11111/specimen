import { isCleared, gazeDirection, EXPRESSIONS, CLEAR_HOLD_MS } from './clear-state.mjs?v=smile1';
import { mineReactionPhase } from './mine-reaction.mjs?v=feel1';
import { EndingSequence, endingPosition, restoreEndingFaces, endingRoute } from './ending.mjs?v=wide1';
import { SIZE, BUG_COUNT } from './config.mjs?v=tray1';
import { SpecimenState } from './game-state.mjs?v=dart1';
import { advanceBugs } from './motion.mjs?v=speed1';
import { PIN_TIMING } from './pinning.mjs?v=tray1';
import { SpecimenAudio } from './sound.mjs?v=feel1';
import { followHeld, captureScale, livingTwitch } from './capture-feel.mjs?v=tray1';
import { makeBugArt } from './bug-art.mjs?v=tray1';
import { CollectiveGaze } from './collective-gaze.mjs?v=surround1';
const gazes = new CollectiveGaze();
const sound = new SpecimenAudio();
let nextFriction = 0;
let heldView = null;
const impactFrames = new Set();
const state = new SpecimenState();
const ending = new EndingSequence(BUG_COUNT);
const AUTO_ENDING = false; // Free marking has no automatic success/failure judgment.
const progress = document.getElementById("progress"), completion = document.getElementById("completion");
let escapeView = null;
let mineReaction=null, clearReaction=null;


const endingLight = document.getElementById('ending-light');
function lightAt(point) {
  endingLight.classList.add('dimmed');
  endingLight.classList.toggle('spotlight',!!point);
  if(point) {
    endingLight.style.setProperty('--spot-x',`${point.x}px`);
    endingLight.style.setProperty('--spot-y',`${point.y}px`);
    endingLight.style.setProperty('--spot-radius',`${board.clientWidth/SIZE*1.5}px`);
  }
}
const board = document.getElementById('board'), insects = document.getElementById('insects');
let focusIndex = 0, lastTime = performance.now(), activePointer = null;
const bugNodes = new Map(), pinNodes = new Map();
function directionText({ dx, dy }) { return `${dy < 0 ? '위' : dy > 0 ? '아래' : ''}${dx < 0 ? '왼쪽' : dx > 0 ? '오른쪽' : ''}`; }
function makeFace(hint) {
  const { dx, dy } = hint;
  const face = document.createElement('span'); face.className = 'face'; face.setAttribute('aria-hidden', 'true');
  face.style.setProperty('--dx', `${dx * 65}%`); face.style.setProperty('--dy', `${dy * 55}%`);
  for (let i = 0; i < 2; i++) { const eye = document.createElement('span'); eye.className = 'eye'; const pupil = document.createElement('span'); pupil.className = 'pupil'; eye.append(pupil); face.append(eye); }
  const mouth = document.createElement('span'); mouth.className = 'mouth'; face.append(mouth);
  const gazeFace = gazes.add(hint, direction => { face.style.setProperty('--dx', `${direction.x * 65}%`); face.style.setProperty('--dy', `${direction.y * 55}%`); }, () => {
    const f=face.getBoundingClientRect(), b=board.getBoundingClientRect();
    return {x:(f.left+f.width/2-b.left)/b.width*SIZE,y:(f.top+f.height/2-b.top)/b.height*SIZE};
  });

  return face;
}
function drawCell(index) {
  const button = board.children[index], opened = state.openedCells.has(index);
  gazes.faces=gazes.faces.filter(f=>f.sourceCell.row*SIZE+f.sourceCell.col!==index);
  pinNodes.delete(index);
  button.replaceChildren(); button.className = 'cell' + (opened ? ' opened' : '');
  let description;
  if(state.hitMine===index) {
    const mark=document.createElement('span');mark.className='revealed-mine';mark.setAttribute('aria-hidden','true');button.append(mark);description='열린 벌레 자리';
  } else if (!opened) {
    const label = document.createElement('span'); label.className = 'paper'; label.textContent = state.labels[index].name; button.append(label); description = state.labels[index].name;
  } else {
    const hints = state.faceHints.get(index), cluster = document.createElement('span'); cluster.className = 'faces';
    cluster.dataset.count=String(hints.length);
    cluster.style.setProperty('--face-rows', Math.ceil(hints.length / (hints.length<=1?1:hints.length<=4?2:3)));
    cluster.dataset.density = hints.length <= 1 ? 'single' : hints.length <= 4 ? 'medium' : 'many';
    for (const hint of hints) cluster.append(makeFace(hint));
    button.append(cluster); description = hints.length ? `시선: ${hints.map(directionText).join(', ')}` : '열린 빈 칸';
  }
  if(state.pinnedSpecimens.has(index)) {
    const pin=document.createElement('span');pin.className='specimen-pin';pin.setAttribute('aria-hidden','true');
    button.append(pin);pinNodes.set(index,pin);description+=', 고정 표본';
  }
  button.setAttribute('aria-label', `${Math.floor(index / SIZE) + 1}행 ${index % SIZE + 1}열, ${description}`);
}
function choose(index) {
  if (ending.active || mineReaction || clearReaction) return;
  const result = state.open(index); if (!result) return;
  for(const cell of result.openedIndices)drawCell(cell);
  if(result.type==='mine')startMineReaction(index);

}
let hoverTarget = null, capturedNode = null;
function point(event) {
  const rect = board.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * SIZE, y: (event.clientY - rect.top) / rect.height * SIZE };
}
function dropTarget({ x, y }) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
  const col = Math.floor(x), row = Math.floor(y), index = row * SIZE + col;
  return state.canPin(index) ? index : null;
}
function highlight(index) { hoverTarget = index; }
function grab(event, bug) {
  const previous=[...state.pinnedSpecimens].find(([,s])=>s.bug.id===bug.id)?.[0];
  if (clearReaction || mineReaction || ending.active || event.button !== 0 || !state.grab(bug.id)) return;
  event.preventDefault(); event.stopPropagation();
  if(previous!==undefined){impactFrames.delete(previous);drawCell(previous);}
  activePointer = event.pointerId; capturedNode = event.currentTarget;
  capturedNode.setPointerCapture(activePointer);
  board.classList.add('gripping'); insects.classList.add('gripping');
  state.moveGrab(point(event).x, point(event).y);
  nextFriction = performance.now() + 180;
  heldView = { x: bug.x * board.clientWidth / SIZE, y: bug.y * board.clientHeight / SIZE, since: performance.now(), last: performance.now() };
  sound.unlock().then(() => { if (state.draggingBug === bug) { sound.click(); sound.rustle(); } });
  drawBugs();
}
function move(event) {
  if (activePointer !== event.pointerId || !state.draggingBug) return;
  event.preventDefault(); event.stopPropagation();
  const pos = point(event); state.moveGrab(pos.x, pos.y); highlight(dropTarget(pos)); drawBugs();
}
function finish(event, cancelled = false) {
  if (activePointer === null || (event && event.pointerId !== activePointer)) return;
  event?.preventDefault(); event?.stopPropagation();
  const pos = event ? point(event) : null;
  if (pos) state.moveGrab(pos.x, pos.y);
  const index = !cancelled && pos ? dropTarget(pos) : null;
  const pinned = state.drop(index);
  heldView = null;
  const pointer = activePointer, node = capturedNode;
  activePointer = null; capturedNode = null;
  if (node?.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
  highlight(null); board.classList.remove('gripping'); insects.classList.remove('gripping');
  sound.stop();
  if (pinned) { drawCell(index); }
  drawBugs();
}
window.addEventListener('pointermove', move, { passive: false });
window.addEventListener('pointerup', event => finish(event));
window.addEventListener('pointercancel', event => finish(event, true));
window.addEventListener('blur', () => finish(null, true));
board.parentElement.addEventListener('contextmenu', event => event.preventDefault());
function build() {
  finish(null, true); sound.stop(); heldView = null; gazes.reset(); impactFrames.clear(); bugNodes.clear(); pinNodes.clear(); activePointer = null; board.classList.remove('gripping'); board.replaceChildren(); insects.replaceChildren(); focusIndex = 0;
  board.style.setProperty('--size', SIZE);
  state.labels.forEach((_, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener('click', () => choose(index));

    button.addEventListener('focus', () => { board.children[focusIndex].tabIndex = -1; focusIndex = index; button.tabIndex = 0; });
    button.addEventListener('keydown', event => {
      if (ending.active) return;
      const row = Math.floor(index / SIZE), col = index % SIZE;
      let next;
      if (event.key === 'ArrowLeft') next = row * SIZE + Math.max(0, col - 1);
      else if (event.key === 'ArrowRight') next = row * SIZE + Math.min(SIZE - 1, col + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * SIZE + col;
      else if (event.key === 'ArrowDown') next = Math.min(SIZE - 1, row + 1) * SIZE + col;
      else return;
      event.preventDefault(); board.children[next].focus();
    });
    board.append(button); drawCell(index);
  });
  for (const bug of state.roamingBugs) { const node = makeBugArt();
    node.addEventListener('pointerdown', event => grab(event, bug));
    node.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
    node.addEventListener('dragstart', event => event.preventDefault());
    node.addEventListener('lostpointercapture', event => finish(event, true));
    insects.append(node); bugNodes.set(bug.id, node); }
  drawBugs();
}
function drawBugs() {
  const now = performance.now();
  const position = (bug, jitter = 0, ox = 0, oy = 0, scale = 1) => {
    const node = bugNodes.get(bug.id); node.style.left = `${bug.x / SIZE * 100}%`; node.style.top = `${bug.y / SIZE * 100}%`;
    node.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) rotate(${bug.angle * 180 / Math.PI + 90 + jitter}deg) scale(${scale})`;
  };
  for (const bug of state.roamingBugs) {
    bugNodes.get(bug.id).className='bug roaming'+(bug.mode==='flee'?' fleeing':'');
    const t=bug.mode==='droppedInvalid'?Math.min(1,bug.elapsed/.15):1;
    const fall=t<.55?-7*(1-(t/.55)**2):0;
    const squash=t>=.55&&t<1?1-.10*Math.sin((t-.55)/.45*Math.PI):1;
    position(bug,0,0,fall,squash);
  }
  if (state.draggingBug) {
    bugNodes.get(state.draggingBug.id).className = 'bug grabbed';
    const bug = state.draggingBug, view = heldView;
    const offset = view ? followHeld(view, bug.x * board.clientWidth / SIZE, bug.y * board.clientHeight / SIZE, (now - view.last) / 1000) : {x:0,y:0};
    if (view) view.last = now;
    position(bug, livingTwitch(now, hoverTarget !== null) - offset.x * .4, offset.x + Math.sin(now / 29) * 1.4, offset.y - 2 + Math.sin(now / 43) * .6, captureScale(now - (view?.since ?? now)));
  }
  for (const [index, specimen] of state.pinnedSpecimens) {
    bugNodes.get(specimen.bug.id).className = 'bug pinned movable' + (specimen.stage === 'pinned' ? '' : ' settling');
    const t = Math.min(1, specimen.elapsed / PIN_TIMING.insert);
    const impact = impactFrames.has(index), alive = specimen.stage !== 'pinned';
    position(specimen.bug, impact ? -9 : alive ? livingTwitch(now, true) : 0, impact ? 3 : 0, impact ? 1 : 0);
    board.children[index].classList.toggle('specimen-complete', !alive);
    if (impact) impactFrames.delete(index);
    const node = pinNodes.get(index); if (!node) continue;
    node.dataset.stage = specimen.stage;
    const offset = specimen.stage === 'settling' ? -45 : specimen.stage === 'inserting' ? -45 * (1 - t * t) : 0;
    node.style.transform = `translateY(${offset}px)`;
    node.style.opacity = specimen.stage === 'settling' ? 0 : 1;
  }
}
function tick(now) {
  const dt = (now - lastTime) / 1000; lastTime = now;
  if(clearReaction){if(now-clearReaction.started>=CLEAR_HOLD_MS)showCompletion("게임 완료");requestAnimationFrame(tick);return;}
  if(mineReaction){renderMineReaction(now);requestAnimationFrame(tick);return;}
  if (ending.active) { ending.advance(dt); renderEnding(); requestAnimationFrame(tick); return; }
  advanceBugs(state.roamingBugs, dt, state.random, () => sound.land(), [...state.pinnedSpecimens.values()].filter(s=>s.stage==='pinned').length);
  if (state.draggingBug && now >= nextFriction) { sound.friction(); nextFriction = now + 170 + 110 * (1 + Math.sin(now / 233)); }
  for (const index of state.specimenPins.advance(dt)) {
    impactFrames.add(index); sound.stop(); sound.tap();
    board.children[index].animate([{translate:'0 0'},{translate:'1px -1px'},{translate:'0 0'}],{duration:65,easing:'steps(2,end)'});
  }
  updateHeldGaze(dt);
  drawBugs();
  progress.textContent = `${ending.count(state)} / ${BUG_COUNT}`;
  if(isCleared(state)) {
    clearReaction={started:now};
    board.inert=true;document.getElementById('restart').disabled=true;
    document.body.classList.add('game-stopped');
    board.querySelectorAll('.face').forEach(face=>{face.dataset.expression=EXPRESSIONS[0];});
  }
  requestAnimationFrame(tick);
}
function startMineReaction(index) {
  const row=Math.floor(index/SIZE),col=index%SIZE,faces=[];
  for(let y=Math.max(0,row-1);y<=Math.min(SIZE-1,row+1);y++)for(let x=Math.max(0,col-1);x<=Math.min(SIZE-1,col+1);x++) {
    if(y===row&&x===col)continue;
    faces.push(...board.children[y*SIZE+x].querySelectorAll('.face'));
  }
  mineReaction={started:performance.now(),faces,immediate:state.openedCells.size===1};
  sound.stop();board.inert=true;document.getElementById('restart').disabled=true;
  document.body.classList.add('game-stopped');renderMineReaction(performance.now());
}
function renderMineReaction(now) {
  const phase=mineReaction.immediate?'complete':mineReactionPhase(now-mineReaction.started);
  for(const face of mineReaction.faces) {
    face.dataset.reaction=phase==='complete'?'closed':phase;
    if(phase!=='surprised'){face.style.setProperty('--dx','0%');face.style.setProperty('--dy','0%');}
  }
  if(phase==='complete')showCompletion('게임 종료');
}
function showCompletion(label) {
  if(completion.open)return;
  completion.querySelector('p').textContent=`${ending.count(state)} / ${BUG_COUNT}`;
  completion.setAttribute('aria-label',label);completion.showModal();
  document.getElementById('completion-restart').focus();
}
function updateHeldGaze(dt) {
  const target=state.draggingBug;
  const mix=1-Math.exp(-Math.min(.05,Math.max(0,dt))/(target?.045:.07));
  for(const face of gazes.faces) {
    const aim=target?gazeDirection(face.getOrigin(),target):face.normalDirection;
    face.currentDirection={x:face.currentDirection.x+(aim.x-face.currentDirection.x)*mix,y:face.currentDirection.y+(aim.y-face.currentDirection.y)*mix};
    face.render(face.currentDirection);
  }
}

function aimEndingFaces(point) {
  const b=board.getBoundingClientRect();
  const target={x:(point.x-b.left)/b.width*SIZE,y:(point.y-b.top)/b.height*SIZE};
  for(const face of gazes.faces) {
    const origin=face.getOrigin(); const dx=target.x-origin.x,dy=target.y-origin.y;
    const length=Math.max(Math.abs(dx),Math.abs(dy),.001);
    face.phase='trackingEndingBug';
    face.currentDirection={x:dx/length,y:dy/length};
    face.render(face.currentDirection);
  }
}
function renderEnding() {
  const node=bugNodes.get(ending.bug.id), phase=ending.phase, t=ending.elapsed;
  if(phase==='still') return;
  if(phase==='twitch') {
    const r=node.getBoundingClientRect(); lightAt({x:r.left+r.width/2,y:r.top+r.height/2});
    node.className='bug pinned'+(t<.3?' waking-subtle':t>.65?' waking':'');
    return;
  }
  if(!escapeView) {
    const r=node.getBoundingClientRect(), paper=board.children[ending.index].querySelector('.paper').getBoundingClientRect();
    const start={x:r.left+r.width/2,y:r.top+r.height/2};
    const label={x:paper.left+paper.width/2,y:paper.bottom+3};
    const route=endingRoute(label,board.getBoundingClientRect(),innerWidth,r.width);
    const exit=route.at(-1);
    escapeView={start,label,exit,route,nextGazeAt:0};
    state.pinnedSpecimens.delete(ending.index);
    ending.bug.mode='endingEscape';
    document.body.append(node);
    node.style.width=`${r.width}px`; node.style.position='fixed'; node.style.zIndex='20';
    board.children[ending.index].setAttribute('aria-label',state.labels[ending.index].name+', 핀과 빈 자리');
  }
  if(phase==='empty'||phase==='complete') {
    lightAt(null);
    node.hidden=true; node.style.display='none'; ending.bug.mode='departed';
    restoreEndingFaces(gazes.faces,phase==='complete'?.15:t);
    if(phase==='complete')showCompletion('게임 완료');
    return;
  }
  const pos=endingPosition(phase,t,escapeView.start,escapeView.label,escapeView.exit,escapeView.route);
  const next=endingPosition(phase,t+.001,escapeView.start,escapeView.label,escapeView.exit,escapeView.route);
  const angle=Math.atan2(next.y-pos.y,next.x-pos.x)*180/Math.PI+90;
  node.className='bug escaping'; node.style.left=`${pos.x}px`;node.style.top=`${pos.y}px`;
  node.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;
  lightAt(pos);
  const now=performance.now();
  if(now>=escapeView.nextGazeAt) {
    aimEndingFaces(pos); escapeView.nextGazeAt=now+100;
  }
}
function restart() {
  mineReaction=null;clearReaction=null;document.body.classList.remove("game-stopped");
  completion.querySelector("p").textContent=`${BUG_COUNT} / ${BUG_COUNT}`;
  endingLight.className=""; endingLight.removeAttribute("style");
  finish(null,true); if(ending.bug) bugNodes.get(ending.bug.id)?.remove();
  completion.close(); ending.reset(); escapeView=null; state.reset(); board.inert=false;
  document.getElementById('restart').disabled=false; progress.textContent=`0 / ${BUG_COUNT}`;
  lastTime=performance.now(); build();
}
document.getElementById('restart').addEventListener('click',()=>{if(!ending.active)restart();});
document.getElementById('completion-restart').addEventListener('click',restart);
completion.addEventListener('cancel',event=>event.preventDefault());
build(); requestAnimationFrame(tick);
