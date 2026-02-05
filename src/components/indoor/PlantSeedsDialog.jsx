import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function PlantSeedsDialog({ open, onClose, tray, selectedCells, onSuccess }) {
  const [seedLots, setSeedLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planting, setPlanting] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSeed, setSelectedSeed] = useState(null);

  useEffect(() => {
    if (open) {
      loadSeeds();
    }
  }, [open]);

  const loadSeeds = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      const seeds = await base44.entities.SeedLot.filter({
        created_by: user.email,
        quantity: { $gt: 0 }
      }, '-updated_date');
      setSeedLots(seeds);
    } catch (error) {
      console.error('Error loading seeds:', error);
      toast.error('Failed to load seed stash');
    } finally {
      setLoading(false);
    }
  };

  const handlePlant = async () => {
    if (!selectedSeed) {
      toast.error('Please select a seed variety');
      return;
    }

    if (selectedSeed.quantity < selectedCells.length) {
      toast.error(`Not enough seeds. You need ${selectedCells.length} but only have ${selectedSeed.quantity}`);
      return;
    }

    setPlanting(true);
    try {
      // Update cells
      const updates = selectedCells.map(cell =>
        base44.entities.TrayCell.update(cell.id, {
          variety_id: selectedSeed.variety_id,
          plant_type_id: selectedSeed.plant_type_id,
          user_seed_id: selectedSeed.id,
          status: 'seeded',
          seeded_date: new Date().toISOString().split('T')[0]
        })
      );

      await Promise.all(updates);

      // Deduct from seed stash
      await base44.entities.SeedLot.update(selectedSeed.id, {
        quantity: selectedSeed.quantity - selectedCells.length
      });

      // Update tray status if needed
      if (tray.status === 'empty') {
        await base44.entities.SeedTray.update(tray.id, {
          status: 'seeded',
          start_date: new Date().toISOString().split('T')[0]
        });
      }

      toast.success(`Planted ${selectedCells.length} seeds!`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error planting seeds:', error);
      toast.error('Failed to plant seeds');
    } finally {
      setPlanting(false);
    }
  };

  const filteredSeeds = seedLots.filter(s => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      s.custom_label?.toLowerCase().includes(searchLower) ||
      s.variety_name?.toLowerCase().includes(searchLower) ||
      s.plant_type_name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Plant Seeds in {selectedCells.length} Cells</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search your seed stash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Seed List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredSeeds.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {search ? 'No seeds match your search' : 'No seeds in your stash'}
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredSeeds.map(seed => {
                const displayName = seed.custom_label || 
                  (seed.variety_name && seed.plant_type_name 
                    ? `${seed.plant_type_name} - ${seed.variety_name}`
                    : seed.variety_name || seed.plant_type_name || 'Unknown');

                return (
                  <div
                    key={seed.id}
                    onClick={() => setSelectedSeed(seed)}
                    className={`
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedSeed?.id === seed.id 
                        ? 'border-emerald-600 bg-emerald-50' 
                        : 'border-gray-200 hover:border-emerald-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{displayName}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {seed.quantity} seeds available
                        </p>
                      </div>
                      {selectedSeed?.id === seed.id && (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handlePlant}
            disabled={!selectedSeed || planting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {planting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Plant {selectedCells.length} Seeds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}