import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ExternalLink, Loader2, Edit, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

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
        
        {isAdmin && (
          <Link to={createPageUrl('EditVariety') + `?id=${varietyId}`}>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit Variety
            </Button>
          </Link>
        )}

        {!isAdmin && (
          <Button
            variant="outline"
            onClick={() => setShowRequestChange(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Request Change
          </Button>
        )}
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

          {variety.description && (
            <div>
              <Label className="text-gray-600">Description</Label>
              <p className="mt-1 text-gray-900">{variety.description}</p>
            </div>
          )}

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
    </div>
  );
}