import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanTypeSelector({ 
  activeSeason, 
  garden, 
  bedId,
  selectedPlanId,
  onSelectPlan,
  getSpacingForPlant,
  getDefaultSpacing,
  plantings
}) {
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [cropPlans, setCropPlans] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [varieties, setVarieties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
    
    // Real-time updates when plantings change
    if (garden && activeSeason) {
      const timer = setInterval(() => loadPlans(), 2000);
      return () => clearInterval(timer);
    }
  }, [activeSeason, garden]);

  const loadPlans = async () => {
    if (!activeSeason || !garden) return;

    try {
      const user = await base44.auth.me();
      const seasons = await base44.entities.GardenSeason.filter({
        garden_id: garden.id,
        season_key: activeSeason
      });

      if (seasons.length === 0) {
        setLoading(false);
        return;
      }

      const season = seasons[0];
      const [plans, profilesData, typesData, varietiesData] = await Promise.all([
        base44.entities.CropPlan.filter({ garden_season_id: season.id, created_by: user.email }),
        base44.entities.PlantProfile.list('variety_name', 500),
        base44.entities.PlantType.list('common_name', 100),
        base44.entities.Variety.list('variety_name', 500)
      ]);

      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);
      setVarieties(varietiesData);

      // Count plantings per plan
      const plansWithCounts = plans.map(plan => {
        const profile = profilesMap[plan.plant_profile_id];
        const plantedCount = plantings.filter(p =>
          p.plant_type_id === plan.plant_type_id &&
          (profile ? p.variety_id === profile.id || p.display_name?.includes(profile.variety_name) : true)
        ).length;
        return { ...plan, plantedCount };
      });

      setCropPlans(plansWithCounts);

      // Group by type
      const typeMap = new Map();
      plansWithCounts.forEach(plan => {
        if (plan.plant_type_id) {
          if (!typeMap.has(plan.plant_type_id)) {
            typeMap.set(plan.plant_type_id, []);
          }
          typeMap.get(plan.plant_type_id).push(plan);
        }
      });

      const typesWithCounts = typesData
        .filter(t => typeMap.has(t.id))
        .map(t => ({ ...t, count: typeMap.get(t.id).length }));

      setPlantTypes(typesWithCounts);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = selectedType
    ? cropPlans.filter(plan => {
        if (plan.plant_type_id !== selectedType.id) return false;
        if (searchQuery) {
          const profile = profiles[plan.plant_profile_id];
          const label = plan.label?.toLowerCase() || '';
          const varietyName = profile?.variety_name?.toLowerCase() || '';
          return label.includes(searchQuery.toLowerCase()) || 
                 varietyName.includes(searchQuery.toLowerCase());
        }
        return true;
      })
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
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No planned crops for this season</p>
        <p className="text-xs text-gray-500 mt-1">Visit the Calendar page to schedule crops</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!selectedType ? (
        <>
          <p className="text-sm text-gray-600">Select plant type:</p>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {plantTypes.map(type => (
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
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedType(null);
                setSearchQuery('');
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
              {filteredPlans.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No varieties found</p>
              ) : (
                filteredPlans.map(plan => {
                  const profile = profiles[plan.plant_profile_id];
                  const isSelected = selectedPlanId === plan.id;

                  return (
                    <button
                      key={plan.id}
                      onClick={async () => {
                        const variety = varieties.find(v =>
                          v.variety_name === profile?.variety_name &&
                          v.plant_type_id === plan.plant_type_id
                        );

                        const spacing = variety
                          ? getSpacingForPlant(variety)
                          : getDefaultSpacing(profile?.common_name);

                        const plantData = {
                          variety_id: variety?.id || null,
                          variety_name: profile?.variety_name || plan.label,
                          plant_type_id: plan.plant_type_id,
                          plant_type_name: selectedType.common_name,
                          plant_family: selectedType.plant_family_id || profile?.plant_family,
                          spacing_cols: spacing.cols,
                          spacing_rows: spacing.rows,
                          crop_plan_id: plan.id
                        };

                        onSelectPlan(plantData, plan);
                      }}
                      className={cn(
                        "w-full p-3 rounded-lg border-2 text-left transition-colors",
                        isSelected
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {selectedType?.common_name || 'Plant'}
                            {(profile?.variety_name || plan.label) && (
                              <span className="text-gray-600"> - {profile?.variety_name || plan.label}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {plan.plantedCount || 0} of {plan.quantity_planned || 1} planted
                          </p>
                        </div>
                      </div>
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