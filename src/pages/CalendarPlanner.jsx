import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Calendar as CalendarIcon,
  Filter,
  Loader2,
  MoreVertical,
  Trash2,
  Copy,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { addWeeks, addDays, format, parseISO } from 'date-fns';

export default function CalendarPlanner() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGardenId, setActiveGardenId] = useState(null);
  const [cropPlans, setCropPlans] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCrop, setShowAddCrop] = useState(false);
  const [filterTaskType, setFilterTaskType] = useState('all');
  
  const [newCrop, setNewCrop] = useState({
    plant_type_id: '',
    method: 'TRANSPLANT'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGardenId) {
      loadCropPlans();
    }
  }, [activeGardenId]);

  const loadData = async () => {
    try {
      const [userData, gardensData, typesData, templatesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Garden.filter({ archived: false }),
        base44.entities.PlantType.list('common_name'),
        base44.entities.CropScheduleTemplate.list()
      ]);
      
      setUser(userData);
      setGardens(gardensData);
      setPlantTypes(typesData);
      setTemplates(templatesData);
      
      if (gardensData.length > 0) {
        setActiveGardenId(userData.active_garden_id || gardensData[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCropPlans = async () => {
    try {
      const [plansData, tasksData] = await Promise.all([
        base44.entities.CropPlan.filter({ garden_id: activeGardenId }),
        base44.entities.ScheduledTask.filter({ garden_id: activeGardenId }, 'start_date')
      ]);
      setCropPlans(plansData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading crop plans:', error);
    }
  };

  const generateTasks = async (cropPlan, plantType, template) => {
    const lastFrost = user.last_frost_date ? parseISO(user.last_frost_date) : new Date();
    const generatedTasks = [];

    if (cropPlan.method === 'TRANSPLANT' && template?.start_indoors_weeks_before_last_frost) {
      const seedDate = addWeeks(lastFrost, -template.start_indoors_weeks_before_last_frost);
      const adjustedSeedDate = addDays(seedDate, cropPlan.offset_days || 0);
      
      generatedTasks.push({
        crop_plan_id: cropPlan.id,
        garden_id: cropPlan.garden_id,
        task_type: 'SEEDING_INDOORS',
        start_date: format(adjustedSeedDate, 'yyyy-MM-dd'),
        title: `Start ${cropPlan.plant_type_name} indoors`,
        status: 'pending'
      });
    }

    if (cropPlan.method === 'DIRECT' && template?.direct_sow_weeks_offset_from_last_frost !== undefined) {
      const sowDate = addWeeks(lastFrost, template.direct_sow_weeks_offset_from_last_frost);
      const adjustedSowDate = addDays(sowDate, cropPlan.offset_days || 0);
      
      generatedTasks.push({
        crop_plan_id: cropPlan.id,
        garden_id: cropPlan.garden_id,
        task_type: 'DIRECT_SEED',
        start_date: format(adjustedSowDate, 'yyyy-MM-dd'),
        title: `Direct sow ${cropPlan.plant_type_name}`,
        status: 'pending'
      });
    }

    if (cropPlan.method === 'TRANSPLANT' && template?.transplant_weeks_after_last_frost !== undefined) {
      const transplantDate = addWeeks(lastFrost, template.transplant_weeks_after_last_frost);
      const adjustedTransplantDate = addDays(transplantDate, cropPlan.offset_days || 0);
      
      generatedTasks.push({
        crop_plan_id: cropPlan.id,
        garden_id: cropPlan.garden_id,
        task_type: 'TRANSPLANT',
        start_date: format(adjustedTransplantDate, 'yyyy-MM-dd'),
        title: `Transplant ${cropPlan.plant_type_name}`,
        status: 'pending'
      });
    }

    // Create tasks
    for (const taskData of generatedTasks) {
      await base44.entities.ScheduledTask.create(taskData);
    }

    return generatedTasks;
  };

  const handleAddCrop = async () => {
    if (!newCrop.plant_type_id) return;

    try {
      const plantType = plantTypes.find(t => t.id === newCrop.plant_type_id);
      const template = templates.find(t => t.plant_type_id === newCrop.plant_type_id);

      const cropPlan = await base44.entities.CropPlan.create({
        garden_id: activeGardenId,
        plant_type_id: newCrop.plant_type_id,
        plant_type_name: plantType?.common_name || plantType?.name,
        method: newCrop.method,
        offset_days: 0,
        is_succession: false
      });

      await generateTasks(cropPlan, plantType, template);
      await loadCropPlans();
      
      setShowAddCrop(false);
      setNewCrop({ plant_type_id: '', method: 'TRANSPLANT' });
      toast.success('Crop added to calendar!');
    } catch (error) {
      console.error('Error adding crop:', error);
      toast.error('Failed to add crop');
    }
  };

  const handleAddSuccession = async (parentPlan) => {
    try {
      const template = templates.find(t => t.plant_type_id === parentPlan.plant_type_id);
      const successionWeeks = template?.succession_default_weeks || 2;

      const cropPlan = await base44.entities.CropPlan.create({
        garden_id: parentPlan.garden_id,
        plant_type_id: parentPlan.plant_type_id,
        plant_type_name: parentPlan.plant_type_name,
        variety_id: parentPlan.variety_id,
        variety_name: parentPlan.variety_name,
        method: parentPlan.method,
        offset_days: 0,
        is_succession: true,
        parent_crop_plan_id: parentPlan.id,
        succession_interval_weeks: successionWeeks
      });

      const plantType = plantTypes.find(t => t.id === parentPlan.plant_type_id);
      await generateTasks(cropPlan, plantType, template);
      await loadCropPlans();
      
      toast.success('Succession planting added!');
    } catch (error) {
      console.error('Error adding succession:', error);
      toast.error('Failed to add succession');
    }
  };

  const handleDeleteCrop = async (cropPlan) => {
    if (!confirm(`Delete crop plan for ${cropPlan.plant_type_name}?`)) return;
    
    try {
      const cropTasks = tasks.filter(t => t.crop_plan_id === cropPlan.id);
      for (const task of cropTasks) {
        await base44.entities.ScheduledTask.delete(task.id);
      }
      await base44.entities.CropPlan.delete(cropPlan.id);
      
      await loadCropPlans();
      toast.success('Crop plan deleted');
    } catch (error) {
      console.error('Error deleting crop:', error);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterTaskType === 'all') return true;
    return task.task_type === filterTaskType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Calendar Planner</h1>
          <p className="text-gray-600 mt-1">Schedule your crops and tasks</p>
        </div>
        <Button 
          onClick={() => setShowAddCrop(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Crop
        </Button>
      </div>

      {gardens.length > 1 && (
        <div className="flex items-center gap-2">
          <Label>Garden:</Label>
          <Select value={activeGardenId} onValueChange={setActiveGardenId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gardens.map((garden) => (
                <SelectItem key={garden.id} value={garden.id}>{garden.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Crop Plans List */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">My Crops</h3>
            <div className="space-y-2">
              {cropPlans.map((plan) => (
                <div key={plan.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{plan.plant_type_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{plan.method.toLowerCase()}</p>
                    {plan.is_succession && (
                      <Badge variant="secondary" className="mt-1 text-xs">Succession</Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleAddSuccession(plan)}>
                        <Copy className="w-4 h-4 mr-2" />
                        Add Succession
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteCrop(plan)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Task Timeline */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Schedule</h3>
              <Select value={filterTaskType} onValueChange={setFilterTaskType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="SEEDING_INDOORS">Seed Indoors</SelectItem>
                  <SelectItem value="DIRECT_SEED">Direct Seed</SelectItem>
                  <SelectItem value="TRANSPLANT">Transplant</SelectItem>
                  <SelectItem value="HARVEST_START">Harvest</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <div key={task.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {format(parseISO(task.start_date), 'MMM d, yyyy')}
                      </Badge>
                      <Badge className="text-xs capitalize">
                        {task.task_type.toLowerCase().replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant={task.status === 'done' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={async () => {
                      await base44.entities.ScheduledTask.update(task.id, {
                        status: task.status === 'done' ? 'pending' : 'done',
                        completed_at: task.status === 'done' ? null : new Date().toISOString()
                      });
                      await loadCropPlans();
                    }}
                  >
                    {task.status === 'done' ? 'Done' : 'Mark Done'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Crop Dialog */}
      <Dialog open={showAddCrop} onOpenChange={setShowAddCrop}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Crop to Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plant Type</Label>
              <Select 
                value={newCrop.plant_type_id} 
                onValueChange={(v) => setNewCrop({ ...newCrop, plant_type_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes
                    .filter(type => type.common_name && type.common_name.trim().length >= 2)
                    .map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.common_name || type.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Growing Method</Label>
              <Select 
                value={newCrop.method} 
                onValueChange={(v) => setNewCrop({ ...newCrop, method: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRECT">Direct Seed</SelectItem>
                  <SelectItem value="TRANSPLANT">Transplant (Start Indoors)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCrop(false)}>Cancel</Button>
            <Button 
              onClick={handleAddCrop}
              disabled={!newCrop.plant_type_id}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Schedule Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}