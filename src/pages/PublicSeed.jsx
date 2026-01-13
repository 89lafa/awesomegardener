import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Package, Sun, Droplets, Ruler, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ShareButton from '@/components/common/ShareButton';

export default function PublicSeed() {
  const [searchParams] = useSearchParams();
  const seedId = searchParams.get('id');
  const [profile, setProfile] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (seedId) {
      loadSeed();
    }
  }, [seedId]);

  const loadSeed = async () => {
    try {
      const seeds = await base44.entities.SeedLot.filter({ id: seedId });
      if (seeds.length === 0) {
        setLoading(false);
        return;
      }

      const seed = seeds[0];
      if (seed.lot_images) setImages(seed.lot_images);

      if (seed.plant_profile_id) {
        const profiles = await base44.entities.PlantProfile.filter({ id: seed.plant_profile_id });
        if (profiles.length > 0) setProfile(profiles[0]);
      }
    } catch (error) {
      console.error('Error loading seed:', error);
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">Seed not found or not shared</p>
        </div>
      </div>
    );
  }

  const shareUrl = window.location.href;
  const shareTitle = `${profile.variety_name} - Seed Sharing`;
  const shareText = `Check out this ${profile.common_name} variety!`;
  const shareImage = images[0] || 'https://awesomegardener.com/og-default.jpg';

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
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{profile.variety_name}</h1>
              <p className="text-xl text-gray-600 mt-1">{profile.common_name}</p>
            </div>
            <ShareButton
              title={shareTitle}
              text={shareText}
              url={shareUrl}
              imageUrl={shareImage}
            />
          </div>

          {/* Photo Gallery */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt="Variety photo"
                  className="w-full aspect-square object-cover rounded-xl shadow-md"
                />
              ))}
            </div>
          )}

          {/* Key Growing Stats */}
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {profile.days_to_maturity_seed && (
              <div className="flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <Calendar className="w-6 h-6 text-blue-600 mb-2" />
                <p className="text-xs text-blue-700 mb-1">Days to Maturity</p>
                <p className="text-2xl font-bold text-blue-900">{profile.days_to_maturity_seed}</p>
              </div>
            )}
            {profile.sun_requirement && (
              <div className="flex flex-col items-center p-4 bg-gradient-to-br from-yellow-50 to-amber-100 rounded-xl border border-yellow-200">
                <Sun className="w-6 h-6 text-yellow-600 mb-2" />
                <p className="text-xs text-yellow-700 mb-1">Sun Exposure</p>
                <p className="text-sm font-bold text-yellow-900 capitalize">
                  {profile.sun_requirement.replace(/_/g, ' ')}
                </p>
              </div>
            )}
            {(profile.spacing_in_min || profile.spacing_in_max) && (
              <div className="flex flex-col items-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
                <Ruler className="w-6 h-6 text-green-600 mb-2" />
                <p className="text-xs text-green-700 mb-1">Spacing</p>
                <p className="text-lg font-bold text-green-900">
                  {profile.spacing_in_min && profile.spacing_in_max
                    ? `${profile.spacing_in_min}-${profile.spacing_in_max}"`
                    : `${profile.spacing_in_min || profile.spacing_in_max}"`}
                </p>
              </div>
            )}
            {profile.water_requirement && (
              <div className="flex flex-col items-center p-4 bg-gradient-to-br from-cyan-50 to-blue-100 rounded-xl border border-cyan-200">
                <Droplets className="w-6 h-6 text-cyan-600 mb-2" />
                <p className="text-xs text-cyan-700 mb-1">Water Needs</p>
                <p className="text-sm font-bold text-cyan-900 capitalize">
                  {profile.water_requirement}
                </p>
              </div>
            )}
          </div>

          {/* Additional Details */}
          <div className="grid gap-6">
            {(profile.height_in_min || profile.height_in_max || (profile.heat_scoville_min || profile.heat_scoville_max)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Variety Details</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  {(profile.height_in_min || profile.height_in_max) && (
                    <div className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-gray-600" />
                        <p className="font-semibold text-gray-900">Plant Height</p>
                      </div>
                      <p className="text-lg text-gray-700">
                        {profile.height_in_min && profile.height_in_max
                          ? `${profile.height_in_min}-${profile.height_in_max} inches`
                          : `${profile.height_in_min || profile.height_in_max} inches`}
                      </p>
                    </div>
                  )}
                  {(profile.heat_scoville_min || profile.heat_scoville_max) && (
                    <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg border border-red-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl">🌶️</div>
                        <p className="font-semibold text-red-900">Heat Level</p>
                      </div>
                      <p className="text-lg font-bold text-red-700">
                        {profile.heat_scoville_min && profile.heat_scoville_max
                          ? `${profile.heat_scoville_min.toLocaleString()}-${profile.heat_scoville_max.toLocaleString()}`
                          : (profile.heat_scoville_min || profile.heat_scoville_max).toLocaleString()} SHU
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Growing Characteristics */}
            {(profile.container_friendly || profile.trellis_required || profile.perennial) && (
              <Card>
                <CardHeader>
                  <CardTitle>Growing Characteristics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.container_friendly && (
                      <Badge className="bg-blue-100 text-blue-800 px-3 py-1">📦 Container Friendly</Badge>
                    )}
                    {profile.trellis_required && (
                      <Badge className="bg-green-100 text-green-800 px-3 py-1">🌿 Needs Trellis</Badge>
                    )}
                    {profile.perennial && (
                      <Badge className="bg-purple-100 text-purple-800 px-3 py-1">🔄 Perennial</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Traits */}
            {profile.traits && Array.isArray(profile.traits) && profile.traits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Variety Traits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.traits.map((trait, idx) => (
                      <Badge key={idx} className="bg-emerald-600 text-white px-3 py-1">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Growing Notes */}
            {profile.notes_public && (
              <Card>
                <CardHeader>
                  <CardTitle>Growing Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{profile.notes_public}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Shared from <a href="/" className="text-emerald-600 hover:underline">AwesomeGardener</a></p>
          </div>
        </div>
      </div>
    </>
  );
}