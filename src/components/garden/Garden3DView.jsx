import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCcw, ZoomIn, ZoomOut, Tag, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PALETTES = {
  wood: {
    top: 'linear-gradient(135deg, #92400e, #78350f, #5b3a1a)',
    front: 'linear-gradient(180deg, #b45309, #92400e, #78350f)',
    back: 'linear-gradient(180deg, #92400e, #78350f, #5c2d0e)',
    left: 'linear-gradient(180deg, #a16207, #854d0e, #6b3a1f)',
    right: 'linear-gradient(180deg, #78350f, #5c2d0e, #451a03)',
    soil: 'linear-gradient(135deg, #5b3a1a, #3e2612, #2d1a0d)',
  },
  terracotta: {
    top: 'linear-gradient(135deg, #a0522d, #8b4513)',
    front: 'linear-gradient(180deg, #cd853f, #a0522d, #8b4513)',
    back: 'linear-gradient(180deg, #b8733d, #8b4513, #6b3410)',
    left: 'linear-gradient(180deg, #c2956a, #a0522d, #7a3b1e)',
    right: 'linear-gradient(180deg, #8b4513, #6b3410, #4a2409)',
    soil: 'linear-gradient(135deg, #6b3a1f, #4a2511)',
  },
  earth: {
    top: 'linear-gradient(135deg, #78350f, #5b3a1a)',
    front: 'linear-gradient(180deg, #92400e, #78350f)',
    back: 'linear-gradient(180deg, #78350f, #5c2d0e)',
    left: 'linear-gradient(180deg, #854d0e, #6b3a1f)',
    right: 'linear-gradient(180deg, #5c2d0e, #451a03)',
    soil: 'linear-gradient(135deg, #78350f, #5b3a1a)',
  },
  building: {
    top: 'linear-gradient(135deg, #6b7280, #4b5563)',
    front: 'linear-gradient(180deg, #9ca3af, #6b7280, #4b5563)',
    back: 'linear-gradient(180deg, #6b7280, #4b5563, #374151)',
    left: 'linear-gradient(180deg, #9ca3af, #6b7280)',
    right: 'linear-gradient(180deg, #4b5563, #374151)',
    soil: 'linear-gradient(135deg, #6b7280, #4b5563)',
  },
};

const STATUS_COLORS = {
  full: { border: '#16a34a', label: '#16a34a' },
  partial: { border: '#f59e0b', label: '#f59e0b' },
  empty: { border: '#9ca3af', label: '#6b7280' },
};

function calculateGroundSize(structures) {
  if (!structures || structures.length === 0) {
    return { width: 400, height: 300 };
  }

  let maxX = 0;
  let maxY = 0;

  structures.forEach(s => {
    const right = s.x + s.width;
    const bottom = s.y + s.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  const padX = Math.max(60, maxX * 0.15);
  const padY = Math.max(60, maxY * 0.15);

  return {
    width: Math.ceil(maxX + padX),
    height: Math.ceil(maxY + padY)
  };
}

export default function Garden3DView({ structures, plotLayout, plantingCounts }) {
  const [rotation, setRotation] = useState(-35);
  const [tilt, setTilt] = useState(58);
  const [zoom, setZoom] = useState(0.72);
  const [hovered, setHovered] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedStructure, setSelectedStructure] = useState(null);

  const resetCamera = () => {
    setRotation(-35);
    setTilt(58);
    setZoom(0.72);
  };

  const groundSize = calculateGroundSize(structures);

  return (
    <div style={{ position: 'relative', minHeight: 680, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #7dd3fc 0%, #bae6fd 30%, #e0f2fe 55%, #f0f9ff 100%)'
      }}>
        <div style={{ position: 'absolute', top: 20, right: 60, width: 80, height: 80, background: 'radial-gradient(circle, rgba(253,224,71,0.6), transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 36, right: 76, width: 48, height: 48, background: 'radial-gradient(circle, #fef08a, #fbbf24)', borderRadius: '50%', pointerEvents: 'none' }} />
      </div>

      <div 
        style={{
          position: 'relative',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: 680, padding: 40,
          perspective: 1600
        }}
        onClick={() => setSelectedStructure(null)}
      >
        <div style={{
          width: groundSize.width, height: groundSize.height,
          transformStyle: 'preserve-3d',
          transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(${rotation}deg)`,
          transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
            <Ground3D width={groundSize.width} height={groundSize.height} />
            {structures.map(structure => (
              <Structure3D
                key={structure.id}
                item={structure}
                plantingCount={plantingCounts?.[structure.id]}
                isHovered={hovered === structure.id}
                onEnter={() => setHovered(structure.id)}
                onLeave={() => setHovered(null)}
                showLabels={showLabels}
                onClick={(e, item) => {
                  e.stopPropagation();
                  setSelectedStructure(item);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <CameraControls3D
        rotation={rotation} setRotation={setRotation}
        tilt={tilt} setTilt={setTilt}
        zoom={zoom} setZoom={setZoom}
        resetCamera={resetCamera}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
      />
      <Legend3D />
      
      {selectedStructure && (
        <StructureDetailPanel 
          structure={selectedStructure} 
          plantingCount={plantingCounts?.[selectedStructure.id]}
          onClose={() => setSelectedStructure(null)}
        />
      )}
    </div>
  );
}

function Ground3D({ width, height }) {
  return (
    <div style={{
      position: 'absolute', 
      left: 0, top: 0,
      width, height,
      background: 'linear-gradient(135deg, #86efac 0%, #4ade80 20%, #22c55e 50%, #16a34a 80%, #15803d 100%)',
      borderRadius: 12,
      boxShadow: '0 30px 80px rgba(0,0,0,0.25)'
    }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.08, borderRadius: 12,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 39px, #064e3b 39px, #064e3b 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #064e3b 39px, #064e3b 40px)'
      }} />
    </div>
  );
}

function Structure3D({ item, plantingCount, isHovered, onEnter, onLeave, showLabels, onClick }) {
  const props = { item, plantingCount, isHovered, onEnter, onLeave, showLabels, onClick };

  switch (item.item_type) {
    case 'RAISED_BED':
      return <Cuboid3D {...props} height={30} palette="wood" />;
    case 'IN_GROUND_BED':
      return <Cuboid3D {...props} height={8} palette="earth" />;
    case 'CONTAINER':
      return <Cuboid3D {...props} height={42} palette="terracotta" />;
    case 'GREENHOUSE':
      return <GlassCube3D {...props} />;
    case 'GROW_BAG':
      return <Cylinder3D {...props} />;
    case 'TREE':
      return <Tree3D {...props} />;
    case 'PATH':
      return <Path3D {...props} />;
    case 'BUILDING':
    case 'SHED':
      return <Cuboid3D {...props} height={60} palette="building" />;
    case 'COMPOST':
      return <Cuboid3D {...props} height={28} palette="earth" />;
    case 'FENCE':
      return <Cuboid3D {...props} height={36} palette="wood" />;
    default:
      return <Cuboid3D {...props} height={20} palette="wood" />;
  }
}

function getStructureStatus(item, plantingCount) {
  if (!plantingCount) return 'empty';
  
  const { filled = 0, capacity = 0 } = plantingCount;
  if (capacity === 0) return 'empty';
  if (filled === 0) return 'empty';
  if (filled >= capacity) return 'full';
  return 'partial';
}

function Cuboid3D({ item, plantingCount, height, palette, isHovered, onEnter, onLeave, showLabels, onClick }) {
  const w = item.width;
  const d = item.height;
  const x = item.x;
  const y = item.y;
  const h = height;
  const pal = PALETTES[palette] || PALETTES.wood;
  const status = getStructureStatus(item, plantingCount);
  const sc = STATUS_COLORS[status];

  const isPlantable = ['RAISED_BED', 'IN_GROUND_BED', 'CONTAINER', 'GREENHOUSE', 'TREE'].includes(item.item_type);
  const nPlants = isPlantable && plantingCount?.filled > 0 ? Math.min(Math.floor(w / 22), 5) : 0;
  const isPlanted = nPlants > 0;

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={(e) => onClick && onClick(e, item)}
      style={{
        position: 'absolute',
        left: x, top: y, width: w, height: d,
        transformStyle: 'preserve-3d',
        cursor: 'pointer'
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 3,
        background: isPlanted ? pal.soil : pal.top,
        transform: `translateZ(${h}px)`,
        boxShadow: `inset 0 0 10px rgba(0,0,0,0.35), 0 0 0 1.5px ${sc.border}`
      }}>
        {isPlantable && isPlanted && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 3, opacity: 0.2,
            background: 'radial-gradient(circle at 25% 40%, #8b5e3c 1px, transparent 1px), radial-gradient(circle at 65% 25%, #6b4226 1px, transparent 1px)',
            backgroundSize: '14px 14px', pointerEvents: 'none'
          }} />
        )}
        {isPlanted && nPlants > 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexWrap: 'wrap', padding: 4 }}>
            {Array.from({ length: nPlants }).map((_, i) => (
              <span key={i} style={{ fontSize: w < 60 ? 11 : 15 }}>
                {['🌱','🥬','🌿','🍅','🫑'][i % 5]}
              </span>
            ))}
          </div>
        )}
        {showLabels && (
          <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>
            {item.label}
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: h,
        background: pal.front,
        transform: 'rotateX(90deg)', transformOrigin: 'bottom'
      }}>
        <WoodGrain count={Math.max(2, Math.floor(h / 10))} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: sc.border }} />
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: h,
        background: pal.back,
        transform: 'rotateX(-90deg)', transformOrigin: 'top'
      }}>
        <WoodGrain count={Math.max(2, Math.floor(h / 10))} />
      </div>

      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: h,
        background: pal.left,
        transform: 'rotateY(-90deg)', transformOrigin: 'left'
      }}>
        <WoodGrain count={Math.max(2, Math.floor(h / 10))} />
      </div>

      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: h,
        background: pal.right,
        transform: 'rotateY(90deg)', transformOrigin: 'right'
      }}>
        <WoodGrain count={Math.max(2, Math.floor(h / 10))} />
      </div>
    </div>
  );
}

function WoodGrain({ count }) {
  return (<>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{
        position: 'absolute', left: 0, right: 0,
        top: `${((i + 1) / (count + 1)) * 100}%`,
        height: 1, background: 'rgba(0,0,0,0.12)',
        pointerEvents: 'none'
      }} />
    ))}
  </>);
}

function Cylinder3D({ item, plantingCount, onEnter, onLeave, showLabels, onClick }) {
  const size = item.width;
  const r = size / 2;
  const h = 20;
  const x = item.x;
  const y = item.y;
  const N = 16;

  return (
    <div 
      onMouseEnter={onEnter} 
      onMouseLeave={onLeave}
      onClick={(e) => onClick && onClick(e, item)}
      style={{ position: 'absolute', left: x, top: y, width: size, height: size, transformStyle: 'preserve-3d', cursor: 'pointer' }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #5b3a1a, #2d1a0d)',
        transform: `translateZ(${h}px)`,
        boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 10 }}>🌱</span>
        {showLabels && (
          <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            {item.label}
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: '#111',
        transform: 'translateZ(0px)'
      }} />

      {Array.from({ length: N }).map((_, i) => {
        const angle = (i / N) * 360;
        const staveWidth = (2 * Math.PI * r / N) + 1.5;
        const lightness = 18 + Math.cos((angle - 45) * Math.PI / 180) * 10;
        return (
          <div key={i} style={{
            position: 'absolute', left: '50%', top: '50%',
            width: staveWidth, height: h,
            marginLeft: -staveWidth / 2, marginTop: -r,
            background: `linear-gradient(180deg, hsl(0,0%,${lightness + 4}%), hsl(0,0%,${lightness}%), hsl(0,0%,${lightness - 3}%))`,
            transform: `rotateY(${angle}deg) translateZ(${r}px) rotateX(90deg)`,
            transformOrigin: 'center top',
            backfaceVisibility: 'hidden'
          }} />
        );
      })}
    </div>
  );
}

function GlassCube3D({ item, plantingCount, onEnter, onLeave, showLabels, onClick }) {
  const x = item.x;
  const y = item.y;
  const w = item.width;
  const d = item.height;
  const h = 80;
  const status = getStructureStatus(item, plantingCount);
  const sc = STATUS_COLORS[status];
  const glassBorder = '2.5px solid rgba(16,185,129,0.55)';

  function PaneGrid({ cols = 4, rows = 3 }) {
    return (<>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <div key={`c${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i+1)/cols)*100}%`, width: 1, background: 'rgba(16,185,129,0.35)' }} />
      ))}
      {Array.from({ length: rows - 1 }).map((_, i) => (
        <div key={`r${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${((i+1)/rows)*100}%`, height: 1, background: 'rgba(16,185,129,0.3)' }} />
      ))}
    </>);
  }

  return (
    <div 
      onMouseEnter={onEnter} 
      onMouseLeave={onLeave}
      onClick={(e) => onClick && onClick(e, item)}
      style={{ position: 'absolute', left: x, top: y, width: w, height: d, transformStyle: 'preserve-3d', cursor: 'pointer' }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'rgba(52,211,153,0.2)', border: glassBorder, transform: `translateZ(${h}px)`, boxShadow: `inset 0 0 25px rgba(16,185,129,0.12), 0 0 0 1.5px ${sc.border}` }}>
        <PaneGrid cols={5} rows={4} />
        <div style={{ position: 'absolute', inset: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
          {Array.from({ length: 12 }).map((_, i) => <span key={i} style={{ fontSize: 10 }}>{['🌱','🍅','🫑','🌿','🥒','🌶'][i % 6]}</span>)}
        </div>
        {showLabels && (
          <div style={{ position: 'absolute', top: 3, left: 5, fontSize: 8, fontWeight: 700, color: '#065f46' }}>{item.label}</div>
        )}
      </div>

      <div style={{ position: 'absolute', inset: 0, borderRadius: 4, background: 'rgba(16,185,129,0.06)', transform: 'translateZ(1px)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: 'linear-gradient(180deg, rgba(52,211,153,0.15), rgba(16,185,129,0.25))', border: glassBorder, transform: 'rotateX(90deg)', transformOrigin: 'bottom' }}>
        <PaneGrid cols={5} rows={3} />
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '18%', height: '55%', border: '1.5px solid rgba(16,185,129,0.45)', borderBottom: 'none', borderRadius: '3px 3px 0 0' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: h, background: 'linear-gradient(180deg, rgba(5,150,105,0.12), rgba(4,120,87,0.2))', border: glassBorder, transform: 'rotateX(-90deg)', transformOrigin: 'top' }}>
        <PaneGrid cols={5} rows={3} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: h, background: 'linear-gradient(180deg, rgba(5,150,105,0.1), rgba(4,120,87,0.18))', border: glassBorder, transform: 'rotateY(-90deg)', transformOrigin: 'left' }}>
        <PaneGrid cols={3} rows={3} />
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: h, background: 'linear-gradient(180deg, rgba(5,150,105,0.08), rgba(4,120,87,0.15))', border: glassBorder, transform: 'rotateY(90deg)', transformOrigin: 'right' }}>
        <PaneGrid cols={3} rows={3} />
      </div>
    </div>
  );
}

function Tree3D({ item, onEnter, onLeave, onClick }) {
  const x = item.x;
  const y = item.y;
  const size = item.width;
  const trunkW = size * 0.22;
  const trunkH = size * 1.4;
  const canopySize = size * 1.3;

  return (
    <div 
      onMouseEnter={onEnter} 
      onMouseLeave={onLeave}
      onClick={(e) => onClick && onClick(e, item)}
      style={{ position: 'absolute', left: x, top: y, width: size, height: size, transformStyle: 'preserve-3d', cursor: 'pointer' }}
    >
      <div style={{
        position: 'absolute', left: '50%', bottom: 0,
        width: trunkW, height: trunkH,
        marginLeft: -trunkW / 2,
        background: 'linear-gradient(90deg, #a16207, #854d0e 30%, #713f12 60%, #422006)',
        transform: 'rotateX(-90deg)',
        transformOrigin: 'bottom center',
        borderRadius: '2px 2px 4px 4px',
        boxShadow: 'inset -3px 0 6px rgba(0,0,0,0.4)'
      }}>
        {[15, 30, 45, 60, 75, 88].map(p => (
          <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: `${p}%`, height: 1, background: 'rgba(0,0,0,0.2)' }} />
        ))}
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: canopySize, height: canopySize,
        marginLeft: -canopySize / 2, marginTop: -canopySize / 2,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 38%, #86efac, #4ade80 25%, #22c55e 50%, #16a34a 75%, #15803d)',
        transform: `translateZ(${trunkH - canopySize * 0.15}px)`,
        boxShadow: 'inset 0 6px 16px rgba(134,239,172,0.4), inset 0 -6px 16px rgba(21,128,61,0.3), 0 20px 50px rgba(0,0,0,0.3)'
      }}>
        <div style={{ position: 'absolute', top: '12%', left: '18%', width: '40%', height: '35%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(187,247,208,0.5), transparent 70%)' }} />
      </div>
    </div>
  );
}

function Path3D({ item }) {
  const x = item.x;
  const y = item.y;
  const w = item.width;
  const d = item.height;
  const stoneCount = Math.floor(d / 22);

  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: d, transform: 'translateZ(2px)' }}>
      {Array.from({ length: stoneCount }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 1, right: 1,
          top: i * 22 + 4, height: 16,
          background: 'linear-gradient(135deg, #d6d3d1, #a8a29e)',
          borderRadius: 3, opacity: 0.5
        }} />
      ))}
    </div>
  );
}

function CameraControls3D({ rotation, setRotation, tilt, setTilt, zoom, setZoom, resetCamera, showLabels, setShowLabels }) {
  const btnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: 'none',
    background: 'rgba(255,255,255,0.8)', color: '#374151',
    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    width: 34, height: 34
  };

  return (
    <>
      <button
        onClick={() => setShowLabels(!showLabels)}
        style={{
          position: 'absolute', top: 16, left: 16,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10,
          border: 'none',
          background: showLabels ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          color: showLabels ? '#047857' : '#6b7280',
          fontSize: 13, fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          transition: 'all 0.2s'
        }}
      >
        <Tag size={16} />
        <span>Labels {showLabels ? 'On' : 'Off'}</span>
      </button>

      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14, padding: '10px 12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(255,255,255,0.6)',
        display: 'flex', gap: 6, alignItems: 'center'
      }}>
        <button style={btnStyle} onClick={() => setZoom(Math.min(zoom + 0.08, 1.3))}>
          <ZoomIn size={15} />
        </button>
        <button style={btnStyle} onClick={() => setZoom(Math.max(zoom - 0.08, 0.45))}>
          <ZoomOut size={15} />
        </button>

        <div style={{ width: 1, height: 26, background: '#e5e7eb' }} />

        <button style={btnStyle} onClick={() => setRotation(rotation - 15)}>
          <ChevronLeft size={15} />
        </button>
        <button style={btnStyle} onClick={resetCamera}>
          <RotateCcw size={14} />
        </button>
        <button style={btnStyle} onClick={() => setRotation(rotation + 15)}>
          <ChevronRight size={15} />
        </button>

        <div style={{ width: 1, height: 26, background: '#e5e7eb' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button style={{ ...btnStyle, width: 30, height: 17 }} onClick={() => setTilt(Math.min(tilt + 5, 75))}>
            <ChevronUp size={13} />
          </button>
          <button style={{ ...btnStyle, width: 30, height: 17 }} onClick={() => setTilt(Math.max(tilt - 5, 35))}>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>
    </>
  );
}

function Legend3D() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      borderRadius: 14, padding: '14px 18px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      border: '1px solid rgba(255,255,255,0.6)'
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Plot Items</div>
      {[
        { color: '#92400e', round: false, label: 'Raised Bed' },
        { color: '#6b8e23', round: false, label: 'In-Ground' },
        { color: '#a0522d', round: false, label: 'Planter' },
        { color: '#1f2937', round: true, label: 'Grow Bag' },
        { color: 'rgba(16,185,129,0.4)', round: false, label: 'Greenhouse', border: '#10b981' },
        { color: '#22c55e', round: true, label: 'Tree' },
        { color: '#d6d3d1', round: false, label: 'Path' }
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i ? 6 : 0 }}>
          <div style={{
            width: item.round ? 14 : 22, height: item.round ? 14 : 12,
            borderRadius: item.round ? '50%' : 3,
            background: item.color,
            border: item.border ? `2px solid ${item.border}` : 'none'
          }} />
          <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 500 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function StructureDetailPanel({ structure, plantingCount, onClose }) {
  const status = getStructureStatus(structure, plantingCount);
  const isPlantable = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'CONTAINER', 'GROW_BAG', 'TREE'].includes(structure.item_type);

  const statusConfig = {
    full: { label: 'Full', color: '#16a34a', bg: '#f0fdf4' },
    partial: { label: 'Partial', color: '#f59e0b', bg: '#fffbeb' },
    empty: { label: 'Empty', color: '#6b7280', bg: '#f3f4f6' }
  };

  const st = statusConfig[status] || statusConfig.empty;

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      width: 280, maxHeight: 400, overflowY: 'auto',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      border: '1px solid rgba(229,231,235,0.8)',
      zIndex: 50
    }}>
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
            {structure.label}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {structure.item_type?.replace(/_/g, ' ')}
            {structure.width && structure.height ? ` • ${Math.round(structure.width / 12)}×${Math.round(structure.height / 12)} ft` : ''}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            width: 28, height: 28, borderRadius: 8,
            border: 'none', background: '#f3f4f6',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#6b7280', fontSize: 16
          }}
        >
          <X size={16} />
        </button>
      </div>

      {isPlantable && (
        <div style={{ padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              color: st.color, background: st.bg
            }}>
              {st.label}
            </span>
            {plantingCount && plantingCount.capacity > 0 && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {plantingCount.filled} / {plantingCount.capacity} filled
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '0 16px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          What's Planted
        </div>
        <PlantedItemsList structureId={structure.id} />
      </div>
    </div>
  );
}

function PlantedItemsList({ structureId }) {
  const [plantings, setPlantings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await base44.entities.PlantInstance.filter({ bed_id: structureId });
        
        const enriched = await Promise.all(
          data.map(async (p) => {
            try {
              const variety = p.variety_id ? await base44.entities.Variety.filter({ id: p.variety_id }).then(r => r[0]) : null;
              return {
                ...p,
                variety_name: variety?.variety_name || p.display_name || 'Unknown'
              };
            } catch {
              return { ...p, variety_name: p.display_name || 'Unknown' };
            }
          })
        );

        setPlantings(enriched);
      } catch (err) {
        console.error('Failed to load plantings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [structureId]);

  if (loading) {
    return <div style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>Loading...</div>;
  }

  if (plantings.length === 0) {
    return (
      <div style={{
        fontSize: 12, color: '#9ca3af',
        padding: '12px',
        background: '#f9fafb',
        borderRadius: 8,
        textAlign: 'center'
      }}>
        Nothing planted yet
      </div>
    );
  }

  const grouped = {};
  plantings.forEach(p => {
    const key = p.variety_name;
    if (!grouped[key]) {
      grouped[key] = { count: 0 };
    }
    grouped[key].count += 1;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Object.entries(grouped).map(([name, info]) => (
        <div key={name} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px',
          background: '#f9fafb',
          borderRadius: 8
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{name}</div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#10b981',
            background: '#f0fdf4',
            padding: '2px 8px', borderRadius: 12
          }}>
            ×{info.count}
          </div>
        </div>
      ))}
    </div>
  );
}