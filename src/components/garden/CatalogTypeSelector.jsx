import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '../utils/useDebouncedValue';

export default function CatalogTypeSelector({ 
  onSelect,
  selectedPlant,
  getSpacingForPlant,
  plantTypes,
  varieties,
  profiles
}) {
  const [selectedType, setSelectedType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeSearchQuery, setTypeSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const debouncedTypeSearch = useDebouncedValue(typeSearchQuery, 300);
  const [creating, setCreating] = useState(false);

  const filteredTypes = plantTypes.filter(type => {
    if (!debouncedTypeSearch) return true;
    return type.common_name?.toLowerCase().includes(debouncedTypeSearch.toLowerCase());
  });

  const filteredVarieties = selectedType
    ? varieties
        .filter(v => {
          if (v.plant_type_id !== selectedType.id) return false;
          if (debouncedSearch) {
            return v.variety_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
          }
          return true;
        })
        .slice(0, 300) // Limit to 100 for performance
    : [];

  const handleSelectVariety = async (variety) => {
    setCreating(true);
    try {
      const spacing = getSpacingForPlant(variety);
      
      // Find or create PlantProfile
      let profileId = variety.id;
      const plantType = plantTypes.find(t => t.id === variety.plant_type_id);

      if (variety.plant_type_name) {
        const existingProfiles = await base44.entities.PlantProfile.filter({
          variety_name: variety.variety_name,
          plant_type_id: variety.plant_type_id
        });

        if (existingProfiles.length > 0) {
          profileId = existingProfiles[0].id;
        } else {
          const newProfile = await base44.entities.PlantProfile.create({
            plant_type_id: variety.plant_type_id,
            plant_subcategory_id: variety.plant_subcategory_id,
            plant_family: plantType?.plant_family_id,
            common_name: plantType?.common_name || variety.plant_type_name,
            variety_name: variety.variety_name,
            days_to_maturity_seed: variety.days_to_maturity,
            spacing_in_min: variety.spacing_recommended,
            spacing_in_max: variety.spacing_recommended,
            sun_requirement: variety.sun_requirement,
            trellis_required: variety.trellis_required || false,
            container_friendly: variety.container_friendly || false,
            notes_private: variety.grower_notes,
            source_type: 'user_private'
          });
          profileId = newProfile.id;
        }
      }

      // Check if already in stash
      const currentUser = await base44.auth.me();
      const existingStash = await base44.entities.SeedLot.filter({
        plant_profile_id: profileId,
        is_wishlist: false,
        created_by: currentUser.email
      });

      if (existingStash.length > 0) {
        toast.error('Already in your stash');
        setCreating(false);
        return;
      }

      // Create new seed lot
      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        is_wishlist: false
      });

      const plantData = {
        variety_id: variety.id,
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id || null,
        plant_type_name: variety.plant_type_name || selectedType.common_name,
        plant_family: plantType?.plant_family_id,
        spacing_cols: spacing.cols,
        spacing_rows: spacing.rows
      };

      onSelect(plantData);
      toast.success('Added to stash - click a cell to place');
    } catch (error) {
      console.error('Error adding to stash:', error);
      toast.error('Failed to add: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  if (plantTypes.length === 0) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{type.icon || '🌱'}</span>
                    <span className="font-medium text-sm">{type.common_name}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </>
      ) : (
        <>
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

          <ScrollArea className="h-[350px]">
            <div className="space-y-2">
              {filteredVarieties.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No varieties found</p>
              ) : (
                filteredVarieties.map(variety => {
                  const isSelected = selectedPlant?.variety_id === variety.id;

                  return (
                    <button
                      key={variety.id}
                      onClick={() => handleSelectVariety(variety)}
                      disabled={creating}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 text-left transition-colors",
                        isSelected
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300",
                        creating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <p className="font-medium text-sm">{variety.variety_name}</p>
                      {variety.days_to_maturity && (
                        <p className="text-xs text-gray-500">{variety.days_to_maturity} days</p>
                      )}
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