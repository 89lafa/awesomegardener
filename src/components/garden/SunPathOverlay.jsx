import React from 'react';
import { Sun } from 'lucide-react';

export default function SunPathOverlay({ width, height, zoom, enabled, season = 'summer' }) {
  if (!enabled) return null;

  // Sun path calculations (simplified - varies by season and latitude)
  const pathData = {
    winter: { startY: 0.7, peakY: 0.5, arc: 0.2 },
    spring: { startY: 0.6, peakY: 0.35, arc: 0.35 },
    summer: { startY: 0.5, peakY: 0.2, arc: 0.5 },
    fall: { startY: 0.6, peakY: 0.35, arc: 0.35 }
  };

  const current = pathData[season] || pathData.summer;
  const sunPositions = [
    { x: 0.1, y: current.startY, label: '6am' },
    { x: 0.3, y: current.peakY + 0.1, label: '9am' },
    { x: 0.5, y: current.peakY, label: 'Noon' },
    { x: 0.7, y: current.peakY + 0.1, label: '3pm' },
    { x: 0.9, y: current.startY, label: '6pm' }
  ];

  const createArcPath = () => {
    const startX = 0.05 * width * zoom;
    const endX = 0.95 * width * zoom;
    const startY = current.startY * height * zoom;
    const endY = current.startY * height * zoom;
    const controlY = current.peakY * height * zoom;
    
    return `M ${startX},${startY} Q ${width * zoom / 2},${controlY} ${endX},${endY}`;
  };

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {/* Sun path arc */}
      <path
        d={createArcPath()}
        stroke="#fbbf24"
        strokeWidth="3"
        fill="none"
        strokeDasharray="8,8"
        opacity="0.7"
      />
      
      {/* Sun positions */}
      {sunPositions.map((pos, idx) => (
        <g key={idx}>
          <circle
            cx={pos.x * width * zoom}
            cy={pos.y * height * zoom}
            r="6"
            fill="#fbbf24"
            stroke="#fff"
            strokeWidth="2"
          />
          <text
            x={pos.x * width * zoom}
            y={pos.y * height * zoom - 15}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="11"
            fontWeight="bold"
            stroke="#fff"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {pos.label}
          </text>
        </g>
      ))}

      {/* Legend */}
      <g transform="translate(10, 10)">
        <rect x="0" y="0" width="140" height="60" fill="white" opacity="0.95" rx="4" />
        <Sun className="w-4 h-4" x="8" y="8" fill="#fbbf24" stroke="#fbbf24" />
        <text x="30" y="20" fontSize="12" fontWeight="bold" fill="#374151">Sun Path</text>
        <text x="10" y="38" fontSize="11" fill="#6b7280">{season.charAt(0).toUpperCase() + season.slice(1)} pattern</text>
        <text x="10" y="52" fontSize="10" fill="#9ca3af">☀️ Full sun: 6+ hrs</text>
      </g>
    </svg>
  );
}