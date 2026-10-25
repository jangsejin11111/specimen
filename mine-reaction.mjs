// 900ms surprise, 1100ms front gaze, 200ms eye closing, then 1s stillness.
export function mineReactionPhase(elapsed) {
  return elapsed<900?'surprised':elapsed<2000?'staring':elapsed<3200?'closed':'complete';
}
