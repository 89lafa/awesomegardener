import React from 'react';

// Simplified sun path overlay. Shows arc + time markers across the garden.
// Pass garden.sun_orientation (e.g. 'south', 'north', 'east', 'west') 
// and a season string to adjust the arc.
export default function SunPathOverlay({ width, height, zoom, enabled, season = 'summer', sunOrientation = 'south' }) {
  if (!enabled) return null;

  // Adjust arc height by season
  const arcHeight = {
    winter: 0.45,
    spring: 0.35,
    summer: 0.22,
    fall: 0.35
  }[season] || 0.28;

  // Sun enters from east side (right when facing south) and sets in west (left).
  // If garden faces north, sun arc appears LOW / barely visible.
  const orientationNote = {
    south: 'Facing South — Great sun all day',
    north: 'Facing North — Low / limited sun',
    east: 'Facing East — Morning sun, afternoon shade',
    west: 'Facing West — Afternoon sun, morning shade',
  }[sunOrientation] || 'Sun Path';

  const W = width * zoom;
  const H = height * zoom;

  // Arc: starts at left (6am/sunrise), peaks in middle (noon), ends right (sunset)
  const startX = W * 0.05;
  const endX   = W * 0.95;
  const startY = H * 0.65;
  const endY   = H * 0.65;
  const peakY  = H * arcHeight;

  const arcPath = `M ${startX},${startY} Q ${W / 2},${peakY} ${endX},${endY}`;

  const sunPoints = [
    { t: 0.05, label: 'Sunrise' },
    { t: 0.30, label: '9am' },
    { t: 0.50, label: 'Noon' },
    { t: 0.70, label: '3pm' },
    { t: 0.95, label: 'Sunset' },
  ].map(({ t, label }) => {
    // Quadratic bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
    const mt = 1 - t;
    const cx = mt * mt * startX + 2 * mt * t * (W / 2) + t * t * endX;
    const cy = mt * mt * startY + 2 * mt * t * peakY + t * t * endY;
    return { x: cx, y: cy, label };
  });

  // Intensity zones: shade overlay strips at top (noon = brightest, bottom = shade)
  const zoneColors = [
    { y: 0, h: H * 0.35, color: 'rgba(253,224,71,0.13)', label: 'Full Sun Zone' },
    { y: H * 0.35, h: H * 0.2, color: 'rgba(253,224,71,0.06)', label: 'Partial Sun' },
  ];

  // Compass arrows
  const compass = { N: { x: W * 0.5, y: 12 }, S: { x: W * 0.5, y: H - 12 }, E: { x: W - 14, y: H * 0.5 }, W: { x: 14, y: H * 0.5 } };

  return (
    <svg className="absolute inset-0 pointer-events-none" width={W} height={H} style={{ zIndex: 50 }}>
      {/* Sun intensity zones */}
      {zoneColors.map((z, i) => (
        <rect key={i} x={0} y={z.y} width={W} height={z.h} fill={z.color} />
      ))}

      {/* Arc path */}
      <path d={arcPath} stroke="#f59e0b" strokeWidth={3} fill="none" strokeDasharray="10,6" opacity={0.85} />

      {/* Glowing arc shadow */}
      <path d={arcPath} stroke="#fbbf24" strokeWidth={8} fill="none" opacity={0.15} />

      {/* Sun position dots + labels */}
      {sunPoints.map((pt, i) => (
        <g key={i}>
          {/* Glow ring */}
          <circle cx={pt.x} cy={pt.y} r={i === 2 ? 14 : 9} fill="#fef08a" opacity={i === 2 ? 0.25 : 0.12} />
          <circle cx={pt.x} cy={pt.y} r={i === 2 ? 8 : 5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
          <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize={i === 2 ? 11 : 9} fontWeight="bold"
            fill="#92400e" stroke="white" strokeWidth={3} paintOrder="stroke">
            {pt.label}
          </text>
        </g>
      ))}

      {/* Compass labels */}
      {Object.entries(compass).map(([dir, pos]) => (
        <text key={dir} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={12} fontWeight="bold" fill="#6b7280" opacity={0.7}>
          {dir}
        </text>
      ))}

      {/* Info legend box */}
      <g transform="translate(10,10)">
        <rect x={0} y={0} width={195} height={58} fill="white" opacity={0.93} rx={6} />
        <text x={10} y={20} fontSize={12} fontWeight="bold" fill="#374151">Sun Path</text>
        <text x={10} y={36} fontSize={10} fill="#6b7280">
          {season.charAt(0).toUpperCase() + season.slice(1)} — {orientationNote.split('—')[0].trim()}
        </text>
        <text x={10} y={50} fontSize={10} fill="#9ca3af">Top = most sun intensity</text>
      </g>
    </svg>
  );
}