import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ExternalLink, Loader2, Edit, Package, Plus, Sprout, Sun, Calendar, Ruler, Droplets, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import AddToStashModal from '@/components/catalog/AddToStashModal';
import ReviewSection from '@/components/variety/ReviewSection';
import SpecialCareWarnings from '@/components/indoor/SpecialCareWarnings';

export default function ViewVariety() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const varietyId = searchParams.get('id');

  const [variety, setVariety] = useState(null);
  const [plantType, setPlantType] = useState(null);
  const [subCategories, setSubCategories] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestChange, setShowRequestChange] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [showAddToStash, setShowAddToStash] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imageOwnership, setImageOwnership] = useState(false);

  useEffect(() => {
    if (varietyId) {
      loadData();
    }
  }, [varietyId]);

  const loadData = async () => {
    try {
      const [userData, varietyData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Variety.filter({ id: varietyId })
      ]);

      setUser(userData);

      if (varietyData.length === 0) {
        setLoading(false);
        return;
      }

      const v = varietyData[0];
      
      if (v.status === 'removed' && v.extended_data?.merged_into_variety_id) {
        window.location.href = createPageUrl('ViewVariety') + `?id=${v.extended_data.merged_into_variety_id}`;
        return;
      }
      
      setVariety(v);

      if (v.plant_type_id) {
        const types = await base44.entities.PlantType.filter({ id: v.plant_type_id });
        if (types.length > 0) {
          setPlantType(types[0]);
        }
      }

      const allSubcatIds = v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : []);
      if (allSubcatIds.length > 0) {
        const subcats = await base44.entities.PlantSubCategory.list();
        setSubCategories(subcats.filter(s => allSubcatIds.includes(s.id)));
      }
    } catch (error) {
      console.error('Error loading variety:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!requestReason.trim()) {
      toast.error('Please provide a reason for this change request');
      return;
    }
    
    if (submitting) return; // Prevent double-submit
    setSubmitting(true);
    try {
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId,
        requested_changes: { note: 'User requested edit access' },
        reason: requestReason,
        submitted_by: user.email,
        status: 'pending'
      });

      toast.success('Change request submitted for review');
      setShowRequestChange(false);
      setRequestReason('');
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
  };

  const handleSubmitImage = async () => {
    if (!imageFile || !imageOwnership) {
      toast.error('Please upload an image and confirm ownership');
      return;
    }
    
    if (uploadingImage) return; // Prevent double-submit
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId,
        requested_changes: { images: [file_url] },
        reason: 'User submitted image for variety',
        submitted_by: user.email,
        status: 'pending'
      });

      toast.success('Image submitted for review');
      setShowAddImage(false);
      setImageFile(null);
      setImageOwnership(false);
    } catch (error) {
      console.error('Error submitting image:', error);
      toast.error('Failed to submit image');
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!varietyId || !variety) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Variety Not Found</h2>
        <Link to={createPageUrl('PlantCatalog')}>
          <Button>Back to Plant Catalog</Button>
        </Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('PlantCatalogDetail') + `?id=${variety.plant_type_id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{variety.variety_name}</h1>
          <p className="text-gray-600 text-lg">{plantType?.common_name || variety.plant_type_name}</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => setShowAddToStash(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Package className="w-4 h-4" />
            Add to Stash
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('AddIndoorPlant') + `?varietyId=${varietyId}`)}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            <Sprout className="w-4 h-4" />
            Add to My Indoor Plants
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddImage(true)}
            className="gap-2"
          >
            <Sprout className="w-4 h-4" />
            Add Image
          </Button>
          {isAdmin ? (
            <Link to={createPageUrl('EditVariety') + `?id=${varietyId}`}>
              <Button variant="outline" className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowRequestChange(true)}
              className="gap-2"
            >
              <Edit className="w-4 h-4" />
              Request Change
            </Button>
          )}
        </div>
      </div>

      {/* Images Gallery */}
      {variety?.images && variety.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {variety.images.map((url, idx) => (
            <img 
              key={idx}
              src={url} 
              alt={`${variety.variety_name} ${idx + 1}`}
              loading="lazy"
              className="w-full aspect-square object-cover rounded-xl shadow-md"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ))}
        </div>
      )}

      {/* Special Care Warnings for Carnivorous Plants */}
      <SpecialCareWarnings variety={variety} />

      {variety.affiliate_url && (
        <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Buy Seeds</p>
                  <p className="text-sm text-emerald-700">Get this variety from our trusted partner</p>
                </div>
              </div>
              <a href={variety.affiliate_url} target="_blank" rel="noopener noreferrer">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Info Card - Full Width */}
      <Card>
          <CardHeader>
            <CardTitle className="text-xl">📖 Variety Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {variety?.description && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="text-gray-700 leading-relaxed">{variety.description}</p>
              </div>
            )}

            {/* Key Growing Stats */}
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {(variety?.days_to_maturity || variety?.days_to_maturity_min) && (
                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <Calendar className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-xs text-blue-700 mb-1">Days to Maturity</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {variety.days_to_maturity || 
                     (variety.days_to_maturity_min && variety.days_to_maturity_max 
                       ? `${variety.days_to_maturity_min}-${variety.days_to_maturity_max}`
                       : variety.days_to_maturity_min)}
                  </p>
                </div>
              )}
              {variety?.sun_requirement && (
                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl border border-yellow-200">
                  <Sun className="w-6 h-6 text-yellow-600 mb-2" />
                  <p className="text-xs text-yellow-700 mb-1">Sun Exposure</p>
                  <p className="text-sm font-bold text-yellow-900 capitalize">
                    {variety.sun_requirement.replace(/_/g, ' ')}
                  </p>
                </div>
              )}
              {(variety?.spacing_recommended || variety?.spacing_min) && (
                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                  <Ruler className="w-6 h-6 text-green-600 mb-2" />
                  <p className="text-xs text-green-700 mb-1">Spacing</p>
                  <p className="text-lg font-bold text-green-900">
                    {variety.spacing_recommended || 
                     (variety.spacing_min && variety.spacing_max 
                       ? `${variety.spacing_min}-${variety.spacing_max}"`
                       : `${variety.spacing_min}"`)}
                  </p>
                </div>
              )}
              {variety?.water_requirement && (
                <div className="flex flex-col items-center p-4 bg-gradient-to-br from-cyan-50 to-blue-100 rounded-xl border border-cyan-200">
                  <Droplets className="w-6 h-6 text-cyan-600 mb-2" />
                  <p className="text-xs text-cyan-700 mb-1">Water Needs</p>
                  <p className="text-sm font-bold text-cyan-900 capitalize">{variety.water_requirement}</p>
                </div>
              )}
            </div>

            {/* Flavor & Uses */}
            {(variety?.flavor_profile || variety?.uses || variety?.fruit_color || variety?.growth_habit) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {variety.flavor_profile && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Flavor</p>
                    <p className="text-sm text-purple-900">{variety.flavor_profile}</p>
                  </div>
                )}
                {variety.uses && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Uses</p>
                    <p className="text-sm text-blue-900">{variety.uses}</p>
                  </div>
                )}
                {variety.fruit_color && (
                  <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                    <p className="text-xs font-semibold text-pink-700 mb-1">Fruit Color</p>
                    <p className="text-sm text-pink-900">{variety.fruit_color}</p>
                  </div>
                )}
                {variety.growth_habit && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700 mb-1">Growth Habit</p>
                    <p className="text-sm text-green-900 capitalize">{variety.growth_habit}</p>
                  </div>
                )}
              </div>
            )}

            {/* Heat Level */}
            {(variety?.scoville_min || variety?.scoville_max) && (
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-2xl">🌶️</div>
                  <p className="font-semibold text-red-900">Heat Level</p>
                </div>
                <p className="text-lg font-bold text-red-700">
                  {variety.scoville_min && variety.scoville_max
                    ? `${variety.scoville_min.toLocaleString()}-${variety.scoville_max.toLocaleString()}`
                    : (variety.scoville_min || variety.scoville_max).toLocaleString()} SHU
                </p>
              </div>
            )}

            {/* Breeder/Origin */}
            {variety.breeder_or_origin && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs font-semibold text-amber-700 mb-1">Breeder / Origin</p>
                <p className="text-sm text-amber-900">{variety.breeder_or_origin}</p>
              </div>
            )}

            {/* Additional Fields */}
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              {variety?.start_indoors_weeks && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-gray-600">Start Indoors</Label>
                  <p className="font-medium text-gray-900">{variety.start_indoors_weeks} weeks before frost</p>
                </div>
              )}
              {variety?.transplant_weeks_after_last_frost_min !== undefined && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-gray-600">Transplant</Label>
                  <p className="font-medium text-gray-900">{variety.transplant_weeks_after_last_frost_min} weeks after frost</p>
                </div>
              )}
              {variety?.direct_sow_weeks_min !== undefined && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-gray-600">Direct Sow</Label>
                  <p className="font-medium text-gray-900">{variety.direct_sow_weeks_min} weeks after frost</p>
                </div>
              )}
              {(variety?.plant_height_typical || variety?.height_min) && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Label className="text-xs text-gray-600">Height</Label>
                  <p className="font-medium text-gray-900">
                    {variety.plant_height_typical || 
                     (variety.height_min && variety.height_max 
                       ? `${variety.height_min}-${variety.height_max}"`
                       : variety.height_min)}
                  </p>
                </div>
              )}
            </div>

            {/* Growing Characteristics */}
            {(variety?.container_friendly || variety?.trellis_required || variety?.is_ornamental) && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Growing Characteristics</p>
                <div className="flex flex-wrap gap-2">
                  {variety.container_friendly && (
                    <Badge className="bg-blue-100 text-blue-800 px-3 py-1">📦 Container Friendly</Badge>
                  )}
                  {variety.trellis_required && (
                    <Badge className="bg-green-100 text-green-800 px-3 py-1">🌿 Needs Trellis</Badge>
                  )}
                  {variety.is_ornamental && (
                    <Badge className="bg-pink-100 text-pink-800 px-3 py-1">🌸 Ornamental</Badge>
                  )}
                  {variety.is_organic && (
                    <Badge className="bg-green-100 text-green-800 px-3 py-1">✓ Certified Organic</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Seed Type & Species */}
            {(variety?.species || variety?.seed_line_type || variety?.season_timing) && (
              <div className="flex flex-wrap gap-2">
                {variety.species && (
                  <Badge variant="outline" className="italic">Species: {variety.species}</Badge>
                )}
                {variety.seed_line_type && (
                  <Badge variant="outline">
                    {variety.seed_line_type === 'open_pollinated' ? 'Open-Pollinated' : 
                     variety.seed_line_type === 'hybrid' ? 'Hybrid' : 
                     variety.seed_line_type}
                  </Badge>
                )}
                {variety.season_timing && (
                  <Badge variant="outline" className="capitalize">Season: {variety.season_timing}</Badge>
                )}
              </div>
            )}

            {/* Notes Sections */}
            {(variety?.grower_notes || variety?.notes_public) && (
              <div className="p-4 bg-gray-50 rounded-lg border">
                <p className="font-semibold text-gray-900 mb-2">Grower Notes</p>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{variety.grower_notes || variety.notes_public}</p>
              </div>
            )}

            {variety?.seed_saving_notes && (
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="font-semibold text-emerald-900 mb-2">Seed Saving Notes</p>
                <p className="text-emerald-800">{variety.seed_saving_notes}</p>
              </div>
            )}

            {variety?.pollination_notes && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-900 mb-2">Pollination Notes</p>
                <p className="text-blue-800">{variety.pollination_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Quick Info Card - Below */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const allSubcatIds = variety?.plant_subcategory_ids || (variety?.plant_subcategory_id ? [variety.plant_subcategory_id] : []);
            return allSubcatIds.length > 0 && (
              <div>
                <Label className="text-sm text-gray-600 font-semibold">Categories</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {allSubcatIds.map(subcatId => {
                    const subcat = subCategories.find(s => s.id === subcatId);
                    return subcat ? (
                      <Badge key={subcatId} variant="secondary" className="px-3 py-1">
                        {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                        {subcat.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })()}
          
          {variety?.sources && variety.sources.length > 0 && (
            <div>
              <Label className="text-sm text-gray-600 font-semibold">Seed Sources</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {variety.sources.map((source, idx) => (
                  <Badge key={idx} variant="outline" className="px-3 py-1">{source}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRequestChange} onOpenChange={setShowRequestChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Change to {variety.variety_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Please describe what changes you'd like to make and why. An admin or moderator will review your request.
            </p>
            <div>
              <Label>Reason for Change</Label>
              <Textarea
                placeholder="e.g., I have grown this variety and found the days to maturity to be incorrect..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestChange}
              disabled={!requestReason.trim() || submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddImage} onOpenChange={setShowAddImage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Image to {variety.variety_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a photo of this variety. Images are reviewed by moderators before being added.
            </p>
            <div>
              <Label>Upload Image</Label>
              <div className="mt-2">
                {imageFile ? (
                  <div className="relative">
                    <img 
                      src={URL.createObjectURL(imageFile)} 
                      alt="Preview" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => setImageFile(null)}
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('variety-image-upload').click()}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Select Image
                  </Button>
                )}
                <input
                  id="variety-image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="imageOwnership"
                checked={imageOwnership}
                onCheckedChange={setImageOwnership}
              />
              <Label htmlFor="imageOwnership" className="text-sm font-normal">
                This image is my own and I have the right to share it
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddImage(false);
              setImageFile(null);
              setImageOwnership(false);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitImage}
              disabled={!imageFile || !imageOwnership || uploadingImage}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reviews Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">⭐ Community Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewSection varietyId={varietyId} plantProfileId={variety.plant_profile_id} />
        </CardContent>
      </Card>

      <AddToStashModal
        open={showAddToStash}
        onOpenChange={setShowAddToStash}
        variety={variety}
        plantType={plantType}
      />
    </div>
  );
}