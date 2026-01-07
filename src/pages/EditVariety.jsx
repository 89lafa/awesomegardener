import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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

export default function EditVariety() {
  const [searchParams] = useSearchParams();
  const varietyId = searchParams.get('id');
  const navigate = useNavigate();
  
  const [variety, setVariety] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [subCategories, setSubCategories] = useState([]);
  const [plantType, setPlantType] = useState(null);

  useEffect(() => {
    checkAccess();
  }, [varietyId]);

  const checkAccess = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        // Non-admin cannot edit - redirect to view
        window.location.href = createPageUrl('ViewVariety') + `?id=${varietyId}`;
        return;
      }
      
      if (varietyId) {
        loadVariety();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Access check failed:', error);
      window.location.href = createPageUrl('PlantCatalog');
    }
  };

  const loadVariety = async () => {
    try {
      const varieties = await base44.entities.Variety.filter({ id: varietyId });
      if (varieties.length > 0) {
        const v = varieties[0];
        setVariety(v);
        
        // Load plant type and subcategories
        if (v.plant_type_id) {
          const [typeData, subcats, subcatMaps] = await Promise.all([
            base44.entities.PlantType.filter({ id: v.plant_type_id }),
            base44.entities.PlantSubCategory.filter({ 
              plant_type_id: v.plant_type_id,
              is_active: true 
            }, 'sort_order'),
            base44.entities.VarietySubCategoryMap.filter({ variety_id: varietyId })
          ]);
          
          if (typeData.length > 0) setPlantType(typeData[0]);
          
          // Deduplicate subcategories by name
          const uniqueSubcats = [];
          const seen = new Set();
          for (const subcat of subcats) {
            if (!seen.has(subcat.name)) {
              seen.add(subcat.name);
              uniqueSubcats.push(subcat);
            }
          }
          setSubCategories(uniqueSubcats);
          
          // Load existing subcategory mapping
          const existingSubcatId = v.plant_subcategory_id || (subcatMaps.length > 0 ? subcatMaps[0].plant_subcategory_id : '');
          setFormData({ ...v, plant_subcategory_id: existingSubcatId });
        } else {
          setFormData(v);
        }
      }
    } catch (error) {
      console.error('Error loading variety:', error);
      toast.error('Failed to load variety');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        variety_name: formData.variety_name,
        plant_subcategory_id: formData.plant_subcategory_id || null,
        days_to_maturity: formData.days_to_maturity ? parseFloat(formData.days_to_maturity) : null,
        spacing_recommended: formData.spacing_recommended ? parseFloat(formData.spacing_recommended) : null,
        plant_height_typical: formData.plant_height_typical,
        sun_requirement: formData.sun_requirement,
        water_requirement: formData.water_requirement,
        trellis_required: formData.trellis_required,
        container_friendly: formData.container_friendly,
        grower_notes: formData.grower_notes,
        heat_scoville_min: formData.heat_scoville_min ? parseFloat(formData.heat_scoville_min) : null,
        heat_scoville_max: formData.heat_scoville_max ? parseFloat(formData.heat_scoville_max) : null,
        affiliate_url: formData.affiliate_url || null
      };

      await base44.entities.Variety.update(varietyId, updateData);

      // Always update VarietySubCategoryMap to ensure consistency
      const oldMaps = await base44.entities.VarietySubCategoryMap.filter({ variety_id: varietyId });
      for (const map of oldMaps) {
        await base44.entities.VarietySubCategoryMap.delete(map.id);
      }
      
      if (formData.plant_subcategory_id) {
        await base44.entities.VarietySubCategoryMap.create({
          variety_id: varietyId,
          plant_subcategory_id: formData.plant_subcategory_id
        });
      }

      toast.success('Variety updated successfully!');
      navigate(-1);
    } catch (error) {
      console.error('Error updating variety:', error);
      toast.error('Failed to update variety');
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

  if (!variety) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Variety Not Found</h2>
        <Link to={createPageUrl('PlantCatalog')}>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Back to Catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Variety</h1>
          <p className="text-gray-600">{variety.plant_type_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Variety Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="variety_name">Variety Name *</Label>
              <Input
                id="variety_name"
                value={formData.variety_name || ''}
                onChange={(e) => setFormData({ ...formData, variety_name: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            {subCategories.length > 0 && (
              <div>
                <Label htmlFor="subcategory">Type/Subcategory</Label>
                <Select 
                  value={formData.plant_subcategory_id || ''} 
                  onValueChange={(v) => setFormData({ ...formData, plant_subcategory_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {subCategories.map((subcat) => (
                      <SelectItem key={subcat.id} value={subcat.id}>
                        {subcat.icon && <span className="mr-2">{subcat.icon}</span>}
                        {subcat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="days_to_maturity">Days to Maturity</Label>
                <Input
                  id="days_to_maturity"
                  type="number"
                  value={formData.days_to_maturity || ''}
                  onChange={(e) => setFormData({ ...formData, days_to_maturity: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="spacing_recommended">Spacing (inches)</Label>
                <Input
                  id="spacing_recommended"
                  type="number"
                  value={formData.spacing_recommended || ''}
                  onChange={(e) => setFormData({ ...formData, spacing_recommended: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="scoville_min">Scoville Min (peppers)</Label>
                <Input
                  id="scoville_min"
                  type="number"
                  value={formData.heat_scoville_min || ''}
                  onChange={(e) => setFormData({ ...formData, heat_scoville_min: e.target.value })}
                  placeholder="e.g., 1000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="scoville_max">Scoville Max</Label>
                <Input
                  id="scoville_max"
                  type="number"
                  value={formData.heat_scoville_max || ''}
                  onChange={(e) => setFormData({ ...formData, heat_scoville_max: e.target.value })}
                  placeholder="e.g., 5000"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="plant_height_typical">Typical Height</Label>
              <Input
                id="plant_height_typical"
                value={formData.plant_height_typical || ''}
                onChange={(e) => setFormData({ ...formData, plant_height_typical: e.target.value })}
                placeholder="e.g., 4-6 feet"
                className="mt-1"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sun_requirement">Sun Requirement</Label>
                <Select 
                  value={formData.sun_requirement || ''} 
                  onValueChange={(v) => setFormData({ ...formData, sun_requirement: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
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
                <Label htmlFor="water_requirement">Water Requirement</Label>
                <Select 
                  value={formData.water_requirement || ''} 
                  onValueChange={(v) => setFormData({ ...formData, water_requirement: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="trellis_required">Needs Trellis?</Label>
                <Select 
                  value={formData.trellis_required ? 'yes' : 'no'} 
                  onValueChange={(v) => setFormData({ ...formData, trellis_required: v === 'yes' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="container_friendly">Container Friendly?</Label>
                <Select 
                  value={formData.container_friendly ? 'yes' : 'no'} 
                  onValueChange={(v) => setFormData({ ...formData, container_friendly: v === 'yes' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="grower_notes">Grower Notes</Label>
              <Textarea
                id="grower_notes"
                value={formData.grower_notes || ''}
                onChange={(e) => setFormData({ ...formData, grower_notes: e.target.value })}
                rows={4}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="affiliate_url">Affiliate/Buy Seeds Link (Admin Only)</Label>
              <Input
                id="affiliate_url"
                type="url"
                value={formData.affiliate_url || ''}
                onChange={(e) => setFormData({ ...formData, affiliate_url: e.target.value })}
                placeholder="https://..."
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                This link will appear as a "Buy Seeds" button on the variety page
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}