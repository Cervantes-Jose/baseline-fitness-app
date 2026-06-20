// Tiny wrapper around the Vibration API for tap feedback. A short ~12ms buzz is
// the default for selection-style taps. No-op on devices/browsers without
// vibration support (e.g. desktop, iOS Safari), so it's always safe to call.
export function tapHaptic(ms = 12) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
}

// Celebratory triple buzz for finishing a workout — three ~220ms pulses with
// short gaps, so it reads as "buzz-buzz-buzz" (not too fast, not too slow).
// No-op where vibration is unsupported, same as tapHaptic.
export function celebrateHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([220, 160, 220, 160, 220]);
}
