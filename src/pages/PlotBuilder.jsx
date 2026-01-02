import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Grid3X3,
  Settings,
  RotateCw,
  Copy,
  ZoomIn,
  ZoomOut,
  Loader2,
  Move,
  Maximize2
} from 'lucide-react';
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
import ErrorBoundary from '@/components/common/ErrorBoundary';

const ITEM_TYPES = [
  { value: 'RAISED_BED', label: 'Raised Bed', color: '#8B7355' },
  { value: 'IN_GROUND_BED', label: 'In-Ground Bed', color: '#A0826D' },
  { value: 'GREENHOUSE', label: 'Greenhouse', color: '#C8E6C9' },
  { value: 'OPEN_PLOT', label: 'Open Plot', color: '#E8F5E9' },
  { value: 'GROW_BAG', label: 'Grow Bag', color: '#FFE0B2' },
  { value: 'CONTAINER', label: 'Container', color: '#BBDEFB' },
  { value: 'PATH', label: 'Path', color: '#CFD8DC' },
  { value: 'COMPOST', label: 'Compost', color: '#D7CCC8' },
  { value: 'WATER_SOURCE', label: 'Water Source', color: '#B3E5FC' },
];

export default function PlotBuilder() {
  const [searchParams] = useSearchParams();
  const gardenId = searchParams.get('gardenId');
  const canvasRef = useRef(null);

  const [garden, setGarden] = useState(null);
  const [plot, setPlot] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showPlotSettings, setShowPlotSettings] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  const [newItem, setNewItem] = useState({
    item_type: 'RAISED_BED',
    label: 'Raised Bed',
    width: 48,
    height: 96,
    unit: 'in'
  });

  const [bulkAdd, setBulkAdd] = useState({
    count: 4,
    base_name: 'Raised Bed',
    dimensions: '4x8',
    unit: 'ft',
    item_type: 'RAISED_BED'
  });

  useEffect(() => {
    if (gardenId) loadData();
  }, [gardenId]);

  const loadData = async () => {
    try {
      const [gardenData, plotData, itemsData] = await Promise.all([
        base44.entities.Garden.filter({ id: gardenId }),
        base44.entities.GardenPlot.filter({ garden_id: gardenId }),
        base44.entities.PlotItem.filter({ garden_id: gardenId }, 'z_index')
      ]);

      if (gardenData.length > 0) setGarden(gardenData[0]);
      
      if (plotData.length === 0) {
        // Create default plot
        const newPlot = await base44.entities.GardenPlot.create({
          garden_id: gardenId,
          width: 480,
          height: 720,
          units: 'ft',
          shape_type: 'RECTANGLE'
        });
        setPlot(newPlot);
      } else {
        setPlot(plotData[0]);
      }

      setItems(itemsData);
    } catch (error) {
      console.error('Error loading plot data:', error);
      toast.error('Failed to load plot');
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

  const handleAddItem = async () => {
    try {
      let width = newItem.width;
      let height = newItem.height;

      // Parse dimension shorthand if needed
      if (typeof newItem.dimensions === 'string') {
        const parsed = parseDimensions(newItem.dimensions);
        if (parsed) {
          width = toInches(parsed.width, newItem.unit);
          height = toInches(parsed.height, newItem.unit);
        }
      } else {
        width = toInches(width, newItem.unit);
        height = toInches(height, newItem.unit);
      }

      const item = await base44.entities.PlotItem.create({
        plot_id: plot.id,
        garden_id: gardenId,
        item_type: newItem.item_type,
        label: newItem.label,
        width,
        height,
        x: 50,
        y: 50,
        rotation: 0,
        z_index: items.length
      });

      setItems([...items, item]);
      setShowAddItem(false);
      setNewItem({
        item_type: 'RAISED_BED',
        label: 'Raised Bed',
        width: 48,
        height: 96,
        unit: 'in'
      });
      toast.success('Item added!');
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    }
  };

  const handleBulkAdd = async () => {
    try {
      const parsed = parseDimensions(bulkAdd.dimensions);
      if (!parsed) {
        toast.error('Invalid dimensions format. Use "4x8" format.');
        return;
      }

      const width = toInches(parsed.width, bulkAdd.unit);
      const height = toInches(parsed.height, bulkAdd.unit);
      const count = parseInt(bulkAdd.count);

      // Create items in a grid layout
      const cols = Math.ceil(Math.sqrt(count));
      const spacing = 24; // 2 feet spacing
      const newItems = [];

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);

        const item = await base44.entities.PlotItem.create({
          plot_id: plot.id,
          garden_id: gardenId,
          item_type: bulkAdd.item_type,
          label: i === 0 ? bulkAdd.base_name : `${bulkAdd.base_name} ${i + 1}`,
          width,
          height,
          x,
          y,
          rotation: 0,
          z_index: items.length + i
        });

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

  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete "${item.label}"?`)) return;
    try {
      await base44.entities.PlotItem.delete(item.id);
      setItems(items.filter(i => i.id !== item.id));
      setSelectedItem(null);
      toast.success('Item deleted');
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleRotateItem = async (item) => {
    const newRotation = (item.rotation + 90) % 360;
    try {
      await base44.entities.PlotItem.update(item.id, { rotation: newRotation });
      setItems(items.map(i => i.id === item.id ? { ...i, rotation: newRotation } : i));
    } catch (error) {
      console.error('Error rotating item:', error);
    }
  };

  const handleDuplicateItem = async (item) => {
    try {
      const newItem = await base44.entities.PlotItem.create({
        plot_id: plot.id,
        garden_id: gardenId,
        item_type: item.item_type,
        label: `${item.label} Copy`,
        width: item.width,
        height: item.height,
        x: item.x + 24,
        y: item.y + 24,
        rotation: item.rotation,
        z_index: items.length
      });
      setItems([...items, newItem]);
      toast.success('Item duplicated');
    } catch (error) {
      console.error('Error duplicating item:', error);
    }
  };

  const handleCanvasMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicked on an item
    const clickedItem = [...items].reverse().find(item => {
      return x >= item.x && x <= item.x + item.width &&
             y >= item.y && y <= item.y + item.height;
    });

    if (clickedItem) {
      setSelectedItem(clickedItem);
      setDraggingItem(clickedItem);
      setDragOffset({ x: x - clickedItem.x, y: y - clickedItem.y });
    } else {
      setSelectedItem(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggingItem) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / zoom - dragOffset.x;
    let y = (e.clientY - rect.top) / zoom - dragOffset.y;

    // Snap to grid
    if (snapToGrid) {
      const gridSize = plot?.grid_size || 12;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    // Constrain to plot bounds
    x = Math.max(0, Math.min(x, (plot?.width || 480) - draggingItem.width));
    y = Math.max(0, Math.min(y, (plot?.height || 720) - draggingItem.height));

    setItems(items.map(i => 
      i.id === draggingItem.id ? { ...i, x, y } : i
    ));
  };

  const handleCanvasMouseUp = async () => {
    if (draggingItem) {
      const item = items.find(i => i.id === draggingItem.id);
      try {
        await base44.entities.PlotItem.update(item.id, { x: item.x, y: item.y });
      } catch (error) {
        console.error('Error updating item position:', error);
      }
      setDraggingItem(null);
    }
  };

  const getItemColor = (type) => {
    return ITEM_TYPES.find(t => t.value === type)?.color || '#8B7355';
  };

  if (!gardenId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">No garden selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Plot Builder Error">
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Gardens')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{garden?.name}</h1>
              <p className="text-sm text-gray-600">Plot Builder</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 mt-4 gap-4">
          {/* Left Toolbar */}
          <div className="w-64 flex-shrink-0 space-y-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <Button 
                  onClick={() => setShowAddItem(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </Button>
                <Button 
                  onClick={() => setShowBulkAdd(true)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Bulk Add
                </Button>
                <Button 
                  onClick={() => setShowPlotSettings(true)}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Plot Settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">View</h3>
                <div className="space-y-2">
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
              </CardContent>
            </Card>

            {selectedItem && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Selected Item</h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedItem.label}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    {selectedItem.width}" × {selectedItem.height}"
                  </p>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRotateItem(selectedItem)}
                      className="w-full gap-2"
                    >
                      <RotateCw className="w-4 h-4" />
                      Rotate 90°
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicateItem(selectedItem)}
                      className="w-full gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteItem(selectedItem)}
                      className="w-full gap-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-gray-50 rounded-xl overflow-auto p-8">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg mx-auto cursor-move"
              style={{
                width: (plot?.width || 480) * zoom,
                height: (plot?.height || 720) * zoom,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              {/* Grid */}
              {plot?.grid_enabled && (
                <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                  {Array.from({ length: Math.ceil((plot?.width || 480) / (plot?.grid_size || 12)) }).map((_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={i * (plot?.grid_size || 12)}
                      y1={0}
                      x2={i * (plot?.grid_size || 12)}
                      y2={plot?.height || 720}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                  {Array.from({ length: Math.ceil((plot?.height || 720) / (plot?.grid_size || 12)) }).map((_, i) => (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={i * (plot?.grid_size || 12)}
                      x2={plot?.width || 480}
                      y2={i * (plot?.grid_size || 12)}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />
                  ))}
                </svg>
              )}

              {/* Items */}
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "absolute border-2 rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                    selectedItem?.id === item.id ? "border-emerald-600 ring-2 ring-emerald-100" : "border-gray-300"
                  )}
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: item.height,
                    backgroundColor: getItemColor(item.item_type),
                    transform: `rotate(${item.rotation}deg)`,
                    cursor: draggingItem?.id === item.id ? 'grabbing' : 'grab'
                  }}
                >
                  <span className="text-white text-shadow">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Add Item Dialog */}
        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Item to Plot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Item Type</Label>
                <Select 
                  value={newItem.item_type} 
                  onValueChange={(v) => setNewItem({ ...newItem, item_type: v })}
                >
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
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={newItem.label}
                  onChange={(e) => setNewItem({ ...newItem, label: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="dimensions">Dimensions (e.g., "4x8")</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="dimensions"
                    placeholder="4x8 or 48"
                    onChange={(e) => setNewItem({ ...newItem, dimensions: e.target.value })}
                    className="flex-1"
                  />
                  <Select 
                    value={newItem.unit} 
                    onValueChange={(v) => setNewItem({ ...newItem, unit: v })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="in">in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
              <Button onClick={handleAddItem} className="bg-emerald-600 hover:bg-emerald-700">
                Add Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Add Dialog */}
        <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Add Items</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="count">Number of Items</Label>
                <Input
                  id="count"
                  type="number"
                  value={bulkAdd.count}
                  onChange={(e) => setBulkAdd({ ...bulkAdd, count: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="baseName">Base Name</Label>
                <Input
                  id="baseName"
                  value={bulkAdd.base_name}
                  onChange={(e) => setBulkAdd({ ...bulkAdd, base_name: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="bulkDimensions">Dimensions (e.g., "4x8")</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="bulkDimensions"
                    value={bulkAdd.dimensions}
                    onChange={(e) => setBulkAdd({ ...bulkAdd, dimensions: e.target.value })}
                    className="flex-1"
                  />
                  <Select 
                    value={bulkAdd.unit} 
                    onValueChange={(v) => setBulkAdd({ ...bulkAdd, unit: v })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">ft</SelectItem>
                      <SelectItem value="in">in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAdd(false)}>Cancel</Button>
              <Button onClick={handleBulkAdd} className="bg-emerald-600 hover:bg-emerald-700">
                Create Items
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}