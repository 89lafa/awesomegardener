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
  { value: 'IN_GROUND_BED', label: 'In-Ground Bed', color: '#A0826D', defaultDims: '4x20', defaultUnit: 'ft', usesRows: true, plantable: true },
  { value: 'GREENHOUSE', label: 'Greenhouse', color: '#80CBC4', defaultDims: '10x12', defaultUnit: 'ft', usesGrid: false, plantable: true },
  { value: 'OPEN_PLOT', label: 'Open Plot', color: '#D7CCC8', defaultDims: '50x100', defaultUnit: 'ft', usesRows: true, plantable: true },
  { value: 'GROW_BAG', label: 'Grow Bag', color: '#424242', usesGallons: true, plantable: true },
  { value: 'CONTAINER', label: 'Container', color: '#D84315', usesSize: true, plantable: true },
  { value: 'FENCE', label: 'Fence', color: '#5D4037', defaultDims: '10x0.5', defaultUnit: 'ft', plantable: false },
  { value: 'BUILDING', label: 'Building/Shed', color: '#795548', defaultDims: '8x10', defaultUnit: 'ft', plantable: false },
  { value: 'TREE', label: 'Tree', color: '#4CAF50', defaultDims: '3x3', defaultUnit: 'ft', plantable: false },
  { value: 'PATH', label: 'Path/Walkway', color: '#9E9E9E', defaultDims: '3x20', defaultUnit: 'ft', plantable: false },
  { value: 'COMPOST', label: 'Compost Bin', color: '#6D4C41', defaultDims: '3x3', defaultUnit: 'ft', plantable: false },
  { value: 'WATER_SOURCE', label: 'Water Source', color: '#2196F3', defaultDims: '2x2', defaultUnit: 'ft', plantable: false },
];

const GALLON_SIZES = [
  { value: 1, footprint: 8 }, { value: 3, footprint: 10 }, { value: 5, footprint: 12 },
  { value: 7, footprint: 14 }, { value: 10, footprint: 16 }, { value: 15, footprint: 20 },
  { value: 20, footprint: 24 }, { value: 30, footprint: 30 }
];

export default function PlotCanvas({ garden, plot, onPlotUpdate, onDeleteGarden }) {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [itemsPlantingCounts, setItemsPlantingCounts] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  
  console.log('[PlotCanvas.js] Component rendered, selectedItem:', selectedItem?.id);
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
  const [editItemData, setEditItemData] = useState({
    label: '',
    dimensions: '',
    unit: 'ft',
    color: '',
    gallonSize: 5,
    rowSpacing: 18,
    rowCount: null,
    capacity: 20
  });

  const [newItem, setNewItem] = useState({
    item_type: 'RAISED_BED',
    label: 'Raised Bed',
    dimensions: '4x8',
    unit: 'ft',
    useSquareFootGrid: true,
    gallonSize: 5,
    rowSpacing: 18,
    rowCount: null,
    createMultiple: false,
    count: 1
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
  }, [plot]);

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
      const [itemsData, plantings] = await Promise.all([
        base44.entities.PlotItem.filter({ 
          garden_id: garden.id,
          plot_id: plot.id 
        }, 'z_index'),
        base44.entities.PlantInstance.filter({ garden_id: garden.id })
      ]);
      
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
          
          // Count cells occupied (not just number of plants)
          const filled = itemPlantings.reduce((sum, p) => {
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
    // Find all items with this base label pattern (e.g., "Raised Bed 1", "Raised Bed 2")
    const escapedBase = baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedBase} (\\d+)$`);
    const matchingItems = items.filter(i => pattern.test(i.label));
    
    console.log('[Naming] Base:', baseLabel, 'Matching:', matchingItems.map(i => i.label));
    
    if (matchingItems.length === 0) {
      return `${baseLabel} 1`;
    }
    
    // Extract numbers from existing items
    const numbers = matchingItems.map(i => {
      const match = i.label.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    
    // Find next available number sequentially
    const sortedNums = numbers.sort((a, b) => a - b);
    let nextNum = 1;
    
    // Find first gap in sequence or go to max+1
    for (const num of sortedNums) {
      if (num === nextNum) {
        nextNum++;
      } else if (num > nextNum) {
        break;
      }
    }
    
    console.log('[Naming] Next number:', nextNum);
    return `${baseLabel} ${nextNum}`;
  };

  const calculateLayoutSchema = (itemType, width, height, metadata) => {
    if (itemType.usesGrid && metadata.gridEnabled) {
      const gridSize = metadata.gridSize || 12;
      return {
        type: 'grid',
        grid_size: gridSize,
        columns: Math.floor(width / gridSize),
        rows: Math.floor(height / gridSize)
      };
    }
    if (itemType.usesRows) {
      return {
        type: 'rows',
        rows: metadata.rowCount || Math.floor(width / (metadata.rowSpacing || 18)),
        row_spacing: metadata.rowSpacing || 18
      };
    }
    if (itemType.usesGallons || itemType.usesSize) {
      return { type: 'slots', slots: 1 };
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
      return layoutSchema.slots || 1;
    }
    return 0;
  };

  const handleAddItem = async () => {
    const itemType = ITEM_TYPES.find(t => t.value === newItem.item_type);
    let width, height;

    // Calculate dimensions based on type
    if (itemType.usesGallons) {
      const gallonInfo = GALLON_SIZES.find(g => g.value === newItem.gallonSize);
      width = height = gallonInfo.footprint;
    } else if (itemType.usesSize) {
      width = height = 18; // Default container footprint
    } else {
      const parsed = parseDimensions(newItem.dimensions);
      if (!parsed) {
        toast.error('Invalid dimensions. Use "4x8" format.');
        return;
      }
      width = toInches(parsed.width, newItem.unit);
      height = toInches(parsed.height, newItem.unit);
    }

    // For GREENHOUSE, prompt for capacity before creating
    let greenhouseCapacity = null;
    if (newItem.item_type === 'GREENHOUSE') {
      const capacityInput = prompt('How many plantable slots does this greenhouse have?', '20');
      if (!capacityInput) return; // User cancelled
      
      const capacity = parseInt(capacityInput);
      if (isNaN(capacity) || capacity < 1) {
        toast.error('Please enter a valid number of slots');
        return;
      }
      greenhouseCapacity = capacity;
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

        const label = `${itemType.label} ${baseNum + i}`;
        console.log('[Add Multiple] Creating:', label, 'at', x, y);

        const metadata = {};
        if (itemType.usesGrid && newItem.useSquareFootGrid) {
          metadata.gridEnabled = true;
          metadata.gridSize = 12;
        }
        if (itemType.usesRows) {
          metadata.rowSpacing = newItem.rowSpacing;
          metadata.rowCount = newItem.rowCount || Math.floor(width / newItem.rowSpacing);
        }
        if (itemType.usesGallons) {
          metadata.gallonSize = newItem.gallonSize;
        }
        if (newItem.item_type === 'GREENHOUSE' && greenhouseCapacity) {
          metadata.capacity = greenhouseCapacity;
          metadata.gridEnabled = false;
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
          metadata
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
    }
  };

  const resetNewItem = () => {
    setNewItem({
      item_type: 'RAISED_BED',
      label: 'Raised Bed',
      dimensions: '4x8',
      unit: 'ft',
      useSquareFootGrid: true,
      gallonSize: 5,
      rowSpacing: 18,
      rowCount: null,
      createMultiple: false,
      count: 1
    });
  };

  const handleTypeChange = (newType) => {
    const itemType = ITEM_TYPES.find(t => t.value === newType);
    const nextName = getNextName(itemType.label);
    console.log('[Type Change] New type:', newType, 'Next name:', nextName);
    setNewItem({
      ...newItem,
      item_type: newType,
      label: nextName,
      dimensions: itemType.defaultDims || '4x8',
      unit: itemType.defaultUnit || 'ft',
      useSquareFootGrid: itemType.usesGrid || false,
      gallonSize: 5,
      rowSpacing: 18,
      rowCount: null
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
        
        const label = `${bulkAdd.base_name} ${baseNum + i}`;
        console.log('[Bulk Add] Creating:', label);

        const metadata = {};
        if (itemType?.usesGrid) {
          metadata.gridEnabled = true;
          metadata.gridSize = 12;
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

  const handleCanvasMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedItem = [...items].reverse().find(item => {
      return x >= item.x && x <= item.x + item.width &&
             y >= item.y && y <= item.y + item.height;
    });

    if (clickedItem) {
      setSelectedItem(clickedItem);
      setDraggingItem(clickedItem);
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setDragOffset({ x: x - clickedItem.x, y: y - clickedItem.y });
      
      // Prevent text selection
      document.body.style.userSelect = 'none';
    } else {
      setSelectedItem(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggingItem) return;

    // Check if moved threshold (3px) - differentiate click vs drag
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 3) return; // Not dragging yet
    
    if (!isDragging) {
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
    }

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / zoom - dragOffset.x;
    let y = (e.clientY - rect.top) / zoom - dragOffset.y;

    if (snapToGrid) {
      const gridSize = plot.grid_size || 12;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    x = Math.max(0, Math.min(x, plot.width - draggingItem.width));
    y = Math.max(0, Math.min(y, plot.height - draggingItem.height));

    setItems(prevItems => prevItems.map(i => 
      i.id === draggingItem.id ? { ...i, x, y } : i
    ));
  };

  const handleCanvasMouseUp = async () => {
    if (draggingItem) {
      const item = items.find(i => i.id === draggingItem.id);
      
      // Only save if actually dragged
      if (isDragging) {
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
      color: getItemColor(item.item_type),
      gallonSize: item.metadata?.gallonSize || 5,
      rowSpacing: item.metadata?.rowSpacing || 18,
      rowCount: item.metadata?.rowCount || null,
      capacity: item.metadata?.capacity || 20
    });
    setShowEditItem(true);
  };

  const handleEditItemSave = async () => {
    if (!selectedItem) return;

    const itemType = ITEM_TYPES.find(t => t.value === selectedItem.item_type);
    let width = selectedItem.width;
    let height = selectedItem.height;

    // Recalculate dimensions if changed
    if (!itemType.usesGallons && !itemType.usesSize) {
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
    }
    if (selectedItem.item_type === 'GREENHOUSE') {
      metadata.capacity = editItemData.capacity;
    }

    try {
      await base44.entities.PlotItem.update(selectedItem.id, {
        label: editItemData.label,
        width,
        height,
        metadata
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
        metadata
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

  const getItemColor = (type) => {
    return ITEM_TYPES.find(t => t.value === type)?.color || '#8B7355';
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
    <div className="flex-1 flex gap-4 mt-4 min-h-0">
      <div className="absolute top-2 left-2 text-xs text-gray-400 bg-white px-2 py-1 rounded shadow-sm z-10">
        PlotCanvas.js
      </div>
      {/* Left Toolbar */}
        <Card className="w-64 flex-shrink-0 h-fit">
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
              Snap to Grid
            </Button>
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
      <div className="flex-1 bg-gray-50 rounded-xl overflow-auto p-8">
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
          className="relative bg-white shadow-lg mx-auto plot-canvas select-none"
          style={{
            width: plot.width * zoom,
            height: plot.height * zoom,
            backgroundColor: plot.background_color || '#ffffff'
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* Grid */}
          {plot.grid_enabled && (
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

          {/* Items */}
          {items.map((item) => {
            const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
            const status = itemType?.plantable ? getPlantingStatus(item.id) : null;
            const counts = itemsPlantingCounts[item.id];
            
            return (
            <div
              key={item.id}
              className={cn(
                "absolute border-4 rounded-lg flex items-center justify-center text-sm font-medium overflow-hidden plot-item",
                selectedItem?.id === item.id && "ring-2 ring-emerald-100",
                !status && "border-gray-400",
                status?.status === 'empty' && "border-gray-400",
                status?.status === 'partial' && "border-amber-500",
                status?.status === 'full' && "border-emerald-600"
              )}
              style={{
                left: item.x * zoom,
                top: item.y * zoom,
                width: item.width * zoom,
                height: item.height * zoom,
                backgroundColor: getItemColor(item.item_type),
                cursor: isDragging && draggingItem?.id === item.id ? 'grabbing' : 'grab'
              }}
            >
              {/* Status overlay with pointer-events: none */}
              {status && status.status === 'partial' && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.1) 10px, transparent 10px, transparent 20px)'
                  }}
                />
              )}
              {status && status.status === 'full' && (
                <div className="absolute inset-0 bg-emerald-600/10 pointer-events-none" />
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

            {/* Type-specific fields */}
            {ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesGallons ? (
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
              </div>
            ) : ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesSize ? (
              <div>
                <Label>Container Type</Label>
                <Select defaultValue="medium">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (12" footprint)</SelectItem>
                    <SelectItem value="medium">Medium (18" footprint)</SelectItem>
                    <SelectItem value="large">Large (24" footprint)</SelectItem>
                  </SelectContent>
                </Select>
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

                {/* Square-foot grid option for raised beds */}
                {newItem.item_type === 'RAISED_BED' && (
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
            <Button onClick={handleAddItem} className="bg-emerald-600 hover:bg-emerald-700">
              {newItem.createMultiple ? `Create ${newItem.count}` : 'Add Item'}
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
              ) : !ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.usesSize ? (
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

                  {selectedItem.item_type === 'GREENHOUSE' && (
                    <div>
                      <Label htmlFor="editCapacity">Capacity (plants)</Label>
                      <Input
                        id="editCapacity"
                        type="number"
                        value={editItemData.capacity}
                        onChange={(e) => setEditItemData({ ...editItemData, capacity: parseInt(e.target.value) })}
                        className="mt-2"
                      />
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