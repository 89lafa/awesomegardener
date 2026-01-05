import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MoreVertical, Copy, Plus, Trash2, Link as LinkIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CropsList({ cropPlans, selectedCrop, onSelectCrop, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [plantTypes, setPlantTypes] = useState({});
  const [profiles, setProfiles] = useState({});

  React.useEffect(() => {
    loadPlantData();
  }, [cropPlans]);

  const loadPlantData = async () => {
    if (cropPlans.length === 0) return;

    const typeIds = [...new Set(cropPlans.map(p => p.plant_type_id).filter(Boolean))];
    const profileIds = [...new Set(cropPlans.map(p => p.plant_profile_id).filter(Boolean))];

    const [types, profs] = await Promise.all([
      Promise.all(typeIds.map(id => base44.entities.PlantType.filter({ id }))),
      Promise.all(profileIds.map(id => base44.entities.PlantProfile.filter({ id })))
    ]);

    const typesMap = {};
    types.flat().forEach(t => { typesMap[t.id] = t; });
    setPlantTypes(typesMap);

    const profsMap = {};
    profs.flat().forEach(p => { profsMap[p.id] = p; });
    setProfiles(profsMap);
  };

  const handleDuplicate = async (crop) => {
    try {
      const newCrop = await base44.entities.CropPlan.create({
        ...crop,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        label: `${crop.label || ''} (Copy)`
      });

      // Duplicate tasks
      const tasks = await base44.entities.CropTask.filter({ crop_plan_id: crop.id });
      for (const task of tasks) {
        await base44.entities.CropTask.create({
          ...task,
          id: undefined,
          crop_plan_id: newCrop.id,
          created_date: undefined,
          updated_date: undefined
        });
      }

      toast.success('Crop duplicated');
      onRefresh();
    } catch (error) {
      console.error('Error duplicating crop:', error);
      toast.error('Failed to duplicate crop');
    }
  };

  const handleAddSuccession = async (crop) => {
    try {
      const interval = crop.succession_interval_days || 14;
      const tasks = await base44.entities.CropTask.filter({ crop_plan_id: crop.id });

      const newCrop = await base44.entities.CropPlan.create({
        ...crop,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        succession_parent_id: crop.succession_parent_id || crop.id,
        succession_count: (crop.succession_count || 0) + 1,
        label: `${crop.label || ''} S${(crop.succession_count || 0) + 2}`
      });

      // Shift task dates by interval
      for (const task of tasks) {
        const startDate = new Date(task.start_date);
        startDate.setDate(startDate.getDate() + interval);
        
        const endDate = task.end_date ? new Date(task.end_date) : null;
        if (endDate) endDate.setDate(endDate.getDate() + interval);

        await base44.entities.CropTask.create({
          ...task,
          id: undefined,
          crop_plan_id: newCrop.id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate ? endDate.toISOString().split('T')[0] : null,
          created_date: undefined,
          updated_date: undefined
        });
      }

      toast.success('Succession planting added');
      onRefresh();
    } catch (error) {
      console.error('Error adding succession:', error);
      toast.error('Failed to add succession');
    }
  };

  const handleDelete = async (crop) => {
    if (!confirm(`Delete this crop and all its tasks?`)) return;

    try {
      const tasks = await base44.entities.CropTask.filter({ crop_plan_id: crop.id });
      for (const task of tasks) {
        await base44.entities.CropTask.delete(task.id);
      }
      await base44.entities.CropPlan.delete(crop.id);

      toast.success('Crop deleted');
      onRefresh();
    } catch (error) {
      console.error('Error deleting crop:', error);
      toast.error('Failed to delete crop');
    }
  };

  const getCropDisplay = (crop) => {
    const plantType = plantTypes[crop.plant_type_id];
    const profile = profiles[crop.plant_profile_id];
    const variety = profile?.variety_name || '';
    const type = plantType?.common_name || '';
    const label = crop.label || '';

    return { type, variety, label };
  };

  const filteredCrops = cropPlans.filter(crop => {
    const display = getCropDisplay(crop);
    const searchStr = `${display.type} ${display.variety} ${display.label}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  // Group by plant type
  const groupedCrops = filteredCrops.reduce((acc, crop) => {
    const type = plantTypes[crop.plant_type_id]?.common_name || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(crop);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-3">My Crops</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search crops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {Object.keys(groupedCrops).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No crops planned yet</p>
            <p className="text-xs mt-1">Click "Add Crop" to start</p>
          </div>
        ) : (
          Object.entries(groupedCrops).map(([type, crops]) => (
            <div key={type}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{type}</h3>
              <div className="space-y-1">
                {crops.map((crop) => {
                  const display = getCropDisplay(crop);
                  return (
                    <div
                      key={crop.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                        selectedCrop?.id === crop.id
                          ? "bg-emerald-50 border-emerald-300"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      )}
                      onClick={() => onSelectCrop(crop)}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: crop.color_hex || '#10b981' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {display.variety || display.type}
                        </div>
                        {display.label && (
                          <div className="text-xs text-gray-500">{display.label}</div>
                        )}
                      </div>
                      {crop.garden_item_id && (
                        <LinkIcon className="w-3 h-3 text-gray-400" />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(crop); }}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAddSuccession(crop); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Succession
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleDelete(crop); }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}