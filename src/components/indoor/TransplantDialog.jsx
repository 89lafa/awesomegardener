import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TransplantDialog({ 
  isOpen, 
  onClose, 
  selectedCells, 
  trayId,
  onTransplanted 
}) {
  const [destination, setDestination] = useState('indoor_container');
  const [containerType, setContainerType] = useState('cup_3.5in');
  const [quantity, setQuantity] = useState(selectedCells?.length || 0);
  const [indoorSpaces, setIndoorSpaces] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [plotStructures, setPlotStructures] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [selectedGarden, setSelectedGarden] = useState('');
  const [selectedStructure, setSelectedStructure] = useState('');
  const [transplantDate, setTransplantDate] = useState(() => {
    const now = new Date();
    now.setHours(now.getHours() - 5);
    return now.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDestinations();
      setQuantity(selectedCells?.length || 0);
    }
  }, [isOpen, selectedCells]);

  const loadDestinations = async () => {
    try {
      const user = await base44.auth.me();
      const [spacesData, gardensData] = await Promise.all([
        base44.entities.IndoorGrowSpace.filter({ created_by: user.email }),
        base44.entities.Garden.filter({ created_by: user.email, archived: false })
      ]);
      setIndoorSpaces(spacesData);
      setGardens(gardensData);
      
      if (spacesData.length > 0) {
        setSelectedSpace(spacesData[0].id);
      }
      if (gardensData.length > 0) {
        setSelectedGarden(gardensData[0].id);
        loadPlotStructures(gardensData[0].id);
      }
    } catch (error) {
      console.error('Error loading destinations:', error);
    }
  };

  const loadPlotStructures = async (gardenId) => {
    try {
      const structures = await base44.entities.PlotStructure.filter({ garden_id: gardenId });
      setPlotStructures(structures);
      if (structures.length > 0) {
        setSelectedStructure(structures[0].id);
      }
    } catch (error) {
      console.error('Error loading plot structures:', error);
    }
  };

  const handleTransplant = async () => {
    if (!selectedCells || selectedCells.length === 0) return;

    setLoading(true);
    try {
      const user = await base44.auth.me();
      let containerCount = 0;

      for (const cell of selectedCells) {
        // Update TrayCell - EMPTY it after transplanting
        await base44.entities.TrayCell.update(cell.id, {
          status: destination === 'discard' ? 'failed' : 'empty',
          transplanted_date: transplantDate,
          transplanted_to_type: destination,
          transplanted_to_id: destination === 'indoor_container' ? selectedSpace : 
                              destination === 'outdoor_garden' ? selectedStructure : null,
          // Clear plant data when emptying
          variety_id: null,
          variety_name: null,
          plant_type_id: null,
          plant_type_name: null,
          user_seed_id: null,
          plant_profile_id: null
        });

        // Create destination record
        if (destination === 'indoor_container') {
          const displayName = cell.variety_name && cell.plant_type_name 
            ? `${cell.variety_name} - ${cell.plant_type_name}`
            : cell.variety_name || 'Plant';
            
          await base44.entities.IndoorContainer.create({
            indoor_space_id: selectedSpace,
            name: `${displayName} Cup ${++containerCount}`,
            container_type: containerType,
            variety_id: cell.variety_id,
            variety_name: cell.variety_name,
            plant_type_name: cell.plant_type_name,
            plant_type_id: cell.plant_type_id,
            plant_profile_id: cell.plant_profile_id,
            user_seed_id: cell.user_seed_id,
            crop_plan_id: cell.crop_plan_id,
            source_tray_cell_id: cell.id,
            status: 'planted',
            planted_date: transplantDate
          });
        } else if (destination === 'outdoor_garden') {
          // Create PlantInstance for outdoor garden
          const structure = plotStructures.find(s => s.id === selectedStructure);
          if (structure) {
            await base44.entities.MyPlant.create({
              garden_id: selectedGarden,
              variety_id: cell.variety_id,
              plant_profile_id: cell.plant_profile_id,
              name: cell.variety_name,
              planted_date: transplantDate,
              source_type: 'indoor_transplant',
              source_tray_cell_id: cell.id,
              notes: `Transplanted from ${cell.tray_name || 'tray'}`
            });
          }
        }
      }

      // Get tray info for global logging
      const trays = await base44.entities.SeedTray.filter({ id: trayId });
      const trayName = trays[0]?.name || 'Tray';
      
      // Adjust for timezone (-5 hours)
      const now = new Date();
      now.setHours(now.getHours() - 5);
      const adjustedTimestamp = now.toISOString();

      // Get variety info from first cell for log message
      const firstCell = selectedCells[0];
      const varietyInfo = firstCell.variety_name && firstCell.plant_type_name 
        ? `${firstCell.plant_type_name} - ${firstCell.variety_name}`
        : firstCell.variety_name || 'Unknown variety';

      // Create tray-level log entry with variety info
      await base44.entities.GrowLog.create({
        tray_id: trayId,
        log_type: 'action',
        title: `Transplanted ${selectedCells.length} ${varietyInfo} seedlings`,
        content: notes || `Moved ${selectedCells.length}x ${varietyInfo} to ${destination === 'indoor_container' ? 'containers' : destination === 'outdoor_garden' ? 'garden' : 'discarded'}`,
        logged_at: adjustedTimestamp
      });
      
      // Create space-level global log entry showing what/where
      if (destination === 'indoor_container' && selectedCells.length > 0) {
        await base44.entities.GrowLog.create({
          indoor_space_id: selectedSpace,
          log_type: 'action',
          title: `Transplanted from ${trayName}`,
          content: `${selectedCells.length}x ${varietyInfo} moved to ${containerType.replace(/_/g, ' ')} containers`,
          logged_at: adjustedTimestamp
        });
      }

      toast.success(`Successfully transplanted ${selectedCells.length} seedlings!`);
      onTransplanted?.();
      onClose();
    } catch (error) {
      console.error('Error transplanting:', error);
      toast.error('Failed to transplant seedlings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transplant Seedlings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Selected:</strong> {selectedCells?.length || 0} seedlings
            </p>
          </div>

          <div>
            <Label>Transplant To</Label>
            <RadioGroup value={destination} onValueChange={setDestination} className="mt-3 space-y-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="indoor_container" id="indoor" />
                <Label htmlFor="indoor" className="flex-1 cursor-pointer">
                  <p className="font-medium">Indoor Container (same grow space)</p>
                  <p className="text-xs text-gray-600">Up-pot to cups, pots, or grow bags</p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="outdoor_garden" id="outdoor" />
                <Label htmlFor="outdoor" className="flex-1 cursor-pointer">
                  <p className="font-medium">Outdoor Garden</p>
                  <p className="text-xs text-gray-600">Transplant to raised beds or garden plots</p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="discard" id="discard" />
                <Label htmlFor="discard" className="flex-1 cursor-pointer">
                  <p className="font-medium">Discard / Failed</p>
                  <p className="text-xs text-gray-600">Mark seedlings as failed</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Indoor Container Options */}
          {destination === 'indoor_container' && (
            <div className="space-y-4 pl-6 border-l-2 border-emerald-200">
              <div>
                <Label>Container Type</Label>
                <Select value={containerType} onValueChange={setContainerType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cup_3.5in">3.5" Cup</SelectItem>
                    <SelectItem value="cup_4in">4" Cup</SelectItem>
                    <SelectItem value="pot_1gal">1 Gallon Pot</SelectItem>
                    <SelectItem value="pot_3gal">3 Gallon Pot</SelectItem>
                    <SelectItem value="grow_bag_5gal">5 Gallon Grow Bag</SelectItem>
                    <SelectItem value="grow_bag_10gal">10 Gallon Grow Bag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Indoor Space</Label>
                <Select value={selectedSpace} onValueChange={setSelectedSpace}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {indoorSpaces.map(space => (
                      <SelectItem key={space.id} value={space.id}>{space.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Outdoor Garden Options */}
          {destination === 'outdoor_garden' && (
            <div className="space-y-4 pl-6 border-l-2 border-green-200">
              <div>
                <Label>Garden</Label>
                <Select value={selectedGarden} onValueChange={(val) => {
                  setSelectedGarden(val);
                  loadPlotStructures(val);
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gardens.map(garden => (
                      <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {plotStructures.length > 0 && (
                <div>
                  <Label>Planting Location</Label>
                  <Select value={selectedStructure} onValueChange={setSelectedStructure}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {plotStructures.map(structure => (
                        <SelectItem key={structure.id} value={structure.id}>
                          {structure.name} ({structure.structure_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Transplant Date</Label>
            <Input
              type="date"
              value={transplantDate}
              onChange={(e) => setTransplantDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transplant..."
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleTransplant}
            disabled={loading || !selectedCells || selectedCells.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transplanting...
              </>
            ) : (
              `🔄 Transplant ${quantity} Seedlings`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}