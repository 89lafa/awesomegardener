import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  MergeIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDeduplicateVarieties() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [dryRunning, setDryRunning] = useState(false);
  const [merging, setMerging] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [mergeResult, setMergeResult] = useState(null);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = createPageUrl('Dashboard');
        return;
      }
      setUser(userData);
      
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
    } catch (error) {
      window.location.href = createPageUrl('Dashboard');
    } finally {
      setLoading(false);
    }
  };

  const normalizeVarietyName = (name) => {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\.$/, '');
  };

  const runDryRun = async () => {
    if (!selectedPlantType || selectedPlantType === 'all') {
      toast.error('Please select a specific plant type');
      return;
    }

    setDryRunning(true);
    setDryRunResult(null);
    
    try {
      const response = await base44.functions.invoke('deduplicateVarietiesGeneric', {
        plant_type_id: selectedPlantType,
        dry_run: true,
        max_groups: 50
      });
      
      if (response.data.success) {
        setDryRunResult(response.data);
        toast.success('Dry run completed!');
      } else {
        throw new Error(response.data.error || 'Dry run failed');
      }
    } catch (error) {
      console.error('Dry run error:', error);
      toast.error('Dry run failed: ' + error.message);
    } finally {
      setDryRunning(false);
    }
  };

  const runMerge = async () => {
    if (!selectedPlantType || selectedPlantType === 'all') {
      toast.error('Please select a specific plant type');
      return;
    }

    if (!dryRunResult || !dryRunResult.summary || dryRunResult.summary.duplicate_groups === 0) {
      toast.error('Run dry-run first to see what will be merged');
      return;
    }

    const plantTypeName = plantTypes.find(p => p.id === selectedPlantType)?.common_name;
    if (!confirm(`Merge duplicates for ${plantTypeName}? This will process up to 20 groups and update all references. Continue?`)) {
      return;
    }

    setMerging(true);
    setMergeResult(null);
    
    try {
      const response = await base44.functions.invoke('deduplicateVarietiesGeneric', {
        plant_type_id: selectedPlantType,
        dry_run: false,
        max_groups: 20
      });
      
      if (response.data.success) {
        setMergeResult(response.data);
        toast.success('Merge completed successfully!');
        // Refresh dry run to show remaining
        setTimeout(() => runDryRun(), 1000);
      } else {
        throw new Error(response.data.error || 'Merge failed');
      }
    } catch (error) {
      console.error('Merge error:', error);
      toast.error('Merge failed: ' + error.message);
    } finally {
      setMerging(false);
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
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('AdminDataMaintenance')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Deduplicate Varieties</h1>
          <p className="text-gray-600 mt-1">Find and merge duplicate variety records</p>
        </div>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Plant Type</Label>
              <Select value={selectedPlantType} onValueChange={setSelectedPlantType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a plant type..." />
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
              <p className="text-xs text-gray-500 mt-1">
                Finds duplicates by variety_code or normalized name, works for any plant type
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={runDryRun}
              disabled={dryRunning}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {dryRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Dry-Run
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dry Run Results */}
      {dryRunResult && dryRunResult.dry_run && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Dry-Run Results
              <Badge variant={dryRunResult.summary?.duplicate_groups > 0 ? 'destructive' : 'default'}>
                {dryRunResult.summary?.duplicate_groups || 0} duplicate groups
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dryRunResult.summary?.duplicate_groups === 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  No duplicates found! Your catalog is clean.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    Found {dryRunResult.summary.duplicate_groups} duplicate groups affecting {dryRunResult.summary.total_duplicates} varieties
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {dryRunResult.groups?.map((group, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">
                          {group.canonical.name}
                        </h4>
                        <Badge variant="outline">{group.count} records</Badge>
                      </div>
                      
                      {/* Canonical */}
                      <div className="p-2 rounded bg-green-100 border border-green-300 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600">KEEP</Badge>
                          <span className="font-mono text-xs text-gray-700">{group.canonical.id}</span>
                          {group.canonical.code && (
                            <Badge variant="outline" className="text-xs">Code: {group.canonical.code}</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          Created: {new Date(group.canonical.created).toLocaleDateString()} • 
                          Completeness Score: {group.canonical.score}
                        </div>
                      </div>

                      {/* Duplicates */}
                      <div className="space-y-1">
                        {group.duplicates.map((dup, i) => (
                          <div key={i} className="p-2 rounded bg-red-50 border border-red-200">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-600">REMOVE</Badge>
                              <span className="font-mono text-xs text-gray-700">{dup.id}</span>
                              {dup.code && (
                                <Badge variant="outline" className="text-xs">Code: {dup.code}</Badge>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              Created: {new Date(dup.created).toLocaleDateString()} • 
                              Score: {dup.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={runMerge}
                  disabled={merging}
                  className="w-full bg-orange-600 hover:bg-orange-700 gap-2"
                >
                  {merging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <MergeIcon className="w-4 h-4" />
                      Apply Merge (20 groups per run)
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merge Results */}
      {mergeResult && mergeResult.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Merge Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <div className="font-semibold">{mergeResult.summary?.message || 'Merge completed!'}</div>
                  <ul className="text-sm space-y-1">
                    <li>• Groups merged: {mergeResult.summary?.groups_merged || 0}</li>
                    <li>• Records removed: {mergeResult.summary?.records_removed || 0}</li>
                    {mergeResult.summary?.groups_remaining > 0 && (
                      <li className="text-amber-700 font-semibold">
                        ⚠️ {mergeResult.summary.groups_remaining} groups remaining - run merge again
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="text-sm text-blue-900 space-y-2">
            <div className="font-semibold">How deduplication works:</div>
            <ul className="space-y-1">
              <li>• <strong>Matching:</strong> Groups varieties by variety_code (if exists) or normalized name + plant type</li>
              <li>• <strong>Canonical selection:</strong> Prefers records with variety_code, most filled fields, or oldest</li>
              <li>• <strong>Merge strategy:</strong> Combines all data (images, synonyms, subcategories) without loss</li>
              <li>• <strong>Safety:</strong> Duplicates marked as "removed", references updated, no hard deletes</li>
              <li>• <strong>Redirects:</strong> Opening a merged variety redirects to canonical record</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}