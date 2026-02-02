import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Calendar as CalendarIcon, 
  Sprout, 
  Clock, 
  Loader2,
  Settings,
  Droplet,
  Sun,
  List,
  CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format, addWeeks, addDays, isWithinInterval } from 'date-fns';

export default function CalendarPlanner() {
  const [user, setUser] = useState(null);
  const [seeds, setSeeds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      
      // Load user's gardens and plantings to show on calendar
      const userData = await base44.auth.me();
      const gardensData = await base44.entities.Garden.filter({ 
        archived: false,
        created_by: userData.email 
      });
      
      // Batch load all plantings for user's gardens
      const [seedsData, profilesData, allPlantings] = await Promise.all([
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: userData.email }),
        base44.entities.PlantProfile.list('variety_name', 500),
        gardensData.length > 0 
          ? base44.entities.PlantInstance.filter({ created_by: userData.email })
          : Promise.resolve([])
      ]);
      
      setUser(userData);
      setSeeds(seedsData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
      
      // Store plantings for calendar display
      setPlantings(allPlantings);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePlantingWindows = (profile, lastFrostDate) => {
    if (!lastFrostDate || !profile) return null;
    
    const lastFrost = new Date(lastFrostDate);
    const windows = {};
    
    // Start indoors
    if (profile.start_indoors_weeks_before_last_frost_min !== undefined) {
      const weeksMax = profile.start_indoors_weeks_before_last_frost_max || profile.start_indoors_weeks_before_last_frost_min;
      windows.startIndoors = {
        start: addWeeks(lastFrost, -weeksMax),
        end: addWeeks(lastFrost, -profile.start_indoors_weeks_before_last_frost_min),
        label: 'Start Indoors'
      };
    }
    
    // Transplant
    if (profile.transplant_weeks_after_last_frost_min !== undefined) {
      const weeksMax = profile.transplant_weeks_after_last_frost_max || (profile.transplant_weeks_after_last_frost_min + 2);
      windows.transplant = {
        start: addWeeks(lastFrost, profile.transplant_weeks_after_last_frost_min),
        end: addWeeks(lastFrost, weeksMax),
        label: 'Transplant Out'
      };
    }
    
    // Direct sow
    if (profile.direct_sow_weeks_relative_to_last_frost_min !== undefined) {
      const weeksMax = profile.direct_sow_weeks_relative_to_last_frost_max || (profile.direct_sow_weeks_relative_to_last_frost_min + 4);
      windows.directSow = {
        start: addWeeks(lastFrost, profile.direct_sow_weeks_relative_to_last_frost_min),
        end: addWeeks(lastFrost, weeksMax),
        label: 'Direct Sow'
      };
    }
    
    // Harvest (estimate)
    const maturityDays = profile.days_to_maturity_transplant || profile.days_to_maturity_seed;
    if (maturityDays) {
      const baseDate = windows.transplant?.start || windows.directSow?.start || addWeeks(lastFrost, 2);
      windows.harvest = {
        start: addDays(baseDate, maturityDays - 7),
        end: addDays(baseDate, maturityDays + 14),
        label: 'Expected Harvest'
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
        const overlaps = window.start <= monthEnd && window.end >= monthStart;
        if (overlaps) {
          actions.push({
            action,
            variety: profile.variety_name,
            common_name: profile.common_name,
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Planting Calendar</h1>
          <Link to={createPageUrl('GrowingProfile')}>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Set Growing Profile
            </Button>
          </Link>
        </div>
        <Alert>
          <CalendarIcon className="w-4 h-4" />
          <AlertDescription>
            Set your frost dates in your Growing Profile to see personalized planting windows for your seed stash.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getAllPlantingSchedules = () => {
    if (!user?.last_frost_date) return [];
    
    const schedules = [];
    
    seeds.forEach(seed => {
      const profile = profiles[seed.plant_profile_id];
      if (!profile) return;
      
      const windows = calculatePlantingWindows(profile, user.last_frost_date);
      if (!windows) return;
      
      schedules.push({
        variety: profile.variety_name,
        common_name: profile.common_name,
        windows,
        profile
      });
    });
    
    return schedules.sort((a, b) => {
      const aStart = a.windows.startIndoors?.start || a.windows.directSow?.start || a.windows.transplant?.start;
      const bStart = b.windows.startIndoors?.start || b.windows.directSow?.start || b.windows.transplant?.start;
      if (!aStart || !bStart) return 0;
      return aStart - bStart;
    });
  };

  const allSchedules = getAllPlantingSchedules();

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Planting Calendar</h1>
          <p className="text-gray-600 mt-1">
            Personalized schedule for Zone {user.usda_zone || 'Unknown'} • Last Frost: {user.last_frost_date ? format(new Date(user.last_frost_date), 'MMM d') : 'Not Set'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-lg">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className={viewMode === 'calendar' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </div>
          <Link to={createPageUrl('GrowingProfile')}>
            <Button variant="outline" className="gap-2">
              <Settings className="w-4 h-4" />
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* This Month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            This Month's Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {thisMonthActions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No planting actions scheduled for this month</p>
          ) : (
            <div className="space-y-2">
              {thisMonthActions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {item.window.label}: {item.variety}
                    </p>
                    <p className="text-sm text-gray-600">
                      {format(item.window.start, 'MMM d')} - {format(item.window.end, 'MMM d')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {item.common_name}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Planting Schedule */}
      {viewMode === 'list' ? (
        <Card>
          <CardHeader>
            <CardTitle>Full Planting Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {allSchedules.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No seeds in your stash to schedule</p>
            ) : (
              <div className="space-y-4">
                {allSchedules.map((schedule, idx) => (
                  <div key={idx} className="border-l-4 border-emerald-500 pl-4 py-2">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{schedule.variety}</h4>
                        <p className="text-sm text-gray-600">{schedule.common_name}</p>
                      </div>
                      <div className="flex gap-2">
                        {schedule.profile.sun_requirement && (
                          <Badge variant="outline" className="text-xs">
                            <Sun className="w-3 h-3 mr-1" />
                            {schedule.profile.sun_requirement.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      {Object.entries(schedule.windows).map(([action, window]) => (
                        <div key={action} className="flex items-center gap-2 text-gray-700">
                          <span className="font-medium w-32">{window.label}:</span>
                          <span>{format(window.start, 'MMM d')} - {format(window.end, 'MMM d')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Calendar View - Planted Items</CardTitle>
          </CardHeader>
          <CardContent>
            {plantings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No plants added to your gardens yet</p>
            ) : (
              <div className="space-y-3">
                {plantings.map((planting) => (
                  <div key={planting.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-2xl">
                      {planting.plant_type_icon || '🌱'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{planting.display_name}</p>
                      <p className="text-sm text-gray-600">
                        Status: <span className="capitalize">{planting.status || 'planned'}</span>
                        {planting.planned_sow_date && ` • Sow: ${format(new Date(planting.planned_sow_date), 'MMM d')}`}
                        {planting.planned_transplant_date && ` • Transplant: ${format(new Date(planting.planned_transplant_date), 'MMM d')}`}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {planting.status === 'planned' && 'Planned'}
                      {planting.status === 'started' && 'Started'}
                      {planting.status === 'transplanted' && 'Transplanted'}
                      {planting.status === 'in_ground' && 'In Ground'}
                      {planting.status === 'harvested' && 'Harvested'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}