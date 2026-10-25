export const PIN_TIMING = { pause: .25, insert: .11 };
export function specimenPosition(index, size) { return { x: index % size + .5, y: Math.floor(index / size) + .4 }; }
export class SpecimenPins {
  constructor(size) { this.size = size; this.items = new Map(); }
  place(index, bug) {
    if (this.items.has(index)) return false;
    Object.assign(bug, specimenPosition(index, this.size), { angle: -Math.PI / 2, mode: 'pinned' });
    this.items.set(index, { bug, stage: 'settling', elapsed: 0 });
    return true;
  }
  advance(dt) {
    const impacts = [];
    for (const [index, pin] of this.items) {
      if (pin.stage === 'pinned') continue;
      pin.elapsed += Math.max(0, Math.min(.05, dt));
      if (pin.stage === 'settling' && pin.elapsed >= PIN_TIMING.pause) {
        pin.stage = 'inserting'; pin.elapsed -= PIN_TIMING.pause;
      }
      if (pin.stage === 'inserting' && pin.elapsed >= PIN_TIMING.insert) {
        pin.stage = 'pinned'; pin.elapsed = 0; impacts.push(index);
      }
    }
    return impacts;
  }
}
