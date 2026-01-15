import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { ArrowLeft, ExternalLink, Loader2, Edit, ShoppingCart, Package, Plus, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import AddToStashModal from '@/components/catalog/AddToStashModal';

export default function ViewVariety() {
  const [searchParams] = useSearchParams();
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
      console.log('[ViewVariety] Loading variety:', varietyId);
      const [userData, varietyData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Variety.filter({ id: varietyId })
      ]);

      setUser(userData);
      console.log('[ViewVariety] Found varieties:', varietyData.length);

      if (varietyData.length === 0) {
        console.error('[ViewVariety] Variety not found');
        setLoading(false);
        return;
      }

      const v = varietyData[0];
      console.log('[ViewVariety] Loaded variety:', v);
      
      // Check if this variety was merged into another
      if (v.status === 'removed' && v.extended_data?.merged_into_variety_id) {
        console.log('[ViewVariety] Variety was merged, redirecting to:', v.extended_data.merged_into_variety_id);
        window.location.href = createPageUrl('ViewVariety') + `?id=${v.extended_data.merged_into_variety_id}`;
        return;
      }
      
      setVariety(v);

      if (v.plant_type_id) {
        const types = await base44.entities.PlantType.filter({ id: v.plant_type_id });
        console.log('[ViewVariety] Found plant types:', types.length);
        if (types.length > 0) {
          console.log('[ViewVariety] Plant type:', types[0]);
          setPlantType(types[0]);
        }
      }

      // Load all subcategories for this variety
      const allSubcatIds = v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : []);
      if (allSubcatIds.length > 0) {
        const subcats = await base44.entities.PlantSubCategory.list();
        setSubCategories(subcats.filter(s => allSubcatIds.includes(s.id)));
      }
    } catch (error) {
      console.error('[ViewVariety] Error loading variety:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestChange = async () => {
    if (!requestReason.trim()) {
      toast.error('Please provide a reason for this change request');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId,
        requested_changes: {
          note: 'User requested edit access'
        },
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

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
      
      await base44.entities.VarietyChangeRequest.create({
        variety_id: varietyId,
        requested_changes: {
          images: [file_url]
        },
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
  const isModerator = user?.is_moderator || false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('PlantCatalogDetail') + `?id=${variety.plant_type_id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{variety.variety_name}</h1>
          <p className="text-gray-600">{plantType?.common_name || variety.plant_type_name}</p>
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
            variant="outline"
            onClick={() => setShowAddImage(true)}
            className="gap-2"
          >
            <ImageIcon className="w-4 h-4" />
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

      {variety.affiliate_url && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Buy Seeds</p>
                  <p className="text-sm text-emerald-700">Get this variety from our trusted partner</p>
                </div>
              </div>
              <a
                href={variety.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Buy Now
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Images */}
      {variety?.images && variety.images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {variety.images.map((url, idx) => (
            <img 
              key={idx}
              src={url} 
              alt={`${variety.variety_name} ${idx + 1}`}
              className="w-full aspect-square object-cover rounded-xl shadow-md"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ))}
        </div>
      )}

      {/* Overview Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📖 Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {variety?.description && (
            <div className="p-4 bg-white rounded-lg border">
              <p className="text-gray-700 leading-relaxed">{variety.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Variety Name</Label>
              <p className="font-medium mt-1">{variety?.variety_name || 'Unknown'}</p>
            </div>
            <div>
              <Label className="text-gray-600">Plant Type</Label>
              <p className="font-medium mt-1">{plantType?.common_name || variety?.plant_type_name || 'Unknown'}</p>
            </div>
            {(() => {
              const allSubcatIds = variety?.plant_subcategory_ids || (variety?.plant_subcategory_id ? [variety.plant_subcategory_id] : []);
              return allSubcatIds.length > 0 && (
                <div className="col-span-2">
                  <Label className="text-gray-600">Categories</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {allSubcatIds.map(subcatId => {
                      const subcat = subCategories.find(s => s.id === subcatId);
                      return subcat ? (
                        <Badge key={subcatId} variant="secondary">
                          {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                          {subcat.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })()}
            {(variety?.days_to_maturity || variety?.days_to_maturity_min) && (
              <div className="p-3 bg-white rounded-lg border">
                <Label className="text-gray-600 text-xs">Days to Maturity</Label>
                <p className="font-semibold text-lg mt-1">
                  {variety.days_to_maturity || 
                   (variety.days_to_maturity_min && variety.days_to_maturity_max 
                     ? `${variety.days_to_maturity_min}-${variety.days_to_maturity_max}`
                     : variety.days_to_maturity_min)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Growing Conditions Card */}
      {(variety?.spacing_recommended || variety?.spacing_min || variety?.sun_requirement || variety?.water_requirement) && (
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🌱 Growing Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {(variety?.spacing_recommended || variety?.spacing_min) && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Spacing</Label>
                  <p className="font-semibold mt-1">
                    {variety.spacing_recommended || 
                     (variety.spacing_min && variety.spacing_max 
                       ? `${variety.spacing_min}-${variety.spacing_max}"`
                       : `${variety.spacing_min}"`)}
                  </p>
                </div>
              )}
              {variety?.sun_requirement && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Sun Requirement</Label>
                  <p className="font-semibold mt-1 capitalize">{variety.sun_requirement.replace(/_/g, ' ')}</p>
                </div>
              )}
              {variety?.water_requirement && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Water Requirement</Label>
                  <p className="font-semibold mt-1 capitalize">{variety.water_requirement}</p>
                </div>
              )}
              {(variety?.plant_height_typical || variety?.height_min) && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Height</Label>
                  <p className="font-semibold mt-1">
                    {variety.plant_height_typical || 
                     (variety.height_min && variety.height_max 
                       ? `${variety.height_min}-${variety.height_max}"`
                       : variety.height_min)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flavor & Uses Card */}
      {(variety?.flavor_profile || variety?.uses || variety?.fruit_color || variety?.fruit_shape) && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🍅 Flavor & Uses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {variety.flavor_profile && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Flavor Profile</Label>
                  <p className="font-medium mt-1">{variety.flavor_profile}</p>
                </div>
              )}
              {variety.uses && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Uses</Label>
                  <p className="font-medium mt-1">{variety.uses}</p>
                </div>
              )}
              {variety.fruit_color && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Fruit Color</Label>
                  <p className="font-medium mt-1 capitalize">{variety.fruit_color}</p>
                </div>
              )}
              {variety.fruit_shape && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Fruit Shape</Label>
                  <p className="font-medium mt-1 capitalize">{variety.fruit_shape}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heat Level Card (Peppers) */}
      {(variety?.scoville_min || variety?.scoville_max) && (
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🌶️ Heat Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-white rounded-lg border text-center">
              <p className="text-3xl font-bold text-red-600">
                {variety.scoville_min && variety.scoville_max 
                  ? `${variety.scoville_min.toLocaleString()}-${variety.scoville_max.toLocaleString()}`
                  : variety.scoville_min?.toLocaleString() || variety.scoville_max?.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">Scoville Heat Units (SHU)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planting Schedule Card */}
      {(variety?.start_indoors_weeks || variety?.transplant_weeks_after_last_frost_min || variety?.direct_sow_weeks_min) && (
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📅 Planting Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {variety.start_indoors_weeks && (
                <div className="flex justify-between p-3 bg-white rounded-lg border">
                  <span className="text-gray-700">Start Indoors</span>
                  <span className="font-semibold">{variety.start_indoors_weeks} weeks before frost</span>
                </div>
              )}
              {variety.transplant_weeks_after_last_frost_min !== undefined && (
                <div className="flex justify-between p-3 bg-white rounded-lg border">
                  <span className="text-gray-700">Transplant</span>
                  <span className="font-semibold">{variety.transplant_weeks_after_last_frost_min} weeks after frost</span>
                </div>
              )}
              {variety.direct_sow_weeks_min !== undefined && (
                <div className="flex justify-between p-3 bg-white rounded-lg border">
                  <span className="text-gray-700">Direct Sow</span>
                  <span className="font-semibold">{variety.direct_sow_weeks_min} weeks after frost</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Details Card */}
      {(variety?.growth_habit || variety?.disease_resistance || variety?.breeder_or_origin) && (
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ℹ️ Additional Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {variety.growth_habit && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Growth Habit</Label>
                  <p className="font-medium mt-1 capitalize">{variety.growth_habit.replace(/_/g, ' ')}</p>
                </div>
              )}
              {variety.disease_resistance && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Disease Resistance</Label>
                  <p className="font-medium mt-1">{variety.disease_resistance}</p>
                </div>
              )}
              {variety.breeder_or_origin && (
                <div className="p-3 bg-white rounded-lg border">
                  <Label className="text-gray-600 text-xs">Breeder / Origin</Label>
                  <p className="font-medium mt-1">{variety.breeder_or_origin}</p>
                </div>
              )}
          </div>

          </div>
          </CardContent>
        </Card>
      )}

      {/* Characteristics Badges Card */}
      <Card>
        <CardHeader>
          <CardTitle>Characteristics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {variety?.trellis_required && (
              <Badge className="bg-green-100 text-green-800">Trellis Required</Badge>
            )}
            {variety?.container_friendly && (
              <Badge className="bg-blue-100 text-blue-800">Container Friendly</Badge>
            )}
            {variety?.is_ornamental && (
              <Badge className="bg-pink-100 text-pink-800">Ornamental</Badge>
            )}
            {variety?.is_organic && (
              <Badge className="bg-green-100 text-green-800">Certified Organic</Badge>
            )}
            {variety?.species && (
              <Badge variant="outline" className="italic">Species: {variety.species}</Badge>
            )}
            {variety?.seed_line_type && (
              <Badge variant="outline">
                {variety.seed_line_type === 'open_pollinated' ? 'Open-Pollinated' : 
                 variety.seed_line_type === 'hybrid' ? 'Hybrid' : 
                 variety.seed_line_type}
              </Badge>
            )}
            {variety?.season_timing && (
              <Badge variant="outline" className="capitalize">Season: {variety.season_timing}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes Cards */}
      {(variety?.seed_saving_notes || variety?.pollination_notes || variety?.grower_notes || variety?.notes_public) && (
        <Card className="bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200">
          <CardHeader>
            <CardTitle>📝 Growing Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variety.seed_saving_notes && (
              <div className="p-3 bg-white rounded-lg border">
                <Label className="text-gray-600 text-xs">Seed Saving Notes</Label>
                <p className="mt-1 text-gray-900">{variety.seed_saving_notes}</p>
              </div>
            )}
            {variety.pollination_notes && (
              <div className="p-3 bg-white rounded-lg border">
                <Label className="text-gray-600 text-xs">Pollination Notes</Label>
                <p className="mt-1 text-gray-900">{variety.pollination_notes}</p>
              </div>
            )}
            {(variety.grower_notes || variety.notes_public) && (
              <div className="p-3 bg-white rounded-lg border">
                <Label className="text-gray-600 text-xs">Grower Notes</Label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{variety.grower_notes || variety.notes_public}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seed Sources Card */}
      {variety?.sources && variety.sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🌐 Seed Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {variety.sources.map((source, idx) => (
                <Badge key={idx} variant="outline" className="px-3 py-1">{source}</Badge>
              ))}
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

      <AddToStashModal
        open={showAddToStash}
        onOpenChange={setShowAddToStash}
        variety={variety}
        plantType={plantType}
      />
    </div>
  );
}