import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MoveHorizontal } from 'lucide-react';
import { toast } from 'sonner';

export default function MoveTrayDialog({ 
  isOpen, 
  onClose, 
  tray,
  onMoved 
}) {
  const [racks, setRacks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [selectedRack, setSelectedRack] = useState('');
  const [selectedShelf, setSelectedShelf] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && tray) {
      loadRacksAndShelves();
    }
  }, [isOpen, tray]);

  const loadRacksAndShelves = async () => {
    try {
      const [shelvesData] = await Promise.all([
        base44.entities.GrowShelf.list()
      ]);
      
      // Find all racks from available shelves and get their space info
      const rackIds = [...new Set(shelvesData.map(s => s.rack_id))];
      const racksData = rackIds.length > 0 
        ? await Promise.all(rackIds.map(id => base44.entities.GrowRack.filter({ id })).then(results => results.flat()))
        : [];
      
      // Filter to only racks in this space
      const filteredRacks = racksData.filter(r => r.indoor_space_id === tray.indoor_space_id);
      
      setRacks(filteredRacks);
      setShelves(shelvesData);
      
      // Pre-select current rack
      const currentShelf = shelvesData.find(s => s.id === tray.shelf_id);
      if (currentShelf) {
        setSelectedRack(currentShelf.rack_id);
        setSelectedShelf(tray.shelf_id);
      }
    } catch (error) {
      console.error('Error loading racks/shelves:', error);
    }
  };

  const handleMove = async () => {
    if (!selectedShelf || !selectedRack) {
      toast.error('Please select a destination shelf');
      return;
    }

    setLoading(true);
    try {
      const targetShelf = shelves.find(s => s.id === selectedShelf);
      const traysOnTargetShelf = await base44.entities.SeedTray.filter({ shelf_id: selectedShelf });
      
      // Check if shelf is full
      if (traysOnTargetShelf.length >= targetShelf.max_trays && selectedShelf !== tray.shelf_id) {
        // Need to swap with a tray on the target shelf
        const trayToSwap = traysOnTargetShelf[0]; // Swap with first tray
        
        // Swap positions
        await base44.entities.SeedTray.update(trayToSwap.id, {
          shelf_id: tray.shelf_id,
          position_on_shelf: tray.position_on_shelf
        });
        
        await base44.entities.SeedTray.update(tray.id, {
          shelf_id: selectedShelf,
          position_on_shelf: trayToSwap.position_on_shelf
        });
        
        toast.success(`Swapped "${tray.name}" with "${trayToSwap.name}"`);
      } else {
        // Just move to new shelf
        const newPosition = traysOnTargetShelf.length + 1;
        await base44.entities.SeedTray.update(tray.id, {
          shelf_id: selectedShelf,
          position_on_shelf: newPosition
        });
        
        toast.success(`Moved "${tray.name}" to ${targetShelf.name}`);
      }

      onMoved?.();
      onClose();
    } catch (error) {
      console.error('Error moving tray:', error);
      toast.error('Failed to move tray');
    } finally {
      setLoading(false);
    }
  };

  const availableShelves = shelves.filter(s => s.rack_id === selectedRack);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Tray</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Moving:</strong> {tray?.name}
            </p>
          </div>

          <div>
            <Label>Select Rack</Label>
            <Select value={selectedRack} onValueChange={setSelectedRack}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose rack..." />
              </SelectTrigger>
              <SelectContent>
                {racks.map(rack => (
                  <SelectItem key={rack.id} value={rack.id}>
                    {rack.name} ({rack.width_ft}ft × {rack.depth_ft}ft)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRack && (
            <div>
              <Label>Select Shelf</Label>
              <Select value={selectedShelf} onValueChange={setSelectedShelf}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose shelf..." />
                </SelectTrigger>
                <SelectContent>
                  {availableShelves.map(shelf => (
                    <SelectItem key={shelf.id} value={shelf.id}>
                      {shelf.name} (Shelf {shelf.shelf_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedShelf && selectedShelf !== tray?.shelf_id && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm text-amber-900">
              <p>
                Note: If the destination shelf is full, this tray will swap positions with an existing tray.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleMove}
            disabled={loading || !selectedShelf || !selectedRack}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <MoveHorizontal className="w-4 h-4" />
                Move Tray
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}