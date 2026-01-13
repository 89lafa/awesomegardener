import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Sprout } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import ShareButton from '@/components/common/ShareButton';

export default function PublicPlant() {
  const [searchParams] = useSearchParams();
  const plantId = searchParams.get('id');
  const [plant, setPlant] = useState(null);
  const [profile, setProfile] = useState(null);
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

        <Card>
          <CardHeader>
            <CardTitle>{profile?.variety_name}</CardTitle>
            <p className="text-gray-600">{profile?.common_name}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {plant.photos && plant.photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {plant.photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo.url}
                    alt={photo.caption || 'Plant photo'}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>
            )}

            <div>
              <span className="text-sm font-medium text-gray-700">Status: </span>
              <Badge>{plant.status}</Badge>
            </div>

            {plant.germination_date && (
              <p className="text-sm text-gray-600">
                🌱 Germinated: {format(new Date(plant.germination_date), 'MMMM d, yyyy')}
              </p>
            )}

            {plant.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{plant.notes}</p>
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