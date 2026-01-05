import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  Calendar,
  MapPin,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Star,
  Sun,
  Droplets,
  Ruler,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SeedStashDetail() {
  const [searchParams] = useSearchParams();
  const seedId = searchParams.get('id');
  const [seed, setSeed] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState({ aging_threshold_years: 2, old_threshold_years: 3 });
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditLot, setShowEditLot] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [lotForm, setLotForm] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (seedId) {
      loadSeed();
    } else {
      setNotFound(true);
      setLoading(false);
    }
  }, [seedId]);

  const loadSeed = async () => {
    try {
      const user = await base44.auth.me();
      const [seedData, userSettings] = await Promise.all([
        base44.entities.SeedLot.filter({ 
          id: seedId,
          created_by: user.email 
        }),
        base44.entities.UserSettings.filter({ created_by: user.email })
      ]);

      if (seedData.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (userSettings.length > 0 && userSettings[0].aging_threshold_years) {
        setSettings({
          aging_threshold_years: userSettings[0].aging_threshold_years,
          old_threshold_years: userSettings[0].old_threshold_years || 3
        });
      }

      const seedLot = seedData[0];
      setSeed(seedLot);
      setLotForm(seedLot);

      if (seedLot.plant_profile_id) {
        const profileData = await base44.entities.PlantProfile.filter({
          id: seedLot.plant_profile_id
        });
        if (profileData.length > 0) {
          setProfile(profileData[0]);
          setProfileForm(profileData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading seed:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getAge = () => {
    if (!seed) return 0;
    const currentYear = new Date().getFullYear();
    const year = seed.packed_for_year || seed.year_acquired;
    return year ? currentYear - year : 0;
  };

  const getAgeStatus = () => {
    const age = getAge();
    if (age >= settings.old_threshold_years) return { status: 'OLD', color: 'red', icon: Star };
    if (age >= settings.aging_threshold_years) return { status: 'AGING', color: 'amber', icon: AlertTriangle };
    return { status: 'OK', color: 'green', icon: null };
  };

  const handleSaveProfile = async () => {
    try {
      await base44.entities.PlantProfile.update(profile.id, profileForm);
      setProfile(profileForm);
      setShowEditProfile(false);
      toast.success('Variety attributes updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update attributes');
    }
  };

  const handleSaveLot = async () => {
    try {
      await base44.entities.SeedLot.update(seed.id, lotForm);
      setSeed(lotForm);
      setShowEditLot(false);
      toast.success('Lot info updated');
    } catch (error) {
      console.error('Error updating lot:', error);
      toast.error('Failed to update lot');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updatedImages = [...(seed.lot_images || []), file_url];
      await base44.entities.SeedLot.update(seed.id, { lot_images: updatedImages });
      setSeed({ ...seed, lot_images: updatedImages });
      setLotForm({ ...lotForm, lot_images: updatedImages });
      toast.success('Photo added');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoUrl) => {
    try {
      const updatedImages = seed.lot_images.filter(url => url !== photoUrl);
      await base44.entities.SeedLot.update(seed.id, { lot_images: updatedImages });
      setSeed({ ...seed, lot_images: updatedImages });
      setLotForm({ ...lotForm, lot_images: updatedImages });
      toast.success('Photo removed');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${profile?.variety_name || seed?.custom_label}"?`)) return;
    
    try {
      await base44.entities.SeedLot.delete(seed.id);
      toast.success('Seed deleted');
      window.location.href = createPageUrl('SeedStash');
    } catch (error) {
      console.error('Error deleting seed:', error);
      toast.error('Failed to delete seed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound || !seed) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Seed Not Found</h2>
            <p className="text-gray-600 mb-6">This seed doesn't exist or you don't have access to it.</p>
            <Link to={createPageUrl('SeedStash')}>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                Back to Seed Stash
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ageStatus = getAgeStatus();
  const age = getAge();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('SeedStash')}>
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Seed Stash
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {profile?.variety_name || seed.custom_label || 'Unknown Seed'}
            </h1>
            {ageStatus.status !== 'OK' && (
              <Badge variant="outline" className={cn(
                ageStatus.status === 'AGING' && "border-amber-500 text-amber-700 bg-amber-50",
                ageStatus.status === 'OLD' && "border-red-500 text-red-700 bg-red-50"
              )}>
                {ageStatus.icon && <ageStatus.icon className="w-4 h-4 mr-1" />}
                {ageStatus.status} ({age} years)
              </Badge>
            )}
          </div>
          {profile?.common_name && (
            <p className="text-gray-600 mt-1 text-lg">{profile.common_name}</p>
          )}
        </div>
        <Button 
          variant="outline" 
          onClick={handleDelete}
          className="gap-2 text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Variety Attributes */}
        {profile && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Variety Profile</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Attributes
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {profile.days_to_maturity_seed && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Days to Maturity</p>
                      <p className="font-semibold">{profile.days_to_maturity_seed} days</p>
                    </div>
                  </div>
                )}
                {profile.sun_requirement && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Sun className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-gray-500">Sun</p>
                      <p className="font-semibold capitalize">{profile.sun_requirement.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}
                {(profile.spacing_in_min || profile.spacing_in_max) && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Ruler className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Spacing</p>
                      <p className="font-semibold">
                        {profile.spacing_in_min && profile.spacing_in_max
                          ? `${profile.spacing_in_min}-${profile.spacing_in_max}"`
                          : profile.spacing_in_min || profile.spacing_in_max}
                      </p>
                    </div>
                  </div>
                )}
                {(profile.height_in_min || profile.height_in_max) && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-5 h-5 text-gray-500 flex items-center">↕</div>
                    <div>
                      <p className="text-xs text-gray-500">Height</p>
                      <p className="font-semibold">
                        {profile.height_in_min && profile.height_in_max
                          ? `${profile.height_in_min}-${profile.height_in_max}"`
                          : profile.height_in_min || profile.height_in_max}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {profile.container_friendly && (
                  <Badge variant="secondary">Container Friendly</Badge>
                )}
                {profile.trellis_required && (
                  <Badge variant="secondary">Trellis Required</Badge>
                )}
                {profile.perennial && (
                  <Badge variant="secondary">Perennial</Badge>
                )}
              </div>

              {profile.traits && Array.isArray(profile.traits) && profile.traits.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">Traits</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.traits.map((trait, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.notes_public && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{profile.notes_public}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Lot Details Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Stash Info</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditLot(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {seed.quantity && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Quantity</span>
                <Badge variant="outline">
                  {seed.quantity} {seed.unit}
                </Badge>
              </div>
            )}
            {seed.year_acquired && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Year Acquired
                </span>
                <span className="font-medium">{seed.year_acquired}</span>
              </div>
            )}
            {seed.packed_for_year && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Packed For</span>
                <span className="font-medium">{seed.packed_for_year}</span>
              </div>
            )}
            {seed.source_vendor_name && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Vendor</span>
                <div className="text-right">
                  <p className="font-medium">{seed.source_vendor_name}</p>
                  {seed.source_vendor_url && (
                    <a 
                      href={seed.source_vendor_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 justify-end"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {seed.storage_location && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Storage
                </span>
                <span className="font-medium">{seed.storage_location}</span>
              </div>
            )}
            {age > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Seed Age</span>
                <Badge variant="outline" className={cn(
                  ageStatus.status === 'AGING' && "border-amber-500 text-amber-700",
                  ageStatus.status === 'OLD' && "border-red-500 text-red-700"
                )}>
                  {age} year{age !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photos Card */}
        {seed.lot_images && seed.lot_images.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {seed.lot_images.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="Seed lot" className="w-full h-40 object-cover rounded-lg" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeletePhoto(url)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Notes */}
      {seed.lot_notes && (
        <Card>
          <CardHeader>
            <CardTitle>My Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{seed.lot_notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Variety Attributes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days to Maturity (seed)</Label>
                <Input
                  type="number"
                  value={profileForm.days_to_maturity_seed || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, days_to_maturity_seed: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Days to Maturity (transplant)</Label>
                <Input
                  type="number"
                  value={profileForm.days_to_maturity_transplant || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, days_to_maturity_transplant: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Spacing Min (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.spacing_in_min || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, spacing_in_min: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Spacing Max (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.spacing_in_max || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, spacing_in_max: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Height Min (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.height_in_min || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, height_in_min: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Height Max (inches)</Label>
                <Input
                  type="number"
                  value={profileForm.height_in_max || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, height_in_max: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Sun Requirement</Label>
              <Select 
                value={profileForm.sun_requirement || ''} 
                onValueChange={(v) => setProfileForm({ ...profileForm, sun_requirement: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select sun exposure" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sun">Full Sun</SelectItem>
                  <SelectItem value="partial_sun">Partial Sun</SelectItem>
                  <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  <SelectItem value="full_shade">Full Shade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.container_friendly || false}
                  onChange={(e) => setProfileForm({ ...profileForm, container_friendly: e.target.checked })}
                  className="rounded"
                />
                <span>Container Friendly</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.trellis_required || false}
                  onChange={(e) => setProfileForm({ ...profileForm, trellis_required: e.target.checked })}
                  className="rounded"
                />
                <span>Trellis Required</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profileForm.perennial || false}
                  onChange={(e) => setProfileForm({ ...profileForm, perennial: e.target.checked })}
                  className="rounded"
                />
                <span>Perennial</span>
              </label>
            </div>

            <div>
              <Label>Growing Notes</Label>
              <Textarea
                value={profileForm.notes_public || ''}
                onChange={(e) => setProfileForm({ ...profileForm, notes_public: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditProfile(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lot Dialog */}
      <Dialog open={showEditLot} onOpenChange={setShowEditLot}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stash Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={lotForm.quantity || ''}
                  onChange={(e) => setLotForm({ ...lotForm, quantity: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select 
                  value={lotForm.unit || 'seeds'} 
                  onValueChange={(v) => setLotForm({ ...lotForm, unit: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seeds">Seeds</SelectItem>
                    <SelectItem value="grams">Grams</SelectItem>
                    <SelectItem value="packets">Packets</SelectItem>
                    <SelectItem value="ounces">Ounces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year Acquired</Label>
                <Input
                  type="number"
                  value={lotForm.year_acquired || ''}
                  onChange={(e) => setLotForm({ ...lotForm, year_acquired: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Packed For Year</Label>
                <Input
                  type="number"
                  value={lotForm.packed_for_year || ''}
                  onChange={(e) => setLotForm({ ...lotForm, packed_for_year: parseInt(e.target.value) || null })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Vendor/Source</Label>
              <Input
                value={lotForm.source_vendor_name || ''}
                onChange={(e) => setLotForm({ ...lotForm, source_vendor_name: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Vendor URL</Label>
              <Input
                type="url"
                value={lotForm.source_vendor_url || ''}
                onChange={(e) => setLotForm({ ...lotForm, source_vendor_url: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Storage Location</Label>
              <Input
                value={lotForm.storage_location || ''}
                onChange={(e) => setLotForm({ ...lotForm, storage_location: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={lotForm.lot_notes || ''}
                onChange={(e) => setLotForm({ ...lotForm, lot_notes: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label>Photos</Label>
              <div className="mt-2 space-y-2">
                {seed.lot_images?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {seed.lot_images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <img src={url} alt="Seed lot" className="w-full h-24 object-cover rounded-lg" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDeletePhoto(url);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingPhoto}
                  onClick={() => document.getElementById('photo-upload').click()}
                  className="w-full"
                >
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Photo
                </Button>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditLot(false)}>Cancel</Button>
            <Button onClick={handleSaveLot} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}