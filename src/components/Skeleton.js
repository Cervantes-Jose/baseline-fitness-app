import React from 'react';

// Shared skeleton-loading primitives. Mirrors Sparkline.js's named-export style:
// one base block plus a few composed shapes that match the real components'
// dimensions. The base `Skeleton` is the only element carrying the `.skeleton`
// pulse animation (defined in App.css); composed pieces just arrange bases.
//
// Heights below are hardcoded to match the real components — keep them in sync:
//   - SkeletonListRow's 36px block mirrors Sparkline default height (Sparkline.js)
//   - SkeletonTimelineRow's 44px tile mirrors the FoodLog hour-row tile
//   - SkeletonChartCard's 120px block mirrors TrendCompareChart H=120

// Base pulsing block. width/height accept a number (→px) or string.
export function Skeleton({ width = '100%', height = 12, radius = 6, circle = false, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{
        background: 'var(--border)',
        width, height,
        borderRadius: circle ? '50%' : radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// A list/measurement card: short label bar + full-width sparkline-sized block.
export function SkeletonListRow() {
  return (
    <div className="card-flat">
      <Skeleton width="40%" height={14} />
      <Skeleton height={36} radius={8} style={{ marginTop: 8 }} />
    </div>
  );
}

// A chart card (e.g. PR total-volume): title bar + tall chart block.
export function SkeletonChartCard() {
  return (
    <div className="card">
      <Skeleton width="50%" height={14} />
      <Skeleton height={120} radius={8} style={{ marginTop: 12 }} />
    </div>
  );
}

// A routine tile: title + stat line + a couple of thin set-preview bars.
export function SkeletonRoutineTile() {
  return (
    <div className="card-flat">
      <Skeleton width="55%" height={16} />
      <Skeleton width="60%" height={11} style={{ marginTop: 10 }} />
      <Skeleton width="80%" height={10} style={{ marginTop: 10 }} />
      <Skeleton width="70%" height={10} style={{ marginTop: 6 }} />
    </div>
  );
}

// A FoodLog timeline row: dot + hour label + food tile.
export function SkeletonTimelineRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '3px 20px', gap: 8 }}>
      <div style={{ width: 16, flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Skeleton circle width={12} height={12} style={{ background: 'var(--border)' }} />
      </div>
      <Skeleton width={44} height={12} />
      <Skeleton height={44} radius={12} style={{ flex: 1 }} />
    </div>
  );
}

// A small uppercase section-label bar (e.g. PR category headers).
export function SkeletonSectionLabel() {
  return <Skeleton width={90} height={11} style={{ margin: '4px 0' }} />;
}
