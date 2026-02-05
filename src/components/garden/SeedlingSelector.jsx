import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';

export default function SeedlingSelector({ isOpen, onClose, onSeedlingSelected }) {
  const [seedlings, setSeedlings] = useState([]);
  const [filteredSeedlings, setFilteredSeedlings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayNames, setDisplayNames] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadSeedlings();
    }
  }, [isOpen]);

  const loadSeedlings = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      
      const [containers, trayCells] = await Promise.all([
        base44.entities.IndoorContainer.filter({ created_by: user.email, status: 'ready_to_transplant' }),
        base44.entities.TrayCell.filter({ created_by: user.email, status: 'ready_to_transplant' })
      ]);

      const allSeedlings = [
        ...containers.map(c => ({ ...c, source_type: 'container', source_id: c.id })),
        ...trayCells.map(c => ({ ...c, source_type: 'tray_cell', source_id: c.id }))
      ];

      setSeedlings(allSeedlings);
      setFilteredSeedlings(allSeedlings);
      
      await loadDisplayNames(allSeedlings);
    } catch (error) {
      console.error('Error loading seedlings:', error);
      toast.error('Failed to load seedlings');
    } finally {
      setLoading(false);
    }
  };

  const loadDisplayNames = async (items) => {
    const names = {};
    
    const varietyIds = new Set();
    const profileIds = new Set();
    
    for (const item of items) {
      if (item.variety_id) varietyIds.add(item.variety_id);
      if (item.plant_profile_id) profileIds.add(item.plant_profile_id);
    }
    
    const [varieties, profiles] = await Promise.all([
      varietyIds.size > 0 ? base44.entities.Variety.list() : Promise.resolve([]),
      profileIds.size > 0 ? base44.entities.PlantProfile.list() : Promise.resolve([])
    ]);
    
    const varietyMap = new Map(varieties.map(v => [v.id, v]));
    const profileMap = new Map(profiles.map(p => [p.id, p]));
    
    const plantTypeIds = new Set();
    varieties.forEach(v => { if (v.plant_type_id) plantTypeIds.add(v.plant_type_id); });
    profiles.forEach(p => { if (p.plant_type_id) plantTypeIds.add(p.plant_type_id); });
    
    const plantTypes = plantTypeIds.size > 0 ? await base44.entities.PlantType.list() : [];
    const plantTypeMap = new Map(plantTypes.map(pt => [pt.id, pt]));
    
    for (const item of items) {
      let varietyName = null;
      let plantTypeName = null;
      
      if (item.variety_id && varietyMap.has(item.variety_id)) {
        const variety = varietyMap.get(item.variety_id);
        varietyName = variety.variety_name;
        if (variety.plant_type_id && plantTypeMap.has(variety.plant_type_id)) {
          plantTypeName = plantTypeMap.get(variety.plant_type_id).common_name;
        }
      } else if (item.plant_profile_id && profileMap.has(item.plant_profile_id)) {
        const profile = profileMap.get(item.plant_profile_id);
        varietyName = profile.variety_name || profile.custom_label;
        plantTypeName = profile.common_name;
        if (!plantTypeName && profile.plant_type_id && plantTypeMap.has(profile.plant_type_id)) {
          plantTypeName = plantTypeMap.get(profile.plant_type_id).common_name;
        }
      }
      
      if (!varietyName) varietyName = item.variety_name || item.custom_label;
      if (!plantTypeName) plantTypeName = item.plant_type_name;
      
      if (varietyName && plantTypeName) {
        names[item.source_id] = `${varietyName} - ${plantTypeName}`;
      } else {
        names[item.source_id] = varietyName || plantTypeName || item.name || 'Unknown';
      }
    }
    
    setDisplayNames(names);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    const filtered = seedlings.filter(s => 
      displayNames[s.source_id]?.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSeedlings(filtered);
  };

  const getSourceLocation = (seedling) => {
    if (seedling.source_type === 'container') {
      return `${seedling.location_name || 'Container'}`;
    }
    return `Tray Cell ${seedling.cell_number || '?'}`;
  };

  const getDaysInGrow = (seedling) => {
    if (seedling.seeded_date) {
      return differenceInDays(new Date(), new Date(seedling.seeded_date));
    }
    return 0;
  };

  const handleSelectSeedling = (seedling) => {
    onSeedlingSelected({
      seedling_source_id: seedling.source_id,
      seedling_source_type: seedling.source_type,
      seedling_age_days: getDaysInGrow(seedling),
      seedling_location: getSourceLocation(seedling),
      variety_id: seedling.variety_id,
      plant_profile_id: seedling.plant_profile_id,
      plant_type_id: seedling.plant_type_id,
      display_name: displayNames[seedling.source_id] || seedling.name
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Seedling to Transplant</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search seedlings..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredSeedlings.length === 0 ? (
                <p className="text-sm text-gray-500 p-4 text-center">No seedlings found</p>
              ) : (
                filteredSeedlings.map((seedling) => (
                  <button
                    key={seedling.source_id}
                    onClick={() => handleSelectSeedling(seedling)}
                    className="w-full p-3 border rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">
                          {displayNames[seedling.source_id] || seedling.name}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {seedling.source_type === 'container' ? '📦 Container' : '🌱 Tray'}
                        </Badge>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p className="flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          {getDaysInGrow(seedling)}d
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {getSourceLocation(seedling)}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}