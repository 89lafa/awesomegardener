
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Plus,
  Trash2,
  RotateCw,
  Copy,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Settings,
  Loader2,
  Palette,
  Sprout
} from 'lucide-react';
import PlotSettingsDialog from './PlotSettingsDialog';
import PlantingModal from './PlantingModal';
import AISuggestLayoutButton from './AISuggestLayoutButton';
import SunPathOverlay from './SunPathOverlay';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ITEM_TYPES = [
  { value: 'RAISED_BED', label: 'Raised Bed', color: '#8B7355', defaultDims: '4x8', defaultUnit: 'ft', usesGrid: true, plantable: true },
  { value: 'RAISED_PLANTER', label: 'Raised Planter/Garden Bed', color: '#5DADE2', usesPredefinedSizes: true, usesGrid: true, plantable: true },
  { value: 'IN_GROUND_BED', label: 'In-Ground Bed', color: '#A0826D', defaultDims: '4x20', defaultUnit: 'ft', usesRows: true, plantable: true },
  { value: 'GREENHOUSE', label: 'Greenhouse', color: '#80CBC4', defaultDims: '10x12', defaultUnit: 'ft', usesGrid: true, plantable: true },
  { value: 'OPEN_PLOT', label: 'Open Plot', color: '#D7CCC8', defaultDims: '50x100', defaultUnit: 'ft', usesRows: true, plantable: true },
  { value: 'GROW_BAG', label: 'Grow Bag', color: '#424242', usesGallons: true, plantable: true },
  { value: 'CONTAINER', label: 'Plastic/Ceramic Container', color: '#D84315', usesGallons: true, plantable: true },
  { value: 'FENCE', label: 'Fence', color: '#5D4037', defaultDims: '10x0.5', defaultUnit: 'ft', plantable: false },
  { value: 'BUILDING', label: 'Building/Shed', color: '#795548', defaultDims: '8x10', defaultUnit: 'ft', plantable: false },
  { value: 'TREE', label: 'Tree', color: '#4CAF50', defaultDims: '3x3', defaultUnit: 'ft', plantable: true },
  { value: 'PATH', label: 'Path/Walkway', color: '#9E9E9E', defaultDims: '3x20', defaultUnit: 'ft', plantable: false },
  { value: 'COMPOST', label: 'Compost Bin', color: '#6D4C41', defaultDims: '3x3', defaultUnit: 'ft', plantable: false },
  { value: 'WATER_SOURCE', label: 'Water Source', color: '#2196F3', defaultDims: '2x2', defaultUnit: 'ft', plantable: false },
];

const RAISED_PLANTER_SIZES = [
  { label: '2ft x 4ft', width: 24, height: 48 },
  { label: '2ft x 8ft', width: 24, height: 96 },
  { label: '4ft x 4ft', width: 48, height: 48 },
  { label: '4ft x 8ft', width: 48, height: 96 }
];

const GALLON_SIZES = [
  { value: 1, footprint: 8 }, { value: 3, footprint: 10 }, { value: 5, footprint: 12 },
  { value: 7, footprint: 14 }, { value: 10, footprint: 16 }, { value: 15, footprint: 20 },
  { value: 20, footprint: 24 }, { value: 30, footprint: 30 }
];

export default function PlotCanvas({ garden, plot, activeSeason, seasonId, onPlotUpdate, onDeleteGarden, onItemSelect }) {
  const [cropPlans, setCropPlans] = useState([]);
  
  useEffect(() => {
    if (seasonId) {
      loadCropPlans();
    }
  }, [seasonId]);

  const loadCropPlans = async () => {
    try {
      const plans = await base44.entities.CropPlan.filter({ garden_season_id: seasonId });
      setCropPlans(plans);
    } catch (error) {
      console.error('Error loading crop plans:', error);
    }
  };
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [itemsPlantingCounts, setItemsPlantingCounts] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [draggingItem, setDraggingItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showPlotSettings, setShowPlotSettings] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [showPlantingModal, setShowPlantingModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSunPath, setShowSunPath] = useState(false);
  const [showSFGGrid, setShowSFGGrid] = useState(false);
  const [editItemData, setEditItemData] = useState({
    label: '',
    dimensions: '',
    unit: 'ft',
    color: '',
    customColor: '',
    gallonSize: 5,
    rowSpacing: 18,
    rowCount: null,
    capacity: 20,
    planting_pattern: 'square_foot'
  });

  const [newItem, setNewItem] = useState({
    item_type: 'RAISED_BED',
    label: 'Raised Bed',
    dimensions: '4x8',
    unit: 'ft',
    useSquareFootGrid: true,
    planting_pattern: 'square_foot',
    gallonSize: 5,
    planterSize: '4ft x 8ft',
    rowSpacing: 18,
    rowCount: null,
    createMultiple: false,
    count: 1,
    color: null
  });

  const [bulkAdd, setBulkAdd] = useState({
    count: 4,
    base_name: 'Raised Bed',
    dimensions: '4x8',
    unit: 'ft',
    item_type: 'RAISED_BED'
  });

  useEffect(() => {
    if (plot) {
      loadItems();
    }
  }, [plot, activeSeason]);

  // Window event listeners for reliable drag end
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (draggingItem || isDragging) {
        setDraggingItem(null);
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
    
    const handleWindowBlur = () => {
      if (draggingItem || isDragging) {
        setDraggingItem(null);
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };
    
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    
    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [draggingItem, isDragging]);

  const loadItems = async () => {
    try {
      const user = await base44.auth.me();
      
      const [itemsData, allPlantings] = await Promise.all([
        base44.entities.PlotItem.filter({ 
          garden_id: garden.id,
          plot_id: plot.id,
          created_by: user.email
        }, 'z_index'),
        base44.entities.PlantInstance.filter({ garden_id: garden.id, created_by: user.email })
      ]);
      
      // Filter plantings by season client-side to handle old plantings without season_year
      let plantings = allPlantings;
      if (activeSeason) {
        // Show plantings for this season OR plantings without season_year (old data - show in current year)
        const currentYear = new Date().getFullYear();
        const isCurrentYearSeason = activeSeason && activeSeason.startsWith(currentYear.toString());
        
        plantings = allPlantings.filter(p => {
          // If planting has no season_year (old data), only show in current year's season
          if (!p.season_year) {
            return isCurrentYearSeason;
          }
          // Otherwise, match the selected season exactly
          return p.season_year === activeSeason;
        });
      }
      
      // Ensure rotation is initialized
      const normalizedItems = itemsData.map(item => ({
        ...item,
        rotation: item.rotation || 0
      }));
      setItems(normalizedItems);
      
      // Calculate planting counts per item
      const counts = {};
      for (const item of normalizedItems) {
        const itemPlantings = plantings.filter(p => p.bed_id === item.id);
        const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
        
        if (itemType?.plantable) {
          let capacity = 0;
          const layoutSchema = item.metadata?.gridEnabled 
            ? calculateLayoutSchema(itemType, item.width, item.height, item.metadata || {})
            : null;
          
          if (layoutSchema?.type === 'grid') {
            capacity = layoutSchema.columns * layoutSchema.rows;
          }
          
          // Count cells occupied (for containers/bags, count = number of plantings, not cells)
          const filled = layoutSchema?.flexible 
            ? itemPlantings.length
            : itemPlantings.reduce((sum, p) => {
                const cols = p.cell_span_cols || 1;
                const rows = p.cell_span_rows || 1;
                return sum + (cols * rows);
              }, 0);
          
          counts[item.id] = {
            filled: filled,
            capacity: capacity
          };
        }
      }
      setItemsPlantingCounts(counts);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseDimensions = (input) => {
    const match = input.match(/(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)/);
    if (match) {
      return { width: parseFloat(match[1]), height: parseFloat(match[2]) };
    }
    return null;
  };

  const toInches = (value, unit) => {
    return unit === 'ft' ? value * 12 : value;
  };

  const getNextName = (baseLabel) => {
    // FIXED: Check for duplicate names and auto-increment
    const exactMatch = items.find(i => i.label === baseLabel);
    if (!exactMatch) {
      return baseLabel;
    }

    // Find all items with this base label pattern
    const escapedBase = baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedBase}( \\d+)?$`);
    const matchingItems = items.filter(i => pattern.test(i.label));
    
    console.log('[Naming] Base:', baseLabel, 'Matching:', matchingItems.map(i => i.label));
    
    // Extract numbers from existing items
    const numbers = matchingItems.map(i => {
      const match = i.label.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 1; // Base name without number = 1
    });
    
    // Find next available number
    const maxNum = Math.max(...numbers, 0);
    const nextNum = maxNum + 1;
    
    console.log('[Naming] Next number:', nextNum);
    return `${baseLabel} ${nextNum}`;
  };

  const calculateLayoutSchema = (itemType, width, height, metadata) => {
    // CONTAINER and GROW_BAG: Flexible slot - capacity = 1 plant of any size
    if (itemType.usesGallons) {
      return { type: 'slots', slots: 1, flexible: true, capacity: 1 };
    }
    
    // TREE: 1 slot plantable
    if (itemType.value === 'TREE') {
      return { type: 'slots', slots: 1, flexible: true };
    }
    
    if (itemType.usesGrid && metadata.gridEnabled) {
      const gridSize = metadata.gridSize || 12;
      return {
        type: 'grid',
        grid_size: gridSize,
        columns: Math.floor(width / gridSize),
        rows: Math.floor(height / gridSize),
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }
    if (itemType.usesPredefinedSizes) {
      const gridSize = 12;
      return {
        type: 'grid',
        grid_size: gridSize,
        columns: Math.floor(width / gridSize),
        rows: Math.floor(height / gridSize),
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }
    if (itemType.usesRows) {
      return {
        type: 'rows',
        rows: metadata.rowCount || Math.floor(width / (metadata.rowSpacing || 18)),
        row_spacing: metadata.rowSpacing || 18,
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }
    return { type: 'slots', slots: 10 };
  };

  const calculateCapacity = (layoutSchema) => {
    if (layoutSchema.type === 'grid') {
      return layoutSchema.columns * layoutSchema.rows;
    }
    if (layoutSchema.type === 'rows') {
      return layoutSchema.rows;
    }
    if (layoutSchema.type === 'slots') {
      // For flexible slots (containers/bags), capacity = 1 regardless of plant grid size
      return layoutSchema.capacity || 1;
    }
    return 0;
  };

  const [addingItems, setAddingItems] = useState(false);

  const handleAddItem = async () => {
    if (addingItems) return; // Prevent double-click
    setAddingItems(true);
    
    const itemType = ITEM_TYPES.find(t => t.value === newItem.item_type);
    let width, height;

    // Calculate dimensions based on type
    if (itemType.usesGallons) {
      const gallonInfo = GALLON_SIZES.find(g => g.value === newItem.gallonSize);
      width = height = gallonInfo.footprint;
    } else if (itemType.usesPredefinedSizes) {
      const planterSize = RAISED_PLANTER_SIZES.find(p => p.label === newItem.planterSize);
      if (!planterSize) {
        toast.error('Please select a planter size');
        return;
      }
      width = planterSize.width;
      height = planterSize.height;
    } else {
      const parsed = parseDimensions(newItem.dimensions);
      if (!parsed) {
        toast.error('Invalid dimensions. Use "4x8" format.');
        return;
      }
      width = toInches(parsed.width, newItem.unit);
      height = toInches(parsed.height, newItem.unit);
    }

    const count = newItem.createMultiple ? parseInt(newItem.count) : 1;
    const newItems = [];
    const spacing = 24;
    const cols = Math.ceil(Math.sqrt(count));

    try {
      // Get base number from first available name
      const firstName = getNextName(itemType.label);
      const baseNum = parseInt(firstName.match(/\d+$/)?.[0] || '1');
      console.log('[Add Multiple] Starting at number:', baseNum, 'creating', count, 'items');

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);

        // FIXED: Check for duplicate name before creating
        let label = `${itemType.label} ${baseNum + i}`;
        let attempt = 0;
        while (items.some(existing => existing.label === label) && attempt < 1000) {
          label = `${itemType.label} ${baseNum + i + attempt}`;
          attempt++;
        }
        console.log('[Add Multiple] Creating:', label, 'at', x, y);

        const metadata = {};
        if (itemType.usesGrid) {
          metadata.gridEnabled = newItem.useSquareFootGrid;
          if (newItem.useSquareFootGrid) {
            metadata.gridSize = 12;
          }
          metadata.planting_pattern = newItem.planting_pattern;
        }
        if (itemType.usesRows) {
          metadata.rowSpacing = newItem.rowSpacing;
          metadata.rowCount = newItem.rowCount || Math.floor(width / newItem.rowSpacing);
          metadata.planting_pattern = newItem.planting_pattern;
        }
        if (itemType.usesGallons) {
          metadata.gallonSize = newItem.gallonSize;
        }

        const item = await base44.entities.PlotItem.create({
          plot_id: plot.id,
          garden_id: garden.id,
          item_type: newItem.item_type,
          label,
          width,
          height,
          x,
          y,
          rotation: 0,
          z_index: items.length + i,
          metadata,
          custom_color: newItem.color || null
        });

        // Auto-create PlantingSpace only if plantable
        if (itemType.plantable) {
          const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
          const capacity = calculateCapacity(layoutSchema);

          console.log('[PlotItem Create] Auto-creating PlantingSpace for:', label, 'capacity:', capacity);
          await base44.entities.PlantingSpace.create({
            garden_id: garden.id,
            plot_item_id: item.id,
            space_type: item.item_type,
            name: label,
            capacity,
            layout_schema: layoutSchema,
            is_active: true
          });
        }

        newItems.push(item);
      }

      // Update items list after all created
      setItems([...items, ...newItems]);
      setShowAddItem(false);
      resetNewItem();
      toast.success(count > 1 ? `Added ${count} items!` : 'Item added!');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    } finally {
      setAddingItems(false);
    }
  };

  const resetNewItem = () => {
    setNewItem({
      item_type: 'RAISED_BED',
      label: 'Raised Bed',
      dimensions: '4x8',
      unit: 'ft',
      useSquareFootGrid: true,
      planting_pattern: 'square_foot',
      gallonSize: 5,
      planterSize: '4ft x 8ft',
      rowSpacing: 18,
      rowCount: null,
      createMultiple: false,
      count: 1,
      color: null
    });
  };

  const handleTypeChange = (newType) => {
    const itemType = ITEM_TYPES.find(t => t.value === newType);
    // Always start with base label, getNextName will auto-increment if needed
    const nextName = getNextName(itemType.label);
    console.log('[Type Change] New type:', newType, 'Next name:', nextName);
    setNewItem({
      ...newItem,
      item_type: newType,
      label: nextName,
      dimensions: itemType.defaultDims || '4x8',
      unit: itemType.defaultUnit || 'ft',
      useSquareFootGrid: itemType.usesGrid || false,
      planting_pattern: 'square_foot',
      gallonSize: 5,
      planterSize: '4ft x 8ft',
      rowSpacing: 18,
      rowCount: null,
      color: itemType.color
    });
  };

  const handleBulkAdd = async () => {
    const parsed = parseDimensions(bulkAdd.dimensions);
    if (!parsed) {
      toast.error('Invalid dimensions. Use "4x8" format.');
      return;
    }

    const width = toInches(parsed.width, bulkAdd.unit);
    const height = toInches(parsed.height, bulkAdd.unit);
    const count = parseInt(bulkAdd.count);
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 24;
    const newItems = [];
    const itemType = ITEM_TYPES.find(t => t.value === bulkAdd.item_type);

    try {
      // Get the first unique name
      const firstName = getNextName(bulkAdd.base_name);
      const baseNum = parseInt(firstName.match(/\d+$/)?.[0] || '1');
      console.log('[Bulk Add] Starting at:', firstName, 'baseNum:', baseNum);

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);
        
        // FIXED: Check for duplicate name
        let label = `${bulkAdd.base_name} ${baseNum + i}`;
        let attempt = 0;
        while (items.some(existing => existing.label === label) && attempt < 1000) {
          label = `${bulkAdd.base_name} ${baseNum + i + attempt}`;
          attempt++;
        }
        console.log('[Bulk Add] Creating:', label);

        const metadata = {};
        if (itemType?.usesGrid) {
          metadata.gridEnabled = true;
          metadata.gridSize = 12;
          metadata.planting_pattern = 'square_foot'; // Default for bulk add
        }

        const item = await base44.entities.PlotItem.create({
          plot_id: plot.id,
          garden_id: garden.id,
          item_type: bulkAdd.item_type,
          label,
          width,
          height,
          x,
          y,
          rotation: 0,
          z_index: items.length + i,
          metadata
        });

        // Auto-create PlantingSpace for plantable items
        if (itemType?.plantable) {
          const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
          const capacity = calculateCapacity(layoutSchema);
          
          await base44.entities.PlantingSpace.create({
            garden_id: garden.id,
            plot_item_id: item.id,
            space_type: item.item_type,
            name: label,
            capacity,
            layout_schema: layoutSchema,
            is_active: true
          });
        }

        newItems.push(item);
      }

      setItems([...items, ...newItems]);
      setShowBulkAdd(false);
      toast.success(`Added ${count} items!`);
    } catch (error) {
      console.error('Error bulk adding:', error);
      toast.error('Failed to add items');
    }
  };

  const handleInteractionStart = (e) => {
    // Ignore clicks on buttons/controls
    if (e.target.closest('button') || e.target.closest('.plot-item-controls')) {
      return;
    }

    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;

    const clickedItem = [...items].reverse().find(item => {
      return x >= item.x && x <= item.x + item.width &&
             y >= item.y && y <= item.y + item.height;
    });

    if (clickedItem) {
      setSelectedItem(clickedItem);
      if (onItemSelect) onItemSelect(clickedItem);
      setDraggingItem(clickedItem);
      setDragStartPos({ x: clientX, y: clientY });
      setDragOffset({ x: x - clickedItem.x, y: y - clickedItem.y });

      // Prevent text selection and scrolling
      document.body.style.userSelect = 'none';
      if (e.touches) {
        e.preventDefault();
      }
    } else {
      setSelectedItem(null);
      if (onItemSelect) onItemSelect(null);
    }
  };

  const handleInteractionMove = (e) => {
    if (!draggingItem) return;

    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Check if moved threshold (3px) - differentiate click vs drag
    const dx = clientX - dragStartPos.x;
    const dy = clientY - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 3) return; // Not dragging yet
    
    if (!isDragging) {
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
    }

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (clientX - rect.left) / zoom - dragOffset.x;
    let y = (clientY - rect.top) / zoom - dragOffset.y;

    // In chaos mode, only snap if explicitly enabled
    if (snapToGrid && !garden?.chaos_mode) {
      const gridSize = plot.grid_size || 12;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    } else if (snapToGrid && garden?.chaos_mode) {
      // In chaos mode with snap enabled, use finer grid (3 inches instead of 12)
      const fineGrid = 3;
      x = Math.round(x / fineGrid) * fineGrid;
      y = Math.round(y / fineGrid) * fineGrid;
    }

    x = Math.max(0, Math.min(x, plot.width - draggingItem.width));
    y = Math.max(0, Math.min(y, plot.height - draggingItem.height));

    setItems(prevItems => prevItems.map(i => 
      i.id === draggingItem.id ? { ...i, x, y } : i
    ));

    // Prevent scrolling on touch
    if (e.touches) {
      e.preventDefault();
    }
  };

  const handleInteractionEnd = async () => {
    if (draggingItem) {
      const item = items.find(i => i.id === draggingItem.id);

      // Only save if actually dragged
      if (isDragging && item) {
        try {
          console.log('[LAYOUT] Saving position for', item.label, 'x=', item.x, 'y=', item.y);
          await base44.entities.PlotItem.update(item.id, { x: item.x, y: item.y });
          if (selectedItem?.id === item.id) {
            setSelectedItem(item);
          }
        } catch (error) {
          console.error('Error updating position:', error);
        }
      }

      setDraggingItem(null);
      setIsDragging(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  };

  const handleDeleteItem = async (item) => {
    try {
      console.log('[PlotItem Delete] Deleting:', item.label);
      // Check if there's a PlantingSpace with plantings
      const spaces = await base44.entities.PlantingSpace.filter({ plot_item_id: item.id });
      if (spaces.length > 0) {
        const space = spaces[0];
        const plantings = await base44.entities.PlantInstance.filter({ space_id: space.id });
        
        if (plantings.length > 0) {
          const confirmed = confirm(
            `"${item.label}" has ${plantings.length} plantings. Delete item and all plantings?`
          );
          if (!confirmed) return;
          
          // Delete all plantings
          for (const planting of plantings) {
            await base44.entities.PlantInstance.delete(planting.id);
          }
        }
        
        // Delete PlantingSpace
        console.log('[PlotItem Delete] Deleting PlantingSpace');
        await base44.entities.PlantingSpace.delete(space.id);
      }
      
      // Delete PlotItem
      await base44.entities.PlotItem.delete(item.id);
      setItems(items.filter(i => i.id !== item.id));
      setSelectedItem(null);
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleRotate = async () => {
    if (!selectedItem) {
      console.error('[LAYOUT] Rotate called but no item selected');
      return;
    }
    
    // Get latest item state from items array
    const currentItem = items.find(i => i.id === selectedItem.id) || selectedItem;
    const currentRotation = currentItem.rotation || 0;
    const newRotation = (currentRotation + 90) % 360;
    
    // Calculate center point
    const cx = currentItem.x + currentItem.width / 2;
    const cy = currentItem.y + currentItem.height / 2;
    
    // Swap dimensions for 90/270 rotation
    const isVertical = newRotation === 90 || newRotation === 270;
    const newWidth = isVertical ? currentItem.height : currentItem.width;
    const newHeight = isVertical ? currentItem.width : currentItem.height;
    
    // Recalculate position to keep centered
    let newX = cx - newWidth / 2;
    let newY = cy - newHeight / 2;
    
    // Apply snap to grid if enabled
    if (snapToGrid) {
      const gridSize = plot.grid_size || 12;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }
    
    // Clamp to canvas bounds
    newX = Math.max(0, Math.min(newX, plot.width - newWidth));
    newY = Math.max(0, Math.min(newY, plot.height - newHeight));
    
    console.log('[LAYOUT] rotate selectedItemId=', selectedItem.id, 
      'before={x:', currentItem.x, 'y:', currentItem.y, 'w:', currentItem.width, 'h:', currentItem.height, 'rot:', currentRotation, '}',
      'after={x:', newX, 'y:', newY, 'w:', newWidth, 'h:', newHeight, 'rot:', newRotation, '}');
    
    try {
      // Update local state FIRST for immediate UI response
      const updatedItem = { 
        ...currentItem, 
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight, 
        rotation: newRotation 
      };
      setItems(prevItems => prevItems.map(i => i.id === selectedItem.id ? updatedItem : i));
      setSelectedItem(updatedItem);
      
      // Then persist to DB
      await base44.entities.PlotItem.update(selectedItem.id, { 
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight, 
        rotation: newRotation 
      });
      console.log('[LAYOUT] rotate saved successfully to DB');
      toast.success('Rotated');
    } catch (error) {
      console.error('[LAYOUT] Error rotating:', error);
      // Revert on error
      setItems(prevItems => prevItems.map(i => i.id === selectedItem.id ? currentItem : i));
      setSelectedItem(currentItem);
      toast.error('Failed to rotate');
    }
  };

  const handlePlotSettingsSave = async (newSettings) => {
    try {
      await base44.entities.GardenPlot.update(plot.id, newSettings);
      setShowPlotSettings(false);
      onPlotUpdate();
      toast.success('Plot settings updated');
    } catch (error) {
      console.error('Error updating plot:', error);
      toast.error('Failed to update plot');
    }
  };

  const openEditItem = (item) => {
    const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
    const widthFt = item.width / 12;
    const heightFt = item.height / 12;
    
    setEditItemData({
      label: item.label,
      dimensions: `${widthFt}x${heightFt}`,
      unit: 'ft',
      color: getItemColor(item),
      customColor: item.custom_color || '',
      gallonSize: item.metadata?.gallonSize || 5,
      rowSpacing: item.metadata?.rowSpacing || 18,
      rowCount: item.metadata?.rowCount || null,
      capacity: item.metadata?.capacity || 20,
      planting_pattern: item.metadata?.planting_pattern || 'square_foot'
    });
    setShowEditItem(true);
  };

  const handleEditItemSave = async () => {
    if (!selectedItem) return;

    const itemType = ITEM_TYPES.find(t => t.value === selectedItem.item_type);
    let width = selectedItem.width;
    let height = selectedItem.height;

    // FIXED: Check for duplicate name before saving
    const duplicateName = items.find(i => i.id !== selectedItem.id && i.label === editItemData.label);
    if (duplicateName) {
      toast.error(`An item named "${editItemData.label}" already exists`);
      return;
    }

    // Recalculate dimensions if changed
    if (!itemType.usesGallons && !itemType.usesPredefinedSizes) {
      const parsed = parseDimensions(editItemData.dimensions);
      if (parsed) {
        width = toInches(parsed.width, editItemData.unit);
        height = toInches(parsed.height, editItemData.unit);
      }
    }

    const metadata = { ...selectedItem.metadata };
    if (itemType.usesGallons) {
      metadata.gallonSize = editItemData.gallonSize;
      const gallonInfo = GALLON_SIZES.find(g => g.value === editItemData.gallonSize);
      width = height = gallonInfo.footprint;
    }
    if (itemType.usesRows) {
      metadata.rowSpacing = editItemData.rowSpacing;
      metadata.rowCount = editItemData.rowCount;
      metadata.planting_pattern = editItemData.planting_pattern;
    }
    if (itemType.usesGrid || itemType.usesPredefinedSizes) { // Added usesPredefinedSizes here
      metadata.planting_pattern = editItemData.planting_pattern;
    }

    try {
      await base44.entities.PlotItem.update(selectedItem.id, {
        label: editItemData.label,
        width,
        height,
        metadata,
        custom_color: editItemData.customColor || null
      });

      // Update PlantingSpace if it exists
      if (itemType.plantable) {
        console.log('[PlotItem Edit] Updating PlantingSpace for:', editItemData.label);
        const spaces = await base44.entities.PlantingSpace.filter({ plot_item_id: selectedItem.id });
        if (spaces.length > 0) {
          const space = spaces[0];
          const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
          const capacity = calculateCapacity(layoutSchema);

          await base44.entities.PlantingSpace.update(space.id, {
            name: editItemData.label,
            capacity,
            layout_schema: layoutSchema
          });
        } else {
          // Create if missing
          console.log('[PlotItem Edit] PlantingSpace missing, creating new one');
          const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
          const capacity = calculateCapacity(layoutSchema);
          await base44.entities.PlantingSpace.create({
            garden_id: selectedItem.garden_id,
            plot_item_id: selectedItem.id,
            space_type: selectedItem.item_type,
            name: editItemData.label,
            capacity,
            layout_schema: layoutSchema,
            is_active: true
          });
        }
      }

      const updatedItem = {
        ...selectedItem,
        label: editItemData.label,
        width,
        height,
        metadata,
        custom_color: editItemData.customColor || null
      };
      
      setItems(items.map(i => i.id === selectedItem.id ? updatedItem : i));
      setSelectedItem(updatedItem);
      setShowEditItem(false);
      
      console.log('[LAYOUT] edit id=', selectedItem.id, 'w/h changed saved');
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const getItemColor = (item) => {
    // Use custom color if set, otherwise default type color
    if (typeof item === 'string') {
      return ITEM_TYPES.find(t => t.value === item)?.color || '#8B7355';
    }
    return item.custom_color || ITEM_TYPES.find(t => t.value === item.item_type)?.color || '#8B7355';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const getPlantingStatus = (itemId) => {
    const counts = itemsPlantingCounts[itemId];
    if (!counts || counts.capacity === 0) return null;
    
    const percentage = (counts.filled / counts.capacity) * 100;
    
    if (percentage === 0) return { status: 'empty', label: 'Empty', color: 'gray' };
    if (percentage >= 100) return { status: 'full', label: 'Full', color: 'emerald' };
    return { status: 'partial', label: 'Partial', color: 'amber' };
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 mt-4 min-h-0">
      {/* Left Toolbar */}
        <Card className="w-full lg:w-64 flex-shrink-0 h-fit relative z-10">
          <CardContent className="p-4 space-y-2">
          <Button 
            onClick={() => setShowAddItem(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>

          <Button 
            onClick={() => setShowPlotSettings(true)}
            variant="outline"
            className="w-full gap-2"
          >
            <Settings className="w-4 h-4" />
            Plot Settings
          </Button>

          <AISuggestLayoutButton
            garden={garden}
            plot={plot}
            crops={cropPlans}
            onApply={(placements) => {
              toast.success('Review suggestions and manually place crops');
            }}
          />

          {onDeleteGarden && (
            <Button 
              onClick={onDeleteGarden}
              variant="outline"
              className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs mt-4 border-red-200"
            >
              <Trash2 className="w-3 h-3" />
              Delete Garden
            </Button>
          )}

          <div className="pt-4 border-t space-y-2">
            <h4 className="font-semibold text-sm">View</h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm flex-1 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant={snapToGrid ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSnapToGrid(!snapToGrid)}
              className="w-full gap-2"
            >
              <Grid3X3 className="w-4 h-4" />
              {garden?.chaos_mode ? 'Fine Snap' : 'Snap to Grid'}
            </Button>
            
            <Button
              variant={showSunPath ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowSunPath(!showSunPath)}
              className="w-full gap-2"
            >
              ☀️ Sun Path
            </Button>
            
            {garden?.planting_method === 'SQUARE_FOOT' && (
              <Button
                variant={showSFGGrid ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setShowSFGGrid(!showSFGGrid)}
                className="w-full gap-2"
              >
                📐 SFG Grid
              </Button>
            )}
          </div>
          {selectedItem && (
            <div className="pt-4 border-t space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Selected</h4>
                <p className="text-sm text-gray-600 font-medium">{selectedItem.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedItem.width}" × {selectedItem.height}"
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditItem(selectedItem)}
                  className="w-full gap-2 justify-start"
                >
                  <Settings className="w-4 h-4" />
                  Edit
                </Button>
                {ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.plantable && (
                  <Button
                    onClick={() => setShowPlantingModal(true)}
                    className="w-full gap-2 justify-start bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
                  >
                    <Sprout className="w-5 h-5" />
                    Plant Seeds
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  disabled={!selectedItem}
                  className="w-full gap-2 justify-start"
                >
                  <RotateCw className="w-4 h-4" />
                  Rotate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteItem(selectedItem)}
                  className="w-full gap-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas */}
      <div className="flex-1 bg-gray-50 rounded-xl overflow-auto p-4 lg:p-8 relative z-0">
        {/* Status Legend */}
        <div className="mb-4 flex items-center gap-4 text-xs">
          <span className="font-medium text-gray-600">Status:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-gray-400 rounded"></div>
            <span className="text-gray-600">Empty</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-amber-500 rounded bg-amber-50"></div>
            <span className="text-gray-600">Partial</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border-2 border-emerald-600 rounded bg-emerald-50"></div>
            <span className="text-gray-600">Full</span>
          </div>
        </div>
        
        <div
          ref={canvasRef}
          className="relative bg-white shadow-lg mx-auto plot-canvas select-none touch-none"
          style={{
            width: plot.width * zoom,
            height: plot.height * zoom,
            backgroundColor: plot.background_color || '#ffffff',
            touchAction: 'none'
          }}
          onMouseDown={handleInteractionStart}
          onMouseMove={handleInteractionMove}
          onMouseUp={handleInteractionEnd}
          onMouseLeave={handleInteractionEnd}
          onTouchStart={handleInteractionStart}
          onTouchMove={handleInteractionMove}
          onTouchEnd={handleInteractionEnd}
          onTouchCancel={handleInteractionEnd}
        >
          {/* Grid */}
          {plot.grid_enabled && !showSFGGrid && (
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              {Array.from({ length: Math.ceil(plot.width / plot.grid_size) }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={i * plot.grid_size * zoom}
                  y1={0}
                  x2={i * plot.grid_size * zoom}
                  y2={plot.height * zoom}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              {Array.from({ length: Math.ceil(plot.height / plot.grid_size) }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={i * plot.grid_size * zoom}
                  x2={plot.width * zoom}
                  y2={i * plot.grid_size * zoom}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
            </svg>
          )}

          {/* Square Foot Gardening Grid */}
          {showSFGGrid && garden?.planting_method === 'SQUARE_FOOT' && (
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 5 }}>
              {/* 1ft grid (12 inches) */}
              {Array.from({ length: Math.ceil(plot.width / 12) + 1 }).map((_, i) => (
                <line
                  key={`sfg-v-${i}`}
                  x1={i * 12 * zoom}
                  y1={0}
                  x2={i * 12 * zoom}
                  y2={plot.height * zoom}
                  stroke="#10b981"
                  strokeWidth="2"
                  opacity="0.6"
                />
              ))}
              {Array.from({ length: Math.ceil(plot.height / 12) + 1 }).map((_, i) => (
                <line
                  key={`sfg-h-${i}`}
                  x1={0}
                  y1={i * 12 * zoom}
                  x2={plot.width * zoom}
                  y2={i * 12 * zoom}
                  stroke="#10b981"
                  strokeWidth="2"
                  opacity="0.6"
                />
              ))}
              {/* Grid cell labels */}
              {Array.from({ length: Math.floor(plot.width / 12) }).map((_, col) =>
                Array.from({ length: Math.floor(plot.height / 12) }).map((_, row) => (
                  <text
                    key={`label-${col}-${row}`}
                    x={(col * 12 + 6) * zoom}
                    y={(row * 12 + 8) * zoom}
                    textAnchor="middle"
                    fontSize={9 * zoom}
                    fill="#10b981"
                    opacity="0.4"
                    fontWeight="bold"
                  >
                    1ft²
                  </text>
                ))
              )}
            </svg>
          )}

          {/* Sun Path Overlay */}
          <SunPathOverlay
            width={plot.width}
            height={plot.height}
            zoom={zoom}
            enabled={showSunPath}
            season="summer"
          />

          {/* Items */}
          {items.map((item) => {
            const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
            const status = itemType?.plantable ? getPlantingStatus(item.id) : null;
            const counts = itemsPlantingCounts[item.id];

            const isGrowBagOrContainer = itemType?.usesGallons;
            const isFull = status?.status === 'full';

            return (
            <div
              key={item.id}
              className={cn(
                "absolute border-4 rounded-lg flex items-center justify-center text-sm font-medium overflow-hidden plot-item group",
                selectedItem?.id === item.id && "ring-4 ring-emerald-300",
                !status && "border-gray-400",
                status?.status === 'empty' && "border-gray-400",
                status?.status === 'partial' && "border-amber-500 bg-amber-500/5",
                status?.status === 'full' && "border-emerald-600 bg-emerald-500/5",
                isGrowBagOrContainer && isFull && "!bg-emerald-600"
              )}
              style={{
                left: item.x * zoom,
                top: item.y * zoom,
                width: item.width * zoom,
                height: item.height * zoom,
                backgroundColor: isGrowBagOrContainer && isFull ? '#10b981' : getItemColor(item),
                cursor: isDragging && draggingItem?.id === item.id ? 'grabbing' : 'grab'
              }}
            >
              {/* Enhanced status overlay */}
              {status && status.status === 'partial' && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.15) 12px, transparent 12px, transparent 24px)'
                  }}
                />
              )}
              {status && status.status === 'full' && (
                <div className="absolute inset-0 bg-emerald-600/15 pointer-events-none" />
              )}

              {/* Status badge - top left corner */}
              {status && status.status !== 'empty' && (
                <div className={cn(
                  "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm pointer-events-none",
                  status.status === 'partial' && "bg-amber-500 text-white",
                  status.status === 'full' && "bg-emerald-600 text-white"
                )}>
                  {status.label}
                </div>
              )}
              
              {/* Badge with pointer-events: none */}
              {counts && counts.capacity > 0 && (
                <div className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-sm pointer-events-none">
                  {counts.filled}/{counts.capacity}
                </div>
              )}
              {/* Row lines for row-based items */}
              {item.metadata?.rowCount && (
                <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                  {Array.from({ length: item.metadata.rowCount - 1 }).map((_, i) => (
                    <line
                      key={i}
                      x1={0}
                      y1={((i + 1) / item.metadata.rowCount) * 100 + '%'}
                      x2="100%"
                      y2={((i + 1) / item.metadata.rowCount) * 100 + '%'}
                      stroke="white"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  ))}
                </svg>
              )}
              {/* Rotated container */}
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  transform: `rotate(${item.rotation}deg)`,
                  transformOrigin: 'center'
                }}
              >
                {/* Label counter-rotated to stay horizontal */}
                <span 
                  className="text-white text-shadow font-semibold plot-item-label"
                  style={{
                    transform: `rotate(${-item.rotation}deg)`,
                    display: 'inline-block'
                  }}
                >
                  {item.label}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Remove Bulk Add Dialog - now integrated into Add Item */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item Type - FIRST */}
            <div>
              <Label>Item Type</Label>
              <Select value={newItem.item_type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Label */}
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={newItem.label}
                onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                className="mt-2"
              />
            </div>

            {/* Color Picker */}
            <div>
              <Label>Item Color</Label>
              <div className="flex gap-2 mt-2">
                <input
                  type="color"
                  value={newItem.color || ITEM_TYPES.find(t => t.value === newItem.item_type)?.color || '#8B7355'}
                  onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                  className="w-12 h-10 rounded border cursor-pointer"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewItem({ ...newItem, color: ITEM_TYPES.find(t => t.value === newItem.item_type)?.color })}
                  className="flex-1"
                >
                  Reset to Default
                </Button>
              </div>
            </div>

            {/* Type-specific fields */}
            {ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesPredefinedSizes ? (
              <div>
                <Label>Planter Size</Label>
                <Select 
                  value={newItem.planterSize} 
                  onValueChange={(v) => setNewItem({ ...newItem, planterSize: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RAISED_PLANTER_SIZES.map((size) => (
                      <SelectItem key={size.label} value={size.label}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesGallons ? (
              <div>
                <Label>Size (Gallons)</Label>
                <Select 
                  value={String(newItem.gallonSize)} 
                  onValueChange={(v) => setNewItem({ ...newItem, gallonSize: parseInt(v) })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GALLON_SIZES.map((g) => (
                      <SelectItem key={g.value} value={String(g.value)}>
                        {g.value} gallon ({g.footprint}" footprint)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Fits any plant size (flexible layout)</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Dimensions</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="4x8"
                      value={newItem.dimensions}
                      onChange={(e) => setNewItem({ ...newItem, dimensions: e.target.value })}
                    />
                    <Select 
                      value={newItem.unit} 
                      onValueChange={(v) => setNewItem({ ...newItem, unit: v })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ft">Feet</SelectItem>
                        <SelectItem value="in">Inches</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Square-foot grid option for raised beds and greenhouses */}
                {(newItem.item_type === 'RAISED_BED' || newItem.item_type === 'GREENHOUSE') && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newItem.useSquareFootGrid}
                      onChange={(e) => setNewItem({ ...newItem, useSquareFootGrid: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">Use Square Foot Grid (12" cells)</span>
                  </label>
                )}

                {/* Planting Pattern */}
                {(newItem.item_type === 'RAISED_BED' || newItem.item_type === 'GREENHOUSE' || newItem.item_type === 'IN_GROUND_BED' || newItem.item_type === 'OPEN_PLOT') && (
                  <div>
                    <Label>Planting Pattern</Label>
                    <Select 
                      value={newItem.planting_pattern || 'square_foot'} 
                      onValueChange={(v) => setNewItem({ ...newItem, planting_pattern: v })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square_foot">Square Foot Grid</SelectItem>
                        <SelectItem value="diagonal">Diagonal (Offset Rows) - Intensive</SelectItem>
                        <SelectItem value="rows">Traditional Rows</SelectItem>
                      </SelectContent>
                    </Select>
                    {newItem.planting_pattern === 'diagonal' && (
                      <p className="text-sm text-gray-500 mt-1">
                        Odd rows will be offset by 50% for intensive planting.
                      </p>
                    )}
                  </div>
                )}

                {/* Row options for in-ground and open plot */}
                {(newItem.item_type === 'IN_GROUND_BED' || newItem.item_type === 'OPEN_PLOT') && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold">Row Configuration</h4>
                    <div>
                      <Label htmlFor="rowSpacing" className="text-xs">Row Spacing (inches)</Label>
                      <Input
                        id="rowSpacing"
                        type="number"
                        value={newItem.rowSpacing}
                        onChange={(e) => setNewItem({ ...newItem, rowSpacing: parseInt(e.target.value) })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rowCount" className="text-xs">Row Count (optional)</Label>
                      <Input
                        id="rowCount"
                        type="number"
                        placeholder="Auto-calculated"
                        value={newItem.rowCount || ''}
                        onChange={(e) => setNewItem({ ...newItem, rowCount: e.target.value ? parseInt(e.target.value) : null })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Bulk creation */}
            <div className="border-t pt-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={newItem.createMultiple}
                  onChange={(e) => setNewItem({ ...newItem, createMultiple: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">Create Multiple</span>
              </label>
              {newItem.createMultiple && (
                <div>
                  <Label htmlFor="count">Count</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    value={newItem.count}
                    onChange={(e) => setNewItem({ ...newItem, count: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Items will be auto-placed in a grid layout
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddItem(false); resetNewItem(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddItem} 
              disabled={addingItems}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {addingItems ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                newItem.createMultiple ? `Create ${newItem.count}` : 'Add Item'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plot Settings Dialog */}
      <PlotSettingsDialog 
        plot={plot}
        open={showPlotSettings}
        onOpenChange={setShowPlotSettings}
        onSave={handlePlotSettingsSave}
      />

      {/* Planting Modal */}
      {selectedItem && ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.plantable && (
        <PlantingModal
          open={showPlantingModal}
          onOpenChange={setShowPlantingModal}
          item={selectedItem}
          garden={garden}
          activeSeason={activeSeason}
          seasonId={seasonId}
          onPlantingUpdate={loadItems}
        />
      )}

      {/* Edit Item Dialog */}
      {selectedItem && (
        <Dialog open={showEditItem} onOpenChange={setShowEditItem}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {selectedItem.label}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editLabel">Label</Label>
                <Input
                  id="editLabel"
                  value={editItemData.label}
                  onChange={(e) => setEditItemData({ ...editItemData, label: e.target.value })}
                  className="mt-2"
                />
              </div>

              {/* Color Picker */}
              <div>
                <Label>Item Color</Label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="color"
                    value={editItemData.customColor || editItemData.color}
                    onChange={(e) => setEditItemData({ ...editItemData, customColor: e.target.value })}
                    className="w-12 h-10 rounded border cursor-pointer"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditItemData({ ...editItemData, customColor: '' })}
                    className="flex-1"
                  >
                    Reset to Default
                  </Button>
                </div>
              </div>

              {ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.usesGallons ? (
                <div>
                  <Label>Size (Gallons)</Label>
                  <Select 
                    value={String(editItemData.gallonSize)} 
                    onValueChange={(v) => setEditItemData({ ...editItemData, gallonSize: parseInt(v) })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GALLON_SIZES.map((g) => (
                        <SelectItem key={g.value} value={String(g.value)}>
                          {g.value} gallon ({g.footprint}" footprint)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : !ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.usesPredefinedSizes ? ( // Corrected condition
                <>
                  <div>
                    <Label>Dimensions</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="4x8"
                        value={editItemData.dimensions}
                        onChange={(e) => setEditItemData({ ...editItemData, dimensions: e.target.value })}
                      />
                      <Select 
                        value={editItemData.unit} 
                        onValueChange={(v) => setEditItemData({ ...editItemData, unit: v })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ft">Feet</SelectItem>
                          <SelectItem value="in">Inches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Planting Pattern for Edit */}
                  {(selectedItem.item_type === 'RAISED_BED' || selectedItem.item_type === 'GREENHOUSE' || selectedItem.item_type === 'IN_GROUND_BED' || selectedItem.item_type === 'OPEN_PLOT') && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold">Planting Pattern</h4>
                      <Select 
                        value={editItemData.planting_pattern || 'square_foot'}
                        onValueChange={(v) => setEditItemData({ ...editItemData, planting_pattern: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="square_foot">Square Foot Grid</SelectItem>
                          <SelectItem value="diagonal">Diagonal (Offset Rows) - Intensive</SelectItem>
                          <SelectItem value="rows">Traditional Rows</SelectItem>
                        </SelectContent>
                      </Select>
                      {editItemData.planting_pattern === 'diagonal' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Odd rows will be offset by 50% for intensive planting.
                        </p>
                      )}
                    </div>
                  )}

                  {(selectedItem.item_type === 'IN_GROUND_BED' || selectedItem.item_type === 'OPEN_PLOT') && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold">Row Configuration</h4>
                      <div>
                        <Label htmlFor="editRowSpacing" className="text-xs">Row Spacing (inches)</Label>
                        <Input
                          id="editRowSpacing"
                          type="number"
                          value={editItemData.rowSpacing}
                          onChange={(e) => setEditItemData({ ...editItemData, rowSpacing: parseInt(e.target.value) })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editRowCount" className="text-xs">Row Count</Label>
                        <Input
                          id="editRowCount"
                          type="number"
                          value={editItemData.rowCount || ''}
                          onChange={(e) => setEditItemData({ ...editItemData, rowCount: e.target.value ? parseInt(e.target.value) : null })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditItem(false)}>Cancel</Button>
              <Button onClick={handleEditItemSave} className="bg-emerald-600 hover:bg-emerald-700">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
