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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TransplantDialog({ open, onClose, selectedCells, tray, onSuccess }) {
  const [transplanting, setTransplanting] = useState(false);
  const [destinationType, setDestinationType] = useState('indoor_container');
  const [containerType, setContainerType] = useState('cup_3.5in');
  const [gardens, setGardens] = useState([]);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [notes, setNotes] = useState('');
  const [loadingGardens, setLoadingGardens] = useState(false);

  useEffect(() => {
    if (open && destinationType === 'outdoor_garden') {
      loadGardens();
    }
  }, [open, destinationType]);

  const loadGardens = async () => {
    try {
      setLoadingGardens(true);
      const user = await base44.auth.me();
      const gardensData = await base44.entities.Garden.filter({
        created_by: user.email
      });
      setGardens(gardensData);
      if (gardensData.length > 0) {
        setSelectedGarden(gardensData[0].id);
      }
    } catch (error) {
      console.error('Error loading gardens:', error);
    } finally {
      setLoadingGardens(false);
    }
  };

  const handleTransplant = async () => {
    setTransplanting(true);
    try {
      const user = await base44.auth.me();
      const timestamp = new Date().toISOString().split('T')[0];

      if (destinationType === 'indoor_container') {
        // Create indoor containers
        const containers = await Promise.all(
          selectedCells.map((cell, idx) => {
            const displayName = cell.variety_name || cell.plant_type_name || 'Seedling';
            return base44.entities.IndoorContainer.create({
              indoor_space_id: tray.indoor_space_id,
              name: `${displayName} #${idx + 1}`,
              container_type: containerType,
              variety_id: cell.variety_id,
              plant_type_id: cell.plant_type_id,
              user_seed_id: cell.user_seed_id,
              source_tray_cell_id: cell.id,
              status: 'planted',
              planted_date: timestamp
            });
          })
        );

        // Update cells as transplanted
        await Promise.all(
          selectedCells.map(cell =>
            base44.entities.TrayCell.update(cell.id, {
              status: 'transplanted',
              transplanted_date: timestamp,
              transplanted_to_type: 'indoor_container',
              transplanted_to_id: containers[0].id // Link to first container
            })
          )
        );

        toast.success(`Transplanted ${selectedCells.length} seedlings to containers`);
      } else if (destinationType === 'outdoor_garden') {
        if (!selectedGarden) {
          toast.error('Please select a garden');
          return;
        }

        // Get active season for the garden
        const garden = gardens.find(g => g.id === selectedGarden);
        const seasonId = garden?.current_season_year;

        // Create CropPlan for each cell
        await Promise.all(
          selectedCells.map(cell =>
            base44.entities.CropPlan.create({
              garden_season_id: seasonId,
              variety_id: cell.variety_id,
              plant_type_id: cell.plant_type_id,
              planting_method: 'transplant',
              status: 'planted',
              source_tray_cell_id: cell.id,
              quantity_planned: 1
            })
          )
        );

        // Update cells
        await Promise.all(
          selectedCells.map(cell =>
            base44.entities.TrayCell.update(cell.id, {
              status: 'transplanted',
              transplanted_date: timestamp,
              transplanted_to_type: 'outdoor_garden',
              transplanted_to_id: selectedGarden
            })
          )
        );

        toast.success(`Transplanted ${selectedCells.length} seedlings to garden`);
      } else if (destinationType === 'discard') {
        // Mark as failed
        await Promise.all(
          selectedCells.map(cell =>
            base44.entities.TrayCell.update(cell.id, {
              status: 'failed',
              notes: notes || 'Discarded'
            })
          )
        );

        toast.success(`Marked ${selectedCells.length} seedlings as failed`);
      }

      // Add log entry
      if (tray.id) {
        await base44.entities.GrowLog.create({
          tray_id: tray.id,
          log_type: 'action',
          title: `Transplanted ${selectedCells.length} seedlings`,
          content: `Destination: ${destinationType}${notes ? `\n${notes}` : ''}`,
          logged_at: new Date().toISOString()
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error transplanting:', error);
      toast.error('Failed to transplant seedlings');
    } finally {
      setTransplanting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Transplant {selectedCells.length} Seedlings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Destination Type */}
          <RadioGroup value={destinationType} onValueChange={setDestinationType}>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg border-2 hover:border-emerald-300 cursor-pointer">
                <RadioGroupItem value="indoor_container" id="indoor" />
                <div className="flex-1">
                  <Label htmlFor="indoor" className="font-medium cursor-pointer">
                    🪴 Indoor Container (same space)
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Move to cups or pots for more growth before outdoor planting
                  </p>
                  {destinationType === 'indoor_container' && (
                    <div className="mt-3">
                      <Select value={containerType} onValueChange={setContainerType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cup_3.5in">3.5" Cup</SelectItem>
                          <SelectItem value="cup_4in">4" Cup</SelectItem>
                          <SelectItem value="pot_1gal">1 Gallon Pot</SelectItem>
                          <SelectItem value="pot_3gal">3 Gallon Pot</SelectItem>
                          <SelectItem value="grow_bag_5gal">5 Gallon Grow Bag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border-2 hover:border-emerald-300 cursor-pointer">
                <RadioGroupItem value="outdoor_garden" id="outdoor" />
                <div className="flex-1">
                  <Label htmlFor="outdoor" className="font-medium cursor-pointer">
                    🌿 Outdoor Garden
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Transplant to outdoor beds (creates CropPlan entries)
                  </p>
                  {destinationType === 'outdoor_garden' && (
                    <div className="mt-3">
                      {loadingGardens ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading gardens...
                        </div>
                      ) : gardens.length === 0 ? (
                        <p className="text-sm text-gray-500">No gardens found. Create one first.</p>
                      ) : (
                        <Select value={selectedGarden} onValueChange={setSelectedGarden}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select garden" />
                          </SelectTrigger>
                          <SelectContent>
                            {gardens.map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg border-2 hover:border-emerald-300 cursor-pointer">
                <RadioGroupItem value="discard" id="discard" />
                <div className="flex-1">
                  <Label htmlFor="discard" className="font-medium cursor-pointer">
                    🗑️ Discard / Mark Failed
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Mark seedlings as failed or discarded
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Transplanting to 3.5 cups for 2 more weeks..."
              className="mt-1 h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleTransplant}
            disabled={transplanting || (destinationType === 'outdoor_garden' && !selectedGarden)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {transplanting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Transplant {selectedCells.length} Seedlings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}