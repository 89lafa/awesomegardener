import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDataMaintenance() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
      loadPlantTypes();
    } catch (error) {
      window.location.href = '/Dashboard';
    }
  };

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list();
      setPlantTypes(types.filter(t => t.common_name).sort((a, b) => a.common_name.localeCompare(b.common_name)));
    } catch (error) {
      console.error('Error loading plant types:', error);
    } finally {
      setLoading(false);
    }
  };

  const runNormalize = async (dryRun = false) => {
    setRunning(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('batchNormalizeVarietySubcategories', { dry_run: dryRun });
      setResult(response.data);
      toast.success(dryRun ? 'Analysis complete' : 'Normalization complete');
    } catch (error) {
      console.error('Normalize error:', error);
      toast.error('Normalization failed: ' + (error.response?.data?.error || error.message));
      setResult({ error: error.response?.data?.error || error.message });
    } finally {
      setRunning(false);
    }
  };

  const runRepair = async (dryRun = false) => {
    if (!selectedType) {
      toast.error('Please select a plant type');
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('batchRepairSubcategories', { 
        plant_type_id: selectedType,
        dry_run: dryRun 
      });
      setResult(response.data);
      toast.success(dryRun ? 'Analysis complete' : 'Repair complete');
    } catch (error) {
      console.error('Repair error:', error);
      toast.error('Repair failed: ' + (error.response?.data?.error || error.message));
      setResult({ error: error.response?.data?.error || error.message });
    } finally {
      setRunning(false);
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Maintenance</h1>
        <p className="text-gray-600 mt-1">Admin tools for data normalization and repair</p>
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          These operations use automatic batching to prevent rate limit errors. Large datasets will be processed in chunks with delays.
        </AlertDescription>
      </Alert>

      {/* Global Normalize */}
      <Card>
        <CardHeader>
          <CardTitle>Normalize Variety Subcategories (Global)</CardTitle>
          <CardDescription>
            Sanitizes and normalizes subcategory fields for ALL varieties. Removes invalid IDs, ensures consistency between single and array fields. Processes in batches of 30 with automatic delays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              onClick={() => runNormalize(true)}
              disabled={running}
              variant="outline"
              className="gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analyze (Dry Run)
            </Button>
            <Button
              onClick={() => runNormalize(false)}
              disabled={running}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Normalize All
            </Button>
          </div>
          {result && (
            <Alert className={result.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
              {result.error ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <AlertDescription className={result.error ? "text-red-800" : "text-green-800"}>
                {result.error ? (
                  <div className="font-semibold">Error: {result.error}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold">{result.dry_run ? 'Analysis' : 'Results'}:</div>
                    <div className="text-sm">Processed: {result.processed} / {result.total}</div>
                    <div className="text-sm">Fixed: {result.fixed}</div>
                    {result.errors > 0 && <div className="text-sm text-red-700">Errors: {result.errors}</div>}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Repair Subcategories */}
      <Card>
        <CardHeader>
          <CardTitle>Repair Subcategories & Varieties</CardTitle>
          <CardDescription>
            Assigns "Uncategorized" subcategory to varieties that don't have one. Select a plant type to repair. Processes in batches of 25 with automatic delays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Plant Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select plant type..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {plantTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => runRepair(true)}
              disabled={running || !selectedType}
              variant="outline"
              className="gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analyze (Dry Run)
            </Button>
            <Button
              onClick={() => runRepair(false)}
              disabled={running || !selectedType}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Repair Now
            </Button>
          </div>

          {result && (
            <Alert className={result.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
              {result.error ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <AlertDescription className={result.error ? "text-red-800" : "text-green-800"}>
                {result.error ? (
                  <div>
                    <div className="font-semibold mb-1">Error: {result.error}</div>
                    {result.suggestion && <div className="text-sm">{result.suggestion}</div>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold">{result.dry_run ? 'Analysis' : 'Results'}:</div>
                    <div className="text-sm">Total varieties: {result.total}</div>
                    <div className="text-sm">Repaired: {result.repaired}</div>
                    {result.errors > 0 && <div className="text-sm text-red-700">Errors: {result.errors}</div>}
                    {result.uncategorized_subcat && <div className="text-sm">Using: {result.uncategorized_subcat}</div>}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}