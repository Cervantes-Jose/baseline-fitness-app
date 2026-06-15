// Tiny wrapper around the Vibration API for tap feedback. A short ~12ms buzz is
// the default for selection-style taps. No-op on devices/browsers without
// vibration support (e.g. desktop, iOS Safari), so it's always safe to call.
export function tapHaptic(ms = 12) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
}
