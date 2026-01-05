import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar as CalendarIcon, Sprout, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, addWeeks, addDays } from 'date-fns';

export default function CalendarPlanner() {
  const [user, setUser] = useState(null);
  const [seeds, setSeeds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, seedsData, profilesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.SeedLot.filter({ is_wishlist: false }),
        base44.entities.PlantProfile.list()
      ]);
      
      setUser(userData);
      setSeeds(seedsData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlantingWindows = (profile, lastFrostDate) => {
    if (!lastFrostDate) return null;
    
    const lastFrost = new Date(lastFrostDate);
    const windows = {};
    
    // Start indoors
    if (profile.start_indoors_weeks_before_last_frost_min) {
      windows.startIndoors = {
        start: addWeeks(lastFrost, -profile.start_indoors_weeks_before_last_frost_max || -profile.start_indoors_weeks_before_last_frost_min),
        end: addWeeks(lastFrost, -profile.start_indoors_weeks_before_last_frost_min)
      };
    }
    
    // Transplant
    if (profile.transplant_weeks_after_last_frost_min !== undefined) {
      windows.transplant = {
        start: addWeeks(lastFrost, profile.transplant_weeks_after_last_frost_min),
        end: addWeeks(lastFrost, profile.transplant_weeks_after_last_frost_max || profile.transplant_weeks_after_last_frost_min + 2)
      };
    }
    
    // Direct sow
    if (profile.direct_sow_weeks_relative_to_last_frost_min !== undefined) {
      windows.directSow = {
        start: addWeeks(lastFrost, profile.direct_sow_weeks_relative_to_last_frost_min),
        end: addWeeks(lastFrost, profile.direct_sow_weeks_relative_to_last_frost_max || profile.direct_sow_weeks_relative_to_last_frost_min + 4)
      };
    }
    
    // Harvest (estimate based on maturity)
    if (profile.days_to_maturity_seed) {
      const transplantDate = windows.transplant?.start || windows.directSow?.start || lastFrost;
      windows.harvest = {
        start: addDays(transplantDate, profile.days_to_maturity_seed - 7),
        end: addDays(transplantDate, profile.days_to_maturity_seed + 7)
      };
    }
    
    return windows;
  };

  const getThisMonthActions = () => {
    if (!user?.last_frost_date) return [];
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const actions = [];
    
    seeds.forEach(seed => {
      const profile = profiles[seed.plant_profile_id];
      if (!profile) return;
      
      const windows = calculatePlantingWindows(profile, user.last_frost_date);
      if (!windows) return;
      
      Object.entries(windows).forEach(([action, window]) => {
        if (window.start <= monthEnd && window.end >= monthStart) {
          actions.push({
            action,
            variety: profile.variety_name,
            window,
            profile
          });
        }
      });
    });
    
    return actions;
  };

  const thisMonthActions = getThisMonthActions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user?.last_frost_date) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Planting Calendar</h1>
        <Alert>
          <CalendarIcon className="w-4 h-4" />
          <AlertDescription>
            Set your last frost date in Settings to see personalized planting windows.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Planting Calendar</h1>
        <p className="text-gray-600 mt-1">
          Personalized planting schedule for Zone {user.usda_zone || 'Unknown'}
        </p>
      </div>

      {/* This Month */}
      <Card>
        <CardHeader>
          <CardTitle>This Month's Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {thisMonthActions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No planting actions this month</p>
          ) : (
            <div className="space-y-3">
              {thisMonthActions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.action === 'startIndoors' && 'Start Indoors'}
                      {item.action === 'transplant' && 'Transplant'}
                      {item.action === 'directSow' && 'Direct Sow'}
                      {item.action === 'harvest' && 'Harvest'}
                      : {item.variety}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(item.window.start, 'MMM d')} - {format(item.window.end, 'MMM d')}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {item.profile.common_name}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle>Yearly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            Full calendar view coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}