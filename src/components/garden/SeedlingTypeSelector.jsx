import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, Loader2, Sprout } from 'lucide-react';

export default function SeedlingTypeSelector({ 
  onSelect, 
  selectedPlant,
  getSpacingForPlant,
  getDefaultSpacing,
  plantTypes
}) {
  const [seedlings, setSeedlings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSeedlings();
  }, []);

  const loadSeedlings = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      
      // Fetch all TrayCell records that are ready for transplant
      const readyCells = await base44.entities.TrayCell.filter({
        created_by: user.email,
        status: { $in: ['germinated', 'growing'] }
      });

      // Group by variety/plant_type for display
      const grouped = readyCells.reduce((acc, cell) => {
        const key = `${cell.variety_id || 'unknown'}_${cell.plant_type_id || 'unknown'}`;
        if (!acc[key]) {
          acc[key] = {
            variety_id: cell.variety_id,
            variety_name: cell.variety_name,
            plant_type_id: cell.plant_type_id,
            plant_type_name: cell.plant_type_name,
            plant_profile_id: cell.plant_profile_id,
            cells: []
          };
        }
        acc[key].cells.push(cell);
        return acc;
      }, {});

      const seedlingsList = Object.values(grouped);
      console.log('[SeedlingTypeSelector] Loaded', seedlingsList.length, 'seedling types,', readyCells.length, 'total cells');
      setSeedlings(seedlingsList);
    } catch (error) {
      console.error('Error loading seedlings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSeedlings = seedlings.filter(s => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      s.variety_name?.toLowerCase().includes(search) ||
      s.plant_type_name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (seedlings.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No seedlings ready for transplant</p>
        <p className="text-xs text-gray-500 mt-1">Start seeds in Indoor Grow to see them here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search seedlings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredSeedlings.map((seedling, idx) => {
          const isSelected = selectedPlant?.seedling_group === `${seedling.variety_id}_${seedling.plant_type_id}`;
          const displayName = seedling.variety_name && seedling.plant_type_name
            ? `${seedling.plant_type_name} - ${seedling.variety_name}`
            : seedling.variety_name || seedling.plant_type_name || 'Unknown';

          return (
            <button
              key={idx}
              onClick={() => {
                // Calculate spacing
                const spacing = getSpacingForPlant(
                  seedling.plant_type_id, 
                  null
                ) || getDefaultSpacing(seedling.plant_type_name);

                const plantData = {
                  source: 'seedling',
                  seedling_group: `${seedling.variety_id}_${seedling.plant_type_id}`,
                  available_cells: seedling.cells,
                  variety_id: seedling.variety_id,
                  variety_name: seedling.variety_name,
                  plant_type_id: seedling.plant_type_id,
                  plant_type_name: seedling.plant_type_name,
                  plant_profile_id: seedling.plant_profile_id,
                  spacing_cols: spacing.cols,
                  spacing_rows: spacing.rows,
                  plantsPerSlot: spacing.plantsPerSlot || 1
                };

                onSelect(plantData);
              }}
              className={cn(
                "w-full p-3 rounded-lg border-2 text-left transition-all",
                isSelected
                  ? "bg-emerald-50 border-emerald-500 shadow-sm"
                  : "bg-white border-gray-200 hover:border-emerald-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    🌱 {seedling.cells.length} seedling{seedling.cells.length !== 1 ? 's' : ''} ready
                  </p>
                </div>
                <Sprout className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}