import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import BedGrid from '@/components/builder/BedGrid';
import { 
  ArrowLeft, 
  Lock, 
  Globe,
  ThumbsUp,
  Share2,
  Loader2,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function PublicGarden() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('id');

  const [garden, setGarden] = useState(null);
  const [plot, setPlot] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [plants, setPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPlantingsDialog, setShowPlantingsDialog] = useState(false);

  useEffect(() => {
    if (gardenId) {
      loadGarden();
    }
  }, [gardenId]);

  const loadGarden = async () => {
    try {
      const [gardenData] = await base44.entities.Garden.filter({ id: gardenId });
      
      if (!gardenData) {
        setError('Garden not found');
        setLoading(false);
        return;
      }

      // Check privacy - must be public
      if (!gardenData.is_public && gardenData.privacy !== 'public') {
        setError('This garden is private');
        setLoading(false);
        return;
      }

      if (gardenData.share_password_enabled) {
        // Check if password is in session
        const sessionPass = sessionStorage.getItem(`garden_pass_${gardenId}`);
        if (!sessionPass) {
          setNeedsPassword(true);
          setGarden(gardenData);
          setLoading(false);
          return;
        }
      }

      setGarden(gardenData);
      await loadGardenData();
    } catch (error) {
      console.error('Error loading garden:', error);
      setError('Failed to load garden');
    } finally {
      setLoading(false);
    }
  };

  const loadGardenData = async () => {
    try {
      const [plotData, plotItemsData, plantingsData, profilesData] = await Promise.all([
        base44.entities.GardenPlot.filter({ garden_id: gardenId }),
        base44.entities.PlotItem.filter({ garden_id: gardenId }),
        base44.entities.PlantInstance.filter({ garden_id: gardenId }),
        base44.entities.PlantProfile.list('variety_name', 500)
      ]);
      
      // Use new PlotItem/PlantingSpace structure
      setSpaces(plotItemsData);
      setPlants(plantingsData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
      setProfiles(profilesMap);
      
      if (plotData.length > 0) {
        setPlot(plotData[0]);
      }
    } catch (error) {
      console.error('Error loading garden data:', error);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    // Simple password check (in production, this should be server-side)
    sessionStorage.setItem(`garden_pass_${gardenId}`, password);
    setNeedsPassword(false);
    setLoading(true);
    await loadGardenData();
    setLoading(false);
  };

  const getItemPlantings = (itemId) => {
    return plants.filter(p => p.bed_id === itemId);
  };

  const handleViewPlantings = (item) => {
    setSelectedItem(item);
    setShowPlantingsDialog(true);
  };

  const handleLike = async () => {
    if (!garden) return;
    
    try {
      await base44.entities.Garden.update(garden.id, {
        like_count: (garden.like_count || 0) + 1
      });
      setGarden({ ...garden, like_count: (garden.like_count || 0) + 1 });
    } catch (error) {
      console.error('Error liking garden:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
            <p className="text-gray-600 mb-4">
              This garden may be private or doesn't exist.
            </p>
            <Link to={createPageUrl('Community')}>
              <Button variant="outline">Browse Public Gardens</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Password Protected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This garden requires a password to view.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                View Garden
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemPlantings = selectedItem ? getItemPlantings(selectedItem.id) : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Link */}
      <Link to={createPageUrl('BrowseGardens')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Browse Gardens
        </Button>
      </Link>

      {/* Garden Header */}
      <div className="aspect-video bg-gradient-to-br from-emerald-100 to-green-50 rounded-xl relative">
        {garden.cover_image ? (
          <img 
            src={garden.cover_image} 
            alt={garden.name}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Globe className="w-24 h-24 text-emerald-200" />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{garden.name}</h1>
          {garden.description && (
            <p className="text-gray-600 mt-2">{garden.description}</p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            {garden.location_region && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {garden.location_region}
              </div>
            )}
            <div className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4" />
              {garden.like_count || 0} likes
            </div>
            <span>by {garden.created_by}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleLike} variant="outline" className="gap-2">
            <ThumbsUp className="w-4 h-4" />
            Like
          </Button>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Link copied!');
            }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
      </div>

      {garden.tags && garden.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {garden.tags.map((tag, idx) => (
            <Badge key={idx} variant="secondary">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Garden Layout (Read-Only) */}
      {plot && spaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Garden Layout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-green-50 rounded-lg overflow-auto p-4" style={{ minHeight: '400px' }}>
              <svg width={plot.width} height={plot.height} className="bg-gradient-to-br from-green-50 to-emerald-50">
                {/* Grid */}
                {plot.grid_enabled && (
                  <g opacity="0.3">
                    {Array.from({ length: Math.floor(plot.width / plot.grid_size) }).map((_, i) => (
                      <line 
                        key={`v${i}`} 
                        x1={i * plot.grid_size} 
                        y1={0} 
                        x2={i * plot.grid_size} 
                        y2={plot.height} 
                        stroke="#94a3b8" 
                        strokeWidth="1"
                      />
                    ))}
                    {Array.from({ length: Math.floor(plot.height / plot.grid_size) }).map((_, i) => (
                      <line 
                        key={`h${i}`} 
                        x1={0} 
                        y1={i * plot.grid_size} 
                        x2={plot.width} 
                        y2={i * plot.grid_size} 
                        stroke="#94a3b8" 
                        strokeWidth="1"
                      />
                    ))}
                  </g>
                )}
                
                {/* Plot Items */}
                {spaces.map((item) => {
                  const itemPlantingCount = getItemPlantings(item.id).length;
                  return (
                    <g 
                      key={item.id}
                      onClick={() => handleViewPlantings(item)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <rect
                        x={item.x}
                        y={item.y}
                        width={item.width}
                        height={item.height}
                        fill={item.color || '#8B7355'}
                        stroke="#6B5D4F"
                        strokeWidth="2"
                        rx="4"
                      />
                      <text
                        x={item.x + item.width / 2}
                        y={item.y + item.height / 2}
                        textAnchor="middle"
                        fill="white"
                        fontSize="14"
                        fontWeight="600"
                      >
                        {item.label}
                      </text>
                      {itemPlantingCount > 0 && (
                        <circle
                          cx={item.x + item.width - 12}
                          cy={item.y + 12}
                          r="10"
                          fill="#10b981"
                          stroke="white"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Click on any item to see what's planted
            </p>
          </CardContent>
        </Card>
      )}

      {/* Plantings Dialog */}
      <Dialog open={showPlantingsDialog} onOpenChange={setShowPlantingsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.label} - Plantings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {itemPlantings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No plants in this space yet</p>
            ) : (
              itemPlantings.map((planting) => (
                <Card key={planting.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{planting.plant_type_icon || '🌱'}</span>
                      <div>
                        <p className="font-medium">{planting.display_name}</p>
                        <p className="text-sm text-gray-500 capitalize">
                          {planting.status}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}