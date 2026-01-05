import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function FromPlanTab({ activeSeason, garden, onSelectPlan }) {
  const [cropPlans, setCropPlans] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [plantTypes, setPlantTypes] = useState({});
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadPlans();
  }, [activeSeason, garden]);
  
  const loadPlans = async () => {
    if (!activeSeason || !garden) return;
    
    try {
      const user = await base44.auth.me();
      
      // Get the season record
      const seasons = await base44.entities.GardenSeason.filter({
        garden_id: garden.id,
        season_key: activeSeason
      });
      
      if (seasons.length === 0) {
        setLoading(false);
        return;
      }
      
      const season = seasons[0];
      
      // Load crop plans for this season
      const plans = await base44.entities.CropPlan.filter({
        garden_season_id: season.id,
        created_by: user.email,
        is_placed: false // Only show unplaced plans
      });
      
      setCropPlans(plans);
      
      // Load related data
      const profileIds = [...new Set(plans.map(p => p.plant_profile_id).filter(Boolean))];
      const typeIds = [...new Set(plans.map(p => p.plant_type_id).filter(Boolean))];
      
      const [profilesData, typesData] = await Promise.all([
        Promise.all(profileIds.map(id => base44.entities.PlantProfile.filter({ id }))),
        Promise.all(typeIds.map(id => base44.entities.PlantType.filter({ id })))
      ]);
      
      const profilesMap = {};
      profilesData.flat().forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);
      
      const typesMap = {};
      typesData.flat().forEach(t => { typesMap[t.id] = t; });
      setPlantTypes(typesMap);
      
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const markAsPlaced = async (planId) => {
    try {
      await base44.entities.CropPlan.update(planId, { is_placed: true });
      // Remove from list
      setCropPlans(cropPlans.filter(p => p.id !== planId));
    } catch (error) {
      console.error('Error marking plan as placed:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }
  
  if (cropPlans.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">No planned crops for this season</p>
        <p className="text-xs text-gray-500 mt-1">
          Visit the Calendar page to schedule crops
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600 mb-3">
        Select a crop from your calendar plan to place in this bed:
      </p>
      {cropPlans.map(plan => {
        const profile = profiles[plan.plant_profile_id];
        const plantType = plantTypes[plan.plant_type_id];
        
        return (
          <button
            key={plan.id}
            onClick={() => {
              onSelectPlan(plan);
              markAsPlaced(plan.id);
            }}
            className={cn(
              "w-full p-3 rounded-lg border-2 text-left transition-colors",
              "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
            )}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: plan.color_hex || '#10b981' }}
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {profile?.variety_name || plan.label || 'Unnamed Crop'}
                </p>
                <p className="text-xs text-gray-500">
                  {plantType?.common_name || profile?.common_name}
                  {plan.label && ` • ${plan.label}`}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}