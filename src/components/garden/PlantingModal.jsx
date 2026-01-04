import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export default function PlantingModal({ open, onOpenChange, item, garden, onPlantingUpdate }) {
  const [plantings, setPlantings] = useState([]);
  const [stashPlants, setStashPlants] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [selectedPlanting, setSelectedPlanting] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  const [newPlant, setNewPlant] = useState({
    variety_id: '',
    variety_name: '',
    plant_type_name: '',
    spacing_cols: 1,
    spacing_rows: 1
  });

  // Calculate grid dimensions
  const gridCols = Math.floor(item.width / 12); // 12" = 1 sqft
  const gridRows = Math.floor(item.height / 12);

  useEffect(() => {
    if (open && item) {
      loadData();
    }
  }, [open, item]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plantingsData, stashData, varietiesData, typesData] = await Promise.all([
        base44.entities.PlantInstance.filter({ bed_id: item.id }),
        base44.entities.SeedLot.filter({ is_wishlist: false }),
        base44.entities.Variety.list('variety_name', 100),
        base44.entities.PlantType.list('common_name', 100)
      ]);
      
      setPlantings(plantingsData);
      setStashPlants(stashData);
      setVarieties(varietiesData);
      setPlantTypes(typesData);
    } catch (error) {
      console.error('Error loading planting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSpacingForPlant = (variety) => {
    const method = garden.planting_method || 'STANDARD';
    
    if (method === 'SQUARE_FOOT') {
      // Most plants 1x1 in SFT, larger crops 2x2
      const spacing = variety.spacing_recommended || 12;
      if (spacing >= 18) return { cols: 2, rows: 2 };
      return { cols: 1, rows: 1 };
    } else {
      // Standard spacing - use variety spacing
      const spacing = variety.spacing_recommended || 24;
      const cells = Math.ceil(spacing / 12);
      return { cols: cells, rows: cells };
    }
  };

  const checkCollision = (col, row, spanCols, spanRows, excludeId = null) => {
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
      const hasCollision = checkCollision(col, row, selectedPlant.spacing_cols, selectedPlant.spacing_rows);
      
      if (hasCollision) {
        toast.error('Cannot place here - space occupied or out of bounds');
        return;
      }
      
      try {
        const displayName = selectedPlant.variety_name !== selectedPlant.plant_type_name 
          ? `${selectedPlant.plant_type_name} - ${selectedPlant.variety_name}`
          : selectedPlant.variety_name;

        // Get icon from PlantType
        const plantType = plantTypes.find(t => t.id === selectedPlant.plant_type_id || t.common_name === selectedPlant.plant_type_name);
        const icon = plantType?.icon || '🌱';

        console.log('[PlantingModal] Creating PlantInstance at', col, row, 'for bed', item.id);
        const planting = await base44.entities.PlantInstance.create({
          garden_id: garden.id,
          bed_id: item.id,
          space_id: item.id,
          cell_x: col,
          cell_y: row,
          plant_type_id: selectedPlant.plant_type_id,
          plant_type_icon: icon,
          variety_id: selectedPlant.variety_id,
          display_name: displayName,
          placement_mode: 'grid_cell',
          cell_col: col,
          cell_row: row,
          cell_span_cols: selectedPlant.spacing_cols,
          cell_span_rows: selectedPlant.spacing_rows,
          status: 'planned'
        });

        console.log('[PlantingModal] Created PlantInstance:', planting.id);
        setPlantings([...plantings, planting]);
        toast.success('Plant added');
      } catch (error) {
        console.error('[PlantingModal] Error adding plant:', error);
        toast.error('Failed to add plant: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleDeletePlanting = async (planting) => {
    if (!confirm(`Remove ${planting.display_name}?`)) return;
    
    try {
      await base44.entities.PlantInstance.delete(planting.id);
      setPlantings(plantings.filter(p => p.id !== planting.id));
      toast.success('Plant removed');
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
    // Check if seed has minimum required info
    if (!stashItem.plant_type_name && !stashItem.variety_name) {
      toast.error('This seed needs a plant name to be planted');
      return;
    }
    
    // Try to find variety from catalog for spacing info
    const variety = varieties.find(v => v.id === stashItem.variety_id);
    const spacing = variety 
      ? getSpacingForPlant(variety) 
      : getDefaultSpacing(stashItem.plant_type_name || stashItem.variety_name);
    
    setSelectedPlant({
      variety_id: stashItem.variety_id || null,
      variety_name: stashItem.variety_name || stashItem.plant_type_name,
      plant_type_id: stashItem.plant_type_id || null,
      plant_type_name: stashItem.plant_type_name || stashItem.variety_name,
      spacing_cols: spacing.cols,
      spacing_rows: spacing.rows
    });
  };

  const handleCreateNewPlant = async () => {
    if (!newPlant.variety_id || creating) return;
    
    console.log('[PlantingModal] Creating new plant from variety:', newPlant.variety_id);
    setCreating(true);
    try {
      const variety = varieties.find(v => v.id === newPlant.variety_id);
      if (!variety) {
        toast.error('Variety not found');
        setCreating(false);
        return;
      }
      
      const spacing = getSpacingForPlant(variety);
      console.log('[PlantingModal] Creating SeedLot with variety:', variety.id, variety.variety_name);
      
      // Add to stash
      const newSeedLot = await base44.entities.SeedLot.create({
        plant_profile_id: variety.id,
        is_wishlist: false
      });
      console.log('[PlantingModal] Created SeedLot:', newSeedLot.id);
      
      // Select for placing
      const selectedPlantData = {
        variety_id: variety.id,
        variety_name: variety.variety_name,
        plant_type_id: variety.plant_type_id || null,
        plant_type_name: variety.common_name || variety.variety_name,
        spacing_cols: spacing.cols,
        spacing_rows: spacing.rows
      };
      console.log('[PlantingModal] Setting selected plant:', selectedPlantData);
      setSelectedPlant(selectedPlantData);
      
      setNewPlant({ variety_id: '', variety_name: '', plant_type_name: '', spacing_cols: 1, spacing_rows: 1 });
      toast.success('Added to stash - now click a cell to place');
      
      // Reload stash
      const stashData = await base44.entities.SeedLot.filter({ is_wishlist: false });
      setStashPlants(stashData);
      console.log('[PlantingModal] Reloaded stash, count:', stashData.length);
    } catch (error) {
      console.error('[PlantingModal] Error creating plant:', error);
      toast.error('Failed to add plant: ' + (error.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
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
      </Dialog>
    );
  }

  const handleDone = () => {
    onOpenChange(false);
    if (onPlantingUpdate) {
      onPlantingUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b flex flex-row items-center justify-between">
          <div className="flex-1">
            <DialogTitle>Plant in {item.label}</DialogTitle>
            <p className="text-sm text-gray-600 mt-1">
              {gridCols} × {gridRows} grid • {garden.planting_method === 'SQUARE_FOOT' ? 'Square Foot Method' : 'Standard Spacing'}
            </p>
          </div>
          <Button 
            onClick={handleDone}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-8 text-base font-semibold ml-4"
          >
            ✓ Done Planting
          </Button>
        </DialogHeader>

        <div className="flex gap-6 p-6 overflow-hidden h-[calc(90vh-120px)]">
          {/* Left Panel - Plant Picker */}
          <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
            <Tabs defaultValue="stash" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full flex-shrink-0">
                <TabsTrigger value="stash" className="flex-1">From Stash</TabsTrigger>
                <TabsTrigger value="new" className="flex-1">Add New</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stash" className="mt-4 flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {stashPlants.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No plants in stash</p>
                    ) : (
                      stashPlants.map((plant) => (
                        <button
                          key={plant.id}
                          onClick={() => handleSelectStashPlant(plant)}
                          className={cn(
                            "w-full p-3 rounded-lg border-2 text-left transition-colors",
                            selectedPlant?.variety_id === plant.variety_id
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <p className="font-medium text-sm">{plant.variety_name}</p>
                          <p className="text-xs text-gray-500">{plant.plant_type_name}</p>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="new" className="mt-4 flex-1">
                <div className="space-y-4">
                  <div>
                    <Label>Variety</Label>
                    <Select 
                      value={newPlant.variety_id} 
                      onValueChange={(v) => {
                        const variety = varieties.find(vr => vr.id === v);
                        setNewPlant({
                          ...newPlant,
                          variety_id: v,
                          variety_name: variety.variety_name,
                          plant_type_name: variety.plant_type_name
                        });
                      }}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select variety" />
                      </SelectTrigger>
                      <SelectContent>
                        {varieties.slice(0, 50).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.variety_name} ({v.plant_type_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    type="button"
                    onClick={handleCreateNewPlant}
                    disabled={!newPlant.variety_id || creating}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Stash & Place
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            
            {selectedPlant && (
              <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex-shrink-0">
                <p className="text-sm font-medium text-emerald-900">Selected:</p>
                <p className="text-sm text-emerald-700 truncate">{selectedPlant.variety_name}</p>
                <p className="text-xs text-emerald-600 mt-1">
                  Takes {selectedPlant.spacing_cols}×{selectedPlant.spacing_rows} cells
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedPlant(null)}
                  className="w-full mt-2"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel - Grid */}
          <div className="flex-1 overflow-auto">
            <div 
              className="grid gap-1 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg inline-block"
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
                    return (
                      <div
                        key={`${colIdx}-${rowIdx}`}
                        className="relative bg-emerald-500 border-2 border-emerald-600 rounded flex items-center justify-center text-white font-medium cursor-pointer hover:bg-emerald-600 transition-colors group"
                        style={{
                          gridColumn: `span ${p.cell_span_cols || 1}`,
                          gridRow: `span ${p.cell_span_rows || 1}`
                        }}
                        onClick={() => {
                          setSelectedPlanting(p);
                          setSelectedPlant(null);
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
                        onClick={() => handleCellClick(colIdx, rowIdx)}
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
          </div>
        </div>
        

      </DialogContent>
    </Dialog>
  );
}