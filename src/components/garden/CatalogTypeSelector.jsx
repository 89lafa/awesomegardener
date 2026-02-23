import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '../utils/useDebouncedValue';

export default function CatalogTypeSelector({ 
  onSelect,
  selectedPlant,
  getSpacingForPlant,
  plantTypes,
  varieties,   // kept for backward compat but no longer used as the variety list
  profiles
}) {
  const [selectedType, setSelectedType] = useState(null);
  const [typeVarieties, setTypeVarieties] = useState([]);   // ← per-type, fetched on demand
  const [typeVarietiesLoading, setTypeVarietiesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeSearchQuery, setTypeSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const debouncedTypeSearch = useDebouncedValue(typeSearchQuery, 300);
  const [creating, setCreating] = useState(false);

  // ─── When user picks a type, load ALL varieties for that type ─────────────
  // Uses smartQuery with a high limit (9999) to bypass the default 100-record
  // page cap. Also gets the 30-minute cache benefit from smartQuery's TTL map,
  // so repeat visits to the same type are instant.
  useEffect(() => {
    if (!selectedType) {
      setTypeVarieties([]);
      return;
    }

    let cancelled = false;

    const fetchVarieties = async () => {
      setTypeVarietiesLoading(true);
      try {
        const { smartQuery } = await import('@/components/utils/smartQuery');
        const data = await smartQuery(
          base44,
          'Variety',
          { plant_type_id: selectedType.id },
          'variety_name',
          9999   // ← fetch every variety for this type, no ceiling
        );
        if (!cancelled) setTypeVarieties(data || []);
      } catch (err) {
        console.error('Error loading varieties for type:', err);
        if (!cancelled) toast.error('Failed to load varieties');
      } finally {
        if (!cancelled) setTypeVarietiesLoading(false);
      }
    };

    fetchVarieties();
    return () => { cancelled = true; };
  }, [selectedType]);

  // ─── Filtered lists ───────────────────────────────────────────────────────
  const filteredTypes = plantTypes.filter(type => {
    if (!debouncedTypeSearch) return true;
    return type.common_name?.toLowerCase().includes(debouncedTypeSearch.toLowerCase());
  });

  const filteredVarieties = typeVarieties.filter(v => {
    if (!debouncedSearch) return true;
    return v.variety_name?.toLowerCase().includes(debouncedSearch.toLowerCase());
  });
  // ↑ No .slice() — full list, client-side search filter only

  // ─── Select handler ───────────────────────────────────────────────────────
  const handleSelectVariety = async (variety) => {
    setCreating(true);
    try {
      const spacing = getSpacingForPlant(variety);
      const plantType = plantTypes.find(t => t.id === variety.plant_type_id);

      let profileId = variety.id;

      if (variety.plant_type_name || variety.plant_type_id) {
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

      await base44.entities.SeedLot.create({
        plant_profile_id: profileId,
        is_wishlist: false
      });

      const plantData = {
        variety_id: variety.id,
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id || null,
        plant_type_name: variety.plant_type_name || selectedType?.common_name,
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

  // ─── Loading state (waiting for plantTypes from parent) ──────────────────
  if (plantTypes.length === 0) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Type picker ── */}
      {!selectedType ? (
        <>
          <p className="text-sm text-gray-600">Select plant type:</p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  onClick={() => {
                    setSelectedType(type);
                    setSearchQuery('');
                  }}
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
        /* ── Variety picker (loaded fresh for this type) ── */
        <>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedType(null);
                setTypeVarieties([]);
                setSearchQuery('');
                setTypeSearchQuery('');
              }}
              className="w-full"
            >
              ← Back to Types
            </Button>

            {/* Type header + result count */}
            <div className="flex items-center gap-2 px-1">
              <span className="text-lg">{selectedType.icon || '🌱'}</span>
              <span className="font-semibold text-sm text-gray-800">{selectedType.common_name}</span>
              {!typeVarietiesLoading && (
                <span className="ml-auto text-xs text-gray-400">
                  {filteredVarieties.length} {filteredVarieties.length === 1 ? 'variety' : 'varieties'}
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search varieties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea className="h-[310px]">
            {typeVarietiesLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <p className="text-sm text-gray-500">Loading all varieties…</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredVarieties.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {searchQuery ? 'No varieties match your search' : 'No varieties found'}
                  </p>
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
                            : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50",
                          creating && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <p className="font-medium text-sm">{variety.variety_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {variety.days_to_maturity && (
                            <p className="text-xs text-gray-500">{variety.days_to_maturity}d to maturity</p>
                          )}
                          {variety.fruit_color && (
                            <p className="text-xs text-gray-400">{variety.fruit_color}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </>
      )}
    </div>
  );
}
