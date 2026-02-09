import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save, Loader2, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminIndoorPlants() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [indoorGroup, setIndoorGroup] = useState(null);
  const [indoorTypes, setIndoorTypes] = useState([]);
  const [gardenTypes, setGardenTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        navigate(createPageUrl('AdminHub'));
        return;
      }
      loadData();
    } catch (error) {
      navigate(createPageUrl('AdminHub'));
    }
  };

  const loadData = async () => {
    try {
      const [types, groups] = await Promise.all([
        base44.entities.PlantType.list('common_name', 1000),
        base44.entities.PlantGroup.list('sort_order')
      ]);

      const indoor = groups.find(g => g.name === 'Indoor & Houseplants');
      setIndoorGroup(indoor);

      const indoor_pts = types.filter(t => t.plant_group_id === indoor?.id);
      const garden_pts = types.filter(t => t.plant_group_id !== indoor?.id);

      setPlantTypes(types);
      setIndoorTypes(indoor_pts);
      setGardenTypes(garden_pts);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const moveToIndoor = async (plantTypeId) => {
    if (!indoorGroup) {
      toast.error('Indoor & Houseplants group not found');
      return;
    }

    try {
      await base44.entities.PlantType.update(plantTypeId, {
        plant_group_id: indoorGroup.id
      });
      toast.success('Moved to Indoor & Houseplants');
      loadData();
    } catch (error) {
      console.error('Error moving plant type:', error);
      toast.error('Failed to move plant type');
    }
  };

  const moveToGarden = async (plantTypeId) => {
    const type = plantTypes.find(t => t.id === plantTypeId);
    
    // Try to find appropriate garden group based on category
    const groups = await base44.entities.PlantGroup.list('sort_order');
    let targetGroup = groups.find(g => g.sort_order < 50); // Any garden group
    
    if (!targetGroup) {
      toast.error('No garden group found');
      return;
    }

    try {
      await base44.entities.PlantType.update(plantTypeId, {
        plant_group_id: targetGroup.id
      });
      toast.success('Moved to Garden Plants');
      loadData();
    } catch (error) {
      console.error('Error moving plant type:', error);
      toast.error('Failed to move plant type');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const filteredGarden = gardenTypes.filter(t => 
    !searchQuery || 
    t.common_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIndoor = indoorTypes.filter(t => 
    !searchQuery || 
    t.common_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('AdminHub'))}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Indoor & Houseplants Manager</h1>
          <p className="text-gray-600">Assign plant types to Indoor or Garden sections</p>
        </div>
      </div>

      <Input
        placeholder="Search plant types..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🏡 Garden Plants ({gardenTypes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredGarden.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{type.icon} {type.common_name}</p>
                  <p className="text-xs text-gray-500 italic">{type.scientific_name}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => moveToIndoor(type.id)}
                >
                  Move to Indoor →
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-emerald-300 bg-emerald-50/20">
          <CardHeader>
            <CardTitle>🏠 Indoor & Houseplants ({indoorTypes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredIndoor.map(type => (
              <div key={type.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-200">
                <div>
                  <p className="font-medium">{type.icon} {type.common_name}</p>
                  <p className="text-xs text-gray-500 italic">{type.scientific_name}</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => moveToGarden(type.id)}
                >
                  ← Move to Garden
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}