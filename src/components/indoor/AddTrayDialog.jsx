import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const TRAY_PRESETS = [
  { name: '72-cell (1206)', cells: 72, rows: 6, cols: 12, insert: '72-cell' },
  { name: '72-cell (1804)', cells: 72, rows: 6, cols: 12, insert: '72-cell' },
  { name: '50-cell tray', cells: 50, rows: 5, cols: 10, insert: '50-cell' },
  { name: '48-cell (806)', cells: 48, rows: 4, cols: 12, insert: '48-cell' },
  { name: '48-cell (1204)', cells: 48, rows: 4, cols: 12, insert: '48-cell' },
  { name: '36-cell (606)', cells: 36, rows: 4, cols: 9, insert: '36-cell' },
  { name: '36-cell (1203)', cells: 36, rows: 6, cols: 6, insert: '36-cell' },
  { name: '36-cell (3601)', cells: 36, rows: 4, cols: 9, insert: '36-cell' },
  { name: '32-cell (804)', cells: 32, rows: 4, cols: 8, insert: '32-cell' },
  { name: '24-cell (2401)', cells: 24, rows: 4, cols: 6, insert: '24-cell' },
  { name: '18-cell (1801)', cells: 18, rows: 3, cols: 6, insert: '18-cell' },
  { name: '18-cell (18)', cells: 18, rows: 3, cols: 6, insert: '18-cell' },
  { name: '12-cell (12)', cells: 12, rows: 2, cols: 6, insert: '12-cell' },
  { name: '8-cell (801)', cells: 8, rows: 2, cols: 4, insert: '8-cell' },
  { name: '288-cell', cells: 288, rows: 12, cols: 24, insert: '288-cell' },
];

export function AddTrayDialog({ isOpen, onClose, shelfId, onTrayAdded }) {
  const [trayName, setTrayName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState('72-cell-1206'); // Unique key
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Get current preset data
  const currentPreset = TRAY_PRESETS[parseInt(selectedPreset.split('-').pop())] || TRAY_PRESETS[0];

  const handleCreate = async () => {
    if (!trayName.trim()) {
      toast.error('Please enter a tray name');
      return;
    }

    setLoading(true);
    try {
      const qty = parseInt(quantity) || 1;
      
      // Extract base name and starting number
      const match = trayName.match(/^(.*?)(\d+)$/);
      const baseName = match ? match[1].trim() : trayName;
      const startNum = match ? parseInt(match[2]) : 1;
      
      for (let i = 0; i < qty; i++) {
        const currentName = qty > 1 ? `${baseName} ${startNum + i}` : trayName;
        
        const tray = await base44.entities.SeedTray.create({
          shelf_id: shelfId,
          name: currentName,
          tray_code: `T-${Date.now().toString(36)}-${i}`,
          total_cells: parseInt(currentPreset.cells),
          cells_rows: parseInt(currentPreset.rows),
          cells_cols: parseInt(currentPreset.cols),
          insert_type: currentPreset.insert,
          width_inches: 20,
          length_inches: 10,
          status: 'empty',
          notes: notes || null
        });

        // Create individual tray cells using bulkCreate to avoid rate limits
        const cellsToCreate = [];
        for (let r = 0; r < currentPreset.rows; r++) {
          for (let c = 0; c < currentPreset.cols; c++) {
            cellsToCreate.push({
              tray_id: tray.id,
              row: r,
              col: c,
              cell_number: r * currentPreset.cols + c + 1,
              status: 'empty'
            });
          }
        }
        await base44.entities.TrayCell.bulkCreate(cellsToCreate);
      }

      toast.success(qty > 1 
        ? `Created ${qty} trays with ${currentPreset.cells} cells each!`
        : `Tray "${trayName}" created with ${currentPreset.cells} cells!`
      );
      onTrayAdded?.();
      onClose();
      setTrayName('');
      setQuantity(1);
      setNotes('');
      setSelectedPreset('72-cell-1206');
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trayName">Tray Name</Label>
              <Input
                id="trayName"
                placeholder="e.g., Tray 1"
                value={trayName}
                onChange={(e) => setTrayName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                placeholder="1"
                className="mt-2"
              />
              {quantity > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Will create: {trayName.replace(/\d+$/, '')} {(trayName.match(/\d+$/) || ['1'])[0]}-{parseInt((trayName.match(/\d+$/) || ['1'])[0]) + quantity - 1}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any notes about this tray..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="trayPreset">Tray Size (Preset)</Label>
            <Select 
              value={selectedPreset} 
              onValueChange={setSelectedPreset}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select tray size" />
              </SelectTrigger>
              <SelectContent>
                {TRAY_PRESETS.map((preset, idx) => (
                  <SelectItem key={`${preset.insert}-${idx}`} value={`${preset.insert}-${idx}`}>
                    {preset.name} - {preset.rows} rows × {preset.cols} cols
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
            <p>Selected: <span className="font-bold">{currentPreset.rows} rows × {currentPreset.cols} cols = {currentPreset.cells} cells</span></p>
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