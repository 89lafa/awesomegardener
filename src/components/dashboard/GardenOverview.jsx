import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TreeDeciduous, ArrowRight, Sprout, Plus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function GardenOverview({ gardens, loading }) {
  const [plantsPerGarden, setPlantsPerGarden] = useState({});

  useEffect(() => {
    if (gardens.length > 0) {
      loadPlantCounts();
    }
  }, [gardens]);

  const loadPlantCounts = async () => {
    try {
      const counts = {};
      for (const garden of gardens.slice(0, 3)) {
        const plants = await base44.entities.PlantInstance.filter({ 
          garden_id: garden.id,
          status: { $in: ['planned', 'started', 'transplanted', 'in_ground'] }
        });
        counts[garden.id] = plants.length;
      }
      setPlantsPerGarden(counts);
    } catch (error) {
      console.error('Error loading plant counts:', error);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <TreeDeciduous className="w-5 h-5 text-emerald-600" />
          Your Gardens
        </CardTitle>
        <Link to={createPageUrl('Gardens')}>
          <Button variant="ghost" size="sm" className="gap-1">
            Manage <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {gardens.length === 0 ? (
          <div className="text-center py-8">
            <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No gardens yet</p>
            <Link to={createPageUrl('Gardens') + '?action=new'}>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Garden
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {gardens.slice(0, 3).map((garden) => (
              <Link 
                key={garden.id}
                to={createPageUrl('MyGarden') + `?id=${garden.id}`}
                className="block"
              >
                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border">
                  {garden.cover_image ? (
                    <img 
                      src={garden.cover_image} 
                      alt={garden.name}
                      className="w-14 h-14 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
                      <TreeDeciduous className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{garden.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Badge variant="outline" className="text-xs">
                        {garden.privacy === 'public' ? '🌍 Public' : garden.privacy === 'unlisted' ? '🔗 Unlisted' : '🔒 Private'}
                      </Badge>
                      {plantsPerGarden[garden.id] !== undefined && (
                        <span className="text-xs flex items-center gap-1">
                          <Sprout className="w-3 h-3" />
                          {plantsPerGarden[garden.id]} plants
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
            {gardens.length > 3 && (
              <Link to={createPageUrl('Gardens')}>
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  View all {gardens.length} gardens <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}