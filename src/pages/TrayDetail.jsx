import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Loader2, Check, X, Upload, Settings, Trash2, Grid, Rows, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import TrayGrid from '@/components/indoor/TrayGrid';
import TransplantDialog from '@/components/indoor/TransplantDialog';
import { PlantSeedsDialog } from '@/components/indoor/PlantSeedsDialog';
import GrowLogComponent from '@/components/indoor/GrowLogComponent';
import EditTrayDialog from '@/components/indoor/EditTrayDialog';

export default function TrayDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trayId = searchParams.get('id');

  const [tray, setTray] = useState(null);
  const [cells, setCells] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlantSeeds, setShowPlantSeeds] = useState(false);
  const [showTransplant, setShowTransplant] = useState(false);
  const [showEditTray, setShowEditTray] = useState(false);
  const [lastClickedCell, setLastClickedCell] = useState(null);

  useEffect(() => {
    if (trayId) {
      loadTrayData();
    }
  }, [trayId]);

  const loadTrayData = async () => {
    try {
      setLoading(true);
      const [trayData, cellsData] = await Promise.all([
        base44.entities.SeedTray.filter({ id: trayId }),
        base44.entities.TrayCell.filter({ tray_id: trayId }, 'cell_number')
      ]);

      if (trayData.length === 0) {
        toast.error('Tray not found');
        navigate(-1);
        return;
      }

      const currentTray = trayData[0];
      
      // Ensure all tray cells exist (fix missing cells with question marks)
      const expectedCells = currentTray.total_cells || (currentTray.cells_rows * currentTray.cells_cols);
      if (cellsData.length < expectedCells) {
        try {
          await base44.functions.invoke('ensureTrayCells', { trayId });
          const refreshedCells = await base44.entities.TrayCell.filter({ tray_id: trayId }, 'cell_number');
          setCells(refreshedCells);
        } catch (error) {
          console.error('Error ensuring cells:', error);
          setCells(cellsData);
        }
      } else {
        setCells(cellsData);
      }
      
      // Load location hierarchy: Shelf -> Rack -> Space
      let locationPath = currentTray.name;
      if (currentTray.shelf_id) {
        const [shelf] = await base44.entities.GrowShelf.filter({ id: currentTray.shelf_id });
        if (shelf?.rack_id) {
          const [rack] = await base44.entities.GrowRack.filter({ id: shelf.rack_id });
          if (rack?.indoor_space_id) {
            const [space] = await base44.entities.IndoorGrowSpace.filter({ id: rack.indoor_space_id });
            locationPath = `${space?.name || 'Unknown Space'} - ${rack?.name || 'Unknown Rack'} - ${shelf?.name || 'Unknown Shelf'} - ${currentTray.name}`;
          }
        }
      }

      setTray({...currentTray, _locationPath: locationPath});
    } catch (error) {
      console.error('Error loading tray:', error);
      toast.error('Failed to load tray');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (cell, event) => {
    if (event?.shiftKey && lastClickedCell) {
      const start = Math.min(lastClickedCell.cell_number, cell.cell_number);
      const end = Math.max(lastClickedCell.cell_number, cell.cell_number);
      const rangeCells = cells.filter(c => c.cell_number >= start && c.cell_number <= end);
      setSelectedCells(rangeCells);
    } else {
      if (selectedCells.some(c => c.id === cell.id)) {
        setSelectedCells(selectedCells.filter(c => c.id !== cell.id));
      } else {
        setSelectedCells([...selectedCells, cell]);
      }
    }
    setLastClickedCell(cell);
  };

  // Bulk selection helpers
  const selectRow = (rowIndex) => {
    if (!tray) return;
    const cols = tray.cells_cols || 1;
    const startNum = rowIndex * cols + 1;
    const endNum = startNum + cols - 1;
    const rowCells = cells.filter(c => c.cell_number >= startNum && c.cell_number <= endNum);
    
    const allSelected = rowCells.every(rc => selectedCells.some(sc => sc.id === rc.id));
    if (allSelected) {
      setSelectedCells(selectedCells.filter(sc => !rowCells.some(rc => rc.id === sc.id)));
    } else {
      const newSelection = [...selectedCells];
      rowCells.forEach(rc => {
        if (!newSelection.some(sc => sc.id === rc.id)) {
          newSelection.push(rc);
        }
      });
      setSelectedCells(newSelection);
    }
  };

  const selectColumn = (colIndex) => {
    if (!tray) return;
    const cols = tray.cells_cols || 1;
    const rows = tray.cells_rows || 1;
    const colCells = [];
    for (let r = 0; r < rows; r++) {
      const cellNum = r * cols + colIndex + 1;
      const cell = cells.find(c => c.cell_number === cellNum);
      if (cell) colCells.push(cell);
    }
    
    const allSelected = colCells.every(cc => selectedCells.some(sc => sc.id === cc.id));
    if (allSelected) {
      setSelectedCells(selectedCells.filter(sc => !colCells.some(cc => cc.id === sc.id)));
    } else {
      const newSelection = [...selectedCells];
      colCells.forEach(cc => {
        if (!newSelection.some(sc => sc.id === cc.id)) {
          newSelection.push(cc);
        }
      });
      setSelectedCells(newSelection);
    }
  };

  const selectAllEmpty = () => {
    const emptyCells = cells.filter(c => c.status === 'empty');
    const allSelected = emptyCells.every(ec => selectedCells.some(sc => sc.id === ec.id));
    if (allSelected) {
      setSelectedCells(selectedCells.filter(sc => !emptyCells.some(ec => ec.id === sc.id)));
    } else {
      const newSelection = [...selectedCells];
      emptyCells.forEach(ec => {
        if (!newSelection.some(sc => sc.id === ec.id)) {
          newSelection.push(ec);
        }
      });
      setSelectedCells(newSelection);
    }
  };

  const selectAllSeeded = () => {
    const seededCells = cells.filter(c => ['seeded', 'germinated', 'growing'].includes(c.status));
    const allSelected = seededCells.every(sc2 => selectedCells.some(sc => sc.id === sc2.id));
    if (allSelected) {
      setSelectedCells(selectedCells.filter(sc => !seededCells.some(sc2 => sc2.id === sc.id)));
    } else {
      const newSelection = [...selectedCells];
      seededCells.forEach(sc2 => {
        if (!newSelection.some(sc => sc.id === sc2.id)) {
          newSelection.push(sc2);
        }
      });
      setSelectedCells(newSelection);
    }
  };

  // Derived: filter selected cells by status for smart action guards
  const selectedNonEmpty = selectedCells.filter(c => c.status !== 'empty');
  const selectedEmpty = selectedCells.filter(c => c.status === 'empty');
  const selectedTransplantable = selectedCells.filter(c => 
    ['seeded', 'germinated', 'growing'].includes(c.status)
  );

  const handleMarkFailed = async () => {
    if (selectedNonEmpty.length === 0) {
      toast.error('No planted cells selected — empty cells cannot be marked as failed');
      return;
    }
    
    try {
      for (const cell of selectedNonEmpty) {
        await base44.entities.TrayCell.update(cell.id, { status: 'failed' });
      }
      
      await loadTrayData();
      setSelectedCells([]);
      toast.success(`Marked ${selectedNonEmpty.length} cells as failed`);
    } catch (error) {
      console.error('Error marking failed:', error);
      toast.error('Failed to update cells');
    }
  };

  const handleMarkGerminated = async () => {
    if (selectedNonEmpty.length === 0) {
      toast.error('No planted cells selected — empty cells cannot be marked as germinated');
      return;
    }
    
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const cell of selectedNonEmpty) {
        await base44.entities.TrayCell.update(cell.id, { 
          status: 'germinated',
          germinated_date: today
        });
      }
      
      await loadTrayData();
      setSelectedCells([]);
      toast.success(`Marked ${selectedNonEmpty.length} cells as germinated`);
    } catch (error) {
      console.error('Error marking germinated:', error);
      toast.error('Failed to update cells');
    }
  };

  const handleTransplantClick = () => {
    if (selectedTransplantable.length === 0) {
      toast.error('No transplantable cells selected — only seeded/germinated/growing cells can be transplanted');
      return;
    }
    setShowTransplant(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!tray) {
    return (
      <div className="text-center py-12">
        <p>Tray not found</p>
      </div>
    );
  }

  const stats = {
    total: tray.total_cells,
    active: cells.filter(c => c.status === 'growing' || c.status === 'germinated' || c.status === 'seeded').length,
    failed: cells.filter(c => c.status === 'failed').length,
    transplanted: cells.filter(c => c.status === 'transplanted').length,
    empty: cells.filter(c => c.status === 'empty').length
  };

  const rows = tray.cells_rows || 1;
  const cols = tray.cells_cols || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tray._locationPath || tray.name}</h1>
            <p className="text-sm text-gray-600">
              {tray.insert_type} • {rows}×{cols} grid
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-600">Total Cells</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-gray-600">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-600">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.transplanted}</p>
            <p className="text-xs text-gray-600">Transplanted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{stats.empty}</p>
            <p className="text-xs text-gray-600">Empty</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar — with smart guards */}
      {selectedCells.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-emerald-900">
                  {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
                </p>
                {selectedEmpty.length > 0 && selectedNonEmpty.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-1">
                    {selectedNonEmpty.length} planted, {selectedEmpty.length} empty
                  </p>
                )}
                {selectedCells.length > 0 && selectedNonEmpty.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    ⚠️ All selected cells are empty — use Plant Seeds to seed them
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleMarkGerminated}
                  disabled={selectedNonEmpty.length === 0}
                  className="gap-1"
                  title={selectedNonEmpty.length === 0 ? 'No planted cells selected' : `Mark ${selectedNonEmpty.length} as germinated`}
                >
                  <Check className="w-4 h-4" />
                  Germinated{selectedNonEmpty.length > 0 ? ` (${selectedNonEmpty.length})` : ''}
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleMarkFailed}
                  disabled={selectedNonEmpty.length === 0}
                  className="gap-1"
                  title={selectedNonEmpty.length === 0 ? 'No planted cells selected' : `Mark ${selectedNonEmpty.length} as failed`}
                >
                  <X className="w-4 h-4" />
                  Failed{selectedNonEmpty.length > 0 ? ` (${selectedNonEmpty.length})` : ''}
                </Button>
                <Button 
                  size="sm"
                  onClick={handleTransplantClick}
                  disabled={selectedTransplantable.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  title={selectedTransplantable.length === 0 ? 'No transplantable cells selected' : `Transplant ${selectedTransplantable.length} seedlings`}
                >
                  <Upload className="w-4 h-4" />
                  Transplant{selectedTransplantable.length > 0 ? ` (${selectedTransplantable.length})` : ''}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions + Bulk Selection Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={() => setShowPlantSeeds(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Plant Seeds
        </Button>
        <Button 
          onClick={() => setShowEditTray(true)}
          variant="outline"
        >
          <Settings className="w-4 h-4 mr-2" />
          Edit Tray
        </Button>

        <div className="h-9 w-px bg-gray-300 mx-1 hidden sm:block" />

        {/* Bulk Selection Controls */}
        <Select 
          value="" 
          onValueChange={(val) => {
            const rowIdx = parseInt(val);
            if (!isNaN(rowIdx)) selectRow(rowIdx);
          }}
        >
          <SelectTrigger className="w-32 h-9 text-xs">
            <span className="flex items-center gap-1">
              <Rows className="w-3 h-3" />
              Select Row
            </span>
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: rows }, (_, i) => {
              const startNum = i * cols + 1;
              const endNum = startNum + cols - 1;
              const rowCells = cells.filter(c => c.cell_number >= startNum && c.cell_number <= endNum);
              const selectedCount = rowCells.filter(rc => selectedCells.some(sc => sc.id === rc.id)).length;
              return (
                <SelectItem key={i} value={String(i)}>
                  Row {i + 1} ({rowCells.length} cells){selectedCount > 0 ? ` ✓${selectedCount}` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select 
          value="" 
          onValueChange={(val) => {
            const colIdx = parseInt(val);
            if (!isNaN(colIdx)) selectColumn(colIdx);
          }}
        >
          <SelectTrigger className="w-32 h-9 text-xs">
            <span className="flex items-center gap-1">
              <Columns className="w-3 h-3" />
              Select Col
            </span>
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: cols }, (_, i) => {
              const colCellNums = [];
              for (let r = 0; r < rows; r++) {
                colCellNums.push(r * cols + i + 1);
              }
              const colCells = cells.filter(c => colCellNums.includes(c.cell_number));
              const selectedCount = colCells.filter(cc => selectedCells.some(sc => sc.id === cc.id)).length;
              return (
                <SelectItem key={i} value={String(i)}>
                  Col {i + 1} ({colCells.length} cells){selectedCount > 0 ? ` ✓${selectedCount}` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          onClick={selectAllEmpty}
          variant="outline"
          size="sm"
          className="h-9 text-xs"
        >
          Empty ({stats.empty})
        </Button>
        <Button
          onClick={selectAllSeeded}
          variant="outline"
          size="sm"
          className="h-9 text-xs"
        >
          Seeded ({stats.active})
        </Button>
        <Button
          onClick={() => {
            const allCells = cells.filter(c => c);
            setSelectedCells(allCells);
          }}
          variant="outline"
          size="sm"
          className="h-9 text-xs"
        >
          <Grid className="w-3 h-3 mr-1" />
          All ({cells.length})
        </Button>
        {selectedCells.length > 0 && (
          <Button
            onClick={() => setSelectedCells([])}
            variant="outline"
            size="sm"
            className="h-9 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Tray Grid */}
      <TrayGrid
        tray={tray}
        cells={cells}
        selectedCells={selectedCells}
        onCellClick={(cell, event) => handleCellClick(cell, event)}
        loading={false}
      />

      {/* Planted Varieties Summary */}
      {cells.filter(c => c.variety_name || c.plant_type_name).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🌱 What's Planted in This Tray</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const varietyCounts = {};
                cells.forEach(cell => {
                  if (cell.status !== 'empty' && (cell.variety_name || cell.plant_type_name)) {
                    const key = `${cell.plant_type_name || 'Unknown'} - ${cell.variety_name || 'Unknown Variety'}`;
                    if (!varietyCounts[key]) {
                      varietyCounts[key] = { count: 0, status: {} };
                    }
                    varietyCounts[key].count++;
                    varietyCounts[key].status[cell.status] = (varietyCounts[key].status[cell.status] || 0) + 1;
                  }
                });

                return Object.entries(varietyCounts).map(([varietyKey, data]) => (
                  <div key={varietyKey} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div>
                      <p className="font-semibold text-emerald-900">{varietyKey}</p>
                      <p className="text-xs text-emerald-700">
                        {Object.entries(data.status).map(([status, count]) => 
                          `${count} ${status}`
                        ).join(', ')}
                      </p>
                    </div>
                    <Badge className="bg-emerald-600 text-white">{data.count} cells</Badge>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes & Log */}
      <Card>
        <CardHeader>
          <CardTitle>Notes & Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <GrowLogComponent targetId={trayId} targetType="tray_id" />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PlantSeedsDialog
        isOpen={showPlantSeeds}
        onClose={() => setShowPlantSeeds(false)}
        trayId={trayId}
        trayName={tray.name}
        onSeedPlanted={() => {
          loadTrayData();
          setSelectedCells([]);
        }}
      />

      <TransplantDialog
        isOpen={showTransplant}
        onClose={() => setShowTransplant(false)}
        selectedCells={selectedTransplantable}
        trayId={trayId}
        onTransplanted={() => {
          loadTrayData();
          setSelectedCells([]);
        }}
      />

      <EditTrayDialog
        isOpen={showEditTray}
        onClose={() => setShowEditTray(false)}
        tray={tray}
        cells={cells}
        onTrayUpdated={() => {
          loadTrayData();
        }}
        onTrayDeleted={() => {
          toast.success('Tray deleted');
          navigate(-1);
        }}
      />
    </div>
  );
}
