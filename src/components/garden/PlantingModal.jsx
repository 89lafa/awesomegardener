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
import { Plus, X, Trash2, Move, Loader2 } from 'lucide-react';
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
  sharedData // CRITICAL: Pre-loaded data from parent page to prevent rate limits
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
  
  const [newPlant, setNewPlant] = useState({
    variety_id: '',
    variety_name: '',
    plant_type_name: '',
    spacing_cols: 1,
    spacing_rows: 1
  });

  // Calculate grid dimensions
  const metadata = item.metadata || {};
  const isSlotBased = !metadata.gridEnabled && metadata.capacity;
  
  // For slot-based (greenhouse/grow bag), use the actual capacity as slot count
  const totalSlots = isSlotBased ? metadata.capacity : null;
  
  // For grid-based, calculate grid dimensions
  const gridCols = isSlotBased ? Math.ceil(Math.sqrt(metadata.capacity)) : Math.floor(item.width / 12); // 12" = 1 sqft
  const gridRows = isSlotBased ? Math.ceil(metadata.capacity / gridCols) : Math.floor(item.height / 12);
  const plantingPattern = item.metadata?.planting_pattern || 'square_foot';

  useEffect(() => {
    if (open && item) {
      loadData();
    }
  }, [open, item, activeSeason]);

  useEffect(() => {
    if (plantings.length > 0) {
      analyzeCompanions();
    }
  }, [plantings]);
  
  // ESC key and click-outside handler
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

      // CRITICAL FIX: Use shared data from parent if available (GardenPlanting page pre-loads it)
      if (sharedData) {
        console.log('[PlantingModal] Using pre-loaded shared data from parent page');
        setVarieties(sharedData.varieties || []);
        setPlantTypes(sharedData.plantTypes || []);
        setPlantingRules(sharedData.plantingRules || []);
        setStashPlants(sharedData.stashPlants || []);
        setProfiles(sharedData.profiles || {});
        
        // Filter crop plans from shared data
        const filteredCropPlans = (sharedData.cropPlans || []).filter(p => 
          (p.quantity_planted || 0) < (p.quantity_planned || 0) &&
          p.garden_season_id === seasonId // Ensure crop plans are for the current season
        );
        setCropPlans(filteredCropPlans);
        
        // Only fetch plantings (user-specific to this bed)
        const allPlantings = await base44.entities.PlantInstance.filter({ bed_id: item.id });
        
        // Filter by season
        let plantingsData = allPlantings;
        if (seasonKey) {
          const currentYear = new Date().getFullYear();
          const isCurrentYearSeason = seasonKey && seasonKey.startsWith(currentYear.toString());

          plantingsData = allPlantings.filter(p => {
            if (!p.season_year) {
              return isCurrentYearSeason;
            }
            return p.season_year === seasonKey;
          });
        }

        console.log('[PlantingModal] Loaded:', plantingsData.length, 'plantings for bed:', item.id);
        setPlantings(plantingsData);
        setLoading(false);
        return;
      }

      // Fallback: Load everything (for modals opened from MyGarden/PlotCanvas without sharedData)
      console.log('[PlantingModal] No shared data, loading all data...');
      
      const [allPlantings, stashData, varietiesData, typesData, rulesData] = await Promise.all([
        base44.entities.PlantInstance.filter({ bed_id: item.id }),
        base44.entities.SeedLot.filter({ is_wishlist: false, created_by: user.email }),
        base44.entities.Variety.list('variety_name', 500),
        base44.entities.PlantType.list('common_name', 100),
        base44.entities.PlantingRule.list()
      ]);
      
      // Extract unique profile IDs
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

      // Filter by season
      let plantingsData = allPlantings;
      if (seasonKey) {
        const currentYear = new Date().getFullYear();
        const isCurrentYearSeason = seasonKey && seasonKey.startsWith(currentYear.toString());

        plantingsData = allPlantings.filter(p => {
          if (!p.season_year) {
            return isCurrentYearSeason;
          }
          return p.season_year === seasonKey;
        });
      }

      console.log('[PlantingModal] Loaded:', plantingsData.length, 'plantings (filtered from', allPlantings.length, 'total) for season:', seasonKey);
      setPlantings(plantingsData);
      setStashPlants(stashData);
      
      const profilesMap = {};
      profilesData.forEach(p => {
        profilesMap[p.id] = p;
      });
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
    // First, check if there's a PlantingRule for this plant type and container
    const containerType = itemType || item.item_type;
    const rule = plantingRules.find(r => 
      r.plant_type_id === plantTypeId && 
      r.container_type === containerType
    );
    
    if (rule) {
      return { 
        cols: rule.grid_cols, 
        rows: rule.grid_rows,
        plantsPerSlot: rule.plants_per_grid_slot 
      };
    }
    
    // Fallback to old logic if no rule exists
    const method = garden.planting_method || 'STANDARD';
    
    if (method === 'SQUARE_FOOT') {
      const spacing = varietySpacing || 12;
      if (spacing >= 18) return { cols: 2, rows: 2, plantsPerSlot: 1 };
      return { cols: 1, rows: 1, plantsPerSlot: 1 };
    } else {
      const spacing = varietySpacing || 24;
      const cells = Math.ceil(spacing / 12);
      return { cols: cells, rows: cells, plantsPerSlot: 1 };
    }
  };

  const checkCollision = (col, row, spanCols, spanRows, excludeId = null) => {
    // CONTAINERS: No collision check for standalone containers
    const isContainer = item.type === 'container' || item.type === 'grow_bag';
    if (isContainer) {
      return false; // Containers allow any size plant
    }
    
    for (let r = row; r < row + spanRows; r++) {
      for (let c = col; c < col + spanCols; c++) {
        if (c >= gridCols || r >= gridRows) return true; // Out of bounds
        
        const existing = plantings.find(p => 
          p.id !== excludeId &&
          c >= p.cell_col && 
          c < p.cell_col + (p.cell_span_cols || 1) &&
          r >= p.cell_row && 
          r < p.cell_row + (p.cell_span_rows || 1)
        );
        
        if (existing) return true;
      }
    }
    return false;
  };

  const handleSlotClick = async (slotIdx) => {
    if (!selectedPlant) return;
    
    // Check if slot is occupied
    const existingPlanting = plantings.find(p => p.cell_col === slotIdx);
    if (existingPlanting) {
      toast.error('This slot is already occupied');
      return;
    }
    
    try {
      const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
        ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
        : selectedPlant.variety_name;

      const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
      const icon = plantType?.icon || '🌱';
      const plantFamily = plantType?.plant_family_id || selectedPlant.plant_family;

      console.log('[PlantingModal] Creating PlantInstance in slot', slotIdx, 'for bed', item.id);
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
        season_year: activeSeason || `${new Date().getFullYear()}-Spring`,
        status: 'planned'
        });

      console.log('[PlantingModal] Created PlantInstance:', planting.id);
      
      // If from crop plan, update quantities - count actual plants, not grid slots
      if (selectedPlant.crop_plan_id) {
        try {
          const plantsAdded = selectedPlant.plantsPerSlot || 1;
          await base44.functions.invoke('updateCropPlantedQuantity', { 
            crop_plan_id: selectedPlant.crop_plan_id,
            quantity_to_add: plantsAdded
          });
          // Reload crop plans if not using sharedData, or update sharedData if it's mutable
          if (!sharedData && seasonId) {
            const updatedPlans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
            setCropPlans(updatedPlans.filter(p => (p.quantity_planted || 0) < (p.quantity_planned || 0)));
          } else if (sharedData && onPlantingUpdate) {
            // Signal parent to update shared data or crop plan if it manages that state
            onPlantingUpdate();
          }
        } catch (error) {
          console.error('Error updating quantities:', error);
        }
      }
      
      const updatedPlantings = [...plantings, planting];
      setPlantings(updatedPlantings);
      // DON'T clear selection - keep it for multiple plantings
      // setSelectedPlant(null);
      toast.success('Plant added - click more cells to keep planting');
      onPlantingUpdate?.(updatedPlantings);
      
      // Re-run companion analysis with new plantings state
      analyzeCompanionsWithPlantings(updatedPlantings);
    } catch (error) {
      console.error('[PlantingModal] Error adding plant:', error);
      toast.error('Failed to add plant: ' + (error.message || 'Unknown error'));
    }
  };

  const handleCellClick = async (col, row) => {
    if (isMoving && selectedPlanting) {
      // Moving existing plant
      const hasCollision = checkCollision(
        col, 
        row, 
        selectedPlanting.cell_span_cols || 1,
        selectedPlanting.cell_span_rows || 1,
        selectedPlanting.id
      );
      
      if (hasCollision) {
        toast.error('Cannot place here - space occupied or out of bounds');
        return;
      }
      
      try {
        await base44.entities.PlantInstance.update(selectedPlanting.id, {
          cell_col: col,
          cell_row: row
        });
        
        setPlantings(plantings.map(p => 
          p.id === selectedPlanting.id 
            ? { ...p, cell_col: col, cell_row: row }
            : p
        ));
        
        setIsMoving(false);
        setSelectedPlanting(null);
        toast.success('Plant moved');
      } catch (error) {
        console.error('Error moving plant:', error);
        toast.error('Failed to move plant');
      }
    } else if (selectedPlant) {
      // Placing new plant
      // CONTAINERS: Allow any size plant (single occupancy only)
      const ITEM_TYPES = [
        { value: 'GROW_BAG', usesGallons: true },
        { value: 'CONTAINER', usesGallons: true }
      ];
      const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
      const isContainer = itemType?.usesGallons;
      
      let hasCollision = false;
      if (isContainer) {
        // Containers: Only check if already occupied (ignore grid bounds)
        hasCollision = plantings.length > 0;
        if (hasCollision) {
          toast.error('Container already occupied');
          return;
        }
      } else {
        // Regular beds: Check grid collision
        for (let r = row; r < row + selectedPlant.spacing_rows; r++) {
          for (let c = col; c < col + selectedPlant.spacing_cols; c++) {
            if (c >= gridCols || r >= gridRows) {
              hasCollision = true;
              break;
            }
            const existing = plantings.find(p => 
              c >= p.cell_col && 
              c < p.cell_col + (p.cell_span_cols || 1) &&
              r >= (p.cell_row || 0) && 
              r < (p.cell_row || 0) + (p.cell_span_rows || 1)
            );
            if (existing) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }
        
        if (hasCollision) {
          toast.error('Cannot place here - space occupied or out of bounds');
          return;
        }
      }
      
      try {
        const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
          ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
          : selectedPlant.variety_name;

        // Get icon from PlantType
        const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
        const icon = plantType?.icon || '🌱';
        const plantFamily = plantType?.plant_family_id || selectedPlant.plant_family;

        console.log('[PlantingModal] Creating PlantInstance at', col, row, 'for bed', item.id);

        // Build seedling metadata if from seedling
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
          season_year: activeSeason || `${new Date().getFullYear()}-Spring`,
          status: 'planned',
          ...seedlingData
        });

        console.log('[PlantingModal] Created PlantInstance:', planting.id);

        // If from crop plan, update quantities - count actual plants, not grid slots
        if (selectedPlant.crop_plan_id) {
          try {
            const plantsAdded = selectedPlant.plantsPerSlot || 1;
            await base44.functions.invoke('updateCropPlantedQuantity', { 
              crop_plan_id: selectedPlant.crop_plan_id,
              quantity_to_add: plantsAdded
            });
            // Reload crop plans to show updated counts
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
        // DON'T clear selection - keep it for multiple plantings
        // setSelectedPlant(null);
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
      
      // Re-run companion analysis with updated plantings
      analyzeCompanionsWithPlantings(updatedPlantings);
      
      // Update crop plan quantities
      // Note: selectedPlant might not be the deleted one if multiple plants were placed.
      // This logic should probably be based on the deleted `planting`'s crop_plan_id.
      if (planting.crop_plan_id) {
        try {
          await base44.functions.invoke('updateCropPlantedQuantity', { 
            crop_plan_id: planting.crop_plan_id,
            quantity_to_add: -1 // Decrement by one
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
    // Common spacing defaults in 12" cells
    if (name.includes('lettuce') || name.includes('radish') || name.includes('carrot')) return { cols: 1, rows: 1 };
    if (name.includes('tomato') || name.includes('pepper') || name.includes('cucumber')) return { cols: 2, rows: 2 };
    if (name.includes('squash') || name.includes('melon') || name.includes('pumpkin')) return { cols: 3, rows: 3 };
    if (name.includes('bean') || name.includes('pea')) return { cols: 1, rows: 1 };
    return { cols: 2, rows: 2 }; // Default
  };

  const handleSelectStashPlant = (stashItem) => {
    const profile = profiles[stashItem.plant_profile_id];
    
    if (!profile) {
      toast.error('This seed has no profile data');
      return;
    }
    
    // Try to find variety from catalog for spacing info
    const variety = varieties.find(v => 
      v.variety_name === profile.variety_name && 
      v.plant_type_id === profile.plant_type_id
    );
    
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
  };

  const checkCompanionAndRotation = async (plantData) => {
    if (!plantData || !plantData.plant_type_id) {
      setCompanionWarning(null);
      setRotationWarning(null);
      return;
    }
    
    try {
      // Load companion rules for this plant type
      const companionRules = await base44.entities.CompanionRule.filter({
        plant_type_id: plantData.plant_type_id
      });
      
      // Check companions - look for existing plantings in this bed
      const bedPlantings = plantings.filter(p => p.bed_id === item.id && p.id !== selectedPlanting?.id);
      
      let hasCompanionIssue = false;
      for (const existing of bedPlantings) {
        // Check if there's a BAD companion rule
        const badRule = companionRules.find(r => 
          r.companion_type === 'BAD' && 
          r.companion_plant_type_id === existing.plant_type_id
        );
        
        if (badRule) {
          hasCompanionIssue = true;
          setCompanionWarning(`⚠️ ${plantData.plant_type_name} should not be planted near ${existing.display_name}`);
          break;
        }
      }
      
      if (!hasCompanionIssue) {
        setCompanionWarning(null);
      }
      
      // Check rotation - look for same family in this bed from previous year
      const currentYear = new Date().getFullYear();
      const lastYearPlantings = plantings.filter(p => 
        p.bed_id === item.id && 
        p.plant_family && 
        plantData.plant_family &&
        p.plant_family === plantData.plant_family &&
        p.season_year && 
        !p.season_year.startsWith(currentYear.toString())
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
    if (currentPlantings.length === 0 || !item?.id) {
      setCompanionResults([]);
      return;
    }

    try {
      const companionRules = await base44.entities.CompanionRule.list();
      const results = [];

      // Check ALL pairs of plantings for companion relationships
      for (let i = 0; i < currentPlantings.length; i++) {
        for (let j = i + 1; j < currentPlantings.length; j++) {
          const plantA = currentPlantings[i];
          const plantB = currentPlantings[j];

          if (!plantA.plant_type_id || !plantB.plant_type_id) continue;

          // FIXED: Check adjacency more reliably
          // For multi-cell plants, check if ANY cells are adjacent
          const aCols = Array.from({ length: plantA.cell_span_cols || 1 }, (_, i) => plantA.cell_col + i);
          const aRows = Array.from({ length: plantA.cell_span_rows || 1 }, (_, i) => (plantA.cell_row || 0) + i);
          const bCols = Array.from({ length: plantB.cell_span_cols || 1 }, (_, i) => plantB.cell_col + i);
          const bRows = Array.from({ length: plantB.cell_span_rows || 1 }, (_, i) => (plantB.cell_row || 0) + i);

          let isAdjacent = false;
          
          if (isSlotBased) {
            // For slots, always adjacent
            isAdjacent = true;
          } else {
            // For grid: check if any cell of A is within 1 cell of any cell of B
            for (const aCol of aCols) {
              for (const aRow of aRows) {
                for (const bCol of bCols) {
                  for (const bRow of bRows) {
                    const colDist = Math.abs(aCol - bCol);
                    const rowDist = Math.abs(aRow - bRow);
                    
                    // Adjacent if within 1 cell (including diagonals), but not same cell
                    if ((colDist <= 1 && rowDist <= 1) && !(colDist === 0 && rowDist === 0)) {
                      isAdjacent = true;
                      break;
                    }
                  }
                  if (isAdjacent) break;
                }
                if (isAdjacent) break;
              }
              if (isAdjacent) break;
            }
          }

          // Look for companion rule (bidirectional)
          const rule = companionRules.find(r =>
            (r.plant_type_id === plantA.plant_type_id && r.companion_plant_type_id === plantB.plant_type_id) ||
            (r.plant_type_id === plantB.plant_type_id && r.companion_plant_type_id === plantA.plant_type_id)
          );

          if (rule && isAdjacent) {
            results.push({
              plantA: plantA.display_name,
              plantB: plantB.display_name,
              type: rule.companion_type,
              notes: rule.notes,
              cellA: { col: plantA.cell_col, row: plantA.cell_row || 0 },
              cellB: { col: plantB.cell_col, row: plantB.cell_row || 0 }
            });
          }
        }
      }

      console.log('[PlantingModal] Companion analysis found', results.length, 'relationships from', currentPlantings.length, 'plants');
      setCompanionResults(results);
    } catch (error) {
      console.error('Error analyzing companions:', error);
    }
  };

  const analyzeCompanions = () => analyzeCompanionsWithPlantings(plantings);
  
  const handleCreateNewPlant = async () => {
    // This function is not used but kept for compatibility.
    // The "Add New" tab now uses CatalogTypeSelector which handles selection and potential creation
    // of seed lots/profiles implicitly through its onSelect callback.
    // If future UI elements need to directly trigger new plant creation,
    // this logic can be re-enabled or modified.
    console.warn("handleCreateNewPlant was called but is currently a no-op as its functionality is handled elsewhere.");
    toast.info("Functionality to directly create new plants is handled by the Catalog Selector.");
    return;
  };

  const getCellContent = (col, row) => {
    const planting = plantings.find(p => 
      col >= p.cell_col && 
      col < p.cell_col + (p.cell_span_cols || 1) &&
      row >= p.cell_row && 
      row < p.cell_row + (p.cell_span_rows || 1)
    );
    
    if (planting && col === planting.cell_col && row === planting.cell_row) {
      return { planting, isOrigin: true };
    } else if (planting) {
      return { planting, isOrigin: false };
    }
    
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

        {/* Seedling Selector Modal */}
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
              spacing_cols: 1,
              spacing_rows: 1,
              plantsPerSlot: 1,
              growing_method: 'SEEDLING_TRANSPLANT',
              seedling_source_id: seedlingData.seedling_source_id,
              seedling_source_type: seedlingData.seedling_source_type,
              seedling_age_days: seedlingData.seedling_age_days,
              seedling_location: seedlingData.seedling_location
            });
            checkCompanionAndRotation({
              plant_type_id: seedlingData.plant_type_id,
              plant_type_name: seedlingData.display_name?.split(' - ')[1] || 'Seedling'
            });
          }}
        />
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
    if (onPlantingUpdate) {
      onPlantingUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] lg:max-h-[90vh] max-h-screen p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 lg:p-6 pb-3 lg:pb-4 border-b flex flex-row items-center justify-between flex-shrink-0">
          <div className="flex-1">
            <DialogTitle className="text-base lg:text-lg">Plant in {item.label}</DialogTitle>
            <p className="text-xs lg:text-sm text-gray-600 mt-1">
              {gridCols} × {gridRows} grid • {garden.planting_method === 'SQUARE_FOOT' ? 'Square Foot' : 'Standard'}
              {plantingPattern === 'diagonal' && ' • Diagonal'}
            </p>
          </div>
          {!isMobile && (
            <Button 
              onClick={handleDone}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 lg:h-11 px-4 lg:px-8 text-sm lg:text-base font-semibold ml-2 lg:ml-4 flex-shrink-0"
            >
              ✓ Done
            </Button>
          )}
        </DialogHeader>

        <div className={cn(
          "flex flex-col lg:flex-row gap-3 lg:gap-6 p-3 lg:p-6 overflow-hidden flex-1 min-h-0",
          isMobile && "pb-20"
        )}>
          {/* Left Panel - Plant Picker - Compact on mobile */}
          <div className={cn("w-full lg:w-80 flex-shrink-0 flex flex-col min-h-0 relative", isMobile ? "max-h-[30vh]" : "max-h-none")}
            style={{ zIndex: 60 }}
          >
            {showCompanionSuggestions && selectedPlant?.plant_type_id && (
              <CompanionSuggestions 
                plantTypeId={selectedPlant.plant_type_id}
                onClose={() => setShowCompanionSuggestions(false)}
              />
            )}
            <Tabs defaultValue="stash" className="flex-1 flex flex-col min-h-0 bg-white rounded-lg shadow-md border-2 border-gray-200 lg:shadow-none lg:border-0">
              <TabsList className="w-full flex-shrink-0 grid grid-cols-4 h-10 lg:h-auto">
                <TabsTrigger value="stash" className="text-xs lg:text-sm py-1.5 lg:py-2">From Stash</TabsTrigger>
                <TabsTrigger value="plan" className="text-xs lg:text-sm py-1.5 lg:py-2">From Plan</TabsTrigger>
                <TabsTrigger value="seedlings" className="text-xs lg:text-sm py-1.5 lg:py-2">Seedlings</TabsTrigger>
                <TabsTrigger value="new" className="text-xs lg:text-sm py-1.5 lg:py-2">Add New</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stash" className="mt-2 lg:mt-4 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                <StashTypeSelector
                  onSelect={(plantData) => {
                    setSelectedPlant(plantData);
                    checkCompanionAndRotation(plantData);
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
              
              <TabsContent value="plan" className="mt-2 lg:mt-4 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                {seasonId && cropPlans.length > 0 ? (
                  <div className="space-y-2 h-full overflow-auto">
                      {cropPlans.map(plan => {
                        const remaining = (plan.quantity_planned || 0) - (plan.quantity_planted || 0);

                        // Get variety details for proper display
                        const variety = varieties.find(v => v.id === plan.variety_id);
                        const plantType = plantTypes.find(pt => pt.id === plan.plant_type_id);

                        // Format: "Variety - PlantType" or just label if no variety
                        const displayName = variety && plantType 
                          ? `${variety.variety_name} - ${plantType.common_name}`
                          : plan.label;

                        return (
                          <button
                            key={plan.id}
                            onClick={() => {
                              const spacing = getDefaultSpacing(plantType?.common_name || plan.label);
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
                            }}
                            className={cn(
                              "w-full p-3 rounded-lg border-2 text-left transition-colors",
                              selectedPlanItem?.id === plan.id 
                                ? "bg-emerald-50 border-emerald-500" 
                                : "bg-white border-gray-200 hover:border-emerald-300"
                            )}
                          >
                            <p className="font-medium text-sm">{displayName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {remaining} of {plan.quantity_planned} remaining
                            </p>
                          </button>
                        );
                      })}
                    </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No calendar crops available to plant
                  </div>
                )}
              </TabsContent>

              <TabsContent value="seedlings" className="mt-2 lg:mt-4 flex-1 min-h-0 overflow-auto p-2 lg:p-0">
                <Button
                  onClick={() => setShowSeedlingSelector(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 mb-3"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Select Seedling
                </Button>
                {selectedPlant?.seedling_source_id && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-600 mb-1">Selected Seedling:</p>
                    <p className="font-medium text-sm text-emerald-900">{selectedPlant.display_name}</p>
                    <p className="text-xs text-emerald-700 mt-1">📍 {selectedPlant.seedling_location}</p>
                    <p className="text-xs text-emerald-700">📅 Age: {selectedPlant.seedling_age_days}d</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="new" className="mt-2 lg:mt-4 flex-1 overflow-auto p-2 lg:p-0">
                <CatalogTypeSelector
                  onSelect={(plantData) => {
                    setSelectedPlant(plantData);
                    checkCompanionAndRotation(plantData);
                  }}
                  selectedPlant={selectedPlant}
                  getSpacingForPlant={getSpacingForPlant}
                  plantTypes={plantTypes}
                  varieties={varieties}
                  profiles={profiles}
                />
              </TabsContent>
            </Tabs>
            
            {/* Desktop: Selected plant card in left panel */}
            {!isMobile && selectedPlant && (
              <div className="mt-2 lg:mt-4 space-y-2 flex-shrink-0">
                <div className="p-2 lg:p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs lg:text-sm font-medium text-emerald-900">Selected:</p>
                  <p className="text-xs lg:text-sm text-emerald-700 truncate">{selectedPlant.variety_name}</p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Takes {selectedPlant.spacing_cols}×{selectedPlant.spacing_rows} cells
                    {selectedPlant.plantsPerSlot > 1 && ` (${selectedPlant.plantsPerSlot} plants)`}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedPlant(null);
                      setCompanionWarning(null);
                      setRotationWarning(null);
                    }}
                    className="w-full mt-2 text-xs lg:text-sm"
                  >
                    Cancel
                  </Button>
                </div>

                {companionWarning && (
                  <div className="p-2 lg:p-3 bg-amber-50 rounded-lg border border-amber-300">
                    <p className="text-xs text-amber-800">{companionWarning}</p>
                  </div>
                )}

                {rotationWarning && (
                  <div className="p-2 lg:p-3 bg-orange-50 rounded-lg border border-orange-300">
                    <p className="text-xs text-orange-800">{rotationWarning}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Grid or Slots */}
          <div 
           className="flex-1 overflow-auto"
           onClick={(e) => {
             // Dismiss overlay when clicking grid background
             if (e.target === e.currentTarget || e.target.closest('.grid-container')) {
               setSelectedPlanting(null);
               setIsMoving(false);
             }
           }}
          >
           {isSlotBased ? (
              // Slot-based layout for greenhouses/containers
              <div className="grid gap-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', maxWidth: '600px' }}>
                {Array.from({ length: totalSlots }).map((_, slotIdx) => {
                  const planting = plantings.find(p => p.cell_col === slotIdx);
                  return (
                    <button
                      key={slotIdx}
                      onClick={() => {
                        if (planting) {
                          if (selectedPlanting?.id === planting.id) {
                            setSelectedPlanting(null);
                          } else {
                            setSelectedPlanting(planting);
                            setSelectedPlant(null);
                          }
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
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlanting(planting);
                              setSelectedPlanting(null);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              // Grid-based layout for raised beds
              <div className="space-y-2">
              {plantingPattern === 'diagonal' ? (
                <DiagonalPlantingPattern
                  rows={gridRows}
                  columns={gridCols}
                  plantings={plantings}
                  onCellClick={handleCellClick}
                  readOnly={!(selectedPlant || isMoving)}
                  selectedPlanting={selectedPlanting}
                  onSelectPlanting={(p) => {
                    if (selectedPlanting?.id === p.id) {
                      setSelectedPlanting(null);
                    } else {
                      setSelectedPlanting(p);
                      setSelectedPlant(null);
                    }
                  }}
                  onMove={(p) => {
                    setSelectedPlanting(p);
                    setIsMoving(true);
                  }}
                  onDelete={handleDeletePlanting}
                  companionResults={companionResults}
                />
              ) : (
                <div 
                  className="grid gap-1 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg inline-block grid-container"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, 40px)`,
                    gridTemplateRows: `repeat(${gridRows}, 40px)`
                  }}
                >
                  {Array.from({ length: gridRows }).map((_, rowIdx) =>
                    Array.from({ length: gridCols }).map((_, colIdx) => {
                    const cellContent = getCellContent(colIdx, rowIdx);
                    
                    if (cellContent?.isOrigin) {
                      const p = cellContent.planting;

                      // Check if this plant has companion relationships
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
                                         hasGood ? 'border-green-500' : 
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
                            // Toggle selection
                            if (selectedPlanting?.id === p.id) {
                              setSelectedPlanting(null);
                            } else {
                              setSelectedPlanting(p);
                              setSelectedPlant(null);
                            }
                          }}
                        >
                          <span className="text-2xl">{p.plant_type_icon || '🌱'}</span>
                          {selectedPlanting?.id === p.id && (
                            <div className="absolute -bottom-12 left-0 right-0 flex gap-1 z-10">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsMoving(true);
                                }}
                                className="flex-1"
                              >
                                <Move className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePlanting(p);
                                }}
                                className="flex-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    } else if (cellContent?.planting) {
                      // Part of multi-cell plant, skip rendering
                      return null;
                    } else {
                      return (
                        <button
                          key={`${colIdx}-${rowIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(colIdx, rowIdx);
                          }}
                          className={cn(
                            "w-10 h-10 border-2 rounded transition-colors",
                            (selectedPlant || isMoving)
                              ? "bg-white border-amber-300 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                              : "bg-white border-gray-300 cursor-default"
                        )}
                        title={`Cell ${colIdx}, ${rowIdx}`}
                      />
                    );
                  }
                  })
                  )}
                  </div>
                  )}
                  </div>
                  )}

            {isMoving && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900">
                  Moving {selectedPlanting?.display_name}
                </p>
                <p className="text-xs text-blue-700 mt-1">Click a cell to place it</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsMoving(false);
                    setSelectedPlanting(null);
                  }}
                  className="w-full mt-2"
                >
                  Cancel Move
                </Button>
              </div>
            )}

            {/* Companion Analysis - Below Grid */}
            {companionResults.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold text-sm mb-2">🌱 Companion Planting in This Bed</h4>
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
                        result.type === 'GOOD' ? 'text-green-800' :
                        result.type === 'BAD' ? 'text-red-800' :
                        'text-amber-800'
                      }`}>
                        {result.plantA} + {result.plantB}: {
                          result.type === 'GOOD' ? '✓ Good Companions' :
                          result.type === 'BAD' ? '✗ Bad Companions' :
                          '⚠ Conditional'
                        }
                      </p>
                      {result.notes && (
                        <p className="text-gray-600 mt-1">{result.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Selected plant card - compact, fixed bottom right */}
        {isMobile && selectedPlant && (
          <div className="fixed bottom-20 right-4 z-[70] max-w-[200px] p-2 bg-emerald-50 rounded-lg border-2 border-emerald-300 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-emerald-900 truncate">{selectedPlant.variety_name}</p>
                <p className="text-[10px] text-emerald-600">{selectedPlant.spacing_cols}×{selectedPlant.spacing_rows}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setSelectedPlant(null);
                  setCompanionWarning(null);
                  setRotationWarning(null);
                }}
                className="h-6 w-6 text-emerald-700 hover:bg-emerald-100 flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Mobile: Done button - fixed bottom bar */}
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
    </Dialog>
  );
}