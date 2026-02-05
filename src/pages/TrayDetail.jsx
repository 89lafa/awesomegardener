import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Plus, Loader2, Check, X, Upload, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
          // Reload cells after creating missing ones
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
      // Shift+click: select range
      const start = Math.min(lastClickedCell.cell_number, cell.cell_number);
      const end = Math.max(lastClickedCell.cell_number, cell.cell_number);
      const rangeCells = cells.filter(c => c.cell_number >= start && c.cell_number <= end);
      setSelectedCells(rangeCells);
    } else {
      // Regular click: toggle selection
      if (selectedCells.some(c => c.id === cell.id)) {
        setSelectedCells(selectedCells.filter(c => c.id !== cell.id));
      } else {
        setSelectedCells([...selectedCells, cell]);
      }
    }
    setLastClickedCell(cell);
  };

  const handleMarkFailed = async () => {
    if (selectedCells.length === 0) return;
    
    try {
      for (const cell of selectedCells) {
        await base44.entities.TrayCell.update(cell.id, { status: 'failed' });
      }
      
      await loadTrayData();
      setSelectedCells([]);
      toast.success(`Marked ${selectedCells.length} cells as failed`);
    } catch (error) {
      console.error('Error marking failed:', error);
      toast.error('Failed to update cells');
    }
  };

  const handleMarkGerminated = async () => {
    if (selectedCells.length === 0) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const cell of selectedCells) {
        await base44.entities.TrayCell.update(cell.id, { 
          status: 'germinated',
          germinated_date: today
        });
      }
      
      await loadTrayData();
      setSelectedCells([]);
      toast.success(`Marked ${selectedCells.length} cells as germinated`);
    } catch (error) {
      console.error('Error marking germinated:', error);
      toast.error('Failed to update cells');
    }
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
              {tray.insert_type} • {tray.cells_rows}×{tray.cells_cols} grid
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

      {/* Actions */}
      {selectedCells.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-emerald-900">
                {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleMarkGerminated}
                  className="gap-1"
                >
                  <Check className="w-4 h-4" />
                  Mark Germinated
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={handleMarkFailed}
                  className="gap-1"
                >
                  <X className="w-4 h-4" />
                  Mark Failed
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setShowTransplant(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                >
                  <Upload className="w-4 h-4" />
                  Transplant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
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
        <Button
          onClick={() => {
            // Select ALL cells, including those without cell numbers
            const allCells = cells.filter(c => c);
            setSelectedCells(allCells);
          }}
          variant="outline"
        >
          Select All ({cells.length})
        </Button>
        <Button
          onClick={() => setSelectedCells([])}
          variant="outline"
        >
          Clear Selection
        </Button>
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
        selectedCells={selectedCells}
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