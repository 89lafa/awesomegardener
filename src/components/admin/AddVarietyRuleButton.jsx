import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CONTAINER_TYPES = ['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'GROW_BAG', 'CONTAINER', 'OPEN_PLOT'];

export default function AddVarietyRuleButton({ plantTypeId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [varieties, setVarieties] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [containerType, setContainerType] = useState('RAISED_BED');
  const [gridCols, setGridCols] = useState(1);
  const [gridRows, setGridRows] = useState(1);
  const [plantsPerSlot, setPlantsPerSlot] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && plantTypeId) {
      base44.entities.Variety.filter({ plant_type_id: plantTypeId }, 'variety_name', 200)
        .then(setVarieties).catch(() => {});
    }
  }, [open, plantTypeId]);

  const filtered = varieties.filter(v => 
    !search || v.variety_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!selectedVariety) { toast.error('Select a variety'); return; }
    setSaving(true);
    try {
      const newRule = await base44.entities.PlantingRule.create({
        plant_type_id: plantTypeId,
        variety_id: selectedVariety.id,
        variety_name: selectedVariety.variety_name,
        container_type: containerType,
        grid_cols: gridCols,
        grid_rows: gridRows,
        plants_per_grid_slot: plantsPerSlot,
        notes,
      });
      onAdded(newRule);
      toast.success(`Added variety override for ${selectedVariety.variety_name}`);
      setOpen(false);
      setSelectedVariety(null);
      setSearch('');
    } catch (e) {
      toast.error('Failed to add: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3" />Add Variety Override
      </Button>
    );
  }

  return (
    <div className="mt-3 p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 space-y-3">
      <h5 className="text-sm font-semibold text-blue-800">New Variety Override</h5>
      <div>
        <Label className="text-xs">Search Variety</Label>
        <Input value={search} onChange={e => { setSearch(e.target.value); setSelectedVariety(null); }} placeholder="Type variety name..." className="mt-1" />
        {search && !selectedVariety && (
          <div className="border rounded bg-white max-h-40 overflow-y-auto mt-1">
            {filtered.slice(0, 15).map(v => (
              <button key={v.id} className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50"
                onClick={() => { setSelectedVariety(v); setSearch(v.variety_name); }}>
                {v.variety_name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No varieties found</p>}
          </div>
        )}
        {selectedVariety && <p className="text-xs text-blue-700 mt-1">✓ Selected: {selectedVariety.variety_name}</p>}
      </div>
      <div>
        <Label className="text-xs">Container Type</Label>
        <Select value={containerType} onValueChange={setContainerType}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CONTAINER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Grid Cols</Label>
          <Input type="number" min="1" value={gridCols} onChange={e => setGridCols(parseInt(e.target.value)||1)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Grid Rows</Label>
          <Input type="number" min="1" value={gridRows} onChange={e => setGridRows(parseInt(e.target.value)||1)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Plants/Slot</Label>
          <Input type="number" min="1" value={plantsPerSlot} onChange={e => setPlantsPerSlot(parseInt(e.target.value)||1)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Cherry — 1×1 sq ft" className="mt-1" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}Save Override
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}