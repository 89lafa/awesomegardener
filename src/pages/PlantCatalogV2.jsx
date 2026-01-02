import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { 
  Search, 
  Sprout, 
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  ArrowLeft,
  Filter,
  Sun,
  Droplets,
  Ruler,
  Clock,
  Package,
  ListChecks,
  BookOpen,
  Edit,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AdBanner from '@/components/monetization/AdBanner';
import SuggestChangeButton from '@/components/taxonomy/SuggestChangeButton';

export default function PlantCatalogV2() {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [families, setFamilies] = useState([]);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [facetGroups, setFacetGroups] = useState([]);
  const [facets, setFacets] = useState([]);
  const [traitDefinitions, setTraitDefinitions] = useState([]);
  const [traitTemplates, setTraitTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFacets, setActiveFacets] = useState({});

  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVariety, setNewVariety] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [
        userData,
        groupsData,
        familiesData,
        typesData,
        varietiesData,
        facetGroupsData,
        facetsData,
        traitsData,
        templatesData
      ] = await Promise.all([
        base44.auth.me(),
        base44.entities.PlantGroup.list('sort_order'),
        base44.entities.PlantFamily.list('common_name'),
        base44.entities.PlantType.list('common_name'),
        base44.entities.Variety.list('variety_name'),
        base44.entities.FacetGroup.list(),
        base44.entities.Facet.list('sort_order'),
        base44.entities.TraitDefinition.list(),
        base44.entities.PlantTypeTraitTemplate.list()
      ]);

      setUser(userData);
      setGroups(groupsData);
      setFamilies(familiesData);
      setPlantTypes(typesData);
      setVarieties(varietiesData);
      setFacetGroups(facetGroupsData);
      setFacets(facetsData);
      setTraitDefinitions(traitsData);
      setTraitTemplates(templatesData);
    } catch (error) {
      console.error('Error loading catalog data:', error);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = user?.role === 'admin' || user?.is_editor;

  const getFamiliesForGroup = (groupId) => {
    const typeIds = plantTypes.filter(t => t.plant_group_id === groupId).map(t => t.plant_family_id);
    return families.filter(f => typeIds.includes(f.id));
  };

  const getTypesForFamily = (familyId) => {
    return plantTypes.filter(t => t.plant_family_id === familyId);
  };

  const getVarietiesForType = (typeId) => {
    return varieties.filter(v => v.plant_type_id === typeId && v.status === 'active');
  };

  const getTraitsForType = (typeId) => {
    const templates = traitTemplates.filter(t => t.plant_type_id === typeId);
    return templates.map(t => traitDefinitions.find(td => td.id === t.trait_id)).filter(Boolean);
  };

  const getFacetGroupsForType = (typeId) => {
    return facetGroups.filter(fg => 
      fg.applies_to_plant_type_id === typeId || fg.applies_to_plant_type_id === 'ALL'
    );
  };

  const handleAddVariety = async () => {
    if (!selectedType || !newVariety.variety_name) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      if (canEdit) {
        // Direct create
        const variety = await base44.entities.Variety.create({
          plant_type_id: selectedType.id,
          plant_type_name: selectedType.common_name,
          ...newVariety,
          status: 'active'
        });

        await base44.entities.TaxonomyAuditLog.create({
          actor_user_id: user.id,
          actor_email: user.email,
          action: 'CREATE Variety',
          object_type: 'Variety',
          object_id: variety.id,
          after_payload: variety
        });

        setVarieties([...varieties, variety]);
        toast.success('Variety added!');
      } else {
        // Submit for review
        await base44.entities.TaxonomyChangeSuggestion.create({
          object_type: 'Variety',
          change_type: 'CREATE',
          proposed_payload: {
            plant_type_id: selectedType.id,
            plant_type_name: selectedType.common_name,
            ...newVariety
          },
          rationale: `User-submitted new variety: ${newVariety.variety_name}`
        });
        toast.success('Variety submitted for review!');
      }

      setShowAddVariety(false);
      setNewVariety({});
    } catch (error) {
      console.error('Error adding variety:', error);
      toast.error('Failed to add variety');
    }
  };

  const handleAddToSeedStash = async (variety) => {
    try {
      await base44.entities.SeedLot.create({
        plant_type_id: selectedType.id,
        plant_type_name: selectedType.common_name,
        variety_id: variety.id,
        variety_name: variety.variety_name,
        is_wishlist: false
      });
      toast.success('Added to seed stash!');
    } catch (error) {
      console.error('Error adding to stash:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Variety Detail View
  if (selectedVariety) {
    const traits = selectedVariety.traits || {};
    const relevantTraits = getTraitsForType(selectedType.id);

    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedVariety(null)} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to {selectedType?.common_name}
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{selectedVariety.variety_name}</h1>
                <p className="text-gray-600 mt-1">
                  {selectedType?.common_name}
                  {selectedType?.scientific_name && (
                    <span className="italic ml-2">({selectedType.scientific_name})</span>
                  )}
                </p>
              </div>
              {!canEdit && (
                <SuggestChangeButton
                  objectType="Variety"
                  targetId={selectedVariety.id}
                  currentData={selectedVariety}
                  onSuccess={loadData}
                />
              )}
            </div>

            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Growing Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedVariety.days_to_maturity && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-5 h-5 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">Days to Maturity</p>
                      <p className="font-semibold">{selectedVariety.days_to_maturity}</p>
                    </div>
                  )}
                  {selectedVariety.spacing_recommended && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <Ruler className="w-5 h-5 text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">Spacing</p>
                      <p className="font-semibold">{selectedVariety.spacing_recommended}"</p>
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Sun className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Sun</p>
                    <p className="font-semibold capitalize">
                      {selectedVariety.sun_requirement?.replace(/_/g, ' ') || 'Full sun'}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Droplets className="w-5 h-5 text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">Water</p>
                    <p className="font-semibold capitalize">
                      {selectedVariety.water_requirement || 'Moderate'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Traits */}
            {relevantTraits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Variety Traits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {relevantTraits.map((trait) => (
                      <div key={trait.id} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700">{trait.label}</p>
                        <p className="text-gray-900 mt-1">
                          {traits[trait.key] || 'Not specified'}
                          {trait.units && traits[trait.key] && ` ${trait.units}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Grower Notes */}
            {selectedVariety.grower_notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Grower Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{selectedVariety.grower_notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={() => handleAddToSeedStash(selectedVariety)}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <Package className="w-4 h-4" />
                Add to Seed Stash
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <AdBanner 
              placement="side_banner" 
              pageType="catalog"
              plantTypeId={selectedType?.id}
              varietyId={selectedVariety.id}
            />
          </div>
        </div>
      </div>
    );
  }

  // Plant Type Detail View
  if (selectedType) {
    const typeVarieties = getVarietiesForType(selectedType.id);
    const typeTraits = getTraitsForType(selectedType.id);
    const typeFacetGroups = getFacetGroupsForType(selectedType.id);
    const family = families.find(f => f.id === selectedType.plant_family_id);
    const group = groups.find(g => g.id === selectedType.plant_group_id);

    return (
      <div className="space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => { setSelectedType(null); setVarieties([]); }}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{selectedType.common_name}</h1>
            {selectedType.scientific_name && (
              <p className="text-lg text-gray-600 italic mt-1">{selectedType.scientific_name}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {group && <Badge variant="outline">{group.name}</Badge>}
              {family && <Badge variant="outline">{family.common_name}</Badge>}
              {selectedType.is_perennial && <Badge className="bg-blue-100 text-blue-700">Perennial</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {!canEdit && (
              <SuggestChangeButton
                objectType="PlantType"
                targetId={selectedType.id}
                currentData={selectedType}
                onSuccess={loadData}
              />
            )}
            <Button 
              onClick={() => setShowAddVariety(true)}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Variety
            </Button>
          </div>
        </div>

        <AdBanner placement="top_banner" pageType="catalog" plantTypeId={selectedType.id} />

        {/* Traits Available */}
        {typeTraits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Trait Template for Varieties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {typeTraits.map((trait) => (
                  <Badge key={trait.id} variant="outline" className="text-sm">
                    {trait.label}
                    {trait.units && ` (${trait.units})`}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Facet Groups */}
        {typeFacetGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typeFacetGroups.map((fg) => (
                  <div key={fg.id} className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{fg.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {facets.filter(f => f.facet_group_id === fg.id).length} options
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Varieties */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Varieties ({typeVarieties.length})
          </h3>
          {typeVarieties.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Sprout className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No varieties yet</p>
                <Button 
                  onClick={() => setShowAddVariety(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Add First Variety
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typeVarieties.map((variety) => (
                <Card 
                  key={variety.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedVariety(variety)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-gray-900">{variety.variety_name}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {variety.days_to_maturity && (
                        <Badge variant="outline">{variety.days_to_maturity} days</Badge>
                      )}
                      {variety.spacing_recommended && (
                        <Badge variant="outline">{variety.spacing_recommended}" spacing</Badge>
                      )}
                      {variety.is_custom && (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Variety Dialog */}
        <Dialog open={showAddVariety} onOpenChange={setShowAddVariety}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add {selectedType.common_name} Variety</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <Label>Variety Name *</Label>
                  <Input
                    value={newVariety.variety_name || ''}
                    onChange={(e) => setNewVariety({ ...newVariety, variety_name: e.target.value })}
                    className="mt-2"
                  />
                </div>

                {/* Trait Fields */}
                {typeTraits.map((trait) => (
                  <div key={trait.id}>
                    <Label>
                      {trait.label}
                      {trait.units && ` (${trait.units})`}
                    </Label>
                    {trait.data_type === 'enum' ? (
                      <Select
                        value={newVariety[trait.key] || ''}
                        onValueChange={(v) => setNewVariety({ ...newVariety, [trait.key]: v })}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {trait.enum_values?.map((val) => (
                            <SelectItem key={val} value={val}>{val}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : trait.data_type === 'number' || trait.data_type === 'integer' ? (
                      <Input
                        type="number"
                        value={newVariety[trait.key] || ''}
                        onChange={(e) => setNewVariety({ 
                          ...newVariety, 
                          [trait.key]: trait.data_type === 'integer' 
                            ? parseInt(e.target.value) 
                            : parseFloat(e.target.value)
                        })}
                        className="mt-2"
                      />
                    ) : trait.data_type === 'text' ? (
                      <Textarea
                        value={newVariety[trait.key] || ''}
                        onChange={(e) => setNewVariety({ ...newVariety, [trait.key]: e.target.value })}
                        className="mt-2"
                      />
                    ) : (
                      <Input
                        value={newVariety[trait.key] || ''}
                        onChange={(e) => setNewVariety({ ...newVariety, [trait.key]: e.target.value })}
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}

                {/* Standard Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Days to Maturity</Label>
                    <Input
                      type="number"
                      value={newVariety.days_to_maturity || ''}
                      onChange={(e) => setNewVariety({ ...newVariety, days_to_maturity: parseInt(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Spacing (inches)</Label>
                    <Input
                      type="number"
                      value={newVariety.spacing_recommended || ''}
                      onChange={(e) => setNewVariety({ ...newVariety, spacing_recommended: parseInt(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddVariety(false)}>Cancel</Button>
              <Button 
                onClick={handleAddVariety}
                disabled={!newVariety.variety_name}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {canEdit ? 'Add Variety' : 'Submit for Review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main Catalog View with Tree Navigation
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Sidebar - Tree Navigation */}
      <div className="w-64 flex-shrink-0 border-r pr-4">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">Browse by Category</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-6rem)]">
          <div className="space-y-1">
            {groups.map((group) => {
              const groupFamilies = getFamiliesForGroup(group.id);
              const isExpanded = selectedGroup?.id === group.id;

              return (
                <Collapsible key={group.id} open={isExpanded} onOpenChange={(open) => setSelectedGroup(open ? group : null)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left">
                      <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <BookOpen className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-sm">{group.name}</span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 mt-1 space-y-1">
                      {groupFamilies.map((family) => (
                        <button
                          key={family.id}
                          onClick={() => setSelectedFamily(family)}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedFamily?.id === family.id
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {family.common_name || family.scientific_name}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plant Catalog</h1>
          <p className="text-gray-600 mt-1">Explore our comprehensive plant database</p>
        </div>

        <AdBanner placement="top_banner" pageType="catalog" />

        {/* Plant Types */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {plantTypes
            .filter(type => {
              if (selectedFamily) return type.plant_family_id === selectedFamily.id;
              if (selectedGroup) return type.plant_group_id === selectedGroup.id;
              if (searchQuery) return type.common_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      type.scientific_name?.toLowerCase().includes(searchQuery.toLowerCase());
              return true;
            })
            .map((type, index) => {
              const varietyCount = varieties.filter(v => v.plant_type_id === type.id && v.status === 'active').length;
              return (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all group"
                    onClick={() => setSelectedType(type)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl ${
                        type.color || 'bg-emerald-100'
                      } group-hover:scale-110 transition-transform`}>
                        {type.icon || '🌱'}
                      </div>
                      <h3 className="font-semibold text-gray-900">{type.common_name}</h3>
                      {type.scientific_name && (
                        <p className="text-xs text-gray-500 italic mt-1">{type.scientific_name}</p>
                      )}
                      {varietyCount > 0 && (
                        <Badge variant="outline" className="mt-2">
                          {varietyCount} varieties
                        </Badge>
                      )}
                      <div className="flex items-center justify-center gap-1 mt-2 text-emerald-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Browse</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
        </div>
      </div>
    </div>
  );
}