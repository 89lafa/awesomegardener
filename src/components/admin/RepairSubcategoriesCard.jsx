import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function RepairSubcategoriesCard() {
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [repairing, setRepairing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadPlantTypes();
  }, []);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const handleRepair = async () => {
    if (!selectedType) {
      toast.error('Please select a plant type');
      return;
    }

    setRepairing(true);
    setResult(null);
    toast.info('Running repair — this may take 1-3 minutes for large plant types...');

    try {
      const response = await base44.functions.invoke('fixSubcatByPlantType', {
        plant_type_id: selectedType,
        dry_run: false
      });

      const d = response.data;
      setResult({
        varieties_repaired: d.fixed || 0,
        varieties_skipped: d.no_match || 0,
        total: d.total_missing || 0,
        no_match_sample: d.no_match_sample || []
      });
      toast.success(`Done! Fixed ${d.fixed}/${d.total_missing} missing subcategories.`);
    } catch (error) {
      console.error('Repair error:', error);
      toast.error('Repair failed: ' + error.message);
      setResult({ error: error.message });
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Repair Subcategories & Varieties
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <div className="font-semibold mb-1">This tool will:</div>
            <ul className="space-y-1 text-xs">
              <li>• Activate all subcategories for the selected plant type</li>
              <li>• Resolve single primary subcategory for each variety from plant_subcategory_code</li>
              <li>• Sync arrays (plant_subcategory_ids, plant_subcategory_codes) to match primary</li>
              <li>• Clean up junk values like stringified arrays or invalid IDs</li>
              <li>• Set empty arrays for varieties with missing/unresolvable codes</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div>
          <Label>Select Plant Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose plant type..." />
            </SelectTrigger>
            <SelectContent>
              {plantTypes.map(pt => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.icon && <span className="mr-2">{pt.icon}</span>}
                  {pt.common_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleRepair}
          disabled={repairing || !selectedType}
          className="bg-indigo-600 hover:bg-indigo-700 gap-2 w-full"
        >
          {repairing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Repairing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Repair Subcategories & Varieties
            </>
          )}
        </Button>

        {result && (
          <Alert className={result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            <AlertDescription className={result.error ? 'text-red-800' : 'text-green-800'}>
              {result.error ? (
                <div className="text-sm">{result.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="font-semibold">Results:</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Total Missing: <strong>{result.total || 0}</strong></div>
                    <div>Fixed: <strong>{result.varieties_repaired || 0}</strong></div>
                    <div>Could Not Match: <strong>{result.varieties_skipped || 0}</strong></div>
                  </div>
                  {result.no_match_sample?.length > 0 && (
                    <div className="text-xs text-gray-600 mt-2">
                      <strong>Still unmatched (sample):</strong><br />
                      {result.no_match_sample.map((v, i) => <span key={i}>{v.name}{i < result.no_match_sample.length - 1 ? ', ' : ''}</span>)}
                    </div>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 p-2 bg-white rounded border text-xs">
                      <div className="font-semibold text-red-700 mb-1">Errors:</div>
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <div key={idx} className="text-red-600">{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}