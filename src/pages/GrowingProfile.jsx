import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Calendar, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function GrowingProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    location_zip: '',
    usda_zone: '',
    last_frost_date: '',
    first_frost_date: '',
    frost_source: 'MANUAL',
    calendar_start_season_mode: 'SPRING',
    winter_sowing_enabled: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      setFormData({
        location_zip: userData.location_zip || '',
        usda_zone: userData.usda_zone_override || userData.usda_zone || '',
        last_frost_date: userData.last_frost_override || userData.last_frost_date || '',
        first_frost_date: userData.first_frost_override || userData.first_frost_date || '',
        frost_source: userData.frost_source || 'MANUAL',
        calendar_start_season_mode: userData.calendar_start_season_mode || 'SPRING',
        winter_sowing_enabled: userData.winter_sowing_enabled || false
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        location_zip: formData.location_zip,
        usda_zone: formData.usda_zone,
        last_frost_date: formData.last_frost_date,
        first_frost_date: formData.first_frost_date,
        last_frost_override: formData.last_frost_date,
        first_frost_override: formData.first_frost_date,
        frost_source: formData.frost_source,
        calendar_start_season_mode: formData.calendar_start_season_mode,
        winter_sowing_enabled: formData.winter_sowing_enabled
      });
      
      toast.success('Growing profile saved!');
      await loadData();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Growing Profile</h1>
        <p className="text-gray-600 mt-1">Set your location and frost dates for personalized planting schedules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Location & Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="e.g., 12345"
                value={formData.location_zip}
                onChange={(e) => setFormData({ ...formData, location_zip: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="zone">USDA Hardiness Zone</Label>
              <Select 
                value={formData.usda_zone} 
                onValueChange={(v) => setFormData({ ...formData, usda_zone: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {['3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b'].map(zone => (
                    <SelectItem key={zone} value={zone}>Zone {zone}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Frost Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="last_frost">Last Spring Frost</Label>
              <Input
                id="last_frost"
                type="date"
                value={formData.last_frost_date}
                onChange={(e) => setFormData({ ...formData, last_frost_date: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Average date of last frost in spring</p>
            </div>
            <div>
              <Label htmlFor="first_frost">First Fall Frost</Label>
              <Input
                id="first_frost"
                type="date"
                value={formData.first_frost_date}
                onChange={(e) => setFormData({ ...formData, first_frost_date: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Average date of first frost in fall</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendar Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="season">Default Season Start</Label>
            <Select 
              value={formData.calendar_start_season_mode} 
              onValueChange={(v) => setFormData({ ...formData, calendar_start_season_mode: v })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPRING">Spring</SelectItem>
                <SelectItem value="SUMMER">Summer</SelectItem>
                <SelectItem value="FALL">Fall</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}