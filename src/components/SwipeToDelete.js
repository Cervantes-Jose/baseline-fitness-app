import React, { useState, useRef } from 'react';

function SwipeToDelete({ children, onDelete, deleteLabel = 'Delete', style: containerStyle }) {
  const [translateX, setTranslateX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const baseX = useRef(0);
  const currentX = useRef(0);
  const direction = useRef(null); // null | 'h' | 'v'
  const snapped = useRef(false);
  const wasSwiped = useRef(false);

  const setX = (x) => {
    currentX.current = x;
    setTranslateX(x);
  };

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    direction.current = null;
    baseX.current = snapped.current ? -80 : 0;
    setAnimating(false);
  };

  const onPointerMove = (e) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (direction.current === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      direction.current = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      if (direction.current === 'v') {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
        startX.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      wasSwiped.current = true;
    }

    if (direction.current !== 'h') return;
    e.preventDefault();
    setX(Math.min(0, Math.max(-200, baseX.current + dx)));
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    setAnimating(true);

    const x = currentX.current;
    if (x < -160) {
      setX(0);
      snapped.current = false;
      onDelete();
    } else if (x < -80) {
      setX(-80);
      snapped.current = true;
    } else {
      setX(0);
      snapped.current = false;
    }
  };

  const onDeleteZoneTap = (e) => {
    e.stopPropagation();
    setAnimating(true);
    setX(0);
    snapped.current = false;
    onDelete();
  };

  return (
    <div style={{ position: 'relative', overflow: 'visible', borderRadius: '16px', ...containerStyle }}>
      {/* Red delete zone revealed behind sliding content */}
      <div
        onClick={onDeleteZoneTap}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px',
          background: '#EF4444', borderRadius: '0 16px 16px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ color: 'white', fontWeight: '700', fontSize: '14px', userSelect: 'none' }}>{deleteLabel}</span>
      </div>
      {/* Sliding content */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => { if (wasSwiped.current) { wasSwiped.current = false; e.stopPropagation(); } }}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: animating ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          touchAction: 'pan-y',
          position: 'relative',
          zIndex: 1,
          willChange: 'transform',
          background: 'var(--card)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeToDelete;
