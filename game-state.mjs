import { createMotionProfile, createEscapeRoute } from './motion.mjs?v=dart1';
import { SIZE, BUG_COUNT } from './config.mjs?v=surround1';
import { LabelData } from './labels.mjs?v=tray1';
import { SpecimenPins } from './pinning.mjs?v=tray1';
export function adjacentCells(index) {
  const row = Math.floor(index / SIZE), col = index % SIZE, result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || row + dy < 0 || row + dy >= SIZE || col + dx < 0 || col + dx >= SIZE) continue;
    result.push({ index: (row + dy) * SIZE + col + dx, dx, dy });
  }
  return result;
}
const cellAddress = index => Object.freeze({ row: Math.floor(index / SIZE), col: index % SIZE });
export function hintsFor(index, hiddenBugCells, random=Math.random) {
  const hints=adjacentCells(index).filter(cell=>hiddenBugCells.has(cell.index)).map(({index:target,dx,dy})=>{
    // A diagonal truth has two honest cardinal projections. Choose once on opening.
    const horizontal=dx!==0 && (dy===0 || random()<.5);
    const x=horizontal?dx:0, y=horizontal?0:dy;
    return Object.freeze({sourceCell:cellAddress(index),targetCell:cellAddress(target),
      direction:x<0?'left':x>0?'right':y<0?'up':'down',dx:x,dy:y});
  });
  // Cluster order must not leak the original eight-neighbor scan order.
  for(let i=hints.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[hints[i],hints[j]]=[hints[j],hints[i]];}
  return hints;
}
export function countGazes(faceHints, openedCells) {
  const counts = new Map(Array.from({ length: SIZE * SIZE }, (_, i) => [i, 0]));
  for (const [source, hints] of faceHints) {
    if (!openedCells.has(source)) continue;
    // Each face contributes once, even if several faces share a source cell.
    for (const face of hints) {
      const { row, col } = face.targetCell;
      if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= SIZE || col >= SIZE) continue;
      const target = row * SIZE + col;
      if (!openedCells.has(target)) counts.set(target, counts.get(target) + 1);
    }
  }
  return counts;
}
// Eight-way connected components retain random placement. Only exterior safe cells
// can be observers; shared perimeter cells occur once in the boundary set.
export function bugClusters(hiddenBugCells) {
  const remaining=new Set(hiddenBugCells), clusters=new Map();
  while(remaining.size) {
    const first=remaining.values().next().value, cells=new Set([first]), queue=[first]; remaining.delete(first);
    for(let i=0;i<queue.length;i++)for(const {index} of adjacentCells(queue[i])) {
      if(remaining.delete(index)){cells.add(index);queue.push(index);}
    }
    const perimeter=new Set();
    for(const cell of cells)for(const {index} of adjacentCells(cell))if(!hiddenBugCells.has(index))perimeter.add(index);
    const key=Math.min(...cells);
    const targetCell={row:[...cells].reduce((a,i)=>a+Math.floor(i/SIZE),0)/cells.size,col:[...cells].reduce((a,i)=>a+i%SIZE,0)/cells.size};
    clusters.set(key,{cells,perimeter,targetCell});
  }
  return clusters;
}
export function surroundedClusters(hiddenBugCells,openedCells,faceHints) {
  return new Map([...bugClusters(hiddenBugCells)].filter(([,group])=>group.perimeter.size>0 && [...group.perimeter].every(source=>
    openedCells.has(source) && (faceHints.get(source)||[]).some(face=>
      face.sourceCell.row*SIZE+face.sourceCell.col===source && group.cells.has(face.targetCell.row*SIZE+face.targetCell.col)
    )
  )));
}
export class SpecimenState {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    const pool = Array.from({ length: SIZE * SIZE }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    this.hiddenBugCells = new Set(pool.slice(0, BUG_COUNT));
    this.hitMine = null;
    this.openedCells = new Set(); this.faceHints = new Map();
    this.gazeCountByCell = countGazes(this.faceHints, this.openedCells);
    this.draggingBug = null;
    this.specimenPins = new SpecimenPins(SIZE);
    this.pinnedSpecimens = this.specimenPins.items;
    const names = new LabelData(this.random);
    this.labels = Array.from({ length: SIZE * SIZE }, () => names.create());
    this.roamingBugs = Array.from({ length: BUG_COUNT }, (_, id) => ({ id, motionProfile:createMotionProfile(id,this.random), motionTime:0, pauseLeft:0, x: .3 + this.random() * (SIZE - .6), y: .3 + this.random() * (SIZE - .6), angle: this.random() * Math.PI * 2, turn: 0, untilTurn: .5 + this.random() * 2 }));
  }
  get surroundedGroups() { return surroundedClusters(this.hiddenBugCells,this.openedCells,this.faceHints); }
  isFullySurrounded(index) { return [...this.surroundedGroups.values()].some(group=>group.cells.has(index)); }
  canPin(index) {
    // Flag-like marking: only unopened cells, without mine or gaze checks.
    return this.hitMine===null && Number.isInteger(index) && index>=0 && index<SIZE*SIZE && !this.openedCells.has(index);
  }
  grab(id) {
    if(this.hitMine!==null||this.draggingBug)return false;
    const roamingIndex=this.roamingBugs.findIndex(bug=>bug.id===id);
    if(roamingIndex>=0)this.draggingBug=this.roamingBugs.splice(roamingIndex,1)[0];
    else {
      const entry=[...this.pinnedSpecimens].find(([,specimen])=>specimen.bug.id===id);
      if(!entry)return false;
      this.draggingBug=entry[1].bug;this.pinnedSpecimens.delete(entry[0]);
    }
    this.draggingBug.mode='grabbed';return true;
  }
  moveGrab(x, y) {
    if (!this.draggingBug) return;
    this.draggingBug.x = Math.max(.16, Math.min(SIZE - .16, x));
    this.draggingBug.y = Math.max(.16, Math.min(SIZE - .16, y));
  }
  drop(index = null) {
    const bug = this.draggingBug;
    if (!bug) return false;
    this.draggingBug = null;
    if (this.canPin(index)) {
      // Keep one body per cell. Replacing a marker releases the previous body.
      const previous=this.pinnedSpecimens.get(index);
      if(previous){this.pinnedSpecimens.delete(index);previous.bug.mode='roaming';this.roamingBugs.push(previous.bug);}
      this.specimenPins.place(index, bug);
      return true;
    }
    bug.mode = 'droppedInvalid'; bug.elapsed = 0;
    Object.assign(bug,createEscapeRoute(bug,this.random));
    bug.x=bug.origin.x;bug.y=bug.origin.y;
    bug.angle = Math.atan2(bug.escapeTurn.y-bug.y,bug.escapeTurn.x-bug.x);
    this.roamingBugs.push(bug);
    return false;
  }
  open(index) {
    if (!Number.isInteger(index) || index < 0 || index >= SIZE * SIZE || this.openedCells.has(index) || this.pinnedSpecimens.has(index)) return null;
    if (this.draggingBug) return null;
    if(this.hitMine!==null)return null;
    if(this.hiddenBugCells.has(index)) {
      this.hitMine=index;this.openedCells.add(index);
      return {type:'mine',index,openedIndices:[index]};
    }
    // Iterative flood fill avoids recursive stack growth and never traverses mines/marks.
    const pending=[index], queued=new Set([index]), openedIndices=[];
    for(let cursor=0;cursor<pending.length;cursor++) {
      const cell=pending[cursor];
      if(this.openedCells.has(cell)||this.hiddenBugCells.has(cell)||this.pinnedSpecimens.has(cell))continue;
      const hints=hintsFor(cell,this.hiddenBugCells,this.random);
      this.openedCells.add(cell);this.faceHints.set(cell,hints);openedIndices.push(cell);
      if(hints.length===0)for(const neighbor of adjacentCells(cell)) {
        if(!queued.has(neighbor.index)){queued.add(neighbor.index);pending.push(neighbor.index);}
      }
    }
    this.gazeCountByCell = countGazes(this.faceHints, this.openedCells);
    return { type:'safe', index, hints:this.faceHints.get(index), openedIndices };
  }
}
