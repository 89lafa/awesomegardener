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
  const [runningNormalize, setRunningNormalize] = useState(false);
  const [runningRepair, setRunningRepair] = useState(false);
  const [normalizeResult, setNormalizeResult] = useState(null);
  const [repairResult, setRepairResult] = useState(null);
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
    setRunningNormalize(true);
    setNormalizeResult(null);
    try {
      const response = await base44.functions.invoke('batchNormalizeVarietySubcategories', { dry_run: dryRun });
      setNormalizeResult(response.data);
      toast.success(dryRun ? 'Analysis complete' : 'Normalization complete');
    } catch (error) {
      console.error('Normalize error:', error);
      toast.error('Normalization failed: ' + (error.response?.data?.error || error.message));
      setNormalizeResult({ error: error.response?.data?.error || error.message });
    } finally {
      setRunningNormalize(false);
    }
  };

  const runRepair = async (dryRun = false) => {
    if (!selectedType) {
      toast.error('Please select a plant type');
      return;
    }

    setRunningRepair(true);
    setRepairResult(null);
    try {
      const response = await base44.functions.invoke('batchRepairSubcategories', { 
        plant_type_id: selectedType,
        dry_run: dryRun 
      });
      setRepairResult(response.data);
      toast.success(dryRun ? 'Analysis complete' : 'Repair complete');
    } catch (error) {
      console.error('Repair error:', error);
      toast.error('Repair failed: ' + (error.response?.data?.error || error.message));
      setRepairResult({ error: error.response?.data?.error || error.message });
    } finally {
      setRunningRepair(false);
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
              disabled={runningNormalize}
              variant="outline"
              className="gap-2"
            >
              {runningNormalize ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analyze (Dry Run)
            </Button>
            <Button
              onClick={() => runNormalize(false)}
              disabled={runningNormalize}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {runningNormalize ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Normalize All
            </Button>
          </div>
          {normalizeResult && (
            <Alert className={normalizeResult.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
              {normalizeResult.error ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <AlertDescription className={normalizeResult.error ? "text-red-800" : "text-green-800"}>
                {normalizeResult.error ? (
                  <div className="font-semibold">Error: {normalizeResult.error}</div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold">{normalizeResult.dry_run ? 'Analysis' : 'Results'}:</div>
                    <div className="text-sm">Processed: {normalizeResult.processed} / {normalizeResult.total}</div>
                    <div className="text-sm">Fixed: {normalizeResult.fixed}</div>
                    {normalizeResult.errors > 0 && <div className="text-sm text-red-700">Errors: {normalizeResult.errors}</div>}
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
              disabled={runningRepair || !selectedType}
              variant="outline"
              className="gap-2"
            >
              {runningRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Analyze (Dry Run)
            </Button>
            <Button
              onClick={() => runRepair(false)}
              disabled={runningRepair || !selectedType}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {runningRepair ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Repair Now
            </Button>
          </div>

          {repairResult && (
            <Alert className={repairResult.error ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
              {repairResult.error ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <AlertDescription className={repairResult.error ? "text-red-800" : "text-green-800"}>
                {repairResult.error ? (
                  <div>
                    <div className="font-semibold mb-1">Error: {repairResult.error}</div>
                    {repairResult.suggestion && <div className="text-sm">{repairResult.suggestion}</div>}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="font-semibold">{repairResult.dry_run ? 'Analysis' : 'Results'}:</div>
                    <div className="text-sm">Total varieties: {repairResult.total}</div>
                    <div className="text-sm">Repaired: {repairResult.repaired}</div>
                    {repairResult.errors > 0 && <div className="text-sm text-red-700">Errors: {repairResult.errors}</div>}
                    {repairResult.uncategorized_subcat && <div className="text-sm">Using: {repairResult.uncategorized_subcat}</div>}
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