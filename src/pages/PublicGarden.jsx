import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, MapPin, Calendar, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ShareButton from '@/components/common/ShareButton';

function PlotItemCard({ item, plantings, gardenId }) {
  const [expanded, setExpanded] = React.useState(false);
  
  const typeColors = {
    RAISED_BED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    IN_GROUND_BED: 'bg-amber-100 text-amber-800 border-amber-300',
    GREENHOUSE: 'bg-blue-100 text-blue-800 border-blue-300',
    CONTAINER: 'bg-purple-100 text-purple-800 border-purple-300',
    GROW_BAG: 'bg-pink-100 text-pink-800 border-pink-300'
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Badge className={typeColors[item.item_type] || 'bg-gray-100 text-gray-800'}>
            {item.item_type?.replace(/_/g, ' ')}
          </Badge>
          <div className="text-left">
            <h4 className="font-semibold text-lg">{item.label}</h4>
            <p className="text-sm text-gray-600">
              {item.width}" × {item.height}" • {plantings.length} plant{plantings.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>
      
      {expanded && plantings.length > 0 && (
        <div className="p-4 bg-gray-50 border-t space-y-2">
          {plantings.map((planting) => (
            <div key={planting.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{planting.plant_type_icon || '🌱'}</span>
                <div>
                  <p className="font-medium">{planting.display_name}</p>
                  {planting.planted_date && (
                    <p className="text-xs text-gray-500">
                      Planted {new Date(planting.planted_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {planting.status && (
                <Badge variant="outline" className="capitalize">
                  {planting.status}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      
      {expanded && plantings.length === 0 && (
        <div className="p-4 bg-gray-50 border-t text-center text-gray-500 text-sm">
          No plants currently growing here
        </div>
      )}
    </div>
  );
}

export default function PublicGarden() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('id');
  const [garden, setGarden] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [plot, setPlot] = useState(null);
  const [plotItems, setPlotItems] = useState([]);
  const [plantings, setPlantings] = useState([]);
  const [myPlants, setMyPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState(null);

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

      const seasonsData = await base44.entities.GardenSeason.filter({ garden_id: gardenId }, '-year');
      setSeasons(seasonsData);
      
      const [plotsData, plotItemsData] = await Promise.all([
        base44.entities.GardenPlot.filter({ garden_id: gardenId }),
        base44.entities.PlotItem.filter({ garden_id: gardenId })
      ]);

      if (plotsData.length > 0) setPlot(plotsData[0]);
      setPlotItems(plotItemsData);
      
      // Load plantings - these are stored in PlantInstance entity
      const plantingsData = await base44.entities.PlantInstance.filter({ garden_id: gardenId });
      setPlantings(plantingsData);
      
      // Load MyPlants if season exists
      if (seasonsData.length > 0) {
        setActiveSeason(seasonsData[0]);
        const myPlantsData = await base44.entities.MyPlant.filter({ garden_season_id: seasonsData[0].id });
        setMyPlants(myPlantsData);
      }
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
          {/* Debug Info (visible to everyone for verification) */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono">
            <div className="font-semibold mb-1">Debug Info:</div>
            <div>Garden ID: {garden.id}</div>
            <div>is_public: {String(garden.is_public)}</div>
            <div>Owner: {garden.created_by}</div>
            <div>Status: ✓ Garden found and is public</div>
          </div>

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
            <div className="flex flex-col gap-2 items-end">
              <ShareButton
                title={shareTitle}
                text={shareDescription}
                url={shareUrl}
                imageUrl={shareImage}
              />
              <div className="text-xs text-gray-500 font-mono">
                OG Tags Present ✓
              </div>
            </div>
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

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-emerald-600">{plotItems.length}</div>
                <p className="text-sm text-gray-600 mt-1">Growing Spaces</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-600">{plantings.length + myPlants.length}</div>
                <p className="text-sm text-gray-600 mt-1">Active Plants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-purple-600">{seasons.length}</div>
                <p className="text-sm text-gray-600 mt-1">Seasons</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {activeSeason ? `${activeSeason.year}` : '-'}
                </div>
                <p className="text-sm text-gray-600 mt-1">Active Year</p>
              </CardContent>
            </Card>
          </div>

          {/* Garden Layout Canvas */}
          {plot && plotItems.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">Garden Layout</CardTitle>
                <p className="text-sm text-gray-600">Visual map of growing spaces</p>
              </CardHeader>
              <CardContent>
                <div className="bg-emerald-50 rounded-xl p-8 min-h-[400px] relative overflow-auto">
                  <svg
                    width={plot.width || 800}
                    height={plot.height || 600}
                    className="mx-auto"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  >
                    {/* Grid */}
                    {plot.grid_enabled && (
                      <>
                        {Array.from({ length: Math.floor(plot.width / (plot.grid_size || 12)) }).map((_, i) => (
                          <line
                            key={`v-${i}`}
                            x1={i * (plot.grid_size || 12)}
                            y1={0}
                            x2={i * (plot.grid_size || 12)}
                            y2={plot.height}
                            stroke="#d1fae5"
                            strokeWidth="1"
                          />
                        ))}
                        {Array.from({ length: Math.floor(plot.height / (plot.grid_size || 12)) }).map((_, i) => (
                          <line
                            key={`h-${i}`}
                            x1={0}
                            y1={i * (plot.grid_size || 12)}
                            x2={plot.width}
                            y2={i * (plot.grid_size || 12)}
                            stroke="#d1fae5"
                            strokeWidth="1"
                          />
                        ))}
                      </>
                    )}
                    
                    {/* Plot Items */}
                    {plotItems.map((item) => {
                      const itemPlantings = plantings.filter(p => p.bed_id === item.id);
                      const colors = {
                        RAISED_BED: '#10b981',
                        IN_GROUND_BED: '#f59e0b',
                        GREENHOUSE: '#3b82f6',
                        CONTAINER: '#8b5cf6',
                        GROW_BAG: '#ec4899'
                      };
                      const color = colors[item.item_type] || '#6b7280';
                      
                      return (
                        <g key={item.id}>
                          <rect
                            x={item.x}
                            y={item.y}
                            width={item.width}
                            height={item.height}
                            fill={color}
                            fillOpacity="0.3"
                            stroke={color}
                            strokeWidth="2"
                            rx="4"
                          />
                          <text
                            x={item.x + item.width / 2}
                            y={item.y + 20}
                            textAnchor="middle"
                            className="text-xs font-semibold"
                            fill="#1f2937"
                          >
                            {item.label}
                          </text>
                          {itemPlantings.length > 0 && (
                            <text
                              x={item.x + item.width / 2}
                              y={item.y + 35}
                              textAnchor="middle"
                              className="text-xs"
                              fill="#059669"
                            >
                              🌱 {itemPlantings.length} plant{itemPlantings.length !== 1 ? 's' : ''}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </CardContent>
            </Card>
          )}

          {/* What's Planted Where */}
          {plotItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">What's Growing Where</CardTitle>
                <p className="text-sm text-gray-600">Explore each growing space</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {plotItems.map((item) => {
                    const itemPlantings = plantings.filter(p => p.bed_id === item.id);
                    return (
                      <PlotItemCard
                        key={item.id}
                        item={item}
                        plantings={itemPlantings}
                        gardenId={gardenId}
                      />
                    );
                  })}
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