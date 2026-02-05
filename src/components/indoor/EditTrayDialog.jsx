import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TRAY_PRESETS = [
  { label: '18-cell (3x6)', cells: 18, rows: 3, cols: 6, insert_type: '18-cell 3x6' },
  { label: '32-cell (4x8)', cells: 32, rows: 4, cols: 8, insert_type: '32-cell 4x8' },
  { label: '36-cell (6x6)', cells: 36, rows: 6, cols: 6, insert_type: '36-cell 6x6' },
  { label: '50-cell (5x10)', cells: 50, rows: 5, cols: 10, insert_type: '50-cell 5x10' },
  { label: '72-cell (8x9)', cells: 72, rows: 8, cols: 9, insert_type: '72-cell 8x9' },
  { label: '128-cell (8x16)', cells: 128, rows: 8, cols: 16, insert_type: '128-cell 8x16' }
];

export default function EditTrayDialog({ 
  isOpen, 
  onClose, 
  tray,
  cells,
  onTrayUpdated,
  onTrayDeleted
}) {
  const [trayName, setTrayName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && tray) {
      setTrayName(tray.name);
      // Try to find matching preset
      const preset = TRAY_PRESETS.find(p => p.cells === tray.total_cells);
      if (preset) {
        setSelectedPreset(`${preset.cells}`);
      }
    }
  }, [isOpen, tray]);

  const hasPlantedSeeds = cells.some(c => c.status !== 'empty');
  const canEditCells = !hasPlantedSeeds;

  const handleSave = async () => {
    if (!trayName.trim()) {
      toast.error('Please enter a tray name');
      return;
    }

    setLoading(true);
    try {
      // Update tray name
      await base44.entities.SeedTray.update(tray.id, {
        name: trayName
      });

      // If changing cell configuration (only allowed if no seeds)
      if (canEditCells && selectedPreset) {
        const preset = TRAY_PRESETS.find(p => `${p.cells}` === selectedPreset);
        if (preset && preset.cells !== tray.total_cells) {
          // Delete all existing cells
          for (const cell of cells) {
            await base44.entities.TrayCell.delete(cell.id);
          }

          // Update tray configuration
          await base44.entities.SeedTray.update(tray.id, {
            total_cells: preset.cells,
            cells_rows: preset.rows,
            cells_cols: preset.cols,
            insert_type: preset.insert_type
          });

          // Create new cells
          const newCells = [];
          for (let row = 0; row < preset.rows; row++) {
            for (let col = 0; col < preset.cols; col++) {
              newCells.push({
                tray_id: tray.id,
                cell_number: row * preset.cols + col + 1,
                row,
                col,
                status: 'empty'
              });
            }
          }
          await base44.entities.TrayCell.bulkCreate(newCells);

          toast.success('Tray configuration updated!');
        } else {
          toast.success('Tray name updated!');
        }
      } else {
        toast.success('Tray name updated!');
      }

      onTrayUpdated?.();
      onClose();
    } catch (error) {
      console.error('Error updating tray:', error);
      toast.error('Failed to update tray');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete all cells first
      for (const cell of cells) {
        await base44.entities.TrayCell.delete(cell.id);
      }

      // Delete the tray
      await base44.entities.SeedTray.delete(tray.id);

      toast.success('Tray deleted successfully');
      onTrayDeleted?.();
      onClose();
    } catch (error) {
      console.error('Error deleting tray:', error);
      toast.error('Failed to delete tray');
    } finally {
      setLoading(false);
    }
  };

  if (!tray) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Tray</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tray Name</Label>
            <Input
              value={trayName}
              onChange={(e) => setTrayName(e.target.value)}
              placeholder="e.g., Tray 1"
              className="mt-2"
            />
          </div>

          {canEditCells ? (
            <div>
              <Label>Cell Configuration</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select tray size" />
                </SelectTrigger>
                <SelectContent>
                  {TRAY_PRESETS.map(preset => (
                    <SelectItem key={preset.cells} value={`${preset.cells}`}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-600 mt-2">
                You can change the cell configuration because no seeds have been planted yet.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">Cannot change cell size</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This tray has planted seeds. You can only change the name or delete the entire tray.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Delete Section */}
          <div className="border-t pt-4 mt-4">
            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete This Tray
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-900">
                    Are you sure? This will delete the tray and all {cells.length} cells. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Yes, Delete'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {!showDeleteConfirm && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}