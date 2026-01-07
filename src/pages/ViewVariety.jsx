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
  const [subCategory, setSubCategory] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestChange, setShowRequestChange] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddToStash, setShowAddToStash] = useState(false);
  const [showAddImage, setShowAddImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageOwnership, setImageOwnership] = useState(false);
  const [imageFile, setImageFile] = useState(null);

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
      setVariety(v);

      if (v.plant_type_id) {
        const types = await base44.entities.PlantType.filter({ id: v.plant_type_id });
        if (types.length > 0) setPlantType(types[0]);
      }

      if (v.plant_subcategory_id) {
        const subcats = await base44.entities.PlantSubCategory.filter({ id: v.plant_subcategory_id });
        if (subcats.length > 0) setSubCategory(subcats[0]);
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
      
      await base44.entities.VarietyImageSubmission.create({
        variety_id: varietyId,
        image_url: file_url,
        submitted_by: user.email,
        ownership_confirmed: true,
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
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Package className="w-4 h-4 mr-2" />
            Add to Seed Stash
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddImage(true)}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Add Image
          </Button>
          {isAdmin ? (
            <Link to={createPageUrl('EditVariety') + `?id=${varietyId}`}>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Edit Variety
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowRequestChange(true)}
            >
              <Edit className="w-4 h-4 mr-2" />
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

      <Card>
        <CardHeader>
          <CardTitle>Variety Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Images */}
          {variety.images && variety.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {variety.images.map((url, idx) => (
                <img 
                  key={idx}
                  src={url} 
                  alt={`${variety.variety_name} ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg shadow-sm"
                />
              ))}
            </div>
          )}

          {variety.image_url && (!variety.images || variety.images.length === 0) && (
            <div className="mb-4">
              <img 
                src={variety.image_url} 
                alt={variety.variety_name}
                className="w-full h-48 object-cover rounded-lg shadow-sm"
              />
            </div>
          )}

          {variety.description && (
            <div className="mb-4">
              <Label className="text-gray-600">Description</Label>
              <p className="mt-1 text-gray-900">{variety.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Variety Name</Label>
              <p className="font-medium mt-1">{variety.variety_name}</p>
            </div>
            <div>
              <Label className="text-gray-600">Plant Type</Label>
              <p className="font-medium mt-1">{plantType?.common_name || variety.plant_type_name}</p>
            </div>
            {subCategory && (
              <div>
                <Label className="text-gray-600">Sub-Category</Label>
                <p className="font-medium mt-1">{subCategory.name}</p>
              </div>
            )}
            {variety.days_to_maturity && (
              <div>
                <Label className="text-gray-600">Days to Maturity</Label>
                <p className="font-medium mt-1">{variety.days_to_maturity}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {variety.spacing_recommended && (
              <div>
                <Label className="text-gray-600">Spacing</Label>
                <p className="font-medium mt-1">{variety.spacing_recommended}"</p>
              </div>
            )}
            {variety.sun_requirement && (
              <div>
                <Label className="text-gray-600">Sun Requirement</Label>
                <p className="font-medium mt-1 capitalize">{variety.sun_requirement.replace(/_/g, ' ')}</p>
              </div>
            )}
            {variety.water_requirement && (
              <div>
                <Label className="text-gray-600">Water Requirement</Label>
                <p className="font-medium mt-1 capitalize">{variety.water_requirement}</p>
              </div>
            )}
            {variety.growth_habit && (
              <div>
                <Label className="text-gray-600">Growth Habit</Label>
                <p className="font-medium mt-1 capitalize">{variety.growth_habit.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {variety.trellis_required && (
              <Badge>Trellis Required</Badge>
            )}
            {variety.container_friendly && (
              <Badge>Container Friendly</Badge>
            )}
          </div>

          {variety.grower_notes && (
            <div>
              <Label className="text-gray-600">Grower Notes</Label>
              <p className="mt-1 text-gray-900">{variety.grower_notes}</p>
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

      <AddToStashModal
        open={showAddToStash}
        onOpenChange={setShowAddToStash}
        variety={variety}
        plantType={plantType}
      />
    </div>
  );
}