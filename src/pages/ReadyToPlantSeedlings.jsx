import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Sprout, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ReadyToPlantSeedlings() {
  const [seedlings, setSeedlings] = useState([]);
  const [filteredSeedlings, setFilteredSeedlings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayNames, setDisplayNames] = useState({});

  useEffect(() => {
    loadSeedlings();
  }, []);

  const loadSeedlings = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();

      // Get all seedlings ready to plant (indoor sources only)
      // Note: TrayCell with status "ready_to_plant" can also be used for outdoor transplant
      const [containers, trayCells] = await Promise.all([
        base44.entities.IndoorContainer.filter({ created_by: user.email, status: 'ready_to_transplant' }),
        base44.entities.TrayCell.filter({ created_by: user.email, status: 'ready_to_transplant' })
      ]);

      const allSeedlings = [
        ...containers.map(c => ({ ...c, source: 'container', source_type: 'container', source_id: c.id })),
        ...trayCells.map(c => ({ ...c, source: 'tray', source_type: 'tray_cell', source_id: c.id }))
      ];

      setSeedlings(allSeedlings);
      setFilteredSeedlings(allSeedlings);

      // Load display names
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
      try {
        let name = null;
        
        // For MyPlant records, use the name directly
        if (item.source_type === 'my_plant') {
          name = item.name || 'Unknown Plant';
        } else if (item.plant_profile_id && profileMap.has(item.plant_profile_id)) {
          // For container/tray - use plant profile
          const profile = profileMap.get(item.plant_profile_id);
          const varietyName = profile.variety_name || profile.custom_label;
          const plantTypeName = profile.common_name || (profile.plant_type_id && plantTypeMap.has(profile.plant_type_id) ? plantTypeMap.get(profile.plant_type_id).common_name : '');
          name = varietyName && plantTypeName ? `${varietyName} - ${plantTypeName}` : varietyName || plantTypeName || item.name;
        } else if (item.variety_id && varietyMap.has(item.variety_id)) {
          // Fallback to variety
          const variety = varietyMap.get(item.variety_id);
          const varietyName = variety.variety_name;
          const plantTypeName = variety.plant_type_id && plantTypeMap.has(variety.plant_type_id) ? plantTypeMap.get(variety.plant_type_id).common_name : '';
          name = varietyName && plantTypeName ? `${varietyName} - ${plantTypeName}` : varietyName || plantTypeName;
        } else {
          name = item.variety_name || item.plant_type_name || item.name || 'Unknown';
        }
        
        names[item.source_id] = name;
      } catch (error) {
        names[item.source_id] = item.name || 'Unknown Seedling';
      }
    }
    
    setDisplayNames(names);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    const filtered = seedlings.filter(s => 
      displayNames[s.source_id]?.toLowerCase().includes(value.toLowerCase()) ||
      s.name?.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredSeedlings(filtered);
  };

  const getSourceLocation = (seedling) => {
    if (seedling.source_type === 'container') {
      return `${seedling.location_name || 'Container'} • ${seedling.container_type || 'Indoor'}`;
    }
    if (seedling.source_type === 'my_plant') {
      return `${seedling.location_name || 'Garden'} • Transplanted`;
    }
    return `Tray • Cell ${seedling.cell_number || '?'}`;
  };

  const getDaysInGrow = (seedling) => {
    if (seedling.seeded_date) {
      return differenceInDays(new Date(), new Date(seedling.seeded_date));
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Ready to Plant Seedlings</h1>
        <p className="text-gray-600">
          {seedlings.length} seedling{seedlings.length !== 1 ? 's' : ''} ready for transplanting to garden
        </p>
      </div>

      {seedlings.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No seedlings ready to plant yet</p>
            <p className="text-sm text-gray-500 mt-1">Start seeds indoors and mark them as ready to transplant</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by variety, plant type, or name..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid gap-4">
            {filteredSeedlings.length === 0 ? (
              <Card>
                <CardContent className="pt-8 pb-8 text-center text-gray-600">
                  No seedlings match your search
                </CardContent>
              </Card>
            ) : (
              filteredSeedlings.map((seedling) => (
                <Card key={seedling.source_id} className="hover:shadow-lg transition">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Seedling Info */}
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Seedling</p>
                        <p className="font-bold text-lg mb-1">
                          {displayNames[seedling.source_id] || seedling.name}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {seedling.source_type === 'container' ? '📦 Container' : seedling.source_type === 'my_plant' ? '🌾 Garden' : '🌱 Tray'}
                          </Badge>
                          {seedling.variety_name && (
                            <Badge variant="secondary" className="text-xs">
                              {seedling.variety_name}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Location & Age */}
                      <div>
                        <div className="mb-3">
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Location
                          </p>
                          <p className="font-medium text-sm">{getSourceLocation(seedling)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Age
                          </p>
                          <p className="font-medium text-sm">
                            {getDaysInGrow(seedling)} days in grow
                          </p>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-end justify-end">
                        <Button
                          onClick={() => {
                            // Navigate to Gardens to plant this seedling
                            window.location.href = '/Gardens';
                          }}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          Plant in Garden →
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}