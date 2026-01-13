import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const ZONE_INFO = {
  '3a': { min: -40, max: -35, description: 'Very cold winters' },
  '3b': { min: -35, max: -30, description: 'Very cold winters' },
  '4a': { min: -30, max: -25, description: 'Cold winters' },
  '4b': { min: -25, max: -20, description: 'Cold winters' },
  '5a': { min: -20, max: -15, description: 'Cold winters' },
  '5b': { min: -15, max: -10, description: 'Cold winters' },
  '6a': { min: -10, max: -5, description: 'Cool winters' },
  '6b': { min: -5, max: 0, description: 'Cool winters' },
  '7a': { min: 0, max: 5, description: 'Moderate winters' },
  '7b': { min: 5, max: 10, description: 'Moderate winters' },
  '8a': { min: 10, max: 15, description: 'Mild winters' },
  '8b': { min: 15, max: 20, description: 'Mild winters' },
  '9a': { min: 20, max: 25, description: 'Warm winters' },
  '9b': { min: 25, max: 30, description: 'Warm winters' },
  '10a': { min: 30, max: 35, description: 'Very warm winters' },
  '10b': { min: 35, max: 40, description: 'Very warm winters' }
};

export default function ZoneMap() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    location_zip: '',
    location_city: '',
    location_state: '',
    usda_zone: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      // Use SAME fields as Settings → Location tab (from user object)
      setFormData({
        location_zip: userData.location_zip || '',
        location_city: userData.location_city || '',
        location_state: userData.location_state || '',
        usda_zone: userData.usda_zone_override || userData.usda_zone || ''
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLookupZone = () => {
    // Simple deterministic helper - user selects from map or dropdown
    toast.info('Please select your zone from the dropdown below, or reference the USDA map');
    // Scroll to zone selector
    document.getElementById('zone-selector')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to SAME user fields as Settings → Location
      await base44.auth.updateMe({
        location_zip: formData.location_zip,
        location_city: formData.location_city,
        location_state: formData.location_state,
        usda_zone_override: formData.usda_zone
      });
      toast.success('Zone saved! This updates your Settings → Location.');
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
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

  const zoneInfo = formData.usda_zone ? ZONE_INFO[formData.usda_zone] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" />
          USDA Hardiness Zone
        </h1>
        <p className="text-gray-600 text-sm">Set your zone for personalized planting recommendations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>ZIP Code (optional)</Label>
            <Input
              value={formData.location_zip}
              onChange={(e) => setFormData({ ...formData, location_zip: e.target.value })}
              placeholder="Enter ZIP for reference"
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use the map below to find your zone, then select it from the dropdown
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>City</Label>
              <Input
                value={formData.location_city}
                onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>State</Label>
              <Input
                value={formData.location_state}
                onChange={(e) => setFormData({ ...formData, location_state: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>

          <div id="zone-selector">
            <Label>USDA Zone *</Label>
            <Select value={formData.usda_zone} onValueChange={(v) => setFormData({ ...formData, usda_zone: v })}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select your zone" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ZONE_INFO).map(zone => (
                  <SelectItem key={zone} value={zone}>
                    Zone {zone} ({ZONE_INFO[zone].min}°F to {ZONE_INFO[zone].max}°F)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {zoneInfo && (
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="font-medium text-emerald-900">Zone {formData.usda_zone}</p>
              <p className="text-sm text-emerald-700">
                Average minimum winter temperature: {zoneInfo.min}°F to {zoneInfo.max}°F
              </p>
              <p className="text-sm text-emerald-600 mt-1">{zoneInfo.description}</p>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !formData.usda_zone}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Zone Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>USDA Hardiness Zone Map</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            ℹ️ Your zone & frost dates are set in Settings → Location and used across Calendar/Tasks
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">📍 Find Your Zone Online</h4>
            <p className="text-sm text-blue-800 mb-3">
              Use the official USDA Plant Hardiness Zone Map to identify your exact zone.
            </p>
            <a
              href="https://planthardiness.ars.usda.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button className="bg-blue-600 hover:bg-blue-700">
                Open Official USDA Zone Finder →
              </Button>
            </a>
            <p className="text-xs text-blue-600 mt-2">
              Enter your ZIP code on the official site, then return here and select your zone from the dropdown above
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg border text-center">
            <p className="text-sm text-gray-600">
              The interactive USDA map is a government-maintained tool. We link to it rather than embedding to ensure you always have access to the most up-to-date zone information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}