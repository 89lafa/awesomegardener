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
import ComprehensiveVarietyForm from '@/components/variety/ComprehensiveVarietyForm';

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
          
          // Extract species_custom if species is not in enum
          const knownSpecies = ['annuum', 'chinense', 'baccatum', 'frutescens', 'pubescens'];
          const species_custom = v.species && !knownSpecies.includes(v.species) ? v.species : '';
          const species = v.species && knownSpecies.includes(v.species) ? v.species : '';
          
          setFormData({ 
            ...v, 
            species,
            species_custom
          });
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
      const primaryId = formData.plant_subcategory_id;
      
      // Resolve subcategory code from ID
      let primaryCode = null;
      if (primaryId) {
        const subcat = subCategories.find(s => s.id === primaryId);
        primaryCode = subcat?.subcat_code || null;
      }

      const scovilleMin = formData.scoville_min || formData.heat_scoville_min;
      const scovilleMax = formData.scoville_max || formData.heat_scoville_max;

      console.log('[EditVariety] Saving single subcategory (new system):', {
        primary_id: primaryId,
        primary_code: primaryCode,
        variety: formData.variety_name
      });

      // Build update object - write primary ID, sync arrays automatically
      const updateData = {
        variety_name: formData.variety_name,
        plant_subcategory_id: primaryId || null,
        plant_subcategory_ids: primaryId ? [primaryId] : [],
        plant_subcategory_code: primaryCode || null,
        plant_subcategory_codes: primaryCode ? [primaryCode] : []
      };
      
      // Only update fields if they have values
      if (formData.description) updateData.description = formData.description;
      if (formData.days_to_maturity) updateData.days_to_maturity = parseFloat(formData.days_to_maturity);
      if (formData.spacing_recommended) updateData.spacing_recommended = parseFloat(formData.spacing_recommended);
      if (formData.plant_height_typical) updateData.plant_height_typical = formData.plant_height_typical;
      if (formData.sun_requirement) updateData.sun_requirement = formData.sun_requirement;
      if (formData.water_requirement) updateData.water_requirement = formData.water_requirement;
      if (formData.growth_habit) updateData.growth_habit = formData.growth_habit;
      if (formData.flavor_profile) updateData.flavor_profile = formData.flavor_profile;
      if (formData.uses) updateData.uses = formData.uses;
      if (formData.species_custom) {
        updateData.species = formData.species_custom;
      } else if (formData.species) {
        updateData.species = formData.species;
      }
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
          <CardContent>
            <ComprehensiveVarietyForm 
              formData={formData} 
              setFormData={setFormData}
              subCategories={subCategories}
            />
            
            <div className="space-y-4 mt-6 pt-6 border-t">
            <div className="flex gap-3">
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