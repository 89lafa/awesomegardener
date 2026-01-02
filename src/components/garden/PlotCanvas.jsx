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
  Loader2
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

const ITEM_TYPES = [
  { value: 'RAISED_BED', label: 'Raised Bed', color: '#8B7355', defaultDims: '4x8', defaultUnit: 'ft', usesGrid: true },
  { value: 'IN_GROUND_BED', label: 'In-Ground Bed', color: '#A0826D', defaultDims: '4x20', defaultUnit: 'ft', usesRows: true },
  { value: 'GREENHOUSE', label: 'Greenhouse', color: '#80CBC4', defaultDims: '10x12', defaultUnit: 'ft', usesGrid: false },
  { value: 'OPEN_PLOT', label: 'Open Plot', color: '#D7CCC8', defaultDims: '50x100', defaultUnit: 'ft', usesRows: true },
  { value: 'GROW_BAG', label: 'Grow Bag', color: '#424242', usesGallons: true },
  { value: 'CONTAINER', label: 'Container', color: '#D84315', usesSize: true },
];

const GALLON_SIZES = [
  { value: 1, footprint: 8 }, { value: 3, footprint: 10 }, { value: 5, footprint: 12 },
  { value: 7, footprint: 14 }, { value: 10, footprint: 16 }, { value: 15, footprint: 20 },
  { value: 20, footprint: 24 }, { value: 30, footprint: 30 }
];

export default function PlotCanvas({ garden, plot, onPlotUpdate }) {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const loadItems = async () => {
    try {
      const itemsData = await base44.entities.PlotItem.filter({ 
        garden_id: garden.id,
        plot_id: plot.id 
      }, 'z_index');
      setItems(itemsData);
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
    const existingWithType = items.filter(i => i.label.startsWith(baseLabel));
    if (existingWithType.length === 0) return baseLabel;
    return `${baseLabel} ${existingWithType.length + 1}`;
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

    const count = newItem.createMultiple ? parseInt(newItem.count) : 1;
    const newItems = [];
    const spacing = 24;
    const cols = Math.ceil(Math.sqrt(count));

    try {
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);
        
        const label = i === 0 ? newItem.label : getNextName(itemType.label);

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

        newItems.push(item);
      }

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
    setNewItem({
      ...newItem,
      item_type: newType,
      label: getNextName(itemType.label),
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

    try {
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = 50 + col * (width + spacing);
        const y = 50 + row * (height + spacing);

        const item = await base44.entities.PlotItem.create({
          plot_id: plot.id,
          garden_id: garden.id,
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

    if (snapToGrid) {
      const gridSize = plot.grid_size || 12;
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    x = Math.max(0, Math.min(x, plot.width - draggingItem.width));
    y = Math.max(0, Math.min(y, plot.height - draggingItem.height));

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
        console.error('Error updating position:', error);
      }
      setDraggingItem(null);
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
      console.error('Error deleting:', error);
    }
  };

  const handleRotate = async (item) => {
    const newRotation = (item.rotation + 90) % 360;
    try {
      await base44.entities.PlotItem.update(item.id, { rotation: newRotation });
      setItems(items.map(i => i.id === item.id ? { ...i, rotation: newRotation } : i));
    } catch (error) {
      console.error('Error rotating:', error);
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

  return (
    <div className="flex-1 flex gap-4 mt-4 min-h-0">
      {/* Left Toolbar */}
      <Card className="w-64 flex-shrink-0">
        <CardContent className="p-4 space-y-2">
          <Button 
            onClick={() => setShowAddItem(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </Button>

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
            <div className="pt-4 border-t space-y-2">
              <h4 className="font-semibold text-sm">Selected</h4>
              <p className="text-sm text-gray-600">{selectedItem.label}</p>
              <p className="text-xs text-gray-500">
                {selectedItem.width}" × {selectedItem.height}"
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRotate(selectedItem)}
                className="w-full gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Rotate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteItem(selectedItem)}
                className="w-full gap-2 text-red-600"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canvas */}
      <div className="flex-1 bg-gray-50 rounded-xl overflow-auto p-8">
        <div
          ref={canvasRef}
          className="relative bg-white shadow-lg mx-auto"
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
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "absolute border-2 rounded-lg flex items-center justify-center text-sm font-medium",
                selectedItem?.id === item.id ? "border-emerald-600 ring-2 ring-emerald-100" : "border-gray-400"
              )}
              style={{
                left: item.x * zoom,
                top: item.y * zoom,
                width: item.width * zoom,
                height: item.height * zoom,
                backgroundColor: getItemColor(item.item_type),
                transform: `rotate(${item.rotation}deg)`,
                transformOrigin: 'center',
                cursor: 'grab'
              }}
            >
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
              {/* Label stays horizontal */}
              <span 
                className="text-white text-shadow pointer-events-none font-semibold"
                style={{
                  transform: `rotate(${-item.rotation}deg)`,
                  display: 'inline-block'
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
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


    </div>
  );
}