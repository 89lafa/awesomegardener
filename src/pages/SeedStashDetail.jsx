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
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function SeedStashDetail() {
  const [searchParams] = useSearchParams();
  const seedId = searchParams.get('id');
  const [seed, setSeed] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      const seedData = await base44.entities.SeedLot.filter({ 
        id: seedId,
        created_by: user.email 
      });

      if (seedData.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const seedLot = seedData[0];
      setSeed(seedLot);

      if (seedLot.plant_profile_id) {
        const profileData = await base44.entities.PlantProfile.filter({
          id: seedLot.plant_profile_id
        });
        if (profileData.length > 0) {
          setProfile(profileData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading seed:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('SeedStash')}>
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {profile?.variety_name || seed.custom_label || 'Unknown Seed'}
          </h1>
          {profile?.common_name && (
            <p className="text-gray-600 mt-1">{profile.common_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl('SeedStash') + '?edit=' + seed.id}>
            <Button variant="outline" className="gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={handleDelete}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Seed Details</CardTitle>
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
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Storage
                </span>
                <span className="font-medium">{seed.storage_location}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Growing Info Card */}
        {profile && (
          <Card>
            <CardHeader>
              <CardTitle>Growing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.days_to_maturity_seed && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Days to Maturity</span>
                  <Badge variant="outline">{profile.days_to_maturity_seed} days</Badge>
                </div>
              )}
              {profile.sun_requirement && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Sun</span>
                  <span className="font-medium capitalize">
                    {profile.sun_requirement.replace(/_/g, ' ')}
                  </span>
                </div>
              )}
              {(profile.spacing_in_min || profile.spacing_in_max) && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Spacing</span>
                  <span className="font-medium">
                    {profile.spacing_in_min && profile.spacing_in_max
                      ? `${profile.spacing_in_min}-${profile.spacing_in_max}"`
                      : profile.spacing_in_min || profile.spacing_in_max
                    }
                  </span>
                </div>
              )}
              {profile.container_friendly !== undefined && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Container Friendly</span>
                  <Badge variant={profile.container_friendly ? 'default' : 'outline'}>
                    {profile.container_friendly ? 'Yes' : 'No'}
                  </Badge>
                </div>
              )}
              {profile.trellis_required && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-600">Trellis</span>
                  <Badge>Required</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Notes */}
      {seed.lot_notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{seed.lot_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}