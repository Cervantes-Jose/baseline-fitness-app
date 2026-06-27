import { useState, useEffect } from 'react';

// Returns true only once `active` has stayed true for `delay` ms. Used to gate
// skeleton screens: because screens remount (and refetch) on every tab switch,
// a naive skeleton would flash even on fast/cached loads. With this, fast loads
// (< delay) render nothing then the real content — no flash; slower loads show
// the skeleton.
export default function useDelayedFlag(active, delay = 150) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) { setShow(false); return; }
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return show;
}
