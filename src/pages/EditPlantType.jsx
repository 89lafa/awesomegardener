import React, { useState, useEffect } from 'react';
import RuleFields from '@/components/admin/RuleFields';
import AddVarietyRuleButton from '@/components/admin/AddVarietyRuleButton';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Save, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function EditPlantType() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plantTypeId = searchParams.get('id');
  
  const [plantType, setPlantType] = useState(null);
  const [plantingRules, setPlantingRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingVarieties, setDeletingVarieties] = useState(false);
  const [deletePreview, setDeletePreview] = useState(null);
  const [formData, setFormData] = useState({
    common_name: '',
    scientific_name: '',
    description: '',
    notes: '',
    category: 'vegetable',
    icon: '',
    typical_sun: 'full_sun',
    typical_water: 'moderate',
    typical_spacing_min: null,
    typical_spacing_max: null,
    default_days_to_maturity: null,
    default_start_indoors_weeks: null,
    default_transplant_weeks: null,
    default_direct_sow_weeks_min: null,
    default_direct_sow_weeks_max: null,
    trellis_common: false,
    is_perennial: false,
    start_indoors_not_recommended: false,
    buy_seeds_link: '',
    affiliate_link2: '',
    affiliate_link3: '',
    color: '#10b981'
  });

  const [allPlantTypes, setAllPlantTypes] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (plantTypeId) {
      loadPlantType();
    } else {
      // No ID provided — load list to pick from
      base44.entities.PlantType.list('common_name', 500).then(types => {
        setAllPlantTypes(types);
        setLoading(false);
      }).catch(err => {
        toast.error('Failed to load plant types');
        setLoading(false);
      });
    }
  }, [plantTypeId]);

  const loadPlantType = async () => {
    try {
      const types = await base44.entities.PlantType.filter({ id: plantTypeId });
      if (types.length === 0) {
        toast.error('PlantType not found');
        navigate(-1);
        return;
      }
      
      const type = types[0];
      setPlantType(type);
      
      // Load planting rules
      const rules = await base44.entities.PlantingRule.filter({ plant_type_id: plantTypeId });
      setPlantingRules(rules);
      setFormData({
        common_name: type.common_name || '',
        scientific_name: type.scientific_name || '',
        description: type.description || '',
        notes: type.notes || '',
        category: type.category || 'vegetable',
        icon: type.icon || '',
        typical_sun: type.typical_sun || 'full_sun',
        typical_water: type.typical_water || 'moderate',
        typical_spacing_min: type.typical_spacing_min ?? null,
        typical_spacing_max: type.typical_spacing_max ?? null,
        default_days_to_maturity: type.default_days_to_maturity ?? null,
        default_start_indoors_weeks: type.default_start_indoors_weeks ?? null,
        default_transplant_weeks: type.default_transplant_weeks ?? null,
        default_direct_sow_weeks_min: type.default_direct_sow_weeks_min ?? null,
        default_direct_sow_weeks_max: type.default_direct_sow_weeks_max ?? null,
        trellis_common: type.trellis_common || false,
        is_perennial: type.is_perennial || false,
        start_indoors_not_recommended: type.start_indoors_not_recommended || false,
        buy_seeds_link: type.buy_seeds_link || '',
        affiliate_link2: type.affiliate_link2 || '',
        affiliate_link3: type.affiliate_link3 || '',
        color: type.color || '#10b981'
      });
    } catch (error) {
      console.error('Error loading plant type:', error);
      toast.error('Failed to load plant type');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.common_name.trim()) {
      toast.error('Common name is required');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.PlantType.update(plantTypeId, formData);
      toast.success('PlantType updated!');
      navigate(-1);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (containerType) => {
    try {
      const newRule = await base44.entities.PlantingRule.create({
        plant_type_id: plantTypeId,
        container_type: containerType,
        grid_cols: 1,
        grid_rows: 1,
        plants_per_grid_slot: 1
      });
      setPlantingRules([...plantingRules, newRule]);
      toast.success(`Added rule for ${containerType}`);
    } catch (error) {
      console.error('Error adding rule:', error);
      toast.error('Failed to add rule');
    }
  };

  const handleUpdateRule = async (ruleId, updates) => {
    try {
      await base44.entities.PlantingRule.update(ruleId, updates);
      setPlantingRules(plantingRules.map(r => r.id === ruleId ? { ...r, ...updates } : r));
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteAllVarieties = async () => {
    if (!deletePreview) {
      // Step 1: dry run to see count
      setDeletingVarieties(true);
      try {
        const res = await base44.functions.invoke('deleteAllVarietiesForPlantTypeV2', {
          plant_type_id: plantTypeId, dry_run: true
        });
        setDeletePreview(res.data);
      } catch (err) {
        toast.error('Preview failed: ' + err.message);
      } finally {
        setDeletingVarieties(false);
      }
      return;
    }

    // Step 2: confirm and execute
    const confirmText = prompt(
      `⚠️ DANGER: This will permanently delete ${deletePreview.would_delete} varieties for "${plantType?.common_name}".\n\nType DELETE to confirm:`
    );
    if (confirmText !== 'DELETE') {
      toast.info('Cancelled');
      return;
    }

    setDeletingVarieties(true);
    try {
      const res = await base44.functions.invoke('deleteAllVarietiesForPlantTypeV2', {
        plant_type_id: plantTypeId,
        dry_run: false,
        confirm_token: `DELETE_${plantTypeId}`
      });
      toast.success(`Deleted ${res.data.deleted} varieties`);
      setDeletePreview(null);
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    } finally {
      setDeletingVarieties(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Delete this planting rule?')) return;
    try {
      await base44.entities.PlantingRule.delete(ruleId);
      setPlantingRules(plantingRules.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // No ID provided: show plant type picker
  if (!plantTypeId) {
    const filtered = allPlantTypes.filter(t =>
      !search || t.common_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.scientific_name?.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Edit Plant Type</h1>
        <p className="text-gray-600 text-sm">Select a plant type to edit its details and planting rules.</p>
        <Input
          placeholder="Search plant types..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="grid gap-2 max-h-[70vh] overflow-y-auto">
          {filtered.map(type => (
            <button
              key={type.id}
              onClick={() => navigate(`?id=${type.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors"
            >
              <span className="text-2xl">{type.icon || '🌱'}</span>
              <div>
                <p className="font-semibold text-sm">{type.common_name}</p>
                {type.scientific_name && <p className="text-xs text-gray-500 italic">{type.scientific_name}</p>}
                <p className="text-xs text-gray-400 capitalize">{type.category}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-gray-500 text-sm py-4 text-center">No plant types found</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Edit PlantType</h1>
          <p className="text-gray-600 text-sm">Update master plant type data</p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Common Name *</Label>
              <Input
                value={formData.common_name}
                onChange={(e) => setFormData({ ...formData, common_name: e.target.value })}
                placeholder="e.g., Tomato"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Scientific Name</Label>
              <Input
                value={formData.scientific_name}
                onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
                placeholder="e.g., Solanum lycopersicum"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of this plant type..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vegetable">Vegetable</SelectItem>
                  <SelectItem value="fruit">Fruit</SelectItem>
                  <SelectItem value="herb">Herb</SelectItem>
                  <SelectItem value="flower">Flower</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Icon (Emoji)</Label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🍅"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Color (Hex)</Label>
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#10b981"
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Growing Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Sun Exposure</Label>
              <Select value={formData.typical_sun} onValueChange={(v) => setFormData({ ...formData, typical_sun: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_sun">Full Sun</SelectItem>
                  <SelectItem value="partial_sun">Partial Sun</SelectItem>
                  <SelectItem value="partial_shade">Partial Shade</SelectItem>
                  <SelectItem value="full_shade">Full Shade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Water Needs</Label>
              <Select value={formData.typical_water} onValueChange={(v) => setFormData({ ...formData, typical_water: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Days to Maturity</Label>
              <Input
                type="number"
                value={formData.default_days_to_maturity || ''}
                onChange={(e) => setFormData({ ...formData, default_days_to_maturity: e.target.value ? parseInt(e.target.value) : null })}
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Spacing Min (inches)</Label>
              <Input
                type="number"
                value={formData.typical_spacing_min || ''}
                onChange={(e) => setFormData({ ...formData, typical_spacing_min: e.target.value ? parseInt(e.target.value) : null })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Spacing Max (inches)</Label>
              <Input
                type="number"
                value={formData.typical_spacing_max || ''}
                onChange={(e) => setFormData({ ...formData, typical_spacing_max: e.target.value ? parseInt(e.target.value) : null })}
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Start Indoors (weeks before last frost)</Label>
              <Input
                type="number"
                value={formData.default_start_indoors_weeks ?? ''}
                onChange={(e) => setFormData({ ...formData, default_start_indoors_weeks: e.target.value !== '' ? parseInt(e.target.value) : null })}
                placeholder="blank = not set, 0 = at frost"
                className="mt-2"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.start_indoors_not_recommended || false}
                  onChange={(e) => setFormData({ ...formData, start_indoors_not_recommended: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-xs text-orange-700 font-medium">⚠ Not Recommended (root disturbance / taproot)</span>
              </label>
            </div>
            <div>
              <Label>Transplant (weeks after last frost)</Label>
              <Input
                type="number"
                value={formData.default_transplant_weeks ?? ''}
                onChange={(e) => setFormData({ ...formData, default_transplant_weeks: e.target.value !== '' ? parseInt(e.target.value) : null })}
                placeholder="blank = not set, 0 = at frost"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Direct Sow Min (weeks relative to last frost)</Label>
              <Input
                type="number"
                value={formData.default_direct_sow_weeks_min ?? ''}
                onChange={(e) => setFormData({ ...formData, default_direct_sow_weeks_min: e.target.value !== '' ? parseInt(e.target.value) : null })}
                placeholder="e.g., -2 (before), 0 (at frost), 2 (after)"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Negative = before frost, Positive = after</p>
            </div>
            <div>
              <Label>Direct Sow Max (weeks relative to last frost)</Label>
              <Input
                type="number"
                value={formData.default_direct_sow_weeks_max ?? ''}
                onChange={(e) => setFormData({ ...formData, default_direct_sow_weeks_max: e.target.value !== '' ? parseInt(e.target.value) : null })}
                placeholder="e.g., 0 (at frost) or 4 (after)"
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grid Planting Rules</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Define how much space this plant type requires in different container types. You can also add <strong>variety-specific overrides</strong> (e.g., cherry tomatoes vs. beefsteak).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plant-type level rules */}
          <h4 className="text-sm font-semibold text-gray-700">Plant Type Rules (default for all varieties)</h4>
          {plantingRules.filter(r => !r.variety_id).length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <p className="text-gray-600 text-sm mb-3">No plant type rules defined yet</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'GROW_BAG', 'CONTAINER'].map(type => (
                  <Button key={type} size="sm" variant="outline" onClick={() => handleAddRule(type)}>
                    + {type.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {plantingRules.filter(r => !r.variety_id).map(rule => (
                <div key={rule.id} className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm text-gray-800">{rule.container_type.replace(/_/g, ' ')}</h4>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                  <RuleFields rule={rule} onUpdate={handleUpdateRule} />
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <p className="text-xs text-gray-500 w-full">Add plant-type rule for:</p>
                {['RAISED_BED', 'IN_GROUND_BED', 'GREENHOUSE', 'GROW_BAG', 'CONTAINER', 'OPEN_PLOT']
                  .filter(type => !plantingRules.find(r => r.container_type === type && !r.variety_id))
                  .map(type => (
                    <Button key={type} size="sm" variant="outline" onClick={() => handleAddRule(type)}>
                      + {type.replace(/_/g, ' ')}
                    </Button>
                  ))}
              </div>
            </div>
          )}

          {/* Variety-specific overrides */}
          <div className="pt-4 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Variety-Specific Overrides</h4>
            <p className="text-xs text-gray-500 mb-3">
              Override spacing for a specific variety (e.g., cherry tomatoes = 1×1, large indeterminate = 2×2).
              These take priority over the plant-type rules above.
            </p>
            {plantingRules.filter(r => r.variety_id).length === 0 ? (
              <p className="text-xs text-gray-400 italic">No variety overrides yet.</p>
            ) : (
              <div className="space-y-3">
                {plantingRules.filter(r => r.variety_id).map(rule => (
                  <div key={rule.id} className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-bold text-blue-700 uppercase">Variety Override</span>
                        <p className="font-semibold text-sm text-gray-800">{rule.variety_name || rule.variety_id} — {rule.container_type.replace(/_/g, ' ')}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                    <RuleFields rule={rule} onUpdate={handleUpdateRule} />
                  </div>
                ))}
              </div>
            )}
            <AddVarietyRuleButton plantTypeId={plantTypeId} onAdded={(newRule) => setPlantingRules(prev => [...prev, newRule])} />
          </div>
        </CardContent>
      </Card>

      {/* ⚠️ Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Delete <strong>ALL varieties</strong> for this plant type from the database.
            Use this when you need to re-import from scratch (e.g., after a bad upsert).
          </p>
          {deletePreview && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
              <p className="font-semibold text-red-800">⚠️ Preview: {deletePreview.would_delete} varieties will be deleted</p>
              {deletePreview.sample?.length > 0 && (
                <p className="text-xs text-red-600 mt-1">Sample: {deletePreview.sample.slice(0, 5).map(v => v.name).join(', ')}{deletePreview.sample.length > 5 ? '...' : ''}</p>
              )}
              <Button
                onClick={() => setDeletePreview(null)}
                variant="ghost" size="sm" className="mt-2 text-gray-500"
              >Cancel</Button>
            </div>
          )}
          <Button
            onClick={handleDeleteAllVarieties}
            disabled={deletingVarieties}
            variant="destructive"
            className="gap-2"
          >
            {deletingVarieties ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {deletePreview ? `⚠️ Confirm Delete ${deletePreview.would_delete} Varieties` : 'Delete All Varieties for This Plant Type'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monetization (Admin Only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Affiliate / Buy Seeds Link 1 (Primary)</Label>
            <Input
              value={formData.buy_seeds_link}
              onChange={(e) => setFormData({ ...formData, buy_seeds_link: e.target.value })}
              placeholder="https://pepperseeds.com/... or affiliate link"
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">Primary "Buy Seeds" button shown to users</p>
          </div>

          <div>
            <Label>Affiliate / Buy Seeds Link 2</Label>
            <Input
              value={formData.affiliate_link2}
              onChange={(e) => setFormData({ ...formData, affiliate_link2: e.target.value })}
              placeholder="https://baker-creek.com/... second vendor"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Affiliate / Buy Seeds Link 3</Label>
            <Input
              value={formData.affiliate_link3}
              onChange={(e) => setFormData({ ...formData, affiliate_link3: e.target.value })}
              placeholder="https://trueleafmarket.com/... third vendor"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Notes (Internal)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Internal notes about this plant type..."
              className="mt-2"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}