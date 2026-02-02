import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';

export function PlantSeedsDialog({ isOpen, onClose, trayId, trayName, onSeedPlanted }) {
  const [seedLots, setSeedLots] = useState([]);
  const [loadingSeeds, setLoadingSeeds] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLot, setSelectedLot] = useState(null);
  const [selectedCells, setSelectedCells] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSeedLots();
    }
  }, [isOpen]);

  const loadSeedLots = async () => {
    try {
      setLoadingSeeds(true);
      const lots = await base44.entities.SeedLot.filter({}, '-updated_date');
      setSeedLots(lots);
    } catch (error) {
      console.error('Error loading seed lots:', error);
      toast.error('Failed to load seed lots');
    } finally {
      setLoadingSeeds(false);
    }
  };

  const handlePlantSeeds = async () => {
    if (!selectedLot) {
      toast.error('Please select a seed lot');
      return;
    }
    if (selectedCells.length === 0) {
      toast.error('Please select at least one cell');
      return;
    }

    setLoading(true);
    try {
      // Update tray cells with seed
      for (const cellNum of selectedCells) {
        const cells = await base44.entities.TrayCell.filter({
          tray_id: trayId,
          cell_number: cellNum
        });
        if (cells.length > 0) {
          await base44.entities.TrayCell.update(cells[0].id, {
            user_seed_id: selectedLot.id,
            status: 'seeded',
            seeded_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      // Update tray status
      await base44.entities.SeedTray.update(trayId, {
        status: 'seeded',
        start_date: new Date().toISOString().split('T')[0]
      });

      toast.success(`Planted ${selectedCells.length} cells!`);
      onSeedPlanted?.();
      onClose();
      setSelectedCells([]);
      setSelectedLot(null);
    } catch (error) {
      console.error('Error planting seeds:', error);
      toast.error('Failed to plant seeds');
    } finally {
      setLoading(false);
    }
  };

  const filteredLots = seedLots.filter(lot =>
    lot.custom_label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lot.lot_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plant Seeds in {trayName}</DialogTitle>
        </DialogHeader>

        {loadingSeeds ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Select Seed Lot */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Seed Lot</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search seed lots..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
                {filteredLots.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">No seed lots found</p>
                ) : (
                  filteredLots.map(lot => (
                    <button
                      key={lot.id}
                      onClick={() => setSelectedLot(lot)}
                      className={`w-full p-3 border rounded-lg text-left transition ${
                        selectedLot?.id === lot.id
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      <p className="font-medium text-sm">{lot.custom_label || 'Unlabeled'}</p>
                      <p className="text-xs text-gray-600">
                        Lot: {lot.lot_number} • {lot.quantity} {lot.unit}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Select Cells */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Cells to Plant ({selectedCells.length} selected)
              </label>
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-3">
                  Click cells to plant. Red = selected.
                </div>
                <TrayCellGrid
                  trayId={trayId}
                  selectedCells={selectedCells}
                  onCellToggle={(cellNum) => {
                    setSelectedCells(prev =>
                      prev.includes(cellNum)
                        ? prev.filter(c => c !== cellNum)
                        : [...prev, cellNum]
                    );
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handlePlantSeeds}
                disabled={loading || !selectedLot || selectedCells.length === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? 'Planting...' : `Plant ${selectedCells.length} Seeds`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrayCellGrid({ trayId, selectedCells, onCellToggle }) {
  const [cells, setCells] = useState([]);

  useEffect(() => {
    loadCells();
  }, [trayId]);

  const loadCells = async () => {
    try {
      const cellData = await base44.entities.TrayCell.filter({ tray_id: trayId });
      setCells(cellData.sort((a, b) => a.cell_number - b.cell_number));
    } catch (error) {
      console.error('Error loading cells:', error);
    }
  };

  if (cells.length === 0) return <p className="text-gray-500">Loading tray...</p>;

  const cols = Math.max(...cells.map(c => c.col + 1));
  const rows = Math.max(...cells.map(c => c.row + 1));

  return (
    <div className="inline-block border border-gray-300 rounded bg-white overflow-auto max-h-80">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: cols }).map((_, col) => {
            const cell = cells.find(c => c.row === row && c.col === col);
            const isSelected = cell && selectedCells.includes(cell.cell_number);

            return (
              <button
                key={`${row}-${col}`}
                onClick={() => cell && onCellToggle(cell.cell_number)}
                disabled={!cell}
                className={`w-8 h-8 border border-gray-200 flex items-center justify-center text-[10px] font-bold transition ${
                  isSelected
                    ? 'bg-red-500 text-white'
                    : cell?.status === 'seeded'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white hover:bg-gray-100'
                }`}
                title={cell ? `Cell ${cell.cell_number}` : ''}
              >
                {cell?.cell_number}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}