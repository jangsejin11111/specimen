// Eyelids only: no changes to hints, pupil tracking, cells or labels.
export class ThresholdBlink {
  constructor() { this.above=new Set(); this.events=new Map(); }
  reset() { this.above.clear(); this.events.clear(); }
  update(now,faces,surrounded,size) {
    const eligible=new Set(surrounded.keys());
    for(const target of eligible) if(!this.above.has(target)) {
      this.events.set(target,{started:now,faces:faces.filter(f=>surrounded.get(target).cells.has(f.targetCell.row*size+f.targetCell.col))});
    }
    this.above=eligible;
    const closed=new Set();
    for(const [target,event] of this.events) {
      const age=now-event.started;
      if(!eligible.has(target)||age>=400) { this.events.delete(target); continue; }
      if(age<100||(age>=200&&age<300)) for(const face of event.faces)closed.add(face);
    }
    for(const face of faces)face.renderBlink?.(closed.has(face));
  }
}
