import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

export default function ComprehensiveVarietyForm({ formData, setFormData, subCategories }) {
  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="basic">Basic</TabsTrigger>
        <TabsTrigger value="growing">Growing</TabsTrigger>
        <TabsTrigger value="indoor">Indoor</TabsTrigger>
        <TabsTrigger value="traits">Traits</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>

      <ScrollArea className="h-[500px] mt-4">
        <div className="pr-4">
          <TabsContent value="basic" className="space-y-4">
            <div>
              <Label>Variety Name *</Label>
              <Input
                value={formData.variety_name || ''}
                onChange={(e) => setFormData({ ...formData, variety_name: e.target.value })}
                placeholder="e.g., Cherokee Purple"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description..."
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Synonyms (comma-separated)</Label>
              <Input
                value={Array.isArray(formData.synonyms) ? formData.synonyms.join(', ') : formData.synonyms || ''}
                onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                placeholder="e.g., Purple Cherokee, Cherokee"
                className="mt-2"
              />
            </div>

            {subCategories?.length > 0 && (
              <div>
                <Label>Sub-Category</Label>
                <Select 
                  value={formData.plant_subcategory_id || ''} 
                  onValueChange={(v) => setFormData({ ...formData, plant_subcategory_id: v || null })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map(sc => (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.icon} {sc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Variety Code</Label>
                <Input
                  value={formData.variety_code || ''}
                  onChange={(e) => setFormData({ ...formData, variety_code: e.target.value })}
                  placeholder="VAR_CODE"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  value={formData.status || 'active'} 
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="removed">Removed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="growing" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Days to Maturity</Label>
                <Input
                  type="number"
                  value={formData.days_to_maturity || ''}
                  onChange={(e) => setFormData({ ...formData, days_to_maturity: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>DTM Range (Min-Max)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.days_to_maturity_min || ''}
                    onChange={(e) => setFormData({ ...formData, days_to_maturity_min: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.days_to_maturity_max || ''}
                    onChange={(e) => setFormData({ ...formData, days_to_maturity_max: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Spacing (in)</Label>
                <Input
                  type="number"
                  value={formData.spacing_recommended || ''}
                  onChange={(e) => setFormData({ ...formData, spacing_recommended: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Spacing Min</Label>
                <Input
                  type="number"
                  value={formData.spacing_min || ''}
                  onChange={(e) => setFormData({ ...formData, spacing_min: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Spacing Max</Label>
                <Input
                  type="number"
                  value={formData.spacing_max || ''}
                  onChange={(e) => setFormData({ ...formData, spacing_max: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Plant Height</Label>
              <Input
                value={formData.plant_height_typical || ''}
                onChange={(e) => setFormData({ ...formData, plant_height_typical: e.target.value })}
                placeholder="e.g., 4-6 feet"
                className="mt-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Height Min (in)</Label>
                <Input
                  type="number"
                  value={formData.height_min || ''}
                  onChange={(e) => setFormData({ ...formData, height_min: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Height Max (in)</Label>
                <Input
                  type="number"
                  value={formData.height_max || ''}
                  onChange={(e) => setFormData({ ...formData, height_max: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sun Requirement</Label>
                <Select 
                  value={formData.sun_requirement || ''} 
                  onValueChange={(v) => setFormData({ ...formData, sun_requirement: v })}
                >
                  <SelectTrigger className="mt-2">
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
                <Label>Water Requirement</Label>
                <Select 
                  value={formData.water_requirement || ''} 
                  onValueChange={(v) => setFormData({ ...formData, water_requirement: v })}
                >
                  <SelectTrigger className="mt-2">
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

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.trellis_required || false}
                  onCheckedChange={(v) => setFormData({ ...formData, trellis_required: v })}
                />
                <Label>Trellis Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.container_friendly || false}
                  onCheckedChange={(v) => setFormData({ ...formData, container_friendly: v })}
                />
                <Label>Container Friendly</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.is_ornamental || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_ornamental: v })}
                />
                <Label>Ornamental</Label>
              </div>
            </div>

            <div>
              <Label>Growth Habit</Label>
              <Input
                value={formData.growth_habit || ''}
                onChange={(e) => setFormData({ ...formData, growth_habit: e.target.value })}
                placeholder="e.g., determinate, indeterminate, bush"
                className="mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="indoor" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Light Requirement Indoor</Label>
                <Select 
                  value={formData.light_requirement_indoor || ''} 
                  onValueChange={(v) => setFormData({ ...formData, light_requirement_indoor: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium_indirect">Medium Indirect</SelectItem>
                    <SelectItem value="bright_indirect">Bright Indirect</SelectItem>
                    <SelectItem value="bright_direct">Bright Direct</SelectItem>
                    <SelectItem value="full_sun">Full Sun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Humidity Preference</Label>
                <Select 
                  value={formData.humidity_preference || ''} 
                  onValueChange={(v) => setFormData({ ...formData, humidity_preference: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="very_high">Very High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Temperature Min (°F)</Label>
                <Input
                  type="number"
                  value={formData.temp_min_f || ''}
                  onChange={(e) => setFormData({ ...formData, temp_min_f: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Temperature Max (°F)</Label>
                <Input
                  type="number"
                  value={formData.temp_max_f || ''}
                  onChange={(e) => setFormData({ ...formData, temp_max_f: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.toxic_to_cats || false}
                  onCheckedChange={(v) => setFormData({ ...formData, toxic_to_cats: v })}
                />
                <Label>Toxic to Cats</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.toxic_to_dogs || false}
                  onCheckedChange={(v) => setFormData({ ...formData, toxic_to_dogs: v })}
                />
                <Label>Toxic to Dogs</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData.air_purifying || false}
                  onCheckedChange={(v) => setFormData({ ...formData, air_purifying: v })}
                />
                <Label>Air Purifying</Label>
              </div>
            </div>

            <div>
              <Label>Watering Frequency Range</Label>
              <Select 
                value={formData.watering_frequency_range || ''} 
                onValueChange={(v) => setFormData({ ...formData, watering_frequency_range: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3-5_days">3-5 days</SelectItem>
                  <SelectItem value="7-10_days">7-10 days</SelectItem>
                  <SelectItem value="14-21_days">14-21 days</SelectItem>
                  <SelectItem value="21-30_days">21-30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Soil Type Recommended</Label>
              <Select 
                value={formData.soil_type_recommended || ''} 
                onValueChange={(v) => setFormData({ ...formData, soil_type_recommended: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_purpose">All Purpose</SelectItem>
                  <SelectItem value="chunky_aroid">Chunky Aroid</SelectItem>
                  <SelectItem value="cactus_succulent">Cactus/Succulent</SelectItem>
                  <SelectItem value="orchid_bark">Orchid Bark</SelectItem>
                  <SelectItem value="peat_perlite">Peat/Perlite</SelectItem>
                  <SelectItem value="carnivorous_mix">Carnivorous Mix</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="growing" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Indoors (weeks before frost)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.start_indoors_weeks_min || ''}
                    onChange={(e) => setFormData({ ...formData, start_indoors_weeks_min: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.start_indoors_weeks_max || ''}
                    onChange={(e) => setFormData({ ...formData, start_indoors_weeks_max: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Transplant (weeks after frost)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={formData.transplant_weeks_after_last_frost_min || ''}
                    onChange={(e) => setFormData({ ...formData, transplant_weeks_after_last_frost_min: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={formData.transplant_weeks_after_last_frost_max || ''}
                    onChange={(e) => setFormData({ ...formData, transplant_weeks_after_last_frost_max: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Direct Sow Min (weeks)</Label>
                <Input
                  type="number"
                  value={formData.direct_sow_weeks_min || ''}
                  onChange={(e) => setFormData({ ...formData, direct_sow_weeks_min: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Direct Sow Max (weeks)</Label>
                <Input
                  type="number"
                  value={formData.direct_sow_weeks_max || ''}
                  onChange={(e) => setFormData({ ...formData, direct_sow_weeks_max: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Species</Label>
                <Input
                  value={formData.species || ''}
                  onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                  placeholder="e.g., annuum, chinense"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Seed Line Type</Label>
                <Select 
                  value={formData.seed_line_type || ''} 
                  onValueChange={(v) => setFormData({ ...formData, seed_line_type: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heirloom">Heirloom</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="open_pollinated">Open-Pollinated</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Season Timing</Label>
                <Select 
                  value={formData.season_timing || ''} 
                  onValueChange={(v) => setFormData({ ...formData, season_timing: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="early">Early</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Checkbox
                  checked={formData.is_organic || false}
                  onCheckedChange={(v) => setFormData({ ...formData, is_organic: v })}
                />
                <Label>Certified Organic</Label>
              </div>
            </div>

            <div>
              <Label>Grower Notes</Label>
              <Textarea
                value={formData.grower_notes || ''}
                onChange={(e) => setFormData({ ...formData, grower_notes: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="traits" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Flavor Profile</Label>
                <Input
                  value={formData.flavor_profile || ''}
                  onChange={(e) => setFormData({ ...formData, flavor_profile: e.target.value })}
                  placeholder="e.g., Sweet and tangy"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Uses</Label>
                <Input
                  value={formData.uses || ''}
                  onChange={(e) => setFormData({ ...formData, uses: e.target.value })}
                  placeholder="e.g., Fresh, canning"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Fruit Color</Label>
                <Input
                  value={formData.fruit_color || ''}
                  onChange={(e) => setFormData({ ...formData, fruit_color: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Fruit Shape</Label>
                <Input
                  value={formData.fruit_shape || ''}
                  onChange={(e) => setFormData({ ...formData, fruit_shape: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Fruit Size</Label>
                <Input
                  value={formData.fruit_size || ''}
                  onChange={(e) => setFormData({ ...formData, fruit_size: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scoville Min</Label>
                <Input
                  type="number"
                  value={formData.scoville_min || formData.heat_scoville_min || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scoville_min: e.target.value,
                    heat_scoville_min: e.target.value 
                  })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Scoville Max</Label>
                <Input
                  type="number"
                  value={formData.scoville_max || formData.heat_scoville_max || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    scoville_max: e.target.value,
                    heat_scoville_max: e.target.value 
                  })}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Pod Color</Label>
                <Input
                  value={formData.pod_color || ''}
                  onChange={(e) => setFormData({ ...formData, pod_color: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Pod Shape</Label>
                <Input
                  value={formData.pod_shape || ''}
                  onChange={(e) => setFormData({ ...formData, pod_shape: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Pod Size</Label>
                <Input
                  value={formData.pod_size || ''}
                  onChange={(e) => setFormData({ ...formData, pod_size: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Disease Resistance</Label>
              <Input
                value={formData.disease_resistance || ''}
                onChange={(e) => setFormData({ ...formData, disease_resistance: e.target.value })}
                placeholder="e.g., TMV, TSWV resistant"
                className="mt-2"
              />
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Breeder/Origin</Label>
                <Input
                  value={formData.breeder_or_origin || ''}
                  onChange={(e) => setFormData({ ...formData, breeder_or_origin: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Popularity Tier</Label>
                <Select 
                  value={formData.popularity_tier || ''} 
                  onValueChange={(v) => setFormData({ ...formData, popularity_tier: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="popular">Popular</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="heirloom">Heirloom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Seed Saving Notes</Label>
              <Textarea
                value={formData.seed_saving_notes || ''}
                onChange={(e) => setFormData({ ...formData, seed_saving_notes: e.target.value })}
                rows={3}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Pollination Notes</Label>
              <Textarea
                value={formData.pollination_notes || ''}
                onChange={(e) => setFormData({ ...formData, pollination_notes: e.target.value })}
                rows={2}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Sources (pipe-separated)</Label>
              <Input
                value={Array.isArray(formData.sources) ? formData.sources.join(' | ') : formData.sources || ''}
                onChange={(e) => setFormData({ ...formData, sources: e.target.value })}
                placeholder="Vendor1 | Vendor2"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Affiliate/Buy Seeds URL</Label>
              <Input
                type="url"
                value={formData.affiliate_url || ''}
                onChange={(e) => setFormData({ ...formData, affiliate_url: e.target.value })}
                placeholder="https://..."
                className="mt-2"
              />
            </div>

            <div>
              <Label>Source Attribution</Label>
              <Input
                value={formData.source_attribution || ''}
                onChange={(e) => setFormData({ ...formData, source_attribution: e.target.value })}
                placeholder="Data source attribution"
                className="mt-2"
              />
            </div>
          </TabsContent>
        </div>
      </ScrollArea>
    </Tabs>
  );
}