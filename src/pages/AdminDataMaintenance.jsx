import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDataMaintenance() {
  const [user, setUser] = useState(null);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);

      const plantTypesData = await base44.entities.PlantType.list('common_name');
      setPlantTypes(plantTypesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async () => {
    if (!selectedPlantType) {
      toast.error('Please select a plant type');
      return;
    }

    setRepairing(true);
    setResults(null);

    try {
      const selectedType = plantTypes.find(pt => pt.id === selectedPlantType);
      
      // Step 1: Activate all subcategories for this plant type
      const subcats = await base44.entities.PlantSubCategory.filter({
        plant_type_id: selectedPlantType
      });

      let subcatsActivated = 0;
      for (const subcat of subcats) {
        if (!subcat.is_active) {
          await base44.entities.PlantSubCategory.update(subcat.id, { is_active: true });
          subcatsActivated++;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Step 2: Get all varieties for this plant type
      const varieties = await base44.entities.Variety.filter({
        plant_type_id: selectedPlantType
      });

      let varietiesRepaired = 0;
      let varietiesSkipped = 0;
      let varietiesMissingCode = 0;
      const errors = [];

      // Build subcat lookup
      const subcatLookup = {};
      subcats.forEach(sc => {
        subcatLookup[sc.subcat_code] = sc;
      });

      // Step 3: Repair each variety
      for (const variety of varieties) {
        let needsUpdate = false;
        const updateData = {};

        // Get the subcategory code
        let subcatCode = variety.plant_subcategory_code || 
                        variety.extended_data?.import_subcat_code || 
                        null;

        // Clean junk stringified arrays
        if (typeof subcatCode === 'string' && (subcatCode.startsWith('[') || subcatCode.includes('['))) {
          try {
            const parsed = JSON.parse(subcatCode);
            if (Array.isArray(parsed) && parsed.length > 0) {
              subcatCode = parsed[0];
            }
          } catch {
            // Remove brackets and quotes
            subcatCode = subcatCode.replace(/[\[\]"']/g, '').trim();
          }
        }

        if (subcatCode && subcatLookup[subcatCode]) {
          const subcat = subcatLookup[subcatCode];
          
          // Set primary
          if (variety.plant_subcategory_id !== subcat.id) {
            updateData.plant_subcategory_id = subcat.id;
            needsUpdate = true;
          }

          // Sync arrays
          const expectedIds = [subcat.id];
          const expectedCodes = [subcat.subcat_code];

          if (JSON.stringify(variety.plant_subcategory_ids || []) !== JSON.stringify(expectedIds)) {
            updateData.plant_subcategory_ids = expectedIds;
            needsUpdate = true;
          }

          if (JSON.stringify(variety.plant_subcategory_codes || []) !== JSON.stringify(expectedCodes)) {
            updateData.plant_subcategory_codes = expectedCodes;
            needsUpdate = true;
          }

          if (variety.plant_subcategory_code !== subcat.subcat_code) {
            updateData.plant_subcategory_code = subcat.subcat_code;
            needsUpdate = true;
          }

          if (needsUpdate) {
            try {
              await base44.entities.Variety.update(variety.id, updateData);
              varietiesRepaired++;
              await new Promise(resolve => setTimeout(resolve, 150));
            } catch (err) {
              errors.push(`${variety.variety_name}: ${err.message}`);
            }
          } else {
            varietiesSkipped++;
          }
        } else if (!subcatCode) {
          varietiesMissingCode++;
        } else {
          errors.push(`${variety.variety_name}: Unknown subcat code "${subcatCode}"`);
        }
      }

      setResults({
        plantType: selectedType.common_name,
        subcatsActivated,
        totalVarieties: varieties.length,
        varietiesRepaired,
        varietiesSkipped,
        varietiesMissingCode,
        errors: errors.slice(0, 20)
      });

      toast.success('Repair completed!');
    } catch (error) {
      console.error('Error repairing:', error);
      toast.error('Repair failed: ' + error.message);
    } finally {
      setRepairing(false);
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Maintenance</h1>
        <p className="text-gray-600 mt-1">Repair subcategories and varieties for any plant type</p>
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>What this tool does:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Activates all subcategories for the selected plant type</li>
            <li>Canonicalizes variety subcategories (single primary + synced arrays)</li>
            <li>Cleans junk stringified arrays</li>
            <li>Reports varieties with missing or invalid subcategory codes</li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Select Plant Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Plant Type *</Label>
            <Select value={selectedPlantType} onValueChange={setSelectedPlantType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a plant type" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {plantTypes.map(pt => (
                  <SelectItem key={pt.id} value={pt.id}>
                    {pt.common_name} ({pt.plant_type_code || pt.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleRepair}
            disabled={!selectedPlantType || repairing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {repairing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Repairing...
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                Repair Subcategories & Varieties
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Repair Results: {results.plantType}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Subcategories Activated</p>
                <p className="text-2xl font-bold text-green-600">{results.subcatsActivated}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Varieties</p>
                <p className="text-2xl font-bold text-gray-900">{results.totalVarieties}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Varieties Repaired</p>
                <p className="text-2xl font-bold text-blue-600">{results.varietiesRepaired}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Varieties Skipped (OK)</p>
                <p className="text-2xl font-bold text-gray-500">{results.varietiesSkipped}</p>
              </div>
            </div>

            {results.varietiesMissingCode > 0 && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <strong>{results.varietiesMissingCode} varieties</strong> have no subcategory code set
                </AlertDescription>
              </Alert>
            )}

            {results.errors.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-red-600 mb-2">Errors ({results.errors.length}):</p>
                <div className="bg-red-50 p-3 rounded-lg max-h-64 overflow-auto">
                  {results.errors.map((err, idx) => (
                    <p key={idx} className="text-xs text-red-700">{err}</p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}