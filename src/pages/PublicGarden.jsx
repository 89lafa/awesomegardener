import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, MapPin, Calendar, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ShareButton from '@/components/common/ShareButton';

export default function PublicGarden() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('id');
  const [garden, setGarden] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [plots, setPlots] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (gardenId) {
      loadGarden();
    }
  }, [gardenId]);

  const loadGarden = async () => {
    try {
      // First try to fetch by ID without is_public filter
      const gardens = await base44.entities.Garden.filter({ id: gardenId });
      
      if (gardens.length === 0) {
        console.log('[PublicGarden] Garden not found:', gardenId);
        setLoading(false);
        return;
      }

      const g = gardens[0];
      console.log('[PublicGarden] Fetched garden:', { id: g.id, name: g.name, is_public: g.is_public, owner: g.created_by });
      
      // Check if public
      if (!g.is_public) {
        console.log('[PublicGarden] Garden is not public');
        setGarden({ ...g, _notPublic: true });
        setLoading(false);
        return;
      }

      setGarden(g);

      const [seasonsData, plotsData] = await Promise.all([
        base44.entities.GardenSeason.filter({ garden_id: gardenId }, '-year'),
        base44.entities.PlotItem.filter({ garden_id: gardenId })
      ]);

      setSeasons(seasonsData);
      setPlots(plotsData);
    } catch (error) {
      console.error('Error loading garden:', error);
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

  if (!garden) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 mb-2">Garden not found</p>
          <p className="text-sm text-gray-600">
            This garden may have been deleted or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  if (garden._notPublic) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <Sprout className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900 mb-2">This garden is private</p>
          <p className="text-sm text-gray-600 mb-4">
            The owner has not made this garden public. Ask them to enable public sharing in their garden settings.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const shareUrl = window.location.href;
  const shareTitle = `${garden.name} - AwesomeGardener`;
  const shareDescription = garden.description || `Check out ${garden.name} on AwesomeGardener!`;
  const shareImage = garden.cover_image || 'https://awesomegardener.com/og-default.jpg';

  return (
    <>
      <Helmet>
        <title>{shareTitle}</title>
        <meta name="description" content={shareDescription} />
        <meta property="og:title" content={shareTitle} />
        <meta property="og:description" content={shareDescription} />
        <meta property="og:image" content={shareImage} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shareTitle} />
        <meta name="twitter:description" content={shareDescription} />
        <meta name="twitter:image" content={shareImage} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{garden.name}</h1>
              {garden.description && <p className="text-gray-600 mt-2">{garden.description}</p>}
              {garden.location_region && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {garden.location_region}
                </p>
              )}
            </div>
            <ShareButton
              title={shareTitle}
              text={shareDescription}
              url={shareUrl}
              imageUrl={shareImage}
            />
          </div>

          {garden.cover_image && (
            <img 
              src={garden.cover_image}
              alt={garden.name}
              className="w-full h-96 object-cover rounded-xl mb-6"
            />
          )}

          {seasons.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Growing Seasons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {seasons.map(s => (
                    <Badge key={s.id} variant="outline">
                      {s.year} {s.season}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {plots.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Garden Layout ({plots.length} beds/plots)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plots.map(plot => (
                    <div key={plot.id} className="p-4 bg-white rounded-lg border">
                      <h4 className="font-semibold">{plot.label}</h4>
                      <p className="text-sm text-gray-600 capitalize">{plot.item_type?.replace(/_/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Shared from <a href="/" className="text-emerald-600 hover:underline">AwesomeGardener</a></p>
          </div>
        </div>
      </div>
    </>
  );
}