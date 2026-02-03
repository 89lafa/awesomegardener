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
  Sprout,
  Copy,
  AlertCircle,
  Trash2
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
import FrostDateLookup from '@/components/ai/FrostDateLookup';

const USDA_ZONES = ['1a', '1b', '2a', '2b', '3a', '3b', '4a', '4b', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b', '10a', '10b', '11a', '11b', '12a', '12b', '13a', '13b'];

const BUILD_VERSION = import.meta.env.VITE_BUILD_TIMESTAMP || new Date().toISOString();

function FeatureRow({ name, status, route }) {
  const statusColor = status === 'SHIPPED' ? 'text-emerald-600' : 
                      status === 'PENDING' ? 'text-yellow-600' : 'text-gray-400';
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
      <span>{name}</span>
      <div className="flex items-center gap-2">
        {route && <span className="text-gray-400">{route}</span>}
        <span className={`font-mono ${statusColor}`}>{status}</span>
      </div>
    </div>
  );
}

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    profile_logo_url: '',
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
    community_interests: '',
    allow_messages: true
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nicknameAvailable, setNicknameAvailable] = useState(true);
  const [checkingNickname, setCheckingNickname] = useState(false);

  useEffect(() => {
    loadUser();
    loadUserSettings();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      console.debug('[Settings] user_loaded', { 
        usda_zone: userData.usda_zone,
        last_frost_date: userData.last_frost_date,
        first_frost_date: userData.first_frost_date
      });
      setUser(userData);
      setFormData({
        nickname: userData.nickname || '',
        profile_logo_url: userData.profile_logo_url || '',
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
        community_interests: userData.community_interests || '',
        allow_messages: userData.allow_messages !== false
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
      // Validate nickname if changed
      if (formData.nickname && formData.nickname !== user.nickname) {
        const { data } = await base44.functions.invoke('validateNickname', { 
          nickname: formData.nickname 
        });
        
        if (!data.available) {
          toast.error('This nickname is already taken');
          setSaving(false);
          return;
        }
      }
      
      await base44.auth.updateMe({
        nickname: formData.nickname || null,
        profile_logo_url: formData.profile_logo_url,
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
        community_interests: formData.community_interests,
        allow_messages: formData.allow_messages
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
          <TabsTrigger value="debug" className="gap-2">
            <Wrench className="w-4 h-4" />
            Debug
          </TabsTrigger>
          <TabsTrigger value="danger" className="gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            Danger Zone
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
                <Label htmlFor="nickname">Nickname / Display Name</Label>
                <Input
                  id="nickname"
                  placeholder="Your public display name"
                  value={formData.nickname}
                  onChange={async (e) => {
                    const newNick = e.target.value;
                    setFormData({ ...formData, nickname: newNick });
                    
                    // Check availability as user types
                    if (newNick.trim() && newNick !== user.nickname) {
                      setCheckingNickname(true);
                      try {
                        const { data } = await base44.functions.invoke('validateNickname', { 
                          nickname: newNick.trim() 
                        });
                        setNicknameAvailable(data.available);
                      } catch (err) {
                        console.error('Error checking nickname:', err);
                      } finally {
                        setCheckingNickname(false);
                      }
                    } else {
                      setNicknameAvailable(true);
                    }
                  }}
                  className="mt-2"
                />
                {formData.nickname && formData.nickname !== user.nickname && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    checkingNickname ? 'text-gray-500' :
                    nicknameAvailable ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {checkingNickname ? (
                      <><Loader2 className="w-3 h-3 inline animate-spin" />Checking...</>
                    ) : nicknameAvailable ? (
                      '✓ Available'
                    ) : (
                      <><AlertCircle className="w-3 h-3 inline" />Already taken</>
                    )}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">Shown on public gardens and forum posts • Others can message you using this</p>
              </div>
              
              <div>
                <Label htmlFor="logo">Profile Logo</Label>
                <div className="mt-2 space-y-3">
                  {formData.profile_logo_url && (
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                      <img 
                        src={formData.profile_logo_url} 
                        alt="Logo preview" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" 
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Current Logo</p>
                        <p className="text-xs text-gray-500">Appears on public garden cards</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData({ ...formData, profile_logo_url: '' })}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo}
                    onClick={() => document.getElementById('logo-upload-settings').click()}
                    className="w-full"
                  >
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    {formData.profile_logo_url ? 'Replace Logo' : 'Upload Logo'}
                  </Button>
                  <input
                    id="logo-upload-settings"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingLogo(true);
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setFormData({ ...formData, profile_logo_url: file_url });
                        toast.success('Logo uploaded! Click Save to apply.');
                      } catch (error) {
                        console.error('Error uploading logo:', error);
                        toast.error('Failed to upload logo');
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>
              
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
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Thermometer className="w-4 h-4" />
                    Frost Dates
                  </h4>
                  <FrostDateLookup
                    zip={formData.location_zip}
                    city={formData.location_city}
                    state={formData.location_state}
                    currentZone={formData.usda_zone}
                    currentLastFrost={formData.last_frost_date}
                    currentFirstFrost={formData.first_frost_date}
                    autoSave={false}
                    onApply={(values) => {
                      console.debug('[Settings] AI_frost_dates_applied_to_form', values);
                      setFormData({ 
                        ...formData, 
                        usda_zone: values.usda_zone || formData.usda_zone,
                        usda_zone_override: values.usda_zone_override || values.usda_zone || formData.usda_zone_override,
                        last_frost_date: values.last_frost_date || formData.last_frost_date,
                        last_frost_override: values.last_frost_override || values.last_frost_date || formData.last_frost_override,
                        first_frost_date: values.first_frost_date || formData.first_frost_date,
                        first_frost_override: values.first_frost_override || values.first_frost_date || formData.first_frost_override
                      });
                    }}
                  />
                </div>
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
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div>
                  <Label>Allow other users to message you</Label>
                  <p className="text-xs text-gray-500 mt-1">Admins can always message you</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allow_messages !== false}
                  onChange={(e) => setFormData({ ...formData, allow_messages: e.target.checked })}
                  className="w-5 h-5"
                />
              </div>
              
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

        <TabsContent value="debug" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Build & Feature Debug</CardTitle>
              <CardDescription>Technical information for troubleshooting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Build Version */}
              <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Build Version:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(BUILD_VERSION);
                      toast.success('Copied!');
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <code className="text-emerald-600">{BUILD_VERSION}</code>
              </div>

              {/* Feature Audit Checklist */}
              <div>
                <h4 className="font-semibold text-sm mb-3">🚢 Feature Ship Status:</h4>
                <div className="space-y-1 text-xs">
                  <FeatureRow name="Share Buttons (My Garden)" status="SHIPPED" route="/MyGarden" />
                  <FeatureRow name="Public Garden Page" status="SHIPPED" route="/PublicGarden" />
                  <FeatureRow name="Calendar Day Click → Panel" status="SHIPPED" route="/Calendar" />
                  <FeatureRow name="DayTasksPanel Component" status="SHIPPED" />
                  <FeatureRow name="My Plants Activity Links" status="SHIPPED" route="/MyPlants" />
                  <FeatureRow name="Effective Scheduling UI" status="SHIPPED" route="/EditVariety" />
                  <FeatureRow name="Direct Sow Fields" status="SHIPPED" />
                  <FeatureRow name="Plant Selectors in Logs" status="SHIPPED" route="/GardenDiary" />
                  <FeatureRow name="OG Meta Tags" status="SHIPPED" />
                </div>
              </div>

              {/* Live Environment Info */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Environment:</h4>
                <div className="p-3 bg-gray-50 rounded font-mono text-xs space-y-1">
                  <div>URL: {window.location.origin}</div>
                  <div>Expected: awesomegardener.com</div>
                  <div>Match: {window.location.origin.includes('awesomegardener.com') ? '✓ YES' : '✗ NO'}</div>
                </div>
              </div>

              {/* Cache Controls */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Cache Controls:</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      window.location.reload(true);
                    }}
                  >
                    🔄 Hard Reload (Ctrl+Shift+R)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                          await registration.unregister();
                        }
                        toast.success('Service workers unregistered. Reload page.');
                      } else {
                        toast.info('No service workers found');
                      }
                    }}
                  >
                    🗑️ Clear Service Workers
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      localStorage.clear();
                      sessionStorage.clear();
                      toast.success('Storage cleared. Reload page.');
                    }}
                  >
                    🧹 Clear All Storage
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
              <CardDescription className="text-red-700">
                Irreversible actions that will permanently delete your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <h4 className="font-semibold text-red-900 mb-2">Delete Account</h4>
                <p className="text-sm text-red-700 mb-4">
                  This will permanently delete your account, all your gardens, seeds, plans, and data. 
                  This action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const confirmed = confirm(
                      '⚠️ WARNING ⚠️\n\nThis will PERMANENTLY DELETE your account and ALL your data:\n\n• All gardens and plantings\n• Entire seed stash\n• Calendar plans and tasks\n• Indoor grow spaces and trays\n• All logs and diary entries\n\nThis CANNOT be undone.\n\nType "DELETE" to confirm.'
                    );
                    
                    if (!confirmed) return;
                    
                    const typed = prompt('Type DELETE in all caps to confirm:');
                    if (typed !== 'DELETE') {
                      toast.error('Account deletion cancelled');
                      return;
                    }
                    
                    try {
                      await base44.auth.deleteMe();
                      toast.success('Account deleted. Goodbye.');
                      window.location.href = '/Landing';
                    } catch (error) {
                      console.error('Error deleting account:', error);
                      toast.error('Failed to delete account: ' + error.message);
                    }
                  }}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>
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