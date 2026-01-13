import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Sprout, MapPin, Calendar, Activity, AlertTriangle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import ShareButton from '@/components/common/ShareButton';

export default function PublicPlant() {
  const [searchParams] = useSearchParams();
  const plantId = searchParams.get('id');
  const [plant, setPlant] = useState(null);
  const [profile, setProfile] = useState(null);
  const [garden, setGarden] = useState(null);
  const [location, setLocation] = useState(null);
  const [diaryCount, setDiaryCount] = useState(0);
  const [issueCount, setIssueCount] = useState(0);
  const [harvestCount, setHarvestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (plantId) {
      loadPlant();
    }
  }, [plantId]);

  const loadPlant = async () => {
    try {
      const plants = await base44.entities.MyPlant.filter({ id: plantId });
      if (plants.length === 0) {
        setLoading(false);
        return;
      }

      const p = plants[0];
      setPlant(p);

      if (p.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: p.plant_profile_id });
        if (profiles.length > 0) setProfile(profiles[0]);
      }

      // Load garden and location
      if (p.garden_season_id) {
        const seasons = await base44.entities.GardenSeason.filter({ id: p.garden_season_id });
        if (seasons.length > 0 && seasons[0].garden_id) {
          const gardens = await base44.entities.Garden.filter({ id: seasons[0].garden_id });
          if (gardens.length > 0) setGarden(gardens[0]);
        }
      }

      if (p.garden_item_id) {
        const items = await base44.entities.PlotItem.filter({ id: p.garden_item_id });
        if (items.length > 0) setLocation(items[0]);
      }

      // Count activities
      const [diaries, issues, harvests] = await Promise.all([
        base44.entities.GardenDiary.filter({ plant_instance_id: plantId }),
        base44.entities.IssueLog.filter({ plant_instance_id: plantId }),
        base44.entities.HarvestLog.filter({ plant_instance_id: plantId })
      ]);
      setDiaryCount(diaries.length);
      setIssueCount(issues.length);
      setHarvestCount(harvests.length);
    } catch (error) {
      console.error('Error loading plant:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Plant not found</p>
        </div>
      </div>
    );
  }

  const shareUrl = window.location.href;
  const shareTitle = `${plant.name || profile?.variety_name} - AwesomeGardener`;
  const shareText = `Check out this ${profile?.common_name || 'plant'} on AwesomeGardener!`;
  const shareImage = plant.photos?.[0]?.url || 'https://awesomegardener.com/og-default.jpg';

  return (
    <>
      <Helmet>
        <title>{shareTitle}</title>
        <meta name="description" content={shareText} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareText} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareText} />
        <meta name="twitter:image" content={shareImage} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {plant.name || profile?.variety_name || 'Plant'}
          </h1>
          <ShareButton
            title={shareTitle}
            text={shareText}
            url={shareUrl}
            imageUrl={shareImage}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Location Card */}
          {(garden || location) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {garden && garden.is_public && (
                  <div>
                    <p className="text-sm text-gray-600">Garden</p>
                    <a 
                      href={`${window.location.origin}/PublicGarden?id=${garden.id}`}
                      className="font-semibold text-emerald-600 hover:underline"
                    >
                      {garden.name}
                    </a>
                  </div>
                )}
                {location && (
                  <div>
                    <p className="text-sm text-gray-600">Growing in</p>
                    <p className="font-semibold">{location.label}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {location.item_type?.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stages Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Growth Stage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plant.status && (
                <div>
                  <p className="text-sm text-gray-600">Observed Stage</p>
                  <Badge className="capitalize">{plant.status}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">📔 Diary Entries</span>
                <span className="font-semibold">{diaryCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">🐛 Issues Tracked</span>
                <span className="font-semibold">{issueCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">🌾 Harvests</span>
                <span className="font-semibold">{harvestCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Photo Gallery */}
        {plant.photos && plant.photos.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Photo Gallery</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {plant.photos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square group">
                    <img
                      src={photo.url}
                      alt={photo.caption || 'Plant photo'}
                      className="w-full h-full object-cover rounded-lg shadow-md"
                    />
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs rounded-b-lg">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>{profile?.variety_name || 'Plant Details'}</CardTitle>
            <p className="text-gray-600">{profile?.common_name}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Milestones */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Key Milestones
              </h3>
              <div className="space-y-2">
                {plant.germination_date && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm">🌱 Germination</span>
                    <span className="font-semibold">
                      {format(new Date(plant.germination_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {plant.transplant_date && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm">🌿 Transplant</span>
                    <span className="font-semibold">
                      {format(new Date(plant.transplant_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {plant.first_harvest_date && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm">🌾 First Harvest</span>
                    <span className="font-semibold">
                      {format(new Date(plant.first_harvest_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Health Status */}
            {plant.health_status && (
              <div>
                <h3 className="font-semibold mb-2">Health Status</h3>
                <Badge 
                  className={
                    plant.health_status === 'thriving' ? 'bg-green-100 text-green-800' :
                    plant.health_status === 'struggling' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }
                >
                  {plant.health_status === 'thriving' ? '✨ Thriving' :
                   plant.health_status === 'struggling' ? '⚠️ Struggling' :
                   '✓ OK'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Shared from <a href="/" className="text-emerald-600 hover:underline">AwesomeGardener</a></p>
        </div>
      </div>
      </div>
    </>
  );
}