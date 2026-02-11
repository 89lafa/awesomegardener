import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AddIndoorPlant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const spaceId = searchParams.get('spaceId');
  const varietyId = searchParams.get('varietyId');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [isCustomVariety, setIsCustomVariety] = useState(false);
  const [customVarietyName, setCustomVarietyName] = useState('');

  const [formData, setFormData] = useState({
    variety_id: '',
    nickname: '',
    acquisition_date: new Date().toISOString().split('T')[0],
    acquisition_source: 'purchased',
    acquired_from: '',
    purchase_price: '',
    indoor_space_id: spaceId || '',
    tier_id: '',
    grid_position_x: '',
    grid_position_y: '',
    pot_type: 'plastic',
    pot_size_inches: '',
    soil_type: 'potting_soil_general',
    has_drainage: true,
    watering_frequency_days: '',
    health_status: 'healthy',
    special_notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.indoor_space_id) {
      loadTiers(formData.indoor_space_id);
    }
  }, [formData.indoor_space_id]);

  const loadData = async () => {
    try {
      const [spacesData, varietiesData, plantTypesData] = await Promise.all([
        base44.entities.IndoorSpace.filter({ is_active: true }),
        base44.entities.Variety.list('variety_name', 5000),
        base44.entities.PlantType.list('common_name', 500)
      ]);

      setSpaces(spacesData);
      
      const indoorPlantTypes = plantTypesData.filter(pt => 
        pt.category === 'flower' || 
        pt.common_name?.toLowerCase().includes('aloe') ||
        pt.common_name?.toLowerCase().includes('succulent') ||
        pt.common_name?.toLowerCase().includes('cactus') ||
        pt.common_name?.toLowerCase().includes('fern') ||
        pt.common_name?.toLowerCase().includes('palm') ||
        pt.common_name?.toLowerCase().includes('orchid') ||
        pt.common_name?.toLowerCase().includes('philodendron') ||
        pt.common_name?.toLowerCase().includes('pothos') ||
        pt.common_name?.toLowerCase().includes('monstera') ||
        pt.common_name?.toLowerCase().includes('snake plant') ||
        pt.common_name?.toLowerCase().includes('spider plant') ||
        pt.common_name?.toLowerCase().includes('jade') ||
        pt.common_name?.toLowerCase().includes('peace lily') ||
        pt.common_name?.toLowerCase().includes('rubber') ||
        pt.common_name?.toLowerCase().includes('ivy')
      );
      
      const indoorTypeIds = indoorPlantTypes.map(pt => pt.id);
      const indoorVarieties = varietiesData.filter(v => indoorTypeIds.includes(v.plant_type_id));
      
      setVarieties(indoorVarieties);
      setPlantTypes(indoorPlantTypes);

      if (spaceId && spacesData.length > 0) {
        const space = spacesData.find(s => s.id === spaceId);
        if (space) {
          setFormData(prev => ({ ...prev, indoor_space_id: space.id }));
        }
      }

      if (varietyId) {
        setFormData(prev => ({ ...prev, variety_id: varietyId }));
        const selectedVariety = varietiesData.find(v => v.id === varietyId);
        if (selectedVariety) {
          setSearchQuery(selectedVariety.variety_name);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async (spaceId) => {
    try {
      const tiersData = await base44.entities.IndoorSpaceTier.filter(
        { indoor_space_id: spaceId },
        'tier_number'
      );
      setTiers(tiersData);
    } catch (error) {
      console.error('Error loading tiers:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: check if custom variety needs name
    if (isCustomVariety && !customVarietyName.trim()) {
      toast.error('Please enter a custom variety name');
      return;
    }
    
    if (!isCustomVariety && !formData.variety_id) {
      toast.error('Please select a plant variety');
      return;
    }
    
    if (!formData.acquisition_date || !formData.indoor_space_id) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      let varietyIdToUse = formData.variety_id;
      
      // Create custom variety if needed
      if (isCustomVariety && selectedPlantType) {
        const customVariety = await base44.entities.Variety.create({
          plant_type_id: selectedPlantType,
          variety_name: customVarietyName.trim(),
          is_custom: true,
          status: 'active'
        });
        varietyIdToUse = customVariety.id;
        toast.success(`Custom variety "${customVarietyName}" created!`);
      }

      const plantData = {
        ...formData,
        variety_id: varietyIdToUse,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        pot_size_inches: formData.pot_size_inches ? parseFloat(formData.pot_size_inches) : null,
        watering_frequency_days: formData.watering_frequency_days ? parseInt(formData.watering_frequency_days) : null,
        grid_position_x: formData.grid_position_x !== '' ? parseInt(formData.grid_position_x) : null,
        grid_position_y: formData.grid_position_y !== '' ? parseInt(formData.grid_position_y) : null,
      };

      const newPlant = await base44.entities.IndoorPlant.create(plantData);
      toast.success('Plant added successfully!');
      
      // Navigate IMMEDIATELY without delay
      if (spaceId) {
        window.location.href = createPageUrl('IndoorSpaceDetail') + `?id=${spaceId}`;
      } else {
        window.location.href = createPageUrl('MyIndoorPlants');
      }
    } catch (error) {
      console.error('Error adding plant:', error);
      toast.error('Failed to add plant');
    } finally {
      setSaving(false);
    }
  };

  const filteredVarieties = searchQuery 
    ? varieties.filter(v => 
        v.variety_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.plant_type_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : varieties;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(spaceId ? createPageUrl('IndoorSpaceDetail') + `?id=${spaceId}` : createPageUrl('MyIndoorPlants'))}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Add New Indoor Plant</h1>
          <p className="text-sm text-gray-500">Add a plant to your indoor collection</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Variety */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Plant Variety</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Plant Type Selector */}
            <div>
              <Label>Plant Type *</Label>
              <Select 
                value={selectedPlantType} 
                onValueChange={(v) => {
                  setSelectedPlantType(v);
                  setFormData({ ...formData, variety_id: '' });
                  setIsCustomVariety(false);
                  setCustomVarietyName('');
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select plant type first" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {plantTypes.map(pt => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.icon && `${pt.icon} `}{pt.common_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlantType && (
              <>
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <input
                    type="checkbox"
                    id="customVariety"
                    checked={isCustomVariety}
                    onChange={(e) => {
                      setIsCustomVariety(e.target.checked);
                      if (e.target.checked) {
                        setFormData({ ...formData, variety_id: '' });
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="customVariety" className="cursor-pointer">
                    This is a custom variety not in our catalog
                  </Label>
                </div>

                {isCustomVariety ? (
                  <div>
                    <Label>Custom Variety Name *</Label>
                    <Input
                      placeholder="Enter the variety name"
                      value={customVarietyName}
                      onChange={(e) => setCustomVarietyName(e.target.value)}
                      className="mt-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll create this variety for you
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Search Varieties</Label>
                      <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search by name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Plant Variety *</Label>
                      <Select value={formData.variety_id} onValueChange={(v) => setFormData({ ...formData, variety_id: v })}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select variety" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {filteredVarieties.filter(v => v.plant_type_id === selectedPlantType).length === 0 ? (
                            <SelectItem value="no-results" disabled>
                              No matching varieties found
                            </SelectItem>
                          ) : (
                            filteredVarieties.filter(v => v.plant_type_id === selectedPlantType).map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.variety_name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {filteredVarieties.filter(v => v.plant_type_id === selectedPlantType).length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          No varieties found for this type. Check "Custom variety" above to add your own.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            <div>
              <Label>Nickname (optional)</Label>
              <Input
                placeholder="e.g., Monica, Fred, Spike"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Acquisition Details */}
        <Card>
          <CardHeader>
            <CardTitle>2. Acquisition Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Acquisition Date *</Label>
              <Input
                type="date"
                value={formData.acquisition_date}
                onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Source</Label>
              <Select value={formData.acquisition_source} onValueChange={(v) => setFormData({ ...formData, acquisition_source: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchased">Purchased</SelectItem>
                  <SelectItem value="gift">Gift</SelectItem>
                  <SelectItem value="propagation">Propagation</SelectItem>
                  <SelectItem value="rescued">Rescued</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Acquired From</Label>
                <Input
                  placeholder="Store name, person..."
                  value={formData.acquired_from}
                  onChange={(e) => setFormData({ ...formData, acquired_from: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Location */}
        <Card>
          <CardHeader>
            <CardTitle>3. Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Space *</Label>
              <Select value={formData.indoor_space_id} onValueChange={(v) => setFormData({ ...formData, indoor_space_id: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tiers.length > 0 && (
              <div>
                <Label>Tier/Shelf (optional)</Label>
                <Select value={formData.tier_id} onValueChange={(v) => setFormData({ ...formData, tier_id: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label || `Tier ${t.tier_number}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.tier_id && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Grid Position X (column)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={(tiers.find(t => t.id === formData.tier_id)?.grid_columns || 4) - 1}
                    placeholder="0"
                    value={formData.grid_position_x}
                    onChange={(e) => setFormData({ ...formData, grid_position_x: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = leftmost, {(tiers.find(t => t.id === formData.tier_id)?.grid_columns || 4) - 1} = rightmost</p>
                </div>
                <div>
                  <Label>Grid Position Y (row)</Label>
                  <Input
                    type="number"
                    min="0"
                    max={(tiers.find(t => t.id === formData.tier_id)?.grid_rows || 2) - 1}
                    placeholder="0"
                    value={formData.grid_position_y}
                    onChange={(e) => setFormData({ ...formData, grid_position_y: e.target.value })}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = front, {(tiers.find(t => t.id === formData.tier_id)?.grid_rows || 2) - 1} = back</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Container & Care */}
        <Card>
          <CardHeader>
            <CardTitle>4. Container & Care</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pot Type</Label>
                <Select value={formData.pot_type} onValueChange={(v) => setFormData({ ...formData, pot_type: v })}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ceramic">Ceramic</SelectItem>
                    <SelectItem value="plastic">Plastic</SelectItem>
                    <SelectItem value="terracotta">Terracotta</SelectItem>
                    <SelectItem value="self_watering">Self-Watering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pot Size (inches)</Label>
                <Input
                  type="number"
                  placeholder="6"
                  value={formData.pot_size_inches}
                  onChange={(e) => setFormData({ ...formData, pot_size_inches: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Soil Type</Label>
              <Select value={formData.soil_type} onValueChange={(v) => setFormData({ ...formData, soil_type: v })}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="potting_soil_general">General Potting Soil</SelectItem>
                  <SelectItem value="tropical_mix">Tropical Mix</SelectItem>
                  <SelectItem value="cactus_mix">Cactus/Succulent Mix</SelectItem>
                  <SelectItem value="orchid_bark">Orchid Bark</SelectItem>
                  <SelectItem value="custom_mix">Custom Mix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Watering Frequency (days)</Label>
              <Input
                type="number"
                placeholder="7"
                value={formData.watering_frequency_days}
                onChange={(e) => setFormData({ ...formData, watering_frequency_days: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">How often does this plant need water?</p>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Special care instructions, observations..."
                value={formData.special_notes}
                onChange={(e) => setFormData({ ...formData, special_notes: e.target.value })}
                rows={4}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(spaceId ? createPageUrl('IndoorSpaceDetail') + `?id=${spaceId}` : createPageUrl('MyIndoorPlants'))}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || (!isCustomVariety && !formData.variety_id) || (isCustomVariety && !customVarietyName.trim()) || !formData.acquisition_date || !formData.indoor_space_id}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add Plant
          </Button>
        </div>
      </form>
    </div>
  );
}