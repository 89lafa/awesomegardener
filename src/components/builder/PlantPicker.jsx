import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Sprout, Package, Plus, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PlantPicker({ 
  open, 
  onClose, 
  onSelect,
  bed,
  cellRow,
  cellCol 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [seedStash, setSeedStash] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plannedDate, setPlannedDate] = useState('');

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (selectedType) {
      loadVarieties(selectedType.id);
    }
  }, [selectedType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [types, seeds] = await Promise.all([
        base44.entities.PlantType.list('name'),
        base44.entities.SeedLot.filter({ is_wishlist: false })
      ]);
      setPlantTypes(types);
      setSeedStash(seeds);
    } catch (error) {
      console.error('Error loading plant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVarieties = async (typeId) => {
    try {
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: typeId,
        status: 'active'
      }, 'variety_name');
      setVarieties(vars);
    } catch (error) {
      console.error('Error loading varieties:', error);
    }
  };

  const handleSelectFromCatalog = (type, variety = null) => {
    const displayName = variety 
      ? `${type.name} - ${variety.variety_name}`
      : type.name;

    onSelect({
      plant_type_id: type.id,
      variety_id: variety?.id,
      display_name: displayName,
      planned_plant_out_date: plannedDate || null
    });
    resetAndClose();
  };

  const handleSelectFromStash = (seed) => {
    const displayName = seed.variety_name 
      ? `${seed.plant_type_name} - ${seed.variety_name}`
      : seed.plant_type_name || seed.custom_name;

    onSelect({
      plant_type_id: seed.plant_type_id,
      variety_id: seed.variety_id,
      display_name: displayName,
      seed_lot_id: seed.id,
      planned_plant_out_date: plannedDate || null
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setSearchQuery('');
    setSelectedType(null);
    setSelectedVariety(null);
    setPlannedDate('');
    onClose();
  };

  const filteredTypes = plantTypes.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSeeds = seedStash.filter(s => {
    const name = s.variety_name || s.plant_type_name || s.custom_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-600" />
            Place a Plant
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Cell: Row {cellRow + 1}, Column {cellCol + 1} in {bed?.name}
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search plants or seeds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="catalog" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="catalog" className="gap-2">
              <Sprout className="w-4 h-4" />
              Catalog
            </TabsTrigger>
            <TabsTrigger value="seeds" className="gap-2">
              <Package className="w-4 h-4" />
              My Seeds
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="flex-1 min-h-0 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              </div>
            ) : selectedType ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedType(null)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <span className="font-medium">{selectedType.name}</span>
                </div>

                <ScrollArea className="h-60">
                  <div className="space-y-2">
                    {/* Generic option */}
                    <button
                      onClick={() => handleSelectFromCatalog(selectedType)}
                      className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium">{selectedType.name} (Generic)</p>
                      <p className="text-sm text-gray-500">No specific variety</p>
                    </button>

                    {/* Varieties */}
                    {varieties.map((variety) => (
                      <button
                        key={variety.id}
                        onClick={() => handleSelectFromCatalog(selectedType, variety)}
                        className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium">{variety.variety_name}</p>
                        <div className="flex gap-2 mt-1">
                          {variety.days_to_maturity && (
                            <Badge variant="outline" className="text-xs">
                              {variety.days_to_maturity} days
                            </Badge>
                          )}
                          {variety.spacing_recommended && (
                            <Badge variant="outline" className="text-xs">
                              {variety.spacing_recommended}" spacing
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <ScrollArea className="h-60">
                <div className="grid grid-cols-2 gap-2">
                  {filteredTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type)}
                      className="p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
                          type.color || 'bg-emerald-100'
                        }`}>
                          {type.icon || '🌱'}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{type.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{type.category}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="seeds" className="flex-1 min-h-0 mt-4">
            {filteredSeeds.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No seeds in your stash</p>
                <p className="text-sm text-gray-400">Add seeds to quickly place them</p>
              </div>
            ) : (
              <ScrollArea className="h-60">
                <div className="space-y-2">
                  {filteredSeeds.map((seed) => (
                    <button
                      key={seed.id}
                      onClick={() => handleSelectFromStash(seed)}
                      className="w-full p-3 text-left rounded-lg border hover:bg-gray-50 transition-colors"
                    >
                      <p className="font-medium">
                        {seed.variety_name || seed.plant_type_name || seed.custom_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {seed.source_company && (
                          <span className="text-xs text-gray-500">{seed.source_company}</span>
                        )}
                        {seed.year && (
                          <Badge variant="outline" className="text-xs">{seed.year}</Badge>
                        )}
                        {seed.quantity && (
                          <Badge variant="outline" className="text-xs">
                            {seed.quantity} {seed.quantity_unit}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Planting Date */}
        <div className="pt-4 border-t">
          <Label htmlFor="plantDate">Planned Plant-Out Date (optional)</Label>
          <Input
            id="plantDate"
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="mt-2"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}