import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Box, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Maximize2, 
  Droplets, 
  Sun, 
  Thermometer 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function Tray3D({ tray, position, showLabel, trayCells }) {
  const activeCells = trayCells.filter(c => 
    c.status === 'seeded' || c.status === 'germinated' || c.status === 'growing'
  );
  const isSeeded = activeCells.length > 0;

  return (
    <div
      className="absolute cursor-pointer transition-all hover:scale-105 group"
      style={{
        left: `${position.x}px`,
        top: `${position.z}px`,
        transform: 'translateZ(5px)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Tray container */}
      <div
        className="relative rounded-lg shadow-xl"
        style={{
          width: '90px',
          height: '70px',
          background: isSeeded
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          border: '2px solid',
          borderColor: isSeeded ? '#047857' : '#374151',
          boxShadow: isSeeded
            ? '0 10px 25px rgba(16, 185, 129, 0.4)'
            : '0 10px 25px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Cells/grid pattern */}
        <div className="absolute inset-0 opacity-30 p-1">
          <div className="grid grid-cols-6 grid-rows-6 gap-0.5 h-full">
            {Array.from({ length: Math.min(tray.total_cells || 72, 36) }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-sm"
                style={{ width: '100%', height: '100%' }}
              />
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-2xl opacity-80">
            {isSeeded ? '🌱' : ''}
          </div>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div
          className="absolute -bottom-8 left-1/2 bg-slate-800/95 backdrop-blur px-2 py-1 rounded text-white text-xs font-medium shadow-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            transform: 'translateX(-50%) translateZ(40px)',
            whiteSpace: 'nowrap',
          }}
        >
          {tray.name || `Tray ${tray.id}`}
          <div className="text-slate-400 text-xs">
            {tray.total_cells || 72} cells • {isSeeded ? `${activeCells.length} SEEDED` : 'EMPTY'}
          </div>
        </div>
      )}

      {/* Shadow */}
      <div
        className="absolute top-full left-1/2"
        style={{
          width: '100px',
          height: '30px',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
          transform: 'translateX(-50%) translateY(5px) translateZ(-5px)',
          filter: 'blur(6px)',
        }}
      />
    </div>
  );
}

function Shelf3D({ shelf, tierNumber, yPosition, width, depth, showLabels, shelfTrays, allCells }) {
  return (
    <div
      className="absolute"
      style={{
        top: `${yPosition}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Shelf label */}
      {showLabels && (
        <div
          className="absolute -left-24 top-1/2"
          style={{ transform: 'translateY(-50%) translateZ(150px)' }}
        >
          <div className="bg-slate-700/90 backdrop-blur text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg border border-slate-600">
            {shelf.name || `Shelf ${tierNumber}`}
          </div>
        </div>
      )}

      {/* Shelf surface */}
      <div
        className="relative"
        style={{
          width: `${width}px`,
          height: `${depth}px`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Top surface */}
        <div
          className="absolute inset-0 rounded-lg shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
            transform: 'rotateX(-89deg) translateZ(0px)',
            transformOrigin: 'top',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
          }}
        >
          {/* Wood grain */}
          <div className="absolute inset-0 opacity-20">
            <svg width="100%" height="100%">
              <defs>
                <pattern id={`wood-${tierNumber}`} width="100" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
                  <rect width="100" height="4" fill="#000" opacity="0.1"/>
                  <rect width="100" height="1" y="4" fill="#000" opacity="0.15"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#wood-${tierNumber})`} />
            </svg>
          </div>
        </div>

        {/* Front edge */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-lg"
          style={{
            height: '20px',
            background: 'linear-gradient(180deg, #78350f 0%, #451a03 100%)',
            transform: 'translateZ(0px)',
            boxShadow: '0 10px 20px rgba(0,0,0,0.6)',
          }}
        />

        {/* Trays on shelf */}
        {shelfTrays.map((tray, i) => {
          const trayCells = allCells.filter(c => c.tray_id === tray.id);
          return (
            <Tray3D
              key={tray.id}
              tray={tray}
              position={{ x: 80 + i * 110, z: 60 }}
              showLabel={showLabels}
              trayCells={trayCells}
            />
          );
        })}

        {/* Grow light indicator */}
        {shelf.light_wattage && (
          <div
            className="absolute top-2 right-4"
            style={{ transform: 'translateZ(10px)' }}
          >
            <div className="bg-yellow-500/80 backdrop-blur px-2 py-1 rounded text-xs font-bold text-yellow-900 flex items-center gap-1">
              <Sun size={12} />
              {shelf.light_wattage}W
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RackStructure3D({ rack, shelves, trays, allCells, showLabels }) {
  const shelfCount = shelves.length;
  const tierHeight = 100;
  const tierWidth = 500;
  const tierDepth = 200;

  return (
    <div className="relative" style={{ transformStyle: 'preserve-3d', marginTop: '200px' }}>
      {/* Back support poles */}
      <div
        className="absolute bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg shadow-2xl"
        style={{
          left: '50px',
          top: '0',
          width: '16px',
          height: `${shelfCount * tierHeight}px`,
          transform: 'translateZ(-100px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg shadow-2xl"
        style={{
          right: '50px',
          top: '0',
          width: '16px',
          height: `${shelfCount * tierHeight}px`,
          transform: 'translateZ(-100px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Front support poles */}
      <div
        className="absolute bg-gradient-to-r from-slate-600 to-slate-500 rounded-lg shadow-2xl"
        style={{
          left: '50px',
          top: '0',
          width: '16px',
          height: `${shelfCount * tierHeight}px`,
          transform: 'translateZ(100px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />
      <div
        className="absolute bg-gradient-to-r from-slate-600 to-slate-500 rounded-lg shadow-2xl"
        style={{
          right: '50px',
          top: '0',
          width: '16px',
          height: `${shelfCount * tierHeight}px`,
          transform: 'translateZ(100px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      />

      {/* Shelves (bottom to top) */}
      {shelves.map((shelf, i) => {
        const tierNum = shelfCount - i;
        const yPos = i * tierHeight;
        const shelfTrays = trays.filter(t => t.shelf_id === shelf.id);

        return (
          <Shelf3D
            key={shelf.id}
            shelf={shelf}
            tierNumber={tierNum}
            yPosition={yPos}
            width={tierWidth}
            depth={tierDepth}
            showLabels={showLabels}
            shelfTrays={shelfTrays}
            allCells={allCells}
          />
        );
      })}
    </div>
  );
}

function Rack3DVisualization({ rack, shelves, trays, allCells, viewAngle, viewPitch, zoom, showLabels }) {
  const getTransform = () => {
    const baseScale = zoom;
    switch (viewAngle) {
      case 'front-left':
        return `scale(${baseScale}) perspective(1200px) rotateX(${viewPitch}deg) rotateY(-25deg)`;
      case 'front-right':
        return `scale(${baseScale}) perspective(1200px) rotateX(${viewPitch}deg) rotateY(25deg)`;
      case 'side':
        return `scale(${baseScale}) perspective(1200px) rotateX(${viewPitch}deg) rotateY(45deg)`;
      default:
        return `scale(${baseScale}) perspective(1200px) rotateX(${viewPitch}deg) rotateY(25deg)`;
    }
  };

  return (
    <div
      className="relative mx-auto transition-all duration-700 ease-out"
      style={{
        width: '900px',
        height: '700px',
        transformStyle: 'preserve-3d',
        transform: getTransform(),
      }}
    >
      <RackStructure3D
        rack={rack}
        shelves={shelves}
        trays={trays}
        allCells={allCells}
        showLabels={showLabels}
      />
    </div>
  );
}

export default function Rack3DView({ racks, shelves, trays, selectedRackId, onSelectRack }) {
  const [viewAngle, setViewAngle] = useState('front-right');
  const [viewPitch, setViewPitch] = useState(10);
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [allCells, setAllCells] = useState([]);

  const selectedRack = racks.find(r => r.id === selectedRackId);
  const rackShelves = shelves.filter(s => s.rack_id === selectedRackId);
  const rackTrays = trays.filter(t => 
    rackShelves.some(shelf => shelf.id === t.shelf_id)
  );

  useEffect(() => {
    if (rackTrays.length > 0) {
      loadCells();
    }
  }, [selectedRackId, rackTrays.length]);

  const loadCells = async () => {
    try {
      const trayIds = rackTrays.map(t => t.id);
      if (trayIds.length === 0) {
        setAllCells([]);
        return;
      }
      const cells = await base44.entities.TrayCell.filter({ 
        tray_id: { $in: trayIds } 
      });
      setAllCells(cells);
    } catch (error) {
      console.error('Error loading cells:', error);
      setAllCells([]);
    }
  };
  
  if (!selectedRack) {
    return (
      <div className="bg-white rounded-xl shadow p-12 text-center">
        <Box size={64} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-bold text-gray-400">No Rack Selected</h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Rack Selector */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Select value={selectedRackId} onValueChange={onSelectRack}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select rack" />
            </SelectTrigger>
            <SelectContent>
              {racks.map(rack => (
                <SelectItem key={rack.id} value={rack.id}>
                  {rack.name || `Rack ${rack.id.slice(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="text-sm text-gray-600 hidden md:block">
            {selectedRack.width_ft}ft × {selectedRack.depth_ft}ft × {rackShelves.length} shelves
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Zoom */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(zoom + 0.1, 1.5))}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(zoom - 0.1, 0.7))}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </Button>

          {/* Angle Controls */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewAngle('front-left')}
              className={`p-2 rounded transition-colors ${
                viewAngle === 'front-left' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Rotate Left"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setViewAngle('front-right')}
              className={`p-2 rounded transition-colors ${
                viewAngle === 'front-right' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Center View"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => setViewAngle('side')}
              className={`p-2 rounded transition-colors ${
                viewAngle === 'side' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-200 text-gray-600'
              }`}
              title="Rotate Right"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Pitch Controls (NEW) */}
          <div className="flex flex-col gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewPitch(Math.min(viewPitch + 5, 40))}
              className="p-1 rounded transition-colors hover:bg-gray-200 text-gray-600"
              title="Tilt Up (Look Down)"
            >
              <ChevronUp size={18} />
            </button>
            <button
              onClick={() => setViewPitch(Math.max(viewPitch - 5, -30))}
              className="p-1 rounded transition-colors hover:bg-gray-200 text-gray-600"
              title="Tilt Down (Look Up)"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Labels Toggle */}
          <Button
            variant={showLabels ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowLabels(!showLabels)}
            className={showLabels ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            Labels {showLabels ? 'On' : 'Off'}
          </Button>
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl p-4 md:p-12 relative overflow-hidden border-2 border-slate-700">
        {/* Ambient lighting */}
        <div className="absolute inset-0 bg-gradient-radial from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        
        {/* Floor grid */}
        <svg className="absolute bottom-0 left-0 right-0 h-32 opacity-10 pointer-events-none">
          <defs>
            <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#floor-grid)" />
        </svg>

        <div className="overflow-x-auto">
          <Rack3DVisualization
            rack={selectedRack}
            shelves={rackShelves}
            trays={rackTrays}
            allCells={allCells}
            viewAngle={viewAngle}
            viewPitch={viewPitch}
            zoom={zoom}
            showLabels={showLabels}
          />
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 left-6 bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-700">
          <h4 className="text-sm font-bold text-white mb-3">Legend</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded bg-emerald-500"></div>
              <span className="text-slate-300">Seeded</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-4 h-4 rounded bg-gray-600"></div>
              <span className="text-slate-300">Empty</span>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="absolute top-6 right-6 bg-slate-800/90 backdrop-blur rounded-xl p-4 border border-slate-700">
          <h4 className="text-sm font-bold text-white mb-3">Environment</h4>
          <div className="space-y-2 text-sm">
            {selectedRack.temperature && (
              <div className="flex items-center gap-2 text-orange-300">
                <Thermometer size={16} />
                <span>{selectedRack.temperature}°F</span>
              </div>
            )}
            {selectedRack.humidity && (
              <div className="flex items-center gap-2 text-blue-300">
                <Droplets size={16} />
                <span>{selectedRack.humidity}%</span>
              </div>
            )}
            {rackShelves.some(s => s.light_wattage) && (
              <div className="flex items-center gap-2 text-yellow-300">
                <Sun size={16} />
                <span>{rackShelves.reduce((sum, s) => sum + (s.light_wattage || 0), 0)}W Total</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}