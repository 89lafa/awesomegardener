import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import BedGrid from '@/components/builder/BedGrid';
import { 
  TreeDeciduous, 
  ArrowLeft, 
  Lock, 
  Globe,
  User,
  Calendar,
  Layers,
  Sprout,
  Loader2,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import AdBanner from '@/components/monetization/AdBanner';

export default function PublicGarden() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('id');

  const [garden, setGarden] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [beds, setBeds] = useState([]);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedSpace, setSelectedSpace] = useState(null);

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

      // Check privacy
      if (gardenData.privacy === 'private') {
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
      const [spacesData, bedsData, plantsData] = await Promise.all([
        base44.entities.GardenSpace.filter({ garden_id: gardenId }),
        base44.entities.Bed.filter({ garden_id: gardenId }),
        base44.entities.PlantInstance.filter({ garden_id: gardenId })
      ]);
      setSpaces(spacesData);
      setBeds(bedsData);
      setPlants(plantsData);
      if (spacesData.length > 0) {
        setSelectedSpace(spacesData[0]);
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

  const getBedsForSpace = (spaceId) => beds.filter(b => b.space_id === spaceId);
  const getPlantsForBed = (bedId) => plants.filter(p => p.bed_id === bedId);

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

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link to={createPageUrl('Community')}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Community
        </Button>
      </Link>

      {/* Garden Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{garden?.name}</h1>
            <Badge className="bg-emerald-100 text-emerald-700">
              <Globe className="w-3 h-3 mr-1" />
              Public
            </Badge>
          </div>
          {garden?.description && (
            <p className="text-gray-600 mb-4">{garden.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Layers className="w-4 h-4" />
              {spaces.length} space{spaces.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Sprout className="w-4 h-4" />
              {plants.length} plant{plants.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Updated {format(new Date(garden?.updated_date || new Date()), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        <AdBanner placement="inline_card" pageType="garden_builder" className="w-full lg:w-64" />
      </div>

      {/* Spaces */}
      {spaces.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <TreeDeciduous className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No spaces in this garden yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Space Tabs */}
          {spaces.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {spaces.map((space) => (
                <Button
                  key={space.id}
                  variant={selectedSpace?.id === space.id ? 'default' : 'outline'}
                  onClick={() => setSelectedSpace(space)}
                  className={selectedSpace?.id === space.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                >
                  {space.name}
                </Button>
              ))}
            </div>
          )}

          {/* Selected Space Content */}
          {selectedSpace && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedSpace.name}</CardTitle>
                <p className="text-sm text-gray-500 capitalize">
                  {selectedSpace.type?.replace(/_/g, ' ')}
                </p>
              </CardHeader>
              <CardContent>
                {getBedsForSpace(selectedSpace.id).length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No beds in this space</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-6">
                    {getBedsForSpace(selectedSpace.id).map((bed) => (
                      <div key={bed.id} className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">{bed.name}</h4>
                        <p className="text-xs text-gray-500 mb-3">
                          {bed.width}" × {bed.height}" • {bed.grid_columns}×{bed.grid_rows} grid
                        </p>
                        <BedGrid
                          bed={bed}
                          plantInstances={getPlantsForBed(bed.id)}
                          companionRules={[]}
                          onCellClick={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Plants List */}
      {plants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Plants in this Garden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {plants.map((plant) => (
                <div key={plant.id} className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="font-medium text-gray-900">{plant.display_name}</h4>
                  <Badge variant="outline" className="mt-2 capitalize">
                    {plant.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}