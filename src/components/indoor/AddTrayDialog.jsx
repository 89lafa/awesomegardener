import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const TRAY_PRESETS = [
  { name: '72-cell tray', cells: 72, rows: 8, cols: 9, insert: '72-cell' },
  { name: '50-cell tray', cells: 50, rows: 5, cols: 10, insert: '50-cell' },
  { name: '36-cell tray', cells: 36, rows: 6, cols: 6, insert: '36-cell' },
  { name: '18-cell tray', cells: 18, rows: 3, cols: 6, insert: '18-cell' },
];

export function AddTrayDialog({ isOpen, onClose, shelfId, onTrayAdded }) {
  const [trayName, setTrayName] = useState('');
  const [totalCells, setTotalCells] = useState(72);
  const [rows, setRows] = useState(8);
  const [cols, setCols] = useState(9);
  const [insertType, setInsertType] = useState('72-cell');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!trayName.trim()) {
      toast.error('Please enter a tray name');
      return;
    }

    setLoading(true);
    try {
      const tray = await base44.entities.SeedTray.create({
        shelf_id: shelfId,
        name: trayName,
        tray_code: `T-${Date.now().toString(36)}`,
        total_cells: parseInt(totalCells),
        cells_rows: parseInt(rows),
        cells_cols: parseInt(cols),
        insert_type: insertType,
        width_inches: 20,
        length_inches: 10,
        status: 'empty'
      });

      // Create individual tray cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          await base44.entities.TrayCell.create({
            tray_id: tray.id,
            row: r,
            col: c,
            cell_number: r * cols + c + 1,
            status: 'empty'
          });
        }
      }

      toast.success(`Tray "${trayName}" created with ${totalCells} cells!`);
      onTrayAdded?.();
      onClose();
      setTrayName('');
    } catch (error) {
      console.error('Error creating tray:', error);
      toast.error('Failed to create tray');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tray to Shelf</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tray Name</label>
            <Input
              placeholder="e.g., Tomato Tray, Seedling Tray 1"
              value={trayName}
              onChange={(e) => setTrayName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tray Size (Preset)</label>
            <div className="space-y-2">
              {TRAY_PRESETS.map(preset => (
                <button
                  key={preset.insert}
                  onClick={() => {
                    setTotalCells(preset.cells);
                    setRows(preset.rows);
                    setCols(preset.cols);
                    setInsertType(preset.insert);
                  }}
                  className={`w-full p-3 border rounded-lg text-left transition ${
                    totalCells === preset.cells
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  <p className="font-medium text-sm">{preset.name}</p>
                  <p className="text-xs text-gray-600">{preset.rows} rows × {preset.cols} cols</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Rows</label>
              <Input
                type="number"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cols</label>
              <Input
                type="number"
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Total</label>
              <Input
                type="number"
                value={totalCells}
                onChange={(e) => setTotalCells(parseInt(e.target.value))}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p>Total cells: <span className="font-bold">{rows * cols}</span></p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Creating...' : 'Create Tray'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}