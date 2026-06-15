// Offline sync queue for finished workouts.
//
// When confirmFinishWorkout can't reach Supabase because the device is offline,
// the workout bundle (session + its exercises) is stashed in localStorage and
// replayed automatically once the connection returns. The user never sees any
// of this — no errors, no banners.
//
// Design notes:
// - The queue key is namespaced per user (`offlineWorkoutQueue_<uid>`) so it is
//   NOT cleared by App.js's PER_USER_KEYS sign-out cleanup. An unsynced workout
//   survives sign-out and syncs the next time that same user signs in.
// - Both the session id and each exercise id are generated client-side, so a
//   replay is idempotent: upsert(onConflict: 'id') can't create duplicates even
//   if a prior attempt partially landed before the network dropped.
// - Security: workout rows carry only user-owned, non-sensitive data and the
//   captured user_id. RLS (auth.uid() = user_id) still enforces ownership at
//   sync time, so a tampered local queue cannot write into another account.

import { supabase } from '../supabaseClient';

const keyFor = uid => `offlineWorkoutQueue_${uid}`;

// True when a Supabase failure is a lost connection (safe to retry later) rather
// than a real server rejection like RLS/validation (which would loop forever).
// navigator.onLine is authoritative; otherwise we sniff the fetch error text,
// which varies by browser ("Failed to fetch" / "Load failed" / "NetworkError").
export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  const msg = `${err.message || err.error_description || err.details || ''}`.toLowerCase();
  return msg.includes('failed to fetch')
    || msg.includes('load failed')
    || msg.includes('networkerror')
    || msg.includes('network request failed');
}

function readQueue(uid) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(uid, bundles) {
  try {
    if (bundles.length === 0) localStorage.removeItem(keyFor(uid));
    else localStorage.setItem(keyFor(uid), JSON.stringify(bundles));
  } catch {
    // localStorage unavailable/full — nothing we can do without surfacing it.
  }
}

// Append one finished-workout bundle: { session: <row>, exercises: [<row>...] }.
export function queueWorkoutSave(uid, bundle) {
  if (!uid || !bundle) return;
  const bundles = readQueue(uid);
  bundles.push(bundle);
  writeQueue(uid, bundles);
}

// Queued workouts reshaped to match loadHistory()'s item shape, so History can
// show them optimistically before they reach the server.
export function getQueuedHistoryItems(uid) {
  if (!uid) return [];
  return readQueue(uid).map(({ session, exercises }) => ({
    id: session.id,
    date: session.date,
    routineName: session.routine_name,
    exercises: (exercises || []).map(e => ({ name: e.exercise_name, sets: e.sets })),
  }));
}

// Drain the queue for uid, upserting each bundle. Removes a bundle on success;
// stops on the first still-offline error (leaving the rest queued); drops a
// bundle the server permanently rejects so it can't loop. Returns true if at
// least one bundle synced. Re-entrancy is guarded so overlapping triggers
// (mount + 'online' + auth change) don't double-replay.
let flushing = false;
export async function flushWorkoutQueue(uid) {
  if (!uid) {
    const { data: { session } } = await supabase.auth.getSession();
    uid = session?.user?.id;
  }
  if (!uid || flushing) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (readQueue(uid).length === 0) return false;

  flushing = true;
  let synced = false;
  try {
    // Re-read each iteration; the queue is the single source of truth.
    while (readQueue(uid).length > 0) {
      const bundles = readQueue(uid);
      const bundle = bundles[0];
      try {
        const { error: sErr } = await supabase
          .from('workout_sessions').upsert(bundle.session, { onConflict: 'id' });
        if (sErr) {
          if (isNetworkError(sErr)) break;        // still offline — stop, keep queued
          writeQueue(uid, bundles.slice(1)); continue;   // unrecoverable — drop it
        }
        if (bundle.exercises && bundle.exercises.length > 0) {
          const { error: eErr } = await supabase
            .from('session_exercises').upsert(bundle.exercises, { onConflict: 'id' });
          if (eErr && isNetworkError(eErr)) break;  // session saved; retry children later
          // A non-network child error drops through: the session is saved and we
          // remove the bundle rather than loop on a row the server keeps rejecting.
        }
        writeQueue(uid, bundles.slice(1));
        synced = true;
      } catch (err) {
        if (isNetworkError(err)) break;
        writeQueue(uid, bundles.slice(1));  // unrecoverable — drop it
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}
