import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wrench, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdminDataMaintenance() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState('');
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
      const response = await base44.functions.invoke('repairPlantTypeSubcategories', {
        plant_type_id: selectedPlantType
      });

      setResults(response.data.results);
      toast.success('Repair completed successfully');
    } catch (error) {
      console.error('Error running repair:', error);
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

  const selectedType = plantTypes.find(pt => pt.id === selectedPlantType);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Maintenance</h1>
        <p className="text-gray-600 mt-1">Repair subcategories and variety classifications</p>
      </div>

      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          This tool will activate all subcategories for a plant type and normalize variety assignments.
          It's useful after CSV imports or when subcategory data gets out of sync.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Repair Subcategories & Varieties</CardTitle>
          <CardDescription>
            Select a plant type to repair its subcategory assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Plant Type
            </label>
            <Select value={selectedPlantType} onValueChange={setSelectedPlantType}>
              <SelectTrigger>
                <SelectValue placeholder="Select plant type" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {plantTypes.map(pt => (
                  <SelectItem key={pt.id} value={pt.id}>
                    {pt.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-sm text-blue-800">
                Selected: <strong>{selectedType.common_name}</strong>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleRepair}
            disabled={!selectedPlantType || repairing}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {repairing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Repairing...
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4 mr-2" />
                Repair Subcategories & Varieties
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Repair Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Subcategories Activated:</span>
                <p className="font-semibold text-lg">{results.subcats_activated}</p>
              </div>
              <div>
                <span className="text-gray-600">Varieties Normalized:</span>
                <p className="font-semibold text-lg">{results.varieties_normalized}</p>
              </div>
              <div>
                <span className="text-gray-600">Junk Arrays Cleared:</span>
                <p className="font-semibold text-lg">{results.junk_cleared}</p>
              </div>
              <div>
                <span className="text-gray-600">Missing Code:</span>
                <p className="font-semibold text-lg">{results.missing_code || 0}</p>
              </div>
            </div>

            {results.errors && results.errors.length > 0 && (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-sm text-red-800">
                  <p className="font-semibold mb-1">Errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {results.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}