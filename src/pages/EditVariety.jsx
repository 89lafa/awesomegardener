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
  const [user, setUser] = useState(null);
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
      setUser(userData);
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
              plant_type_id: v.plant_type_id
              // Admins can see all subcategories including inactive ones
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
          
          // Migrate to multi-subcategory if needed
          let subcatIds = v.plant_subcategory_ids || [];
          if (subcatIds.length === 0 && v.plant_subcategory_id) {
            subcatIds = [v.plant_subcategory_id];
          }
          
          setFormData({ ...v, plant_subcategory_ids: subcatIds });
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
      // Ensure plant_subcategory_id is in plant_subcategory_ids
      let selectedIds = formData.plant_subcategory_ids || [];
      let primaryId = formData.plant_subcategory_id;

      // CRITICAL: Ensure primary is in array
      if (primaryId && !selectedIds.includes(primaryId)) {
        selectedIds = [primaryId, ...selectedIds];
      }

      // If array is not empty but primary is null, set primary to first
      if (selectedIds.length > 0 && !primaryId) {
        primaryId = selectedIds[0];
      }

      const scovilleMin = formData.scoville_min || formData.heat_scoville_min;
      const scovilleMax = formData.scoville_max || formData.heat_scoville_max;

      console.log('[EditVariety] Saving subcategories:', {
        primary: primaryId,
        array: selectedIds,
        variety: formData.variety_name
      });

      // Build update object - only include non-empty values to avoid wiping data
      const updateData = {
        variety_name: formData.variety_name,
        plant_subcategory_id: primaryId || null,
        plant_subcategory_ids: selectedIds
      };
      
      // Only update fields if they have values
      if (formData.description) updateData.description = formData.description;
      if (formData.days_to_maturity) updateData.days_to_maturity = parseFloat(formData.days_to_maturity);
      if (formData.spacing_recommended) updateData.spacing_recommended = parseFloat(formData.spacing_recommended);
      if (formData.plant_height_typical) updateData.plant_height_typical = formData.plant_height_typical;
      if (formData.sun_requirement) updateData.sun_requirement = formData.sun_requirement;
      if (formData.water_requirement) updateData.water_requirement = formData.water_requirement;
      if (formData.growth_habit) updateData.growth_habit = formData.growth_habit;
      if (formData.species) updateData.species = formData.species;
      if (formData.seed_line_type) updateData.seed_line_type = formData.seed_line_type;
      if (formData.season_timing) updateData.season_timing = formData.season_timing;
      if (formData.grower_notes) updateData.grower_notes = formData.grower_notes;
      if (formData.affiliate_url) updateData.affiliate_url = formData.affiliate_url;
      if (formData.images) updateData.images = formData.images;
      if (scovilleMin) updateData.scoville_min = parseFloat(scovilleMin);
      if (scovilleMax) updateData.scoville_max = parseFloat(scovilleMax);
      if (scovilleMin) updateData.heat_scoville_min = parseFloat(scovilleMin);
      if (scovilleMax) updateData.heat_scoville_max = parseFloat(scovilleMax);
      
      updateData.trellis_required = formData.trellis_required || false;
      updateData.container_friendly = formData.container_friendly || false;
      updateData.is_ornamental = formData.is_ornamental || false;
      updateData.is_organic = formData.is_organic || false;

      // Remove old approach
      const oldUpdateData = {
      };

      // Log the edit
      await base44.entities.AuditLog.create({
        action_type: 'variety_update',
        entity_type: 'Variety',
        entity_id: varietyId,
        entity_name: formData.variety_name,
        action_details: { fields_updated: Object.keys(updateData) },
        user_role: user.role
      });

      await base44.entities.Variety.update(varietyId, updateData);

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
                <Label>Categories (multi-select)</Label>
                <div className="mt-2 p-3 border rounded-lg max-h-64 overflow-y-auto space-y-3">
                  {(() => {
                    const grouped = {};
                    subCategories.forEach(s => {
                      const dim = s.dimension || 'Other';
                      if (!grouped[dim]) grouped[dim] = [];
                      grouped[dim].push(s);
                    });
                    
                    return Object.entries(grouped).map(([dimension, subcats]) => (
                      <div key={dimension} className="space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase">{dimension}</p>
                        <div className="flex flex-wrap gap-2">
                          {subcats.map(subcat => {
                            const isSelected = (formData.plant_subcategory_ids || []).includes(subcat.id);
                            const isPrimary = formData.plant_subcategory_id === subcat.id;
                            return (
                              <Button
                                key={subcat.id}
                                type="button"
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                onClick={() => {
                                  const currentIds = formData.plant_subcategory_ids || [];
                                  let newIds;
                                  if (isSelected) {
                                    newIds = currentIds.filter(id => id !== subcat.id);
                                    if (isPrimary) {
                                      setFormData({ 
                                        ...formData, 
                                        plant_subcategory_ids: newIds,
                                        plant_subcategory_id: newIds.length > 0 ? newIds[0] : null
                                      });
                                      return;
                                    }
                                  } else {
                                    newIds = [...currentIds, subcat.id];
                                    if (!formData.plant_subcategory_id && dimension === 'CulinaryUse') {
                                      setFormData({ 
                                        ...formData, 
                                        plant_subcategory_ids: newIds,
                                        plant_subcategory_id: subcat.id
                                      });
                                      return;
                                    }
                                  }
                                  setFormData({ ...formData, plant_subcategory_ids: newIds });
                                }}
                                className={isSelected ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                              >
                                {subcat.icon && <span className="mr-1">{subcat.icon}</span>}
                                {subcat.name}
                                {isPrimary && <span className="ml-1 text-xs">★</span>}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Primary category (★) is used for main classification. Click to toggle selection.
                </p>
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
                  value={formData.scoville_min || formData.heat_scoville_min || ''}
                  onChange={(e) => setFormData({ ...formData, scoville_min: e.target.value, heat_scoville_min: e.target.value })}
                  placeholder="e.g., 1000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="scoville_max">Scoville Max</Label>
                <Input
                  id="scoville_max"
                  type="number"
                  value={formData.scoville_max || formData.heat_scoville_max || ''}
                  onChange={(e) => setFormData({ ...formData, scoville_max: e.target.value, heat_scoville_max: e.target.value })}
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

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="species">Species (botanical)</Label>
                <Select 
                  value={formData.species || ''} 
                  onValueChange={(v) => setFormData({ ...formData, species: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Not specified</SelectItem>
                    <SelectItem value="annuum">Annuum</SelectItem>
                    <SelectItem value="chinense">Chinense</SelectItem>
                    <SelectItem value="baccatum">Baccatum</SelectItem>
                    <SelectItem value="frutescens">Frutescens</SelectItem>
                    <SelectItem value="pubescens">Pubescens</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="seed_line_type">Seed Line Type</Label>
                <Select 
                  value={formData.seed_line_type || ''} 
                  onValueChange={(v) => setFormData({ ...formData, seed_line_type: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Not specified</SelectItem>
                    <SelectItem value="heirloom">Heirloom</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="open_pollinated">Open-Pollinated</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="season_timing">Season Timing</Label>
                <Select 
                  value={formData.season_timing || ''} 
                  onValueChange={(v) => setFormData({ ...formData, season_timing: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Not specified</SelectItem>
                    <SelectItem value="early">Early</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="is_ornamental">Ornamental?</Label>
                <Select 
                  value={formData.is_ornamental ? 'yes' : 'no'} 
                  onValueChange={(v) => setFormData({ ...formData, is_ornamental: v === 'yes' })}
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

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="is_organic">Certified Organic Seeds?</Label>
                <Select 
                  value={formData.is_organic ? 'yes' : 'no'} 
                  onValueChange={(v) => setFormData({ ...formData, is_organic: v === 'yes' })}
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of this variety..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="grower_notes">Grower Notes</Label>
              <Textarea
                id="grower_notes"
                value={formData.grower_notes || ''}
                onChange={(e) => setFormData({ ...formData, grower_notes: e.target.value })}
                placeholder="Community observations, tips, experiences..."
                rows={4}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Images</Label>
              <div className="mt-2 space-y-2">
                {formData.images && formData.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.images.map((url, idx) => (
                      <div key={idx} className="relative w-24 h-24">
                        <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-cover rounded border" />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                          onClick={() => {
                            const newImages = formData.images.filter((_, i) => i !== idx);
                            setFormData({ ...formData, images: newImages });
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('variety-image-upload').click()}
                  className="w-full"
                >
                  + Upload Image
                </Button>
                <input
                  id="variety-image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    
                    for (const file of files) {
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setFormData(prev => ({ ...prev, images: [...(prev.images || []), file_url] }));
                        toast.success('Image uploaded');
                      } catch (error) {
                        console.error('Error uploading image:', error);
                        toast.error('Failed to upload image');
                      }
                    }
                  }}
                />
              </div>
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