import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '../utils/useDebouncedValue';

export default function StashTypeSelector({ 
  onSelect, 
  selectedPlant,
  getSpacingForPlant,
  getDefaultSpacing,
  stashPlants: externalStashPlants,
  profiles: externalProfiles,
  varieties: externalVarieties,
  plantTypes: externalPlantTypes
}) {
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [stashPlants, setStashPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [varieties, setVarieties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use external data if provided, otherwise load
    if (externalStashPlants && externalProfiles && externalVarieties && externalPlantTypes) {
      setStashPlants(externalStashPlants);
      setProfiles(externalProfiles);
      setVarieties(externalVarieties);
      
      // Group stash by plant type
      const typeMap = new Map();
      externalStashPlants.forEach(lot => {
        const profile = externalProfiles[lot.plant_profile_id];
        if (profile?.plant_type_id) {
          if (!typeMap.has(profile.plant_type_id)) {
            typeMap.set(profile.plant_type_id, []);
          }
          typeMap.get(profile.plant_type_id).push(lot);
        }
      });

      const typesWithCounts = externalPlantTypes
        .filter(t => typeMap.has(t.id))
        .map(t => ({ ...t, count: typeMap.get(t.id).length }));

      setPlantTypes(typesWithCounts);
      setLoading(false);
    } else {
      loadData();
    }
  }, [externalStashPlants, externalProfiles, externalVarieties, externalPlantTypes]);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const [stashData, profilesData, varietiesData, typesData] = await Promise.all([
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.Variety.list('variety_name', 500),
        base44.entities.PlantType.list('common_name', 100)
      ]);

      setStashPlants(stashData);
      setVarieties(varietiesData);

      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);

      // Group stash by plant type
      const typeMap = new Map();
      stashData.forEach(lot => {
        const profile = profilesMap[lot.plant_profile_id];
        if (profile?.plant_type_id) {
          if (!typeMap.has(profile.plant_type_id)) {
            typeMap.set(profile.plant_type_id, []);
          }
          typeMap.get(profile.plant_type_id).push(lot);
        }
      });

      const typesWithCounts = typesData
        .filter(t => typeMap.has(t.id))
        .map(t => ({ ...t, count: typeMap.get(t.id).length }));

      setPlantTypes(typesWithCounts);
    } catch (error) {
      console.error('Error loading stash types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVariety = (stashItem) => {
    const profile = profiles[stashItem.plant_profile_id];
    if (!profile) return;

    const variety = varieties.find(v => 
      v.variety_name === profile.variety_name && 
      v.plant_type_id === profile.plant_type_id
    );

    const spacing = variety 
      ? getSpacingForPlant(variety) 
      : getDefaultSpacing(profile.common_name);

    const plantData = {
      variety_id: variety?.id || null,
      variety_name: profile.variety_name,
      plant_type_id: profile.plant_type_id,
      plant_type_name: profile.common_name,
      plant_family: profile.plant_family,
      spacing_cols: spacing.cols,
      spacing_rows: spacing.rows
    };

    onSelect(plantData);
  };

  const filteredTypes = plantTypes.filter(type => {
    if (!debouncedTypeSearch) return true;
    return type.common_name?.toLowerCase().includes(debouncedTypeSearch.toLowerCase());
  });

  const filteredVarieties = selectedType
    ? stashPlants
        .filter(lot => {
          const profile = profiles[lot.plant_profile_id];
          if (!profile || profile.plant_type_id !== selectedType.id) return false;
          if (debouncedSearch) {
            return profile.variety_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
          }
          return true;
        })
        .filter((lot, idx, self) => 
          idx === self.findIndex(l => profiles[l.plant_profile_id]?.variety_name === profiles[lot.plant_profile_id]?.variety_name)
        )
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (plantTypes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500">No plants in stash</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Type Selection */}
      {!selectedType ? (
        <>
          <p className="text-sm text-gray-600">Select plant type:</p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search plant types..."
              value={typeSearchQuery}
              onChange={(e) => setTypeSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[360px]">
            <div className="space-y-1">
              {filteredTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className="w-full p-3 rounded-lg border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{type.icon || '🌱'}</span>
                      <span className="font-medium text-sm">{type.common_name}</span>
                    </div>
                    <Badge variant="secondary">{type.count}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <>
          {/* Back button + Search */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedType(null);
                setSearchQuery('');
                setTypeSearchQuery('');
              }}
              className="w-full"
            >
              ← Back to Types
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search varieties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Variety List */}
          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {filteredVarieties.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No varieties found</p>
              ) : (
                filteredVarieties.map(lot => {
                  const profile = profiles[lot.plant_profile_id];
                  if (!profile) return null;
                  const isSelected = selectedPlant?.variety_name === profile.variety_name;

                  return (
                    <button
                      key={lot.id}
                      onClick={() => handleSelectVariety(lot)}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 text-left transition-colors",
                        isSelected
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <p className="font-medium text-sm">{profile.variety_name}</p>
                      <p className="text-xs text-gray-500">{profile.common_name}</p>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}