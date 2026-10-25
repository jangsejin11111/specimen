export const CLEAR_HOLD_MS=2000;
export function isCleared(state) {
  return state.hitMine===null && !state.draggingBug && state.roamingBugs.length===0 &&
    state.hiddenBugCells.size===8 && state.pinnedSpecimens.size===8 &&
    [...state.hiddenBugCells].every(cell=>state.pinnedSpecimens.get(cell)?.stage==='pinned');
}
export function gazeDirection(origin,target) {
  const dx=target.x-origin.x,dy=target.y-origin.y,length=Math.max(Math.abs(dx),Math.abs(dy),.001);
  return {x:dx/length,y:dy/length};
}
export const EXPRESSIONS=['smile'];
