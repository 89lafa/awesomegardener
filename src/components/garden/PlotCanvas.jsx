import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Sprout,
  Edit,
  Maximize2,
  Minimize2
} from 'lucide-react';
import PlotSettingsDialog from './PlotSettingsDialog';
import PlantingModal from './PlantingModal';
import AISuggestLayoutButton from './AISuggestLayoutButton';
import SunPathOverlay from './SunPathOverlay';
import PlotItem from './PlotItem';
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
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/components/ui/use-mobile';

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

// ─── Helper: distance between two touch points ───
function getTouchDistance(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function PlotCanvas({ garden, plot, activeSeason, seasonId, onPlotUpdate, onDeleteGarden, onItemSelect }) {
  const isMobile = useIsMobile();
  const [cropPlans, setCropPlans] = useState([]);
  const [longPressedItem, setLongPressedItem] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  
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
  const scrollContainerRef = useRef(null);
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

  // ─── Mobile-specific state ───
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

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

  // ─── Auto-zoom to fit on mobile ───
  useEffect(() => {
    if (isMobile && plot && scrollContainerRef.current && !loading) {
      const containerW = scrollContainerRef.current.clientWidth - 16; // padding
      const containerH = scrollContainerRef.current.clientHeight - 16;
      const fitZoom = Math.min(containerW / plot.width, containerH / plot.height, 1.5);
      setZoom(Math.max(0.3, Math.min(fitZoom, 1.5)));
    }
  }, [isMobile, plot, loading]);

  // ─── Window event listeners for reliable drag end ───
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (draggingItem || isDragging) {
        handleInteractionEnd();
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
  }, [draggingItem, isDragging, items]);

  // ═══════════════════════════════════════════
  // NON-PASSIVE TOUCH LISTENERS (fixes 47 errors)
  // React's onTouchMove is passive by default in
  // many browsers, so we MUST use addEventListener
  // with { passive: false } to call preventDefault.
  // ═══════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchMoveNonPassive = (e) => {
      // Two fingers = pinch/zoom — let it happen on canvas, prevent page scroll
      if (e.touches.length === 2) {
        e.preventDefault();
        handlePinchMove(e);
        return;
      }
      // One finger + dragging item = drag
      if (draggingItem) {
        e.preventDefault();
        handleDragMove(e);
        return;
      }
      // One finger + no item = allow native scroll of overflow container
    };

    const onTouchStartNonPassive = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        handlePinchStart(e);
        return;
      }
    };

    canvas.addEventListener('touchmove', onTouchMoveNonPassive, { passive: false });
    canvas.addEventListener('touchstart', onTouchStartNonPassive, { passive: false });

    return () => {
      canvas.removeEventListener('touchmove', onTouchMoveNonPassive);
      canvas.removeEventListener('touchstart', onTouchStartNonPassive);
    };
  }, [draggingItem, isDragging, zoom, isPinching]);

  // ─── Pinch-to-zoom handlers ───
  const handlePinchStart = (e) => {
    if (e.touches.length !== 2) return;
    setIsPinching(true);
    pinchStartDist.current = getTouchDistance(e.touches[0], e.touches[1]);
    pinchStartZoom.current = zoom;
  };

  const handlePinchMove = (e) => {
    if (e.touches.length !== 2 || !isPinching) return;
    const dist = getTouchDistance(e.touches[0], e.touches[1]);
    const scale = dist / pinchStartDist.current;
    const newZoom = Math.max(0.3, Math.min(3, pinchStartZoom.current * scale));
    setZoom(newZoom);
  };

  const handlePinchEnd = () => {
    setIsPinching(false);
  };

  // ─── Drag move (extracted for non-passive listener) ───
  const handleDragMove = (e) => {
    if (!draggingItem) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - dragStartPos.x;
    const dy = clientY - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 3) return;

    if (!isDragging) {
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
    }

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (clientX - rect.left) / zoom - dragOffset.x;
    let y = (clientY - rect.top) / zoom - dragOffset.y;

    if (snapToGrid && !garden?.chaos_mode) {
      const gridSize = plot.grid_size || 12;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    } else if (snapToGrid && garden?.chaos_mode) {
      const fineGrid = 3;
      x = Math.round(x / fineGrid) * fineGrid;
      y = Math.round(y / fineGrid) * fineGrid;
    }

    x = Math.max(0, Math.min(x, plot.width - draggingItem.width));
    y = Math.max(0, Math.min(y, plot.height - draggingItem.height));

    setItems(prevItems => prevItems.map(i =>
      i.id === draggingItem.id ? { ...i, x, y } : i
    ));
  };

  const loadItems = async () => {
    try {
      const user = await base44.auth.me();
      const { smartQuery: sq } = await import('@/components/utils/smartQuery');
      
      const [itemsData, allPlantings] = await Promise.all([
        sq(base44, 'PlotItem', { garden_id: garden.id, plot_id: plot.id, created_by: user.email }, 'z_index'),
        sq(base44, 'PlantInstance', { garden_id: garden.id, created_by: user.email })
      ]);
      
      let plantings = allPlantings;
      if (activeSeason) {
        const currentYear = new Date().getFullYear();
        const isCurrentYearSeason = activeSeason && activeSeason.startsWith(currentYear.toString());
        plantings = allPlantings.filter(p => {
          if (!p.season_year) return isCurrentYearSeason;
          return p.season_year === activeSeason;
        });
      }
      
      const normalizedItems = itemsData.map(item => ({
        ...item,
        rotation: item.rotation || 0
      }));
      setItems(normalizedItems);
      
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
          
          const filled = layoutSchema?.flexible 
            ? itemPlantings.length
            : itemPlantings.reduce((sum, p) => {
                const cols = p.cell_span_cols || 1;
                const rows = p.cell_span_rows || 1;
                return sum + (cols * rows);
              }, 0);
          
          counts[item.id] = { filled, capacity };
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
    if (match) return { width: parseFloat(match[1]), height: parseFloat(match[2]) };
    return null;
  };

  const toInches = (value, unit) => unit === 'ft' ? value * 12 : value;

  const getNextName = (baseLabel) => {
    const exactMatch = items.find(i => i.label === baseLabel);
    if (!exactMatch) return baseLabel;
    const escapedBase = baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedBase}( \\d+)?$`);
    const matchingItems = items.filter(i => pattern.test(i.label));
    const numbers = matchingItems.map(i => {
      const match = i.label.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 1;
    });
    const maxNum = Math.max(...numbers, 0);
    return `${baseLabel} ${maxNum + 1}`;
  };

  const calculateLayoutSchema = (itemType, width, height, metadata) => {
    if (itemType.usesGallons) return { type: 'slots', slots: 1, flexible: true, capacity: 1 };
    if (itemType.value === 'TREE') return { type: 'slots', slots: 1, flexible: true };
    if (itemType.usesGrid && metadata.gridEnabled) {
      const gridSize = metadata.gridSize || 12;
      return {
        type: 'grid', grid_size: gridSize,
        columns: Math.floor(width / gridSize), rows: Math.floor(height / gridSize),
        planting_pattern: metadata.planting_pattern || 'square_foot'
      };
    }
    if (itemType.usesPredefinedSizes) {
      const gridSize = 12;
      return {
        type: 'grid', grid_size: gridSize,
        columns: Math.floor(width / gridSize), rows: Math.floor(height / gridSize),
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
    if (layoutSchema.type === 'grid') return layoutSchema.columns * layoutSchema.rows;
    if (layoutSchema.type === 'rows') return layoutSchema.rows;
    if (layoutSchema.type === 'slots') return layoutSchema.capacity || 1;
    return 0;
  };

  const [addingItems, setAddingItems] = useState(false);

  const handleAddItem = async () => {
    if (addingItems) return;
    setAddingItems(true);
    
    const itemType = ITEM_TYPES.find(t => t.value === newItem.item_type);
    let width, height;

    if (itemType.usesGallons) {
      const gallonInfo = GALLON_SIZES.find(g => g.value === newItem.gallonSize);
      width = height = gallonInfo.footprint;
    } else if (itemType.usesPredefinedSizes) {
      const planterSize = RAISED_PLANTER_SIZES.find(p => p.label === newItem.planterSize);
      if (!planterSize) { toast.error('Please select a planter size'); setAddingItems(false); return; }
      width = planterSize.width;
      height = planterSize.height;
    } else {
      const parsed = parseDimensions(newItem.dimensions);
      if (!parsed) { toast.error('Invalid dimensions. Use "4x8" format.'); setAddingItems(false); return; }
      width = toInches(parsed.width, newItem.unit);
      height = toInches(parsed.height, newItem.unit);
    }

    const count = newItem.createMultiple ? parseInt(newItem.count) : 1;
    const newItems = [];
    const spacing = 24;
    const cols = Math.ceil(Math.sqrt(count));

    try {
      const firstName = getNextName(itemType.label);
      const baseNum = parseInt(firstName.match(/\d+$/)?.[0] || '1');

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);

        let label = `${itemType.label} ${baseNum + i}`;
        let attempt = 0;
        while (items.some(existing => existing.label === label) && attempt < 1000) {
          label = `${itemType.label} ${baseNum + i + attempt}`;
          attempt++;
        }

        const metadata = {};
        if (itemType.usesGrid) {
          metadata.gridEnabled = newItem.useSquareFootGrid;
          if (newItem.useSquareFootGrid) metadata.gridSize = 12;
          metadata.planting_pattern = newItem.planting_pattern;
        }
        if (itemType.usesRows) {
          metadata.rowSpacing = newItem.rowSpacing;
          metadata.rowCount = newItem.rowCount || Math.floor(width / newItem.rowSpacing);
          metadata.planting_pattern = newItem.planting_pattern;
        }
        if (itemType.usesGallons) metadata.gallonSize = newItem.gallonSize;

        const item = await base44.entities.PlotItem.create({
          plot_id: plot.id, garden_id: garden.id,
          item_type: newItem.item_type, label, width, height, x, y,
          rotation: 0, z_index: items.length + i, metadata,
          custom_color: newItem.color || null
        });

        if (itemType.plantable) {
          const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
          const capacity = calculateCapacity(layoutSchema);
          await base44.entities.PlantingSpace.create({
            garden_id: garden.id, plot_item_id: item.id,
            space_type: item.item_type, name: label, capacity,
            layout_schema: layoutSchema, is_active: true
          });
        }
        newItems.push(item);
      }

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
      item_type: 'RAISED_BED', label: 'Raised Bed', dimensions: '4x8', unit: 'ft',
      useSquareFootGrid: true, planting_pattern: 'square_foot', gallonSize: 5,
      planterSize: '4ft x 8ft', rowSpacing: 18, rowCount: null,
      createMultiple: false, count: 1, color: null
    });
  };

  const handleTypeChange = (newType) => {
    const itemType = ITEM_TYPES.find(t => t.value === newType);
    const nextName = getNextName(itemType.label);
    setNewItem({
      ...newItem, item_type: newType, label: nextName,
      dimensions: itemType.defaultDims || '4x8', unit: itemType.defaultUnit || 'ft',
      useSquareFootGrid: itemType.usesGrid || false, planting_pattern: 'square_foot',
      gallonSize: 5, planterSize: '4ft x 8ft', rowSpacing: 18, rowCount: null,
      color: itemType.color
    });
  };

  // ─── Canvas interaction handlers (mouse only — touch uses non-passive listeners) ───
  const handleMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('.plot-item-controls')) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    const clickedItem = [...items].reverse().find(item =>
      x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height
    );

    if (clickedItem) {
      setSelectedItem(clickedItem);
      if (onItemSelect) onItemSelect(clickedItem);
      setDraggingItem(clickedItem);
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setDragOffset({ x: x - clickedItem.x, y: y - clickedItem.y });
      document.body.style.userSelect = 'none';
    } else {
      setSelectedItem(null);
      if (onItemSelect) onItemSelect(null);
    }
  };

  const handleMouseMove = (e) => {
    handleDragMove(e);
  };

  const handleInteractionEnd = async () => {
    if (isPinching) { handlePinchEnd(); return; }
    if (draggingItem) {
      const item = items.find(i => i.id === draggingItem.id);
      if (isDragging && item) {
        try {
          await base44.entities.PlotItem.update(item.id, { x: item.x, y: item.y });
          if (selectedItem?.id === item.id) setSelectedItem(item);
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

  // ─── Mobile: tap on item = select, long-press = context menu ───
  const handleMobileTapItem = useCallback((item) => {
    if (isPinching) return;
    setSelectedItem(item);
    if (onItemSelect) onItemSelect(item);
  }, [isPinching, onItemSelect]);

  const handleMobileLongPressItem = useCallback((item) => {
    if (isPinching) return;
    setSelectedItem(item);
    setLongPressedItem(item);
    setShowContextMenu(true);
  }, [isPinching]);

  // ─── Mobile: tap on canvas background = deselect ───
  const handleMobileCanvasTap = useCallback((e) => {
    // Only if tapping the canvas itself, not an item
    if (e.target === canvasRef.current || e.target.closest('svg')) {
      setSelectedItem(null);
      if (onItemSelect) onItemSelect(null);
    }
  }, [onItemSelect]);

  // ─── Mobile: start dragging a selected item ───
  const handleMobileTouchStartOnCanvas = useCallback((e) => {
    if (e.touches.length !== 1 || isPinching) return;
    if (e.target.closest('.plot-item')) return; // PlotItem handles its own touches

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches[0].clientX - rect.left) / zoom;
    const y = (e.touches[0].clientY - rect.top) / zoom;

    const touchedItem = [...items].reverse().find(item =>
      x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height
    );

    if (!touchedItem) {
      // Tapping empty canvas
      handleMobileCanvasTap(e);
    }
  }, [items, zoom, isPinching, handleMobileCanvasTap]);

  const handleDeleteItem = async (item) => {
    try {
      const spaces = await base44.entities.PlantingSpace.filter({ plot_item_id: item.id });
      if (spaces.length > 0) {
        const space = spaces[0];
        const plantings = await base44.entities.PlantInstance.filter({ space_id: space.id });
        if (plantings.length > 0) {
          const confirmed = confirm(`"${item.label}" has ${plantings.length} plantings. Delete item and all plantings?`);
          if (!confirmed) return;
          for (const planting of plantings) {
            await base44.entities.PlantInstance.delete(planting.id);
          }
        }
        await base44.entities.PlantingSpace.delete(space.id);
      }
      await base44.entities.PlotItem.delete(item.id);
      setItems(items.filter(i => i.id !== item.id));
      setSelectedItem(null);
      setShowContextMenu(false);
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleRotate = async () => {
    if (!selectedItem) return;
    const currentItem = items.find(i => i.id === selectedItem.id) || selectedItem;
    const currentRotation = currentItem.rotation || 0;
    const newRotation = (currentRotation + 90) % 360;
    const cx = currentItem.x + currentItem.width / 2;
    const cy = currentItem.y + currentItem.height / 2;
    const isVertical = newRotation === 90 || newRotation === 270;
    const newWidth = isVertical ? currentItem.height : currentItem.width;
    const newHeight = isVertical ? currentItem.width : currentItem.height;
    let newX = cx - newWidth / 2;
    let newY = cy - newHeight / 2;
    if (snapToGrid) {
      const gridSize = plot.grid_size || 12;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;
    }
    newX = Math.max(0, Math.min(newX, plot.width - newWidth));
    newY = Math.max(0, Math.min(newY, plot.height - newHeight));

    try {
      const updatedItem = { ...currentItem, x: newX, y: newY, width: newWidth, height: newHeight, rotation: newRotation };
      setItems(prevItems => prevItems.map(i => i.id === selectedItem.id ? updatedItem : i));
      setSelectedItem(updatedItem);
      await base44.entities.PlotItem.update(selectedItem.id, { x: newX, y: newY, width: newWidth, height: newHeight, rotation: newRotation });
      toast.success('Rotated');
    } catch (error) {
      console.error('Error rotating:', error);
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
      toast.error('Failed to update plot');
    }
  };

  const openEditItem = (item) => {
    const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
    const widthFt = item.width / 12;
    const heightFt = item.height / 12;
    setEditItemData({
      label: item.label, dimensions: `${widthFt}x${heightFt}`, unit: 'ft',
      color: getItemColor(item), customColor: item.custom_color || '',
      gallonSize: item.metadata?.gallonSize || 5,
      rowSpacing: item.metadata?.rowSpacing || 18,
      rowCount: item.metadata?.rowCount || null,
      capacity: item.metadata?.capacity || 20,
      planting_pattern: item.metadata?.planting_pattern || 'square_foot'
    });
    setShowEditItem(true);
    setShowContextMenu(false);
  };

  const handleEditItemSave = async () => {
    if (!selectedItem) return;
    const itemType = ITEM_TYPES.find(t => t.value === selectedItem.item_type);
    let width = selectedItem.width;
    let height = selectedItem.height;

    const duplicateName = items.find(i => i.id !== selectedItem.id && i.label === editItemData.label);
    if (duplicateName) { toast.error(`An item named "${editItemData.label}" already exists`); return; }

    if (!itemType.usesGallons && !itemType.usesPredefinedSizes) {
      const parsed = parseDimensions(editItemData.dimensions);
      if (parsed) { width = toInches(parsed.width, editItemData.unit); height = toInches(parsed.height, editItemData.unit); }
    }

    const metadata = { ...selectedItem.metadata };
    if (itemType.usesGallons) {
      metadata.gallonSize = editItemData.gallonSize;
      const gallonInfo = GALLON_SIZES.find(g => g.value === editItemData.gallonSize);
      width = height = gallonInfo.footprint;
    }
    if (itemType.usesRows) { metadata.rowSpacing = editItemData.rowSpacing; metadata.rowCount = editItemData.rowCount; metadata.planting_pattern = editItemData.planting_pattern; }
    if (itemType.usesGrid || itemType.usesPredefinedSizes) { metadata.planting_pattern = editItemData.planting_pattern; }

    try {
      await base44.entities.PlotItem.update(selectedItem.id, {
        label: editItemData.label, width, height, metadata, custom_color: editItemData.customColor || null
      });

      if (itemType.plantable) {
        const spaces = await base44.entities.PlantingSpace.filter({ plot_item_id: selectedItem.id });
        const layoutSchema = calculateLayoutSchema(itemType, width, height, metadata);
        const capacity = calculateCapacity(layoutSchema);
        if (spaces.length > 0) {
          await base44.entities.PlantingSpace.update(spaces[0].id, { name: editItemData.label, capacity, layout_schema: layoutSchema });
        } else {
          await base44.entities.PlantingSpace.create({
            garden_id: selectedItem.garden_id, plot_item_id: selectedItem.id,
            space_type: selectedItem.item_type, name: editItemData.label,
            capacity, layout_schema: layoutSchema, is_active: true
          });
        }
      }

      const updatedItem = { ...selectedItem, label: editItemData.label, width, height, metadata, custom_color: editItemData.customColor || null };
      setItems(items.map(i => i.id === selectedItem.id ? updatedItem : i));
      setSelectedItem(updatedItem);
      setShowEditItem(false);
      toast.success('Item updated');
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const getItemColor = (item) => {
    if (typeof item === 'string') return ITEM_TYPES.find(t => t.value === item)?.color || '#8B7355';
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

  // ═══════════════════════════════════════════
  // Item Context Menu (Mobile Drawer / Desktop Dialog)
  // ═══════════════════════════════════════════
  const ItemContextMenu = ({ item, onClose }) => {
    const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
    const isPlantable = itemType?.plantable;
    
    const ContextContent = (
      <>
        <DrawerHeader>
          <DrawerTitle>{item.label}</DrawerTitle>
          <DrawerDescription>{item.width}" × {item.height}"</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 space-y-2 pb-4">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { openEditItem(item); onClose(); }}>
            <Edit className="w-4 h-4" />Edit
          </Button>
          {isPlantable && (
            <Button className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
              onClick={() => { setShowPlantingModal(true); onClose(); }}>
              <Sprout className="w-5 h-5" />Plant Seeds
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { handleRotate(); onClose(); }}>
            <RotateCw className="w-4 h-4" />Rotate
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => { handleDeleteItem(item); onClose(); }}>
            <Trash2 className="w-4 h-4" />Delete
          </Button>
        </div>
        <DrawerFooter>
          <DrawerClose asChild><Button variant="outline">Close</Button></DrawerClose>
        </DrawerFooter>
      </>
    );
    
    if (isMobile) {
      return (
        <Drawer open={showContextMenu} onOpenChange={setShowContextMenu}>
          <DrawerContent>{ContextContent}</DrawerContent>
        </Drawer>
      );
    }
    return (
      <Dialog open={showContextMenu} onOpenChange={setShowContextMenu}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{item.label}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { openEditItem(item); onClose(); }}>
              <Edit className="w-4 h-4" />Edit
            </Button>
            {isPlantable && (
              <Button className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-12 font-semibold"
                onClick={() => { setShowPlantingModal(true); onClose(); }}>
                <Sprout className="w-5 h-5" />Plant Seeds
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { handleRotate(); onClose(); }}>
              <RotateCw className="w-4 h-4" />Rotate
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => { handleDeleteItem(item); onClose(); }}>
              <Trash2 className="w-4 h-4" />Delete
            </Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 mt-4 min-h-0">
      {/* ═══════════════════════════════════════════
          LEFT TOOLBAR — Desktop only
          ═══════════════════════════════════════════ */}
      <Card className="hidden lg:block w-64 flex-shrink-0 h-fit relative z-10">
        <CardContent className="p-4 space-y-2">
          <Button onClick={() => setShowAddItem(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Plus className="w-4 h-4" />Add Item
          </Button>
          <Button onClick={() => setShowPlotSettings(true)} variant="outline" className="w-full gap-2">
            <Settings className="w-4 h-4" />Plot Settings
          </Button>
          <AISuggestLayoutButton garden={garden} plot={plot} crops={cropPlans}
            onApply={() => toast.success('Review suggestions and manually place crops')} />
          {onDeleteGarden && (
            <Button onClick={onDeleteGarden} variant="outline"
              className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs mt-4 border-red-200">
              <Trash2 className="w-3 h-3" />Delete Garden
            </Button>
          )}
          <div className="pt-4 border-t space-y-2">
            <h4 className="font-semibold text-sm">View</h4>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm flex-1 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="icon" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            <Button variant={snapToGrid ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapToGrid(!snapToGrid)} className="w-full gap-2">
              <Grid3X3 className="w-4 h-4" />{garden?.chaos_mode ? 'Fine Snap' : 'Snap to Grid'}
            </Button>
            <Button variant={showSunPath ? 'secondary' : 'outline'} size="sm" onClick={() => setShowSunPath(!showSunPath)} className="w-full gap-2">
              ☀️ Sun Path
            </Button>
            {garden?.planting_method === 'SQUARE_FOOT' && (
              <Button variant={showSFGGrid ? 'secondary' : 'outline'} size="sm" onClick={() => setShowSFGGrid(!showSFGGrid)} className="w-full gap-2">
                📐 SFG Grid
              </Button>
            )}
          </div>
          {selectedItem && !isMobile && (
            <div className="pt-4 border-t space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">Selected</h4>
                <p className="text-sm text-gray-600 font-medium">{selectedItem.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{selectedItem.width}" × {selectedItem.height}"</p>
              </div>
              <div className="space-y-2">
                <Button variant="outline" size="sm" onClick={() => openEditItem(selectedItem)} className="w-full gap-2 justify-start">
                  <Settings className="w-4 h-4" />Edit
                </Button>
                {ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.plantable && (
                  <Button onClick={() => setShowPlantingModal(true)}
                    className="w-full gap-2 justify-start bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold">
                    <Sprout className="w-5 h-5" />Plant Seeds
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleRotate} disabled={!selectedItem} className="w-full gap-2 justify-start">
                  <RotateCw className="w-4 h-4" />Rotate
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteItem(selectedItem)}
                  className="w-full gap-2 justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════
          MOBILE TOOLBAR — Compact top bar
          ═══════════════════════════════════════════ */}
      <div className="lg:hidden flex gap-2 mb-2 overflow-x-auto pb-1 flex-shrink-0">
        <Button onClick={() => setShowAddItem(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1 whitespace-nowrap">
          <Plus className="w-3 h-3" />Add
        </Button>
        <Button onClick={() => setShowPlotSettings(true)} variant="outline" size="sm" className="gap-1 whitespace-nowrap">
          <Settings className="w-3 h-3" />
        </Button>
        <Button variant={snapToGrid ? 'secondary' : 'outline'} size="sm" onClick={() => setSnapToGrid(!snapToGrid)} className="gap-1 whitespace-nowrap">
          <Grid3X3 className="w-3 h-3" />
        </Button>
        <div className="flex items-center gap-1 border rounded-md px-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(Math.max(0.3, zoom - 0.15))}>
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="text-[10px] font-mono w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom(Math.min(3, zoom + 0.15))}>
            <ZoomIn className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          CANVAS AREA
          ═══════════════════════════════════════════ */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "flex-1 bg-gray-50 rounded-xl overflow-auto relative z-0",
          isMobile ? "p-2" : "p-8"
        )}
      >
        {/* Status Legend */}
        <div className="mb-2 lg:mb-4 flex items-center gap-2 lg:gap-4 text-xs flex-shrink-0">
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
          {isMobile && (
            <span className="text-[10px] text-gray-400 ml-auto">Pinch to zoom • Long-press item for menu</span>
          )}
        </div>
        
        <div
          ref={canvasRef}
          className="relative bg-white shadow-lg mx-auto plot-canvas select-none"
          style={{
            width: plot.width * zoom,
            height: plot.height * zoom,
            backgroundColor: plot.background_color || '#ffffff',
            // CRITICAL: Do NOT set touchAction: 'none' — breaks scrolling.
            // Touch interception is handled by non-passive event listeners above.
            touchAction: isMobile ? 'pan-x pan-y' : 'none'
          }}
          // Desktop mouse handlers
          onMouseDown={!isMobile ? handleMouseDown : undefined}
          onMouseMove={!isMobile ? handleMouseMove : undefined}
          onMouseUp={!isMobile ? handleInteractionEnd : undefined}
          onMouseLeave={!isMobile ? handleInteractionEnd : undefined}
          // Mobile: canvas-level touch start for deselection
          onTouchStart={isMobile ? handleMobileTouchStartOnCanvas : undefined}
          onTouchEnd={isMobile ? (e) => { if (isPinching) handlePinchEnd(); handleInteractionEnd(); } : undefined}
          onTouchCancel={isMobile ? () => { handlePinchEnd(); handleInteractionEnd(); } : undefined}
        >
          {/* Grid lines */}
          {plot.grid_enabled && !showSFGGrid && (
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              {Array.from({ length: Math.ceil(plot.width / plot.grid_size) }).map((_, i) => (
                <line key={`v-${i}`} x1={i * plot.grid_size * zoom} y1={0} x2={i * plot.grid_size * zoom} y2={plot.height * zoom} stroke="#e5e7eb" strokeWidth="1" />
              ))}
              {Array.from({ length: Math.ceil(plot.height / plot.grid_size) }).map((_, i) => (
                <line key={`h-${i}`} x1={0} y1={i * plot.grid_size * zoom} x2={plot.width * zoom} y2={i * plot.grid_size * zoom} stroke="#e5e7eb" strokeWidth="1" />
              ))}
            </svg>
          )}

          {/* SFG Grid */}
          {showSFGGrid && garden?.planting_method === 'SQUARE_FOOT' && (
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ zIndex: 5 }}>
              {Array.from({ length: Math.ceil(plot.width / 12) + 1 }).map((_, i) => (
                <line key={`sfg-v-${i}`} x1={i * 12 * zoom} y1={0} x2={i * 12 * zoom} y2={plot.height * zoom} stroke="#10b981" strokeWidth="2" opacity="0.6" />
              ))}
              {Array.from({ length: Math.ceil(plot.height / 12) + 1 }).map((_, i) => (
                <line key={`sfg-h-${i}`} x1={0} y1={i * 12 * zoom} x2={plot.width * zoom} y2={i * 12 * zoom} stroke="#10b981" strokeWidth="2" opacity="0.6" />
              ))}
              {Array.from({ length: Math.floor(plot.width / 12) }).map((_, col) =>
                Array.from({ length: Math.floor(plot.height / 12) }).map((_, row) => (
                  <text key={`label-${col}-${row}`} x={(col * 12 + 6) * zoom} y={(row * 12 + 8) * zoom}
                    textAnchor="middle" fontSize={9 * zoom} fill="#10b981" opacity="0.4" fontWeight="bold">1ft²</text>
                ))
              )}
            </svg>
          )}

          <SunPathOverlay width={plot.width} height={plot.height} zoom={zoom} enabled={showSunPath} season="summer" />

          {/* ─── Items ─── */}
          {items.map((item) => {
            const itemType = ITEM_TYPES.find(t => t.value === item.item_type);
            const status = itemType?.plantable ? getPlantingStatus(item.id) : null;
            const counts = itemsPlantingCounts[item.id];
            const isGrowBagOrContainer = itemType?.usesGallons;
            const isFull = status?.status === 'full';

            return (
              <PlotItem
                key={item.id}
                item={item}
                itemType={itemType}
                status={status}
                counts={counts}
                isGrowBagOrContainer={isGrowBagOrContainer}
                isFull={isFull}
                selectedItem={selectedItem}
                isDragging={isDragging}
                draggingItem={draggingItem}
                zoom={zoom}
                isMobile={isMobile}
                getItemColor={getItemColor}
                // Mobile: tap to select, long-press for context menu
                onTap={isMobile ? handleMobileTapItem : undefined}
                onLongPress={isMobile ? handleMobileLongPressItem : undefined}
                // Desktop: double-click for context menu
                onDoubleClick={() => {
                  setLongPressedItem(item);
                  setSelectedItem(item);
                  setShowContextMenu(true);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE: Floating Action Bar (when item selected)
          Shows Plant Seeds / Edit / Rotate / Delete
          ═══════════════════════════════════════════ */}
      {isMobile && selectedItem && !showContextMenu && !showPlantingModal && !showEditItem && (
        <div className="fixed bottom-4 left-3 right-3 z-30 bg-white rounded-2xl shadow-2xl border-2 border-emerald-200 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate flex-1">{selectedItem.label}</span>
            <span className="text-[10px] text-gray-500">{selectedItem.width}" × {selectedItem.height}"</span>
          </div>
          <div className="flex gap-2">
            {ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.plantable && (
              <Button size="sm" onClick={() => setShowPlantingModal(true)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-10 font-semibold">
                <Sprout className="w-4 h-4" />Plant
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => openEditItem(selectedItem)} className="gap-1 h-10">
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleRotate} className="gap-1 h-10">
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDeleteItem(selectedItem)}
              className="gap-1 h-10 text-red-600 hover:bg-red-50 border-red-200">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {longPressedItem && (
        <ItemContextMenu item={longPressedItem} onClose={() => { setShowContextMenu(false); setLongPressedItem(null); }} />
      )}

      {/* ─── Add Item Dialog ─── */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Item</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Type</Label>
              <Select value={newItem.item_type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} className="mt-2" />
            </div>
            <div>
              <Label>Item Color</Label>
              <div className="flex gap-2 mt-2">
                <input type="color" value={newItem.color || ITEM_TYPES.find(t => t.value === newItem.item_type)?.color || '#8B7355'}
                  onChange={(e) => setNewItem({ ...newItem, color: e.target.value })} className="w-12 h-10 rounded border cursor-pointer" />
                <Button variant="outline" size="sm"
                  onClick={() => setNewItem({ ...newItem, color: ITEM_TYPES.find(t => t.value === newItem.item_type)?.color })} className="flex-1">
                  Reset to Default
                </Button>
              </div>
            </div>

            {ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesPredefinedSizes ? (
              <div>
                <Label>Planter Size</Label>
                <Select value={newItem.planterSize} onValueChange={(v) => setNewItem({ ...newItem, planterSize: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RAISED_PLANTER_SIZES.map((size) => (
                      <SelectItem key={size.label} value={size.label}>{size.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : ITEM_TYPES.find(t => t.value === newItem.item_type)?.usesGallons ? (
              <div>
                <Label>Size (Gallons)</Label>
                <Select value={String(newItem.gallonSize)} onValueChange={(v) => setNewItem({ ...newItem, gallonSize: parseInt(v) })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GALLON_SIZES.map((g) => (
                      <SelectItem key={g.value} value={String(g.value)}>{g.value} gallon ({g.footprint}" footprint)</SelectItem>
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
                    <Input placeholder="4x8" value={newItem.dimensions} onChange={(e) => setNewItem({ ...newItem, dimensions: e.target.value })} />
                    <Select value={newItem.unit} onValueChange={(v) => setNewItem({ ...newItem, unit: v })}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ft">Feet</SelectItem>
                        <SelectItem value="in">Inches</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(newItem.item_type === 'RAISED_BED' || newItem.item_type === 'GREENHOUSE') && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={newItem.useSquareFootGrid}
                      onChange={(e) => setNewItem({ ...newItem, useSquareFootGrid: e.target.checked })} className="w-4 h-4 rounded" />
                    <span className="text-sm">Use Square Foot Grid (12" cells)</span>
                  </label>
                )}
                {(newItem.item_type === 'RAISED_BED' || newItem.item_type === 'GREENHOUSE' || newItem.item_type === 'IN_GROUND_BED' || newItem.item_type === 'OPEN_PLOT') && (
                  <div>
                    <Label>Planting Pattern</Label>
                    <Select value={newItem.planting_pattern || 'square_foot'} onValueChange={(v) => setNewItem({ ...newItem, planting_pattern: v })}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Select pattern" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="square_foot">Square Foot Grid</SelectItem>
                        <SelectItem value="diagonal">Diagonal (Offset Rows) - Intensive</SelectItem>
                        <SelectItem value="rows">Traditional Rows</SelectItem>
                      </SelectContent>
                    </Select>
                    {newItem.planting_pattern === 'diagonal' && (
                      <p className="text-sm text-gray-500 mt-1">Odd rows offset by 50% for intensive planting.</p>
                    )}
                  </div>
                )}
                {(newItem.item_type === 'IN_GROUND_BED' || newItem.item_type === 'OPEN_PLOT') && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold">Row Configuration</h4>
                    <div>
                      <Label htmlFor="rowSpacing" className="text-xs">Row Spacing (inches)</Label>
                      <Input id="rowSpacing" type="number" value={newItem.rowSpacing}
                        onChange={(e) => setNewItem({ ...newItem, rowSpacing: parseInt(e.target.value) })} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="rowCount" className="text-xs">Row Count (optional)</Label>
                      <Input id="rowCount" type="number" placeholder="Auto-calculated" value={newItem.rowCount || ''}
                        onChange={(e) => setNewItem({ ...newItem, rowCount: e.target.value ? parseInt(e.target.value) : null })} className="mt-1" />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="border-t pt-4">
              <label className="flex items-center gap-2 mb-3">
                <input type="checkbox" checked={newItem.createMultiple}
                  onChange={(e) => setNewItem({ ...newItem, createMultiple: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium">Create Multiple</span>
              </label>
              {newItem.createMultiple && (
                <div>
                  <Label htmlFor="count">Count</Label>
                  <Input id="count" type="number" min="1" value={newItem.count}
                    onChange={(e) => setNewItem({ ...newItem, count: e.target.value })} className="mt-2" />
                  <p className="text-xs text-gray-500 mt-1">Items will be auto-placed in a grid layout</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddItem(false); resetNewItem(); }}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={addingItems} className="bg-emerald-600 hover:bg-emerald-700">
              {addingItems ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</>) : (newItem.createMultiple ? `Create ${newItem.count}` : 'Add Item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plot Settings Dialog */}
      <PlotSettingsDialog plot={plot} open={showPlotSettings} onOpenChange={setShowPlotSettings} onSave={handlePlotSettingsSave} />

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
            <DialogHeader><DialogTitle>Edit {selectedItem.label}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editLabel">Label</Label>
                <Input id="editLabel" value={editItemData.label} onChange={(e) => setEditItemData({ ...editItemData, label: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label>Item Color</Label>
                <div className="flex gap-2 mt-2">
                  <input type="color" value={editItemData.customColor || editItemData.color}
                    onChange={(e) => setEditItemData({ ...editItemData, customColor: e.target.value })} className="w-12 h-10 rounded border cursor-pointer" />
                  <Button variant="outline" size="sm" onClick={() => setEditItemData({ ...editItemData, customColor: '' })} className="flex-1">
                    Reset to Default
                  </Button>
                </div>
              </div>
              {ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.usesGallons ? (
                <div>
                  <Label>Size (Gallons)</Label>
                  <Select value={String(editItemData.gallonSize)} onValueChange={(v) => setEditItemData({ ...editItemData, gallonSize: parseInt(v) })}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GALLON_SIZES.map((g) => (
                        <SelectItem key={g.value} value={String(g.value)}>{g.value} gallon ({g.footprint}" footprint)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : !ITEM_TYPES.find(t => t.value === selectedItem.item_type)?.usesPredefinedSizes ? (
                <>
                  <div>
                    <Label>Dimensions</Label>
                    <div className="flex gap-2 mt-2">
                      <Input placeholder="4x8" value={editItemData.dimensions} onChange={(e) => setEditItemData({ ...editItemData, dimensions: e.target.value })} />
                      <Select value={editItemData.unit} onValueChange={(v) => setEditItemData({ ...editItemData, unit: v })}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ft">Feet</SelectItem>
                          <SelectItem value="in">Inches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(selectedItem.item_type === 'RAISED_BED' || selectedItem.item_type === 'GREENHOUSE' || selectedItem.item_type === 'IN_GROUND_BED' || selectedItem.item_type === 'OPEN_PLOT') && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold">Planting Pattern</h4>
                      <Select value={editItemData.planting_pattern || 'square_foot'} onValueChange={(v) => setEditItemData({ ...editItemData, planting_pattern: v })}>
                        <SelectTrigger><SelectValue placeholder="Select pattern" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="square_foot">Square Foot Grid</SelectItem>
                          <SelectItem value="diagonal">Diagonal (Offset Rows) - Intensive</SelectItem>
                          <SelectItem value="rows">Traditional Rows</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(selectedItem.item_type === 'IN_GROUND_BED' || selectedItem.item_type === 'OPEN_PLOT') && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold">Row Configuration</h4>
                      <div>
                        <Label htmlFor="editRowSpacing" className="text-xs">Row Spacing (inches)</Label>
                        <Input id="editRowSpacing" type="number" value={editItemData.rowSpacing}
                          onChange={(e) => setEditItemData({ ...editItemData, rowSpacing: parseInt(e.target.value) })} className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="editRowCount" className="text-xs">Row Count</Label>
                        <Input id="editRowCount" type="number" value={editItemData.rowCount || ''}
                          onChange={(e) => setEditItemData({ ...editItemData, rowCount: e.target.value ? parseInt(e.target.value) : null })} className="mt-1" />
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditItem(false)}>Cancel</Button>
              <Button onClick={handleEditItemSave} className="bg-emerald-600 hover:bg-emerald-700">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
