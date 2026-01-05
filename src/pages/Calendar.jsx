import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Settings, 
  Loader2,
  Filter as FilterIcon
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import CropsList from '@/components/calendar/CropsList';
import CalendarTimeline from '@/components/calendar/CalendarTimeline';
import AddCropModal from '@/components/calendar/AddCropModal';
import TaskDetailPanel from '@/components/calendar/TaskDetailPanel';

export default function Calendar() {
  const [user, setUser] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [activeGarden, setActiveGarden] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [cropPlans, setCropPlans] = useState([]);
  const [cropTasks, setCropTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCropModal, setShowAddCropModal] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [timelineRange, setTimelineRange] = useState('18');
  const [taskFilter, setTaskFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeGarden && activeSeason) {
      loadCropData();
    }
  }, [activeGarden, activeSeason]);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const gardensData = await base44.entities.Garden.filter({
        archived: false,
        created_by: userData.email
      }, '-updated_date');

      setGardens(gardensData);

      if (gardensData.length > 0) {
        const garden = gardensData[0];
        setActiveGarden(garden);

        const seasonsData = await base44.entities.GardenSeason.filter({
          garden_id: garden.id
        }, '-year');

        if (seasonsData.length === 0) {
          // Create default season
          const currentYear = new Date().getFullYear();
          const newSeason = await base44.entities.GardenSeason.create({
            garden_id: garden.id,
            year: currentYear,
            season: 'Spring',
            season_key: `${currentYear}-Spring`,
            status: 'active'
          });
          setSeasons([newSeason]);
          setActiveSeason(newSeason);
        } else {
          setSeasons(seasonsData);
          setActiveSeason(seasonsData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const loadCropData = async () => {
    try {
      const [plans, tasks] = await Promise.all([
        base44.entities.CropPlan.filter({
          garden_season_id: activeSeason.id,
          created_by: user.email
        }),
        base44.entities.CropTask.filter({
          garden_season_id: activeSeason.id,
          created_by: user.email
        }, 'start_date')
      ]);

      setCropPlans(plans);
      setCropTasks(tasks);
    } catch (error) {
      console.error('Error loading crop data:', error);
    }
  };

  const handleGardenChange = async (gardenId) => {
    const garden = gardens.find(g => g.id === gardenId);
    setActiveGarden(garden);

    const seasonsData = await base44.entities.GardenSeason.filter({
      garden_id: gardenId
    }, '-year');

    setSeasons(seasonsData);
    if (seasonsData.length > 0) {
      setActiveSeason(seasonsData[0]);
    }
  };

  const scrollToToday = () => {
    const todayElement = document.getElementById('today-marker');
    if (todayElement) {
      todayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (gardens.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No gardens yet</h3>
          <p className="text-gray-600">Create a garden to start planning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center gap-4 pb-4 border-b">
        <Select value={activeGarden?.id} onValueChange={handleGardenChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gardens.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeSeason?.id} onValueChange={(id) => setActiveSeason(seasons.find(s => s.id === id))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.year} {s.season}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={scrollToToday}>
          <CalendarIcon className="w-4 h-4 mr-2" />
          Today
        </Button>

        <Select value={timelineRange} onValueChange={setTimelineRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="18">18 months</SelectItem>
            <SelectItem value="24">24 months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={taskFilter} onValueChange={setTaskFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="bed_prep">Bed Prep</SelectItem>
            <SelectItem value="seed">Seeding</SelectItem>
            <SelectItem value="transplant">Transplant</SelectItem>
            <SelectItem value="direct_seed">Direct Seed</SelectItem>
            <SelectItem value="harvest">Harvest</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="crop">Sort by Crop</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button
            onClick={() => setShowAddCropModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Crop
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-6 mt-4 overflow-hidden">
        {/* Left Sidebar - Crops List */}
        <div className="w-80 flex-shrink-0">
          <CropsList
            cropPlans={cropPlans}
            selectedCrop={selectedCrop}
            onSelectCrop={setSelectedCrop}
            onRefresh={loadCropData}
          />
        </div>

        {/* Main Timeline */}
        <div className="flex-1 overflow-auto">
          <CalendarTimeline
            cropTasks={cropTasks}
            cropPlans={cropPlans}
            timelineRange={parseInt(timelineRange)}
            taskFilter={taskFilter}
            selectedCrop={selectedCrop}
            onTaskClick={setSelectedTask}
            onRefresh={loadCropData}
            activeSeason={activeSeason}
          />
        </div>
      </div>

      {/* Modals */}
      <AddCropModal
        open={showAddCropModal}
        onOpenChange={setShowAddCropModal}
        activeSeason={activeSeason}
        activeGarden={activeGarden}
        onSuccess={loadCropData}
      />

      <TaskDetailPanel
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onRefresh={loadCropData}
      />
    </div>
  );
}