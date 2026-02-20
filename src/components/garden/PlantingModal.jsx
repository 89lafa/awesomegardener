import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useIsMobile } from "@/components/ui/use-mobile";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, X, Trash2, Move, Loader2, ChevronDown, ChevronRight, Rows3, Columns3, Grid2X2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import StashTypeSelector from './StashTypeSelector';
import CatalogTypeSelector from './CatalogTypeSelector';
import CompanionSuggestions from './CompanionSuggestions';
import DiagonalPlantingPattern from './DiagonalPlantingPattern';
import SeedlingSelector from './SeedlingSelector';

export default function PlantingModal({ 
   open, 
   onOpenChange, 
   item, 
   itemType, 
   garden, 
   onPlantingUpdate, 
   activeSeason, 
   seasonId,
   sharedData
 }) {
  const isMobile = useIsMobile();
  const [plantings, setPlantings] = useState([]);
  const [stashPlants, setStashPlants] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [varieties, setVarieties] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [plantingRules, setPlantingRules] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedPlanting, setSelectedPlanting] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [companionWarning, setCompanionWarning] = useState(null);
  const [rotationWarning, setRotationWarning] = useState(null);
  const [companionResults, setCompanionResults] = useState([]);
  const [selectedPlanItem, setSelectedPlanItem] = useState(null);
  const [cropPlans, setCropPlans] = useState([]);
  const [showCompanionSuggestions, setShowCompanionSuggestions] = useState(false);
  const [showSeedlingSelector, setShowSeedlingSelector] = useState(false);
  // NEW: Bulk planting state
  const [bulkPlanting, setBulkPlanting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  // NEW: Mobile plant picker collapsed state
  const [pickerCollapsed, setPickerCollapsed] = useState(false);
  
  const [newPlant, setNewPlant] = useState({
    variety_id: '',
    variety_name: '',
    plant_type_name: '',
    spacing_cols: 1,
    spacing_rows: 1
  });

  const metadata = item.metadata || {};
  const isSlotBased = !metadata.gridEnabled && metadata.capacity;
  const totalSlots = isSlotBased ? metadata.capacity : null;
  const gridCols = isSlotBased ? Math.ceil(Math.sqrt(metadata.capacity)) : Math.floor(item.width / 12);
  const gridRows = isSlotBased ? Math.ceil(metadata.capacity / gridCols) : Math.floor(item.height / 12);
  const plantingPattern = item.metadata?.planting_pattern || 'square_foot';

  // Responsive cell size on mobile — fits grid to screen width
  // Account for ~80px of padding/arrows/margins
  const CELL_SIZE = isMobile 
    ? Math.max(20, Math.min(44, Math.floor((window.innerWidth - 80) / Math.max(gridCols, 1))))
    : 40;
  const ARROW_SIZE = isMobile ? Math.min(28, CELL_SIZE) : 24;

  useEffect(() => {
     if (open && item) {
       loadData();
       // Auto-collapse picker on mobile when returning to grid
       if (isMobile) setPickerCollapsed(false);
     }
   }, [open, item, activeSeason]);

  useEffect(() => {
    if (plantings.length > 0) {
      analyzeCompanions();
    }
  }, [plantings]);
  
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && (selectedPlanting || isMoving)) {
        setSelectedPlanting(null);
        setIsMoving(false);
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, selectedPlanting, isMoving]);

  const loadData = async () => {
    try {
      setLoading(true);
      const user = await base44.auth.me();
      const seasonKey = activeSeason || `${new Date().getFullYear()}-Spring`;

      if (sharedData) {
        console.log('[PlantingModal] Using pre-loaded shared data from parent page');
        setVarieties(sharedData.varieties || []);
        setPlantTypes(sharedData.plantTypes || []);
        setPlantingRules(sharedData.plantingRules || []);
        setStashPlants(sharedData.stashPlants || []);
        setProfiles(sharedData.profiles || {});
        
        const filteredCropPlans = (sharedData.cropPlans || []).filter(p => 
          (p.quantity_planted || 0) < (p.quantity_planned || 0) &&
          p.garden_season_id === seasonId
        );
        setCropPlans(filteredCropPlans);
        
        const allPlantings = await base44.entities.PlantInstance.filter({ bed_id: item.id });
        
        let plantingsData = allPlantings;
        if (seasonKey) {
          const currentYear = new Date().getFullYear();
          const isCurrentYearSeason = seasonKey && seasonKey.startsWith(currentYear.toString());
          plantingsData = allPlantings.filter(p => {
            if (!p.season_year) return isCurrentYearSeason;
            return p.season_year === seasonKey;
          });
        }

        setPlantings(plantingsData);
        setLoading(false);
        return;
      }

      console.log('[PlantingModal] No shared data, loading all data...');
      
      const [allPlantings, stashData, varietiesData, typesData, rulesData] = await Promise.all([
        base44.entities.PlantInstance.filter({ bed_id: item.id }),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.Variety.list('variety_name', 500),
        base44.entities.PlantType.list('common_name', 500),
        base44.entities.PlantingRule.list()
      ]);
      
      const uniqueProfileIds = [...new Set(stashData.map(s => s.plant_profile_id).filter(Boolean))];
      const profilesData = uniqueProfileIds.length > 0
        ? await base44.entities.PlantProfile.filter({ id: { $in: uniqueProfileIds } })
        : [];
      
      let cropPlansData = null;
      if (seasonId) {
        cropPlansData = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
      }
      
      if (cropPlansData) {
        setCropPlans(cropPlansData.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
      }

      let plantingsData = allPlantings;
      if (seasonKey) {
        const currentYear = new Date().getFullYear();
        const isCurrentYearSeason = seasonKey && seasonKey.startsWith(currentYear.toString());
        plantingsData = allPlantings.filter(p => {
          if (!p.season_year) return isCurrentYearSeason;
          return p.season_year === seasonKey;
        });
      }

      setPlantings(plantingsData);
      setStashPlants(stashData);
      
      const profilesMap = {};
      profilesData.forEach(p => { profilesMap[p.id] = p; });
      setProfiles(profilesMap);
      
      setVarieties(varietiesData);
      setPlantTypes(typesData);
      setPlantingRules(rulesData || []);
    } catch (error) {
      console.error('Error loading planting data:', error);
      toast.error('Failed to load data - try refreshing');
    } finally {
      setLoading(false);
    }
  };

 const getSpacingForPlant = (plantTypeId, varietySpacing) => {
    const containerType = itemType || item.item_type;
    
    // 1) Exact match: plant_type_id + container_type
    const rule = plantingRules.find(r => 
      r.plant_type_id === plantTypeId && 
      r.container_type === containerType
    );
    
    if (rule) {
      console.log(`[PlantingRule] ✓ Found rule for ${plantTypeId} in ${containerType}: ${rule.grid_cols}×${rule.grid_rows}, ${rule.plants_per_grid_slot} plants/slot`);
      return { cols: rule.grid_cols, rows: rule.grid_rows, plantsPerSlot: rule.plants_per_grid_slot || 1 };
    }
    
    // 2) Fallback: any rule for this plant type (user may not have set up this container type yet)
    const anyRule = plantingRules.find(r => r.plant_type_id === plantTypeId);
    if (anyRule) {
      console.log(`[PlantingRule] ⚠ No rule for ${containerType}, using ${anyRule.container_type} fallback: ${anyRule.grid_cols}×${anyRule.grid_rows}, ${anyRule.plants_per_grid_slot} plants/slot`);
      return { cols: anyRule.grid_cols, rows: anyRule.grid_rows, plantsPerSlot: anyRule.plants_per_grid_slot || 1 };
    }
    
    // 3) No rules at all — use spacing-based calculation
    console.log(`[PlantingRule] ✗ No rules for plant ${plantTypeId}. Loaded rules: ${plantingRules.length}. Using spacing fallback.`);
    
    const method = garden.planting_method || 'STANDARD';
    
    if (method === 'SQUARE_FOOT') {
      const spacing = varietySpacing || 12;
      if (spacing >= 18) return { cols: 2, rows: 2, plantsPerSlot: 1 };
      return { cols: 1, rows: 1, plantsPerSlot: 1 };
    } else {
      // Changed default from 24 to 12 so unknown plants = 1×1, not 2×2
      const spacing = varietySpacing || 12;
      const cells = Math.max(1, Math.ceil(spacing / 12));
      return { cols: cells, rows: cells, plantsPerSlot: 1 };
    }
  };
// Look up plants-per-slot for a planting from the rules (no schema change needed)
  const getPlantsPerSlot = (planting) => {
    if (!planting?.plant_type_id) return 1;
    const containerType = itemType || item.item_type;
    const rule = plantingRules.find(r => 
      r.plant_type_id === planting.plant_type_id && 
      r.container_type === containerType
    ) || plantingRules.find(r => r.plant_type_id === planting.plant_type_id);
    return rule?.plants_per_grid_slot || 1;
  };

  // ===========================================================
  // Collision detection — accepts a plantings list for bulk use
  // ===========================================================
  const checkCollisionWithList = (col, row, spanCols, spanRows, plantingsList, excludeId = null) => {
    const isContainer = item.item_type === 'GROW_BAG' || item.item_type === 'CONTAINER';
    if (isContainer) return plantingsList.length > 0;
    
    for (let r = row; r < row + spanRows; r++) {
      for (let c = col; c < col + spanCols; c++) {
        if (c >= gridCols || r >= gridRows) return true;
        const existing = plantingsList.find(p => 
          p.id !== excludeId &&
          c >= p.cell_col && 
          c < p.cell_col + (p.cell_span_cols || 1) &&
          r >= (p.cell_row || 0) && 
          r < (p.cell_row || 0) + (p.cell_span_rows || 1)
        );
        if (existing) return true;
      }
    }
    return false;
  };

  const checkCollision = (col, row, spanCols, spanRows, excludeId = null) => {
    return checkCollisionWithList(col, row, spanCols, spanRows, plantings, excludeId);
  };

  // ===========================================================
  // BULK PLANTING — core function that places multiple plants
  // ===========================================================
  const handleBulkPlant = async (positions) => {
    if (!selectedPlant || positions.length === 0) return;
    
    const confirmed = positions.length > 5 
      ? confirm(`Plant ${positions.length} ${selectedPlant.variety_name} plants?`)
      : true;
    if (!confirmed) return;
    
    setBulkPlanting(true);
    setBulkProgress({ current: 0, total: positions.length });
    
    const spanCols = selectedPlant.spacing_cols || 1;
    const spanRows = selectedPlant.spacing_rows || 1;
    const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
      ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
      : selectedPlant.variety_name;
    const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
    const icon = plantType?.icon || '🌱';
    const plantFamily = plantType?.plant_family_id || selectedPlant.plant_family;
    
    const newPlantings = [];
    let localPlantings = [...plantings]; // Track locally for collision during batch
    
    for (let i = 0; i < positions.length; i++) {
      const { col, row } = positions[i];
      
      // Re-check collision with local tracking (in case prior items changed positions)
      if (checkCollisionWithList(col, row, spanCols, spanRows, localPlantings)) {
        continue;
      }
      
try {
        const seedlingData = selectedPlant.seedling_source_id ? {
          growing_method: 'SEEDLING_TRANSPLANT',
          seedling_source_id: selectedPlant.seedling_source_id,
          seedling_source_type: selectedPlant.seedling_source_type,
          seedling_age_days: selectedPlant.seedling_age_days,
          seedling_location: selectedPlant.seedling_location,
          actual_transplant_date: new Date().toISOString().split('T')[0]
        } : {};

        console.log('═══════════════════════════════════════');
        console.log('[PLANTING DEBUG] About to create PlantInstance');
        console.log('selectedPlant.plantsPerSlot:', selectedPlant.plantsPerSlot);
        console.log('selectedPlant object:', selectedPlant);
        console.log('Will save plants_per_slot as:', selectedPlant.plantsPerSlot || 1);
        console.log('═══════════════════════════════════════');

        const planting = await base44.entities.PlantInstance.create({
          garden_id: garden.id,
          bed_id: item.id,
          space_id: item.id,
          cell_x: col,
          cell_y: row,
          plant_type_id: selectedPlant.plant_type_id,
          plant_type_icon: icon,
          plant_family: plantFamily,
          variety_id: selectedPlant.variety_id,
          display_name: displayName,
          placement_mode: 'grid_cell',
          cell_col: col,
          cell_row: row,
          cell_span_cols: spanCols,
          cell_span_rows: spanRows,
          plants_per_slot: selectedPlant.plantsPerSlot || 1,
          season_year: activeSeason || `${new Date().getFullYear()}-Spring`,
          status: 'planned',
          ...seedlingData
        });
        
        console.log('═══════════════════════════════════════');
        console.log('[PLANTING DEBUG] Created PlantInstance');
        console.log('Returned record plants_per_slot:', planting.plants_per_slot);
        console.log('Full planting object:', planting);
        console.log('═══════════════════════════════════════');
        
        localPlantings.push(planting);
        newPlantings.push(planting);
        setBulkProgress({ current: i + 1, total: positions.length });
        
        // Rate limit protection: 150ms between API calls
        if (i < positions.length - 1) {
          await new Promise(r => setTimeout(r, 150));
        }
      } catch (error) {
        console.error(`Error planting at (${col}, ${row}):`, error);
      }
    }
    
    // Update state with all new plantings
    const updatedPlantings = [...plantings, ...newPlantings];
    setPlantings(updatedPlantings);
    
    // Update crop plan quantities in bulk
    if (selectedPlant.crop_plan_id && newPlantings.length > 0) {
      try {
        const plantsAdded = newPlantings.length * (selectedPlant.plantsPerSlot || 1);
        await base44.functions.invoke('updateCropPlantedQuantity', { 
          crop_plan_id: selectedPlant.crop_plan_id,
          quantity_to_add: plantsAdded
        });
        if (!sharedData && seasonId) {
          const updatedPlans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
          setCropPlans(updatedPlans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
        }
      } catch (error) {
        console.error('Error updating crop quantities:', error);
      }
    }
    
    setBulkPlanting(false);
    setBulkProgress({ current: 0, total: 0 });
    onPlantingUpdate?.(updatedPlantings);
    analyzeCompanionsWithPlantings(updatedPlantings);
    
    if (newPlantings.length > 0) {
      toast.success(`Planted ${newPlantings.length} plants!`);
    } else {
      toast.info('No empty spaces found');
    }
  };

  // ===========================================================
  // FILL ROW / COLUMN / ALL helpers
  // ===========================================================
  const handleFillRow = (rowIdx) => {
    if (!selectedPlant) { toast.error('Select a plant first'); return; }
    const spanCols = selectedPlant.spacing_cols || 1;
    const spanRows = selectedPlant.spacing_rows || 1;
    
    if (rowIdx + spanRows > gridRows) { toast.error('Plant too tall for this row'); return; }
    
    const positions = [];
    for (let col = 0; col <= gridCols - spanCols; col += spanCols) {
      if (!checkCollisionWithList(col, rowIdx, spanCols, spanRows, plantings)) {
        positions.push({ col, row: rowIdx });
      }
    }
    
    if (positions.length === 0) { toast.info('Row is full'); return; }
    handleBulkPlant(positions);
  };

  const handleFillColumn = (colIdx) => {
    if (!selectedPlant) { toast.error('Select a plant first'); return; }
    const spanCols = selectedPlant.spacing_cols || 1;
    const spanRows = selectedPlant.spacing_rows || 1;
    
    if (colIdx + spanCols > gridCols) { toast.error('Plant too wide for this column'); return; }
    
    const positions = [];
    for (let row = 0; row <= gridRows - spanRows; row += spanRows) {
      if (!checkCollisionWithList(colIdx, row, spanCols, spanRows, plantings)) {
        positions.push({ col: colIdx, row });
      }
    }
    
    if (positions.length === 0) { toast.info('Column is full'); return; }
    handleBulkPlant(positions);
  };

  const handleFillAll = () => {
    if (!selectedPlant) { toast.error('Select a plant first'); return; }
    const spanCols = selectedPlant.spacing_cols || 1;
    const spanRows = selectedPlant.spacing_rows || 1;
    
    const positions = [];
    for (let row = 0; row <= gridRows - spanRows; row += spanRows) {
      for (let col = 0; col <= gridCols - spanCols; col += spanCols) {
        if (!checkCollisionWithList(col, row, spanCols, spanRows, plantings)) {
          positions.push({ col, row });
        }
      }
    }
    
    if (positions.length === 0) { toast.info('Bed is full!'); return; }
    handleBulkPlant(positions);
  };

  // ===========================================================
  // Existing single-cell handlers (unchanged logic)
  // ===========================================================
  const handleSlotClick = async (slotIdx) => {
    if (!selectedPlant) return;
    const existingPlanting = plantings.find(p => p.cell_col === slotIdx);
    if (existingPlanting) { toast.error('This slot is already occupied'); return; }
    
    try {
      const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
        ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
        : selectedPlant.variety_name;
      const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
      const icon = plantType?.icon || '🌱';
      const plantFamily = plantType?.plant_family_id || selectedPlant.plant_family;

      const seedlingData = selectedPlant.seedling_source_id ? {
        growing_method: 'SEEDLING_TRANSPLANT',
        seedling_source_id: selectedPlant.seedling_source_id,
        seedling_source_type: selectedPlant.seedling_source_type,
        seedling_age_days: selectedPlant.seedling_age_days,
        seedling_location: selectedPlant.seedling_location,
        actual_transplant_date: new Date().toISOString().split('T')[0]
      } : {};

      const planting = await base44.entities.PlantInstance.create({
        garden_id: garden.id,
        bed_id: item.id,
        space_id: item.id,
        plant_type_id: selectedPlant.plant_type_id,
        plant_type_icon: icon,
        plant_family: plantFamily,
        variety_id: selectedPlant.variety_id,
        display_name: displayName,
        placement_mode: 'slot',
        cell_col: slotIdx,
        cell_row: 0,
        cell_span_cols: 1,
        cell_span_rows: 1,
        plants_per_slot: selectedPlant.plantsPerSlot || 1,
        season_year: activeSeason || `${new Date().getFullYear()}-Spring`,
        status: 'planned',
        ...seedlingData
      });

      if (selectedPlant.seedling_source_id) {
        try {
          const entityName = selectedPlant.seedling_source_type === 'tray_cell' ? 'TrayCell' : 
                           selectedPlant.seedling_source_type === 'container' ? 'IndoorContainer' : 'MyPlant';
          await base44.entities[entityName].update(selectedPlant.seedling_source_id, {
            status: 'transplanted',
            transplanted_date: new Date().toISOString()
          });
        } catch (err) {
          console.error('Error marking seedling as transplanted:', err);
        }
      }
      
      if (selectedPlant.crop_plan_id) {
        try {
          const plantsAdded = selectedPlant.plantsPerSlot || 1;
          await base44.functions.invoke('updateCropPlantedQuantity', { 
            crop_plan_id: selectedPlant.crop_plan_id,
            quantity_to_add: plantsAdded
          });
          if (!sharedData && seasonId) {
            const updatedPlans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
            setCropPlans(updatedPlans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
          } else if (sharedData && onPlantingUpdate) {
            onPlantingUpdate();
          }
        } catch (error) {
          console.error('Error updating quantities:', error);
        }
      }
      
      const updatedPlantings = [...plantings, planting];
      setPlantings(updatedPlantings);
      toast.success('Plant added');
      onPlantingUpdate?.(updatedPlantings);
      analyzeCompanionsWithPlantings(updatedPlantings);
    } catch (error) {
      console.error('[PlantingModal] Error adding plant:', error);
      toast.error('Failed to add plant: ' + (error.message || 'Unknown error'));
    }
  };

  const handleCellClick = async (col, row) => {
    if (isMoving && selectedPlanting) {
      const hasCollision = checkCollision(col, row, selectedPlanting.cell_span_cols || 1, selectedPlanting.cell_span_rows || 1, selectedPlanting.id);
      if (hasCollision) { toast.error('Cannot place here - space occupied or out of bounds'); return; }
      
      try {
        await base44.entities.PlantInstance.update(selectedPlanting.id, { cell_col: col, cell_row: row });
        setPlantings(plantings.map(p => p.id === selectedPlanting.id ? { ...p, cell_col: col, cell_row: row } : p));
        setIsMoving(false);
        setSelectedPlanting(null);
        toast.success('Plant moved');
      } catch (error) {
        console.error('Error moving plant:', error);
        toast.error('Failed to move plant');
      }
    } else if (selectedPlant) {
      const ITEM_TYPES_CONTAINERS = [{ value: 'GROW_BAG', usesGallons: true }, { value: 'CONTAINER', usesGallons: true }];
      const containerType = ITEM_TYPES_CONTAINERS.find(t => t.value === item.item_type);
      const isContainer = containerType?.usesGallons;
      
      let hasCollision = false;
      if (isContainer) {
        hasCollision = plantings.length > 0;
        if (hasCollision) { toast.error('Container already occupied'); return; }
      } else {
        for (let r = row; r < row + selectedPlant.spacing_rows; r++) {
          for (let c = col; c < col + selectedPlant.spacing_cols; c++) {
            if (c >= gridCols || r >= gridRows) { hasCollision = true; break; }
            const existing = plantings.find(p => 
              c >= p.cell_col && c < p.cell_col + (p.cell_span_cols || 1) &&
              r >= (p.cell_row || 0) && r < (p.cell_row || 0) + (p.cell_span_rows || 1)
            );
            if (existing) { hasCollision = true; break; }
          }
          if (hasCollision) break;
        }
        if (hasCollision) { toast.error('Cannot place here - space occupied or out of bounds'); return; }
      }
      
      try {
        const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
          ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
          : selectedPlant.variety_name;
        const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
        const icon = plantType?.icon || '🌱';
        const plantFamily = plantType?.plant_family_id || selectedPlant.plant_family;

        const seedlingData = selectedPlant.seedling_source_id ? {
          growing_method: 'SEEDLING_TRANSPLANT',
          seedling_source_id: selectedPlant.seedling_source_id,
          seedling_source_type: selectedPlant.seedling_source_type,
          seedling_age_days: selectedPlant.seedling_age_days,
          seedling_location: selectedPlant.seedling_location,
          actual_transplant_date: new Date().toISOString().split('T')[0]
        } : {};

        const planting = await base44.entities.PlantInstance.create({
          garden_id: garden.id,
          bed_id: item.id,
          space_id: item.id,
          cell_x: col,
          cell_y: row,
          plant_type_id: selectedPlant.plant_type_id,
          plant_type_icon: icon,
          plant_family: plantFamily,
          variety_id: selectedPlant.variety_id,
          display_name: displayName,
          placement_mode: 'grid_cell',
          cell_col: col,
          cell_row: row,
          cell_span_cols: selectedPlant.spacing_cols,
          cell_span_rows: selectedPlant.spacing_rows,
          plants_per_slot: selectedPlant.plantsPerSlot || 1,
          season_year: activeSeason || `${new Date().getFullYear()}-Spring`,
          status: 'planned',
          ...seedlingData
        });

        if (selectedPlant.seedling_source_id) {
          try {
            const entityName = selectedPlant.seedling_source_type === 'tray_cell' ? 'TrayCell' : 
                             selectedPlant.seedling_source_type === 'container' ? 'IndoorContainer' : 'MyPlant';
            await base44.entities[entityName].update(selectedPlant.seedling_source_id, {
              status: 'transplanted',
              transplanted_date: new Date().toISOString()
            });
          } catch (err) {
            console.error('Error marking seedling as transplanted:', err);
          }
        }

        if (selectedPlant.crop_plan_id) {
          try {
            const plantsAdded = selectedPlant.plantsPerSlot || 1;
            await base44.functions.invoke('updateCropPlantedQuantity', { 
              crop_plan_id: selectedPlant.crop_plan_id,
              quantity_to_add: plantsAdded
            });
            if (!sharedData && seasonId) {
              const updatedPlans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
              setCropPlans(updatedPlans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
            } else if (sharedData && onPlantingUpdate) {
              onPlantingUpdate();
            }
          } catch (error) {
            console.error('Error updating quantities:', error);
          }
        }

        const updatedPlantings = [...plantings, planting];
        setPlantings(updatedPlantings);
        toast.success('Plant added - click more cells to keep planting');
        onPlantingUpdate?.(updatedPlantings);
      } catch (error) {
        console.error('[PlantingModal] Error adding plant:', error);
        toast.error('Failed to add plant: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDeletePlanting = async (planting) => {
    if (!planting || !confirm(`Remove ${planting.display_name}?`)) return;
    
    try {
      await base44.entities.PlantInstance.delete(planting.id);
      const updatedPlantings = plantings.filter(p => p.id !== planting.id);
      setPlantings(updatedPlantings);
      setSelectedPlanting(null);
      toast.success('Plant removed');
      onPlantingUpdate?.(updatedPlantings);
      analyzeCompanionsWithPlantings(updatedPlantings);
      
      if (planting.crop_plan_id) {
        try {
          await base44.functions.invoke('updateCropPlantedQuantity', { 
            crop_plan_id: planting.crop_plan_id,
            quantity_to_add: -1
          });
          if (!sharedData && seasonId) {
            const updatedPlans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
            setCropPlans(updatedPlans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
          } else if (sharedData && onPlantingUpdate) {
            onPlantingUpdate();
          }
        } catch (error) {
          console.error('Error updating quantities after delete:', error);
        }
      }
    } catch (error) {
      console.error('Error deleting planting:', error);
      toast.error('Failed to remove plant');
    }
  };

  const getDefaultSpacing = (plantTypeName) => {
    const name = plantTypeName?.toLowerCase() || '';
    if (name.includes('lettuce') || name.includes('radish') || name.includes('carrot')) return { cols: 1, rows: 1 };
    if (name.includes('tomato') || name.includes('pepper') || name.includes('cucumber')) return { cols: 2, rows: 2 };
    if (name.includes('squash') || name.includes('melon') || name.includes('pumpkin')) return { cols: 3, rows: 3 };
    if (name.includes('bean') || name.includes('pea')) return { cols: 1, rows: 1 };
    return { cols: 2, rows: 2 };
  };

  const handleSelectStashPlant = (stashItem) => {
    const profile = profiles[stashItem.plant_profile_id];
    if (!profile) { toast.error('This seed has no profile data'); return; }
    
    const variety = varieties.find(v => v.variety_name === profile.variety_name && v.plant_type_id === profile.plant_type_id);
    const spacing = variety 
      ? getSpacingForPlant(profile.plant_type_id, variety.spacing_recommended) 
      : getDefaultSpacing(profile.common_name);
    
    const plantData = {
      variety_id: variety?.id || null,
      variety_name: profile.variety_name,
      plant_type_id: profile.plant_type_id,
      plant_type_name: profile.common_name,
      plant_family: profile.plant_family,
      spacing_cols: spacing.cols,
      spacing_rows: spacing.rows,
      plantsPerSlot: spacing.plantsPerSlot
    };
    
    setSelectedPlant(plantData);
    checkCompanionAndRotation(plantData);
    setShowCompanionSuggestions(true);
    // Auto-collapse picker on mobile after selection
    if (isMobile) setPickerCollapsed(true);
  };

  const checkCompanionAndRotation = async (plantData) => {
    if (!plantData || !plantData.plant_type_id) {
      setCompanionWarning(null);
      setRotationWarning(null);
      return;
    }
    
    try {
      const companionRules = sharedData?.companionRules || 
        await base44.entities.CompanionRule.filter({ plant_type_id: plantData.plant_type_id });
      
      const bedPlantings = plantings.filter(p => p.bed_id === item.id && p.id !== selectedPlanting?.id);
      
      let hasCompanionIssue = false;
      for (const existing of bedPlantings) {
        const badRule = companionRules.find(r => r.companion_type === 'BAD' && r.companion_plant_type_id === existing.plant_type_id);
        if (badRule) {
          hasCompanionIssue = true;
          setCompanionWarning(`⚠️ ${plantData.plant_type_name} should not be planted near ${existing.display_name}`);
          break;
        }
      }
      
      if (!hasCompanionIssue) setCompanionWarning(null);
      
      const currentYear = new Date().getFullYear();
      const lastYearPlantings = plantings.filter(p => 
        p.bed_id === item.id && 
        p.plant_family && plantData.plant_family &&
        p.plant_family === plantData.plant_family &&
        p.season_year && !p.season_year.startsWith(currentYear.toString())
      );
      
      if (lastYearPlantings.length > 0) {
        setRotationWarning(`⚠️ Rotation: ${plantData.plant_family} family was grown here last season`);
      } else {
        setRotationWarning(null);
      }
    } catch (error) {
      console.error('Error checking companions:', error);
    }
  };

  const analyzeCompanionsWithPlantings = async (currentPlantings) => {
    if (currentPlantings.length === 0 || !item?.id) { setCompanionResults([]); return; }

    try {
      const companionRules = sharedData?.companionRules || await base44.entities.CompanionRule.list();
      const results = [];

      for (let i = 0; i < currentPlantings.length; i++) {
        for (let j = i + 1; j < currentPlantings.length; j++) {
          const plantA = currentPlantings[i];
          const plantB = currentPlantings[j];
          if (!plantA.plant_type_id || !plantB.plant_type_id) continue;

          const aCols = Array.from({ length: plantA.cell_span_cols || 1 }, (_, i) => plantA.cell_col + i);
          const aRows = Array.from({ length: plantA.cell_span_rows || 1 }, (_, i) => (plantA.cell_row || 0) + i);
          const bCols = Array.from({ length: plantB.cell_span_cols || 1 }, (_, i) => plantB.cell_col + i);
          const bRows = Array.from({ length: plantB.cell_span_rows || 1 }, (_, i) => (plantB.cell_row || 0) + i);

          let isAdjacent = false;
          
          if (isSlotBased) {
            isAdjacent = true;
          } else {
            for (const aCol of aCols) {
              for (const aRow of aRows) {
                for (const bCol of bCols) {
                  for (const bRow of bRows) {
                    const colDist = Math.abs(aCol - bCol);
                    const rowDist = Math.abs(aRow - bRow);
                    if ((colDist <= 1 && rowDist <= 1) && !(colDist === 0 && rowDist === 0)) {
                      isAdjacent = true; break;
                    }
                  }
                  if (isAdjacent) break;
                }
                if (isAdjacent) break;
              }
              if (isAdjacent) break;
            }
          }

          const rule = companionRules.find(r =>
            (r.plant_type_id === plantA.plant_type_id && r.companion_plant_type_id === plantB.plant_type_id) ||
            (r.plant_type_id === plantB.plant_type_id && r.companion_plant_type_id === plantA.plant_type_id)
          );

          if (rule && isAdjacent) {
            results.push({
              plantA: plantA.display_name, plantB: plantB.display_name,
              type: rule.companion_type, notes: rule.notes,
              cellA: { col: plantA.cell_col, row: plantA.cell_row || 0 },
              cellB: { col: plantB.cell_col, row: plantB.cell_row || 0 }
            });
          }
        }
      }
      setCompanionResults(results);
    } catch (error) {
      console.error('Error analyzing companions:', error);
    }
  };

  const analyzeCompanions = () => analyzeCompanionsWithPlantings(plantings);

  const getCellContent = (col, row) => {
    const planting = plantings.find(p => 
      col >= p.cell_col && col < p.cell_col + (p.cell_span_cols || 1) &&
      row >= p.cell_row && row < p.cell_row + (p.cell_span_rows || 1)
    );
    if (planting && col === planting.cell_col && row === planting.cell_row) return { planting, isOrigin: true };
    if (planting) return { planting, isOrigin: false };
    return null;
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDone = () => {
    setSelectedPlanting(null);
    setSelectedPlant(null);
    setIsMoving(false);
    setCompanionWarning(null);
    setRotationWarning(null);
    onOpenChange(false);
    if (onPlantingUpdate) onPlantingUpdate();
  };

  // Count empty cells for the "Fill All" button label
  const countEmptyCells = () => {
    if (!selectedPlant) return 0;
    const spanCols = selectedPlant.spacing_cols || 1;
    const spanRows = selectedPlant.spacing_rows || 1;
    let count = 0;
    for (let row = 0; row <= gridRows - spanRows; row += spanRows) {
      for (let col = 0; col <= gridCols - spanCols; col += spanCols) {
        if (!checkCollisionWithList(col, row, spanCols, spanRows, plantings)) count++;
      }
    }
    return count;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-6xl p-0 overflow-hidden flex flex-col",
        isMobile 
          ? "max-h-[100dvh] h-[100dvh] rounded-none m-0 w-full" 
          : "max-h-[90vh]"
      )}>
        {/* Header */}
        <DialogHeader className="p-3 lg:p-6 pb-2 lg:pb-4 border-b flex flex-row items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-base lg:text-lg truncate">Plant in {item.label}</DialogTitle>
            <p className="text-xs lg:text-sm text-gray-600 mt-0.5">
              {gridCols}×{gridRows} grid • {plantings.length} planted
              {plantingPattern === 'diagonal' && ' • Diagonal'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {!isMobile && (
              <Button 
                onClick={handleDone}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 lg:h-11 px-4 lg:px-8 text-sm lg:text-base font-semibold"
              >
                ✓ Done
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Bulk Progress Overlay */}
        {bulkPlanting && (
          <div className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-xs">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">Planting...</p>
              <p className="text-sm text-gray-600 mt-1">
                {bulkProgress.current} of {bulkProgress.total}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className={cn(
          "flex flex-col lg:flex-row gap-2 lg:gap-6 p-3 lg:p-6 overflow-hidden flex-1 min-h-0",
          isMobile && "pb-20"
        )}>
          {/* Left Panel - Plant Picker */}
          <div className={cn(
            "w-full lg:w-80 flex-shrink-0 flex flex-col min-h-0 relative",
            isMobile && pickerCollapsed ? "max-h-[56px]" : isMobile ? "max-h-[35vh]" : "max-h-none"
          )} style={{ zIndex: 60 }}>
            
            {/* Mobile: Collapsible header for plant picker */}
            {isMobile && (
              <button
                onClick={() => setPickerCollapsed(!pickerCollapsed)}
                className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 rounded-t-lg border border-gray-200 flex-shrink-0"
              >
                <span className="text-sm font-semibold text-gray-700">
                  {selectedPlant 
                    ? `🌱 ${selectedPlant.variety_name} (${selectedPlant.spacing_cols}×${selectedPlant.spacing_rows})`
                    : '🌱 Select a plant to place'
                  }
                </span>
                <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", pickerCollapsed && "-rotate-90")} />
              </button>
            )}

            {showCompanionSuggestions && selectedPlant?.plant_type_id && !pickerCollapsed && (
              <CompanionSuggestions 
                plantTypeId={selectedPlant.plant_type_id}
                onClose={() => setShowCompanionSuggestions(false)}
              />
            )}

            {/* Plant picker tabs - hidden when collapsed on mobile */}
            <div className={cn(
              "flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow-md border-2 border-gray-200 lg:shadow-none lg:border-0 overflow-hidden",
              isMobile && pickerCollapsed && "hidden"
            )}>
              <Tabs defaultValue="stash" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full flex-shrink-0 grid grid-cols-4 h-10 lg:h-auto">
                  <TabsTrigger value="stash" className="text-xs lg:text-sm py-1.5">Stash</TabsTrigger>
                  <TabsTrigger value="plan" className="text-xs lg:text-sm py-1.5">Plan</TabsTrigger>
                  <TabsTrigger value="seedlings" className="text-xs lg:text-sm py-1.5">Seedlings</TabsTrigger>
                  <TabsTrigger value="new" className="text-xs lg:text-sm py-1.5">Catalog</TabsTrigger>
                </TabsList>
                
                <TabsContent value="stash" className="mt-2 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                  <StashTypeSelector
                    onSelect={(plantData) => {
                      // Re-apply PlantingRule lookup to override StashTypeSelector's spacing
                      const spacing = getSpacingForPlant(plantData.plant_type_id, plantData.varietySpacing);
                      const corrected = {
                        ...plantData,
                        spacing_cols: spacing.cols,
                        spacing_rows: spacing.rows,
                        plantsPerSlot: spacing.plantsPerSlot || 1
                      };
                      setSelectedPlant(corrected);
                      checkCompanionAndRotation(corrected);
                      if (isMobile) setPickerCollapsed(true);
                    }}
                    selectedPlant={selectedPlant}
                    getSpacingForPlant={getSpacingForPlant}
                    getDefaultSpacing={getDefaultSpacing}
                    stashPlants={stashPlants}
                    profiles={profiles}
                    varieties={varieties}
                    plantTypes={plantTypes}
                  />
                </TabsContent>
                
                <TabsContent value="plan" className="mt-2 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                  {seasonId && cropPlans.length > 0 ? (
                    <div className="space-y-2 h-full overflow-auto">
                      {cropPlans.map(plan => {
                        const remaining = (plan.quantity_planned || 0) - (plan.quantity_planted || 0);
                        const variety = varieties.find(v => v.id === plan.variety_id);
                        const plantType = plantTypes.find(pt => pt.id === plan.plant_type_id);
                        const displayName = variety && plantType 
                          ? `${variety.variety_name} - ${plantType.common_name}` : plan.label;

                        return (
                          <button
                            key={plan.id}
                            onClick={() => {
                              const spacing = getSpacingForPlant(plan.plant_type_id) || getDefaultSpacing(plantType?.common_name || plan.label);
                              const plantData = {
                                crop_plan_id: plan.id,
                                variety_id: plan.variety_id,
                                variety_name: variety?.variety_name || plan.label,
                                plant_type_id: plan.plant_type_id,
                                plant_type_name: plantType?.common_name || plan.label,
                                spacing_cols: spacing.cols,
                                spacing_rows: spacing.rows
                              };
                              setSelectedPlanItem(plan);
                              setSelectedPlant(plantData);
                              checkCompanionAndRotation(plantData);
                              if (isMobile) setPickerCollapsed(true);
                            }}
                            className={cn(
                              "w-full p-3 rounded-lg border-2 text-left transition-colors",
                              selectedPlanItem?.id === plan.id 
                                ? "bg-emerald-50 border-emerald-500" 
                                : "bg-white border-gray-200 hover:border-emerald-300"
                            )}
                          >
                            <p className="font-medium text-sm">{displayName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{remaining} of {plan.quantity_planned} remaining</p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">No calendar crops available</div>
                  )}
                </TabsContent>

                <TabsContent value="seedlings" className="mt-2 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                  <Button onClick={() => setShowSeedlingSelector(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 mb-3">
                    <Plus className="w-4 h-4 mr-2" />Select Seedling
                  </Button>
                  {selectedPlant?.seedling_source_id && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-xs text-emerald-600 mb-1">Selected:</p>
                      <p className="font-medium text-sm text-emerald-900">{selectedPlant.display_name}</p>
                      <p className="text-xs text-emerald-700 mt-1">📍 {selectedPlant.seedling_location}</p>
                      <p className="text-xs text-emerald-700">📅 Age: {selectedPlant.seedling_age_days}d</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="new" className="mt-2 flex-1 overflow-auto p-2 lg:p-0">
                  <CatalogTypeSelector
                    onSelect={(plantData) => {
                      const spacing = getSpacingForPlant(plantData.plant_type_id, plantData.varietySpacing);
                      const corrected = {
                        ...plantData,
                        spacing_cols: spacing.cols,
                        spacing_rows: spacing.rows,
                        plantsPerSlot: spacing.plantsPerSlot || 1
                      };
                      setSelectedPlant(corrected);
                      checkCompanionAndRotation(corrected);
                      if (isMobile) setPickerCollapsed(true);
                    }}
                    selectedPlant={selectedPlant}
                    getSpacingForPlant={getSpacingForPlant}
                    plantTypes={plantTypes}
                    varieties={varieties}
                    profiles={profiles}
                  />
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Desktop: Selected plant info */}
            {!isMobile && selectedPlant && (
              <div className="mt-4 space-y-2 flex-shrink-0">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-sm font-medium text-emerald-900">Selected:</p>
                  <p className="text-sm text-emerald-700 truncate">{selectedPlant.variety_name}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Takes {selectedPlant.spacing_cols}×{selectedPlant.spacing_rows} cells
                    {selectedPlant.plantsPerSlot > 1 && ` (${selectedPlant.plantsPerSlot} plants)`}
                  </p>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { setSelectedPlant(null); setCompanionWarning(null); setRotationWarning(null); }}
                    className="w-full mt-2 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
                {companionWarning && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-300">
                    <p className="text-xs text-amber-800">{companionWarning}</p>
                  </div>
                )}
                {rotationWarning && (
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-300">
                    <p className="text-xs text-orange-800">{rotationWarning}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================
              RIGHT PANEL - GRID with BULK FILL ARROWS
              ============================================================ */}
          <div 
            className="flex-1 overflow-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget || e.target.closest('.grid-container')) {
                setSelectedPlanting(null);
                setIsMoving(false);
              }
            }}
          >
            {/* BULK FILL TOOLBAR — shows when a plant is selected */}
            {selectedPlant && !isSlotBased && plantingPattern !== 'diagonal' && (
              <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-xs font-semibold text-emerald-800">Quick Fill:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFillAll}
                  disabled={bulkPlanting}
                  className="gap-1.5 bg-white hover:bg-emerald-100 border-emerald-300 text-emerald-700 font-semibold"
                >
                  <Grid2X2 className="w-3.5 h-3.5" />
                  Fill All ({countEmptyCells()})
                </Button>
                <p className="text-[10px] text-emerald-600 w-full">
                  Or click ↓ arrows above columns / → arrows left of rows to fill one at a time
                </p>
              </div>
            )}

            {isSlotBased ? (
              /* Slot-based layout for greenhouses/containers */
              <div className="grid gap-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', maxWidth: '600px' }}>
                {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                  const planting = plantings.find(p => p.cell_col === slotIdx);
                  return (
                    <button
                      key={slotIdx}
                      onClick={() => {
                        if (planting) {
                          if (selectedPlanting?.id === planting.id) setSelectedPlanting(null);
                          else { setSelectedPlanting(planting); setSelectedPlant(null); }
                        } else if (selectedPlant) {
                          handleSlotClick(slotIdx);
                        }
                      }}
                      className={cn(
                        "w-12 h-12 border-2 rounded transition-colors flex items-center justify-center text-2xl relative",
                        planting 
                          ? "bg-emerald-500 border-emerald-600 cursor-pointer hover:bg-emerald-600" 
                          : selectedPlant
                          ? "bg-white border-amber-300 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                          : "bg-white border-gray-300 cursor-default"
                      )}
                      title={planting ? planting.display_name : `Slot ${slotIdx + 1}`}
                    >
                      {planting && <span>{planting.plant_type_icon || '🌱'}</span>}
                      {selectedPlanting?.id === planting?.id && planting && (
                        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-white rounded-lg shadow-lg p-1">
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeletePlanting(planting); setSelectedPlanting(null); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Grid-based layout for raised beds */
              <div className="space-y-2">
                {plantingPattern === 'diagonal' ? (
                  <DiagonalPlantingPattern
                    rows={gridRows} columns={gridCols} plantings={plantings}
                    onCellClick={handleCellClick}
                    readOnly={!(selectedPlant || isMoving)}
                    selectedPlanting={selectedPlanting}
                    onSelectPlanting={(p) => {
                      if (selectedPlanting?.id === p.id) setSelectedPlanting(null);
                      else { setSelectedPlanting(p); setSelectedPlant(null); }
                    }}
                    onMove={(p) => { setSelectedPlanting(p); setIsMoving(true); }}
                    onDelete={handleDeletePlanting}
                    companionResults={companionResults}
                  />
                ) : (
                  /* ====================================================
                     GRID WITH BULK FILL ARROWS
                     Column arrows on top (↓), Row arrows on left (→)
                     ==================================================== */
                  <div className="inline-flex grid-container">
                    {/* Row arrows column (left side) — offset for grid padding (p-4=16px) + border (2px) */}
                    <div className="flex flex-col gap-1 mr-1" style={{ paddingTop: selectedPlant ? `${ARROW_SIZE + 4 + 16 + 2}px` : `${16 + 2}px` }}>
                      {Array.from({ length: gridRows }).map((_, rowIdx) => (
                        <button
                          key={`row-${rowIdx}`}
                          onClick={() => handleFillRow(rowIdx)}
                          disabled={!selectedPlant || bulkPlanting}
                          title={selectedPlant ? `Fill row ${rowIdx + 1}` : 'Select a plant first'}
                          className={cn(
                            "flex items-center justify-center rounded transition-all",
                            selectedPlant 
                              ? "bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-600 border border-emerald-300 cursor-pointer"
                              : "bg-gray-50 text-gray-300 border border-gray-200 cursor-default"
                          )}
                          style={{ width: `${ARROW_SIZE}px`, height: `${CELL_SIZE}px` }}
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                    
                    <div>
                      {/* Column arrows row (top) — offset for grid padding (p-4=16px) + border (2px) */}
                      {selectedPlant && (
                        <div className="flex gap-1 mb-1" style={{ paddingLeft: '18px' }}>
                          {Array.from({ length: gridCols }).map((_, colIdx) => (
                            <button
                              key={`col-${colIdx}`}
                              onClick={() => handleFillColumn(colIdx)}
                              disabled={bulkPlanting}
                              title={`Fill column ${colIdx + 1}`}
                              className="flex items-center justify-center rounded bg-emerald-100 hover:bg-emerald-500 hover:text-white text-emerald-600 border border-emerald-300 cursor-pointer transition-all"
                              style={{ width: `${CELL_SIZE}px`, height: `${ARROW_SIZE}px` }}
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* The actual planting grid */}
                      <div 
                        className="grid gap-1 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg"
                        style={{
                          gridTemplateColumns: `repeat(${gridCols}, ${CELL_SIZE}px)`,
                          gridTemplateRows: `repeat(${gridRows}, ${CELL_SIZE}px)`
                        }}
                      >
                        {Array.from({ length: gridRows }).map((_, rowIdx) =>
                          Array.from({ length: gridCols }).map((_, colIdx) => {
                            const cellContent = getCellContent(colIdx, rowIdx);
                            
                            if (cellContent?.isOrigin) {
                              const p = cellContent.planting;
                              const companionBorders = companionResults
                                .filter(cr => 
                                  (cr.cellA.col === p.cell_col && cr.cellA.row === p.cell_row) ||
                                  (cr.cellB.col === p.cell_col && cr.cellB.row === p.cell_row)
                                )
                                .map(cr => cr.type);

                              const hasBad = companionBorders.includes('BAD');
                              const hasGood = companionBorders.includes('GOOD');
                              const hasConditional = companionBorders.includes('GOOD_CONDITIONAL');

                              const borderColor = hasBad ? 'border-red-500' : 
                                                 hasGood ? 'border-yellow-500' : 
                                                 hasConditional ? 'border-amber-500' : 'border-emerald-600';

                              return (
                                <div
                                  key={`${colIdx}-${rowIdx}`}
                                  className={`relative bg-emerald-500 border-4 rounded flex items-center justify-center text-white font-medium cursor-pointer hover:bg-emerald-600 transition-colors group ${borderColor}`}
                                  style={{
                                    gridColumn: `span ${p.cell_span_cols || 1}`,
                                    gridRow: `span ${p.cell_span_rows || 1}`
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedPlanting?.id === p.id) setSelectedPlanting(null);
                                    else { setSelectedPlanting(p); setSelectedPlant(null); }
                                  }}
                                >
                                  <span className="text-xl lg:text-2xl">{p.plant_type_icon || '🌱'}</span>
                                  {/* ×N badge — computed from PlantingRule, no schema change */}
                                  {getPlantsPerSlot(p) > 1 && (
                                    <span className="absolute bottom-0 right-0 bg-white text-emerald-700 text-[9px] font-bold px-1 rounded-tl-md rounded-br shadow leading-tight">
                                      ×{getPlantsPerSlot(p)}
                                    </span>
                                  )}
                                  {selectedPlanting?.id === p.id && (
                                    <div className="absolute -bottom-12 left-0 right-0 flex gap-1 z-10">
                                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setIsMoving(true); }} className="flex-1">
                                        <Move className="w-3 h-3" />
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeletePlanting(p); }} className="flex-1">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            } else if (cellContent?.planting) {
                              return null; // Part of multi-cell plant
                            } else {
                              return (
                                <button
                                  key={`${colIdx}-${rowIdx}`}
                                  onClick={(e) => { e.stopPropagation(); handleCellClick(colIdx, rowIdx); }}
                                  className={cn(
                                    "border-2 rounded transition-colors",
                                    (selectedPlant || isMoving)
                                      ? "bg-white border-amber-300 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                                      : "bg-white border-gray-300 cursor-default"
                                  )}
                                  style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                                  title={`Cell ${colIdx}, ${rowIdx}`}
                                />
                              );
                            }
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isMoving && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900">Moving {selectedPlanting?.display_name}</p>
                <p className="text-xs text-blue-700 mt-1">Click a cell to place it</p>
                <Button size="sm" variant="outline" onClick={() => { setIsMoving(false); setSelectedPlanting(null); }} className="w-full mt-2">
                  Cancel Move
                </Button>
              </div>
            )}

            {/* Companion Analysis */}
            {companionResults.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">🌱 Companion Planting</h4>
                <div className="space-y-2">
                  {companionResults.map((result, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        result.type === 'GOOD' ? 'bg-green-50 border border-green-200' :
                        result.type === 'BAD' ? 'bg-red-50 border border-red-200' :
                        'bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <p className={`font-semibold ${
                        result.type === 'GOOD' ? 'text-green-800' : result.type === 'BAD' ? 'text-red-800' : 'text-amber-800'
                      }`}>
                        {result.plantA} + {result.plantB}: {
                          result.type === 'GOOD' ? '✓ Good' : result.type === 'BAD' ? '✗ Bad' : '⚠ Conditional'
                        }
                      </p>
                      {result.notes && <p className="text-gray-600 mt-1">{result.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Selected plant card + cancel */}
        {isMobile && selectedPlant && (
          <div className="fixed bottom-20 right-3 z-[70] max-w-[200px] p-2 bg-emerald-50 rounded-lg border-2 border-emerald-300 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-900 truncate">{selectedPlant.variety_name}</p>
                <p className="text-[10px] text-emerald-600">{selectedPlant.spacing_cols}×{selectedPlant.spacing_rows}</p>
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => { setSelectedPlant(null); setCompanionWarning(null); setRotationWarning(null); setPickerCollapsed(false); }}
                className="h-6 w-6 text-emerald-700 hover:bg-emerald-100 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            {companionWarning && (
              <p className="text-[10px] text-amber-700 mt-1 leading-tight">{companionWarning}</p>
            )}
          </div>
        )}

        {/* Mobile: Done button */}
        {isMobile && (
          <DialogFooter className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t z-[65] shadow-[0_-4px_6px_-1px_rgb(0_0_0_/_0.1)]">
            <Button 
              onClick={handleDone}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base font-semibold"
            >
              ✓ Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>

      <SeedlingSelector 
        isOpen={showSeedlingSelector}
        onClose={() => setShowSeedlingSelector(false)}
        onSeedlingSelected={(seedlingData) => {
          setSelectedPlant({
            variety_id: seedlingData.variety_id,
            variety_name: seedlingData.display_name,
            plant_type_id: seedlingData.plant_type_id,
            plant_type_name: seedlingData.display_name?.split(' - ')[1] || 'Seedling',
            display_name: seedlingData.display_name,
            spacing_cols: seedlingData.spacing_cols || 1,
            spacing_rows: seedlingData.spacing_rows || 1,
            plantsPerSlot: 1,
            growing_method: 'SEEDLING_TRANSPLANT',
            seedling_source_id: seedlingData.seedling_source_id,
            seedling_source_type: seedlingData.seedling_source_type,
            seedling_age_days: seedlingData.seedling_age_days,
            seedling_location: seedlingData.seedling_location,
            max_quantity: seedlingData.max_quantity || 1,
            quantity_to_plant: 1
          });
          checkCompanionAndRotation({
            plant_type_id: seedlingData.plant_type_id,
            plant_type_name: seedlingData.display_name?.split(' - ')[1] || 'Seedling'
          });
          if (isMobile) setPickerCollapsed(true);
        }}
      />
    </Dialog>
  );
}
