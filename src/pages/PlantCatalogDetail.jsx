import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  ArrowLeft, 
  Plus,
  Leaf,
  Droplets,
  Sun,
  TrendingUp,
  Loader2,
  Package,
  ListChecks
} from 'lucide-react';
import AddVarietyDialog from '@/components/variety/AddVarietyDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/common/ErrorBoundary';

export default function PlantCatalogDetail() {
  const [searchParams] = useSearchParams();
  const plantTypeId = searchParams.get('id');
  
  const [plantType, setPlantType] = useState(null);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    if (plantTypeId) {
      loadPlantType();
    } else {
      setNotFound(true);
      setLoading(false);
    }
  }, [plantTypeId]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const reloadVarieties = async () => {
    if (!plantTypeId) return;
    
    try {
      let vars = await base44.entities.Variety.filter({ 
        plant_type_id: plantTypeId
      }, 'variety_name');
      
      console.log('[VARIETY RELOAD] Found varieties:', vars.length);
      setVarieties(vars);
    } catch (error) {
      console.error('Error reloading varieties:', error);
    }
  };

  const loadPlantType = async () => {
    try {
      // Validate plantTypeId
      if (!plantTypeId) {
        console.error('No plantTypeId provided');
        setNotFound(true);
        setLoading(false);
        return;
      }

      console.log('Loading plant type:', plantTypeId);
      const types = await base44.entities.PlantType.filter({ id: plantTypeId });
      
      if (types.length === 0) {
        console.error('Plant type not found:', plantTypeId);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const type = types[0];
      console.log('Loaded plant type:', type);
      setPlantType(type);

      // Load varieties - try multiple approaches
      console.log('[VARIETY DEBUG] Attempting to load varieties for plant_type_id:', plantTypeId);
      
      let vars = await base44.entities.Variety.filter({ 
        plant_type_id: plantTypeId,
        status: 'active'
      }, 'variety_name');
      
      console.log('[VARIETY DEBUG] Found varieties with status=active:', vars.length);
      
      // If no varieties with status filter, try without it
      if (vars.length === 0) {
        vars = await base44.entities.Variety.filter({ 
          plant_type_id: plantTypeId
        }, 'variety_name');
        console.log('[VARIETY DEBUG] Found varieties without status filter:', vars.length);
      }
      
      // Try matching by plant_type_name as fallback
      if (vars.length === 0 && type.common_name) {
        vars = await base44.entities.Variety.filter({ 
          plant_type_name: type.common_name
        }, 'variety_name');
        console.log('[VARIETY DEBUG] Found varieties by plant_type_name match:', vars.length);
      }
      
      console.log('[VARIETY DEBUG] Final varieties:', vars.slice(0, 3));
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading plant type:', error);
      toast.error('Failed to load plant details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Leaf className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Plant Type Not Found</h2>
        <p className="text-gray-600 mb-6">This plant type doesn't exist or has been removed.</p>
        <Link to={createPageUrl('PlantCatalog')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plant Catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Plant Detail Error">
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('PlantCatalog')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                plantType.color || 'bg-emerald-100'
              }`}>
                {plantType.icon || '🌱'}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {plantType.common_name || plantType.name}
                </h1>
                {plantType.scientific_name && (
                  <p className="text-gray-500 italic">{plantType.scientific_name}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowAddVariety(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {user?.role === 'admin' || user?.role === 'editor' ? 'Add Variety' : 'Suggest Variety'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Water Needs</p>
                  <p className="font-medium capitalize">
                    {plantType.typical_water || 'Moderate'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Sun Exposure</p>
                  <p className="font-medium capitalize">
                    {plantType.typical_sun?.replace(/_/g, ' ') || 'Full Sun'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Days to Maturity</p>
                  <p className="font-medium">
                    {plantType.default_days_to_maturity || 'Varies'}
                  </p>
                </div>
              </div>
            </div>

            {plantType.notes && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{plantType.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Varieties */}
        <Card>
          <CardHeader>
            <CardTitle>Varieties ({varieties.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {varieties.length === 0 ? (
              <div className="text-center py-8">
                <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No varieties cataloged yet</p>
                <p className="text-sm text-gray-500 mb-4">
                  {user?.role === 'admin' 
                    ? 'Import varieties or add them manually' 
                    : 'Be the first to suggest a variety!'}
                </p>
                <Button 
                  onClick={() => setShowAddVariety(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {user?.role === 'admin' || user?.role === 'editor' ? 'Add First Variety' : 'Suggest Variety'}
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {varieties.map((variety) => (
                  <Card key={variety.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{variety.variety_name}</h4>
                        <div className="flex gap-1">
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await base44.entities.SeedLot.create({
                                  plant_type_id: plantType.id,
                                  plant_type_name: plantType.common_name,
                                  variety_id: variety.id,
                                  variety_name: variety.variety_name,
                                  is_wishlist: false
                                });
                                toast.success('Added to seed stash!');
                              } catch (error) {
                                console.error('Error adding to stash:', error);
                                toast.error('Failed to add to stash');
                              }
                            }}
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await base44.entities.SeedLot.create({
                                  plant_type_id: plantType.id,
                                  plant_type_name: plantType.common_name,
                                  variety_id: variety.id,
                                  variety_name: variety.variety_name,
                                  is_wishlist: true
                                });
                                toast.success('Added to wishlist!');
                              } catch (error) {
                                console.error('Error adding to wishlist:', error);
                              }
                            }}
                          >
                            <ListChecks className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {variety.days_to_maturity && (
                          <Badge variant="outline" className="text-xs">
                            {variety.days_to_maturity} days
                          </Badge>
                        )}
                        {variety.spacing_recommended && (
                          <Badge variant="outline" className="text-xs">
                            {variety.spacing_recommended}" spacing
                          </Badge>
                        )}
                        {variety.trellis_required && (
                          <Badge className="bg-green-100 text-green-800 text-xs">Needs Trellis</Badge>
                        )}
                      </div>
                      {variety.grower_notes && (
                        <p className="text-sm text-gray-600 mt-3 line-clamp-2">{variety.grower_notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Growing Info */}
        <Card>
          <CardHeader>
            <CardTitle>Growing Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                {plantType.typical_spacing_min && plantType.typical_spacing_max && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Spacing</p>
                    <p className="font-medium">
                      {plantType.typical_spacing_min}" - {plantType.typical_spacing_max}"
                    </p>
                  </div>
                )}
                {plantType.is_perennial !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Growth Habit</p>
                    <Badge className={plantType.is_perennial ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                      {plantType.is_perennial ? 'Perennial' : 'Annual'}
                    </Badge>
                  </div>
                )}
                {plantType.default_start_indoors_weeks && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Start Indoors</p>
                    <p className="font-medium">{plantType.default_start_indoors_weeks} weeks before last frost</p>
                  </div>
                )}
                {plantType.default_transplant_weeks !== undefined && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Transplant</p>
                    <p className="font-medium">
                      {plantType.default_transplant_weeks} weeks {plantType.default_transplant_weeks >= 0 ? 'after' : 'before'} last frost
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Variety Dialog */}
        <AddVarietyDialog 
          plantType={plantType}
          open={showAddVariety}
          onOpenChange={setShowAddVariety}
          onSuccess={reloadVarieties}
          userRole={user?.role}
        />
      </div>
    </ErrorBoundary>
  );
}