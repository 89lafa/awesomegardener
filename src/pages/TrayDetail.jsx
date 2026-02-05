import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft,
  Loader2,
  Sprout,
  X as XIcon,
  CheckCircle2,
  Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import PlantSeedsDialog from '@/components/indoor/PlantSeedsDialog';
import TransplantDialog from '@/components/indoor/TransplantDialog';
import { format } from 'date-fns';

export default function TrayDetail() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const trayId = urlParams.get('id');

  const [tray, setTray] = useState(null);
  const [cells, setCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [showPlantDialog, setShowPlantDialog] = useState(false);
  const [showTransplantDialog, setShowTransplantDialog] = useState(false);
  const [lastClickedCell, setLastClickedCell] = useState(null);

  useEffect(() => {
    if (trayId) {
      loadData();
    } else {
      // New tray creation mode
      const spaceId = urlParams.get('spaceId');
      const shelfId = urlParams.get('shelfId');
      if (spaceId && shelfId) {
        createNewTray(spaceId, shelfId);
      }
    }
  }, [trayId]);

  const createNewTray = async (spaceId, shelfId) => {
    try {
      // Show dialog to configure tray
      const name = prompt('Tray name (e.g., Tray A, Tomatoes 1):', 'Tray 1');
      if (!name) {
        navigate(-1);
        return;
      }

      const insertType = '72-cell'; // Default, can be made configurable
      const config = {
        '72-cell': { rows: 6, cols: 12, total: 72 },
        '50-cell': { rows: 5, cols: 10, total: 50 },
        '36-cell': { rows: 6, cols: 6, total: 36 },
        '18-cell': { rows: 3, cols: 6, total: 18 }
      }[insertType];

      const newTray = await base44.entities.SeedTray.create({
        shelf_id: shelfId,
        indoor_space_id: spaceId,
        name,
        insert_type: insertType,
        total_cells: config.total,
        cells_rows: config.rows,
        cells_cols: config.cols,
        width_inches: 11,
        length_inches: 21,
        status: 'empty'
      });

      // Create empty cells
      const cellsToCreate = [];
      for (let r = 1; r <= config.rows; r++) {
        for (let c = 1; c <= config.cols; c++) {
          cellsToCreate.push({
            tray_id: newTray.id,
            row: r,
            col: c,
            cell_number: (r - 1) * config.cols + c,
            status: 'empty'
          });
        }
      }

      await base44.entities.TrayCell.bulkCreate(cellsToCreate);
      
      toast.success('Tray created!');
      navigate(createPageUrl('TrayDetail') + `?id=${newTray.id}`);
    } catch (error) {
      console.error('Error creating tray:', error);
      toast.error('Failed to create tray');
      navigate(-1);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [trayData, cellsData] = await Promise.all([
        base44.entities.SeedTray.filter({ id: trayId }),
        base44.entities.TrayCell.filter({ tray_id: trayId })
      ]);

      if (!trayData || trayData.length === 0) {
        toast.error('Tray not found');
        navigate(-1);
        return;
      }

      setTray(trayData[0]);
      setCells(cellsData);
    } catch (error) {
      console.error('Error loading tray:', error);
      toast.error('Failed to load tray');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (cell, event) => {
    const cellKey = `${cell.row}-${cell.col}`;
    const newSelected = new Set(selectedCells);

    if (event.shiftKey && lastClickedCell) {
      // Range select
      const startRow = Math.min(lastClickedCell.row, cell.row);
      const endRow = Math.max(lastClickedCell.row, cell.row);
      const startCol = Math.min(lastClickedCell.col, cell.col);
      const endCol = Math.max(lastClickedCell.col, cell.col);

      cells.forEach(c => {
        if (c.row >= startRow && c.row <= endRow && c.col >= startCol && c.col <= endCol) {
          newSelected.add(`${c.row}-${c.col}`);
        }
      });
    } else {
      // Toggle single cell
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey);
      } else {
        newSelected.add(cellKey);
      }
    }

    setSelectedCells(newSelected);
    setLastClickedCell(cell);
  };

  const handleBulkStatusChange = async (newStatus) => {
    const selectedCellsList = cells.filter(c => selectedCells.has(`${c.row}-${c.col}`));
    
    if (selectedCellsList.length === 0) {
      toast.error('No cells selected');
      return;
    }

    try {
      const updates = selectedCellsList.map(cell =>
        base44.entities.TrayCell.update(cell.id, {
          status: newStatus,
          ...(newStatus === 'germinated' && { germinated_date: new Date().toISOString().split('T')[0] })
        })
      );
      
      await Promise.all(updates);
      await loadData();
      setSelectedCells(new Set());
      toast.success(`Marked ${selectedCellsList.length} cells as ${newStatus}`);
    } catch (error) {
      console.error('Error updating cells:', error);
      toast.error('Failed to update cells');
    }
  };

  const getStats = () => {
    const stats = {
      total: tray?.total_cells || 0,
      empty: cells.filter(c => c.status === 'empty').length,
      seeded: cells.filter(c => c.status === 'seeded').length,
      germinated: cells.filter(c => c.status === 'germinated').length,
      growing: cells.filter(c => c.status === 'growing').length,
      failed: cells.filter(c => c.status === 'failed').length,
      transplanted: cells.filter(c => c.status === 'transplanted').length
    };
    stats.active = stats.seeded + stats.germinated + stats.growing;
    return stats;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!tray) return null;

  const stats = getStats();
  const rows = tray.cells_rows || 6;
  const cols = tray.cells_cols || 12;

  // Organize cells into grid
  const grid = Array(rows).fill(null).map((_, r) => 
    cells.filter(c => c.row === r + 1).sort((a, b) => a.col - b.col)
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{tray.name}</h1>
          <p className="text-gray-600 mt-1">
            {tray.insert_type} • {rows}×{cols} grid
          </p>
        </div>
      </div>

      {/* Tray Info */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4">
            <Badge variant="outline" className="text-sm">
              📊 {stats.active}/{stats.total} active
            </Badge>
            {stats.failed > 0 && (
              <Badge variant="outline" className="text-sm text-red-600">
                ❌ {stats.failed} failed
              </Badge>
            )}
            {stats.transplanted > 0 && (
              <Badge variant="outline" className="text-sm text-green-600">
                ✅ {stats.transplanted} transplanted
              </Badge>
            )}
            {tray.start_date && (
              <Badge variant="outline" className="text-sm">
                📅 Started: {format(new Date(tray.start_date), 'MMM d')}
              </Badge>
            )}
          </div>
          {selectedCells.size > 0 && (
            <Badge className="bg-emerald-600 text-white">
              {selectedCells.size} cells selected
            </Badge>
          )}
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowPlantDialog(true)}
            disabled={selectedCells.size === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Sprout className="w-4 h-4 mr-2" />
            Plant Selected
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('germinated')}
            disabled={selectedCells.size === 0}
            variant="outline"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark Germinated
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('failed')}
            disabled={selectedCells.size === 0}
            variant="outline"
          >
            <XIcon className="w-4 h-4 mr-2" />
            Mark Failed
          </Button>
          <Button
            onClick={() => setShowTransplantDialog(true)}
            disabled={selectedCells.size === 0}
            variant="outline"
          >
            <Package className="w-4 h-4 mr-2" />
            Transplant
          </Button>
          <Button
            onClick={() => setSelectedCells(new Set())}
            disabled={selectedCells.size === 0}
            variant="ghost"
            size="sm"
          >
            Clear Selection
          </Button>
        </div>
      </Card>

      {/* Cell Grid */}
      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Column headers */}
          <div className="flex mb-2">
            <div className="w-8" />
            {Array(cols).fill(null).map((_, i) => (
              <div key={i} className="flex-1 text-center text-xs font-medium text-gray-500">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {grid.map((rowCells, ri) => (
            <div key={ri} className="flex mb-1">
              <div className="w-8 flex items-center justify-center text-xs font-medium text-gray-500">
                {ri + 1}
              </div>
              {rowCells.map((cell) => {
                const isSelected = selectedCells.has(`${cell.row}-${cell.col}`);
                const statusConfig = {
                  empty: { bg: 'bg-gray-100 hover:bg-gray-200', icon: null },
                  seeded: { bg: 'bg-amber-100 hover:bg-amber-200', icon: '🟤' },
                  germinated: { bg: 'bg-green-100 hover:bg-green-200', icon: '🌱' },
                  growing: { bg: 'bg-emerald-200 hover:bg-emerald-300', icon: '🌿' },
                  failed: { bg: 'bg-red-100 hover:bg-red-200', icon: '❌' },
                  transplanted: { bg: 'bg-blue-100 hover:bg-blue-200', icon: '✅' }
                };

                const config = statusConfig[cell.status] || statusConfig.empty;

                return (
                  <div
                    key={cell.id}
                    onClick={(e) => handleCellClick(cell, e)}
                    className={`
                      flex-1 aspect-square m-0.5 rounded-md flex items-center justify-center 
                      cursor-pointer transition-all text-base
                      ${config.bg}
                      ${isSelected ? 'ring-2 ring-emerald-600 ring-offset-2 scale-95' : ''}
                    `}
                    title={`Row ${cell.row}, Col ${cell.col} - ${cell.status}`}
                  >
                    {config.icon}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gray-100" />
            <span className="text-sm text-gray-600">Empty</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">🟤</div>
            <span className="text-sm text-gray-600">Seeded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">🌱</div>
            <span className="text-sm text-gray-600">Germinated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-200 flex items-center justify-center">🌿</div>
            <span className="text-sm text-gray-600">Growing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center">❌</div>
            <span className="text-sm text-gray-600">Failed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">✅</div>
            <span className="text-sm text-gray-600">Transplanted</span>
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      {showPlantDialog && (
        <PlantSeedsDialog
          open={showPlantDialog}
          onClose={() => setShowPlantDialog(false)}
          tray={tray}
          selectedCells={cells.filter(c => selectedCells.has(`${c.row}-${c.col}`))}
          onSuccess={() => {
            loadData();
            setSelectedCells(new Set());
          }}
        />
      )}

      {showTransplantDialog && (
        <TransplantDialog
          open={showTransplantDialog}
          onClose={() => setShowTransplantDialog(false)}
          selectedCells={cells.filter(c => selectedCells.has(`${c.row}-${c.col}`))}
          tray={tray}
          onSuccess={() => {
            loadData();
            setSelectedCells(new Set());
          }}
        />
      )}
    </div>
  );
}