import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Settings as SettingsIcon, 
  User, 
  MapPin, 
  Thermometer,
  Save,
  Loader2,
  Download,
  Upload,
  Users,
  Wrench,
  Sprout
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';

const USDA_ZONES = ['1a', '1b', '2a', '2b', '3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b', '11a', '11b', '12a', '12b', '13a', '13b'];

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    avatar_url: '',
    location_zip: '',
    location_city: '',
    location_state: '',
    usda_zone: '',
    usda_zone_override: '',
    last_frost_date: '',
    last_frost_override: '',
    first_frost_date: '',
    first_frost_override: '',
    units: 'imperial',
    week_start: 'sunday',
    community_bio: '',
    community_interests: ''
  });

  useEffect(() => {
    loadUser();
    loadUserSettings();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      setFormData({
        full_name: userData.full_name || '',
        avatar_url: userData.avatar_url || '',
        location_zip: userData.location_zip || '',
        location_city: userData.location_city || '',
        location_state: userData.location_state || '',
        usda_zone: userData.usda_zone || '',
        usda_zone_override: userData.usda_zone_override || '',
        last_frost_date: userData.last_frost_date || '',
        last_frost_override: userData.last_frost_override || '',
        first_frost_date: userData.first_frost_date || '',
        first_frost_override: userData.first_frost_override || '',
        units: userData.units || 'imperial',
        week_start: userData.week_start || 'sunday',
        community_bio: userData.community_bio || '',
        community_interests: userData.community_interests || ''
      });
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserSettings = async () => {
    try {
      const userData = await base44.auth.me();
      const settings = await base44.entities.UserSettings.filter({ user_email: userData.email });
      if (settings.length > 0) {
        setUserSettings(settings[0]);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        avatar_url: formData.avatar_url,
        location_zip: formData.location_zip,
        location_city: formData.location_city,
        location_state: formData.location_state,
        usda_zone: formData.usda_zone,
        usda_zone_override: formData.usda_zone_override,
        last_frost_date: formData.last_frost_date,
        last_frost_override: formData.last_frost_override,
        first_frost_date: formData.first_frost_date,
        first_frost_override: formData.first_frost_override,
        units: formData.units,
        week_start: formData.week_start,
        community_bio: formData.community_bio,
        community_interests: formData.community_interests
      });
      toast.success('Settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExportSeeds = async () => {
    try {
      const seeds = await base44.entities.SeedLot.list();
      const csv = [
        ['Plant Type', 'Variety', 'Source', 'Year', 'Quantity', 'Unit', 'Storage', 'Notes', 'Wishlist'].join(','),
        ...seeds.map(s => [
          s.plant_type_name || '',
          s.variety_name || s.custom_name || '',
          s.source_company || '',
          s.year || '',
          s.quantity || '',
          s.quantity_unit || '',
          s.storage_location || '',
          (s.notes || '').replace(/,/g, ';'),
          s.is_wishlist ? 'Yes' : 'No'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'seed_stash.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Seeds exported!');
    } catch (error) {
      console.error('Error exporting seeds:', error);
      toast.error('Failed to export seeds');
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="location" className="gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <SettingsIcon className="w-4 h-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="community" className="gap-2">
            <User className="w-4 h-4" />
            Community
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Download className="w-4 h-4" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  disabled
                  className="mt-2 bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Name cannot be changed here</p>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-2 bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="avatar">Avatar URL</Label>
                <Input
                  id="avatar"
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="location" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Location & Growing Zone</CardTitle>
              <CardDescription>Set your location for accurate planting schedules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="12345"
                    value={formData.location_zip}
                    onChange={(e) => setFormData({ ...formData, location_zip: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.location_city}
                    onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.location_state}
                    onChange={(e) => setFormData({ ...formData, location_state: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>USDA Zone</Label>
                  <Select 
                    value={formData.usda_zone_override || formData.usda_zone} 
                    onValueChange={(v) => setFormData({ ...formData, usda_zone_override: v })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {USDA_ZONES.map(zone => (
                        <SelectItem key={zone} value={zone}>Zone {zone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" />
                  Frost Dates
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lastFrost">Last Frost (Spring)</Label>
                    <Input
                      id="lastFrost"
                      type="date"
                      value={formData.last_frost_override || formData.last_frost_date}
                      onChange={(e) => setFormData({ ...formData, last_frost_override: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstFrost">First Frost (Fall)</Label>
                    <Input
                      id="firstFrost"
                      type="date"
                      value={formData.first_frost_override || formData.first_frost_date}
                      onChange={(e) => setFormData({ ...formData, first_frost_override: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="community" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Community Board Preferences</CardTitle>
              <CardDescription>Customize your community profile and signature</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="community_bio">Bio</Label>
                <Input
                  id="community_bio"
                  placeholder="Tell the community about yourself..."
                  value={formData.community_bio || ''}
                  onChange={(e) => setFormData({ ...formData, community_bio: e.target.value })}
                  className="mt-2"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">Shows in your forum signature</p>
              </div>
              <div>
                <Label htmlFor="community_interests">Gardening Interests</Label>
                <Input
                  id="community_interests"
                  placeholder="e.g., Hot peppers, Heirloom tomatoes, Vertical gardening"
                  value={formData.community_interests || ''}
                  onChange={(e) => setFormData({ ...formData, community_interests: e.target.value })}
                  className="mt-2"
                  maxLength={80}
                />
                <p className="text-xs text-gray-500 mt-1">Displayed in your posts</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview Signature:</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                  {formData.usda_zone && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>Zone {formData.usda_zone}</span>
                    </div>
                  )}
                  {formData.location_city && formData.location_state && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{formData.location_city}, {formData.location_state}</span>
                    </div>
                  )}
                  {formData.community_interests && (
                    <div className="flex items-center gap-1">
                      <Sprout className="w-3 h-3" />
                      <span className="italic">{formData.community_interests}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize how the app works for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Measurement Units</Label>
                <Select 
                  value={formData.units} 
                  onValueChange={(v) => setFormData({ ...formData, units: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial">Imperial (feet, inches)</SelectItem>
                    <SelectItem value="metric">Metric (meters, cm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Week Starts On</Label>
                <Select 
                  value={formData.week_start} 
                  onValueChange={(v) => setFormData({ ...formData, week_start: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Download your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-2">Export Seed Stash</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Download your seed collection as a CSV file
                </p>
                <Button variant="outline" onClick={handleExportSeeds}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {user?.role === 'admin' && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Admin Tools</CardTitle>
                <CardDescription>Administrative functions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to={createPageUrl('AdminDataImport')}>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Upload className="w-4 h-4" />
                    Data Import
                  </Button>
                </Link>
                <Link to={createPageUrl('AdminDataMaintenance')}>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Wrench className="w-4 h-4" />
                    Admin Maintenance
                  </Button>
                </Link>
                <Link to={createPageUrl('Users')}>
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="w-4 h-4" />
                    Manage Users
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}