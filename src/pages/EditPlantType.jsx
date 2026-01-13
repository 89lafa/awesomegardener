import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    buy_seeds_link: '',
    color: '#10b981'
  });

  useEffect(() => {
    if (plantTypeId) {
      loadPlantType();
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
      setFormData({
        common_name: type.common_name || '',
        scientific_name: type.scientific_name || '',
        description: type.description || '',
        notes: type.notes || '',
        category: type.category || 'vegetable',
        icon: type.icon || '',
        typical_sun: type.typical_sun || 'full_sun',
        typical_water: type.typical_water || 'moderate',
        typical_spacing_min: type.typical_spacing_min || null,
        typical_spacing_max: type.typical_spacing_max || null,
        default_days_to_maturity: type.default_days_to_maturity || null,
        default_start_indoors_weeks: type.default_start_indoors_weeks || null,
        default_transplant_weeks: type.default_transplant_weeks || null,
        default_direct_sow_weeks_min: type.default_direct_sow_weeks_min || null,
        default_direct_sow_weeks_max: type.default_direct_sow_weeks_max || null,
        trellis_common: type.trellis_common || false,
        is_perennial: type.is_perennial || false,
        buy_seeds_link: type.buy_seeds_link || '',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
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
                value={formData.default_start_indoors_weeks || ''}
                onChange={(e) => setFormData({ ...formData, default_start_indoors_weeks: e.target.value ? parseInt(e.target.value) : null })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Transplant (weeks after last frost)</Label>
              <Input
                type="number"
                value={formData.default_transplant_weeks || ''}
                onChange={(e) => setFormData({ ...formData, default_transplant_weeks: e.target.value ? parseInt(e.target.value) : null })}
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Direct Sow Min (weeks relative to last frost)</Label>
              <Input
                type="number"
                value={formData.default_direct_sow_weeks_min || ''}
                onChange={(e) => setFormData({ ...formData, default_direct_sow_weeks_min: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g., -2 (before) or 2 (after)"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Negative = before frost, Positive = after</p>
            </div>
            <div>
              <Label>Direct Sow Max (weeks relative to last frost)</Label>
              <Input
                type="number"
                value={formData.default_direct_sow_weeks_max || ''}
                onChange={(e) => setFormData({ ...formData, default_direct_sow_weeks_max: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g., 4"
                className="mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monetization (Admin Only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Buy Seeds Link</Label>
            <Input
              value={formData.buy_seeds_link}
              onChange={(e) => setFormData({ ...formData, buy_seeds_link: e.target.value })}
              placeholder="https://pepperseeds.com/... or affiliate link"
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will power the "Buy Seeds" button shown to users
            </p>
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