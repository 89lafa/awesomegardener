import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Settings,
  Download
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDataMaintenance() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [pepperCleanupRunning, setPepperCleanupRunning] = useState(false);
  const [tomatoDedupRunning, setTomatoDedupRunning] = useState(false);
  const [tomatoMergeRunning, setTomatoMergeRunning] = useState(false);
  const [exportingSHU, setExportingSHU] = useState(false);
  const [normalizingSubcats, setNormalizingSubcats] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const [pepperCleanupResult, setPepperCleanupResult] = useState(null);
  const [tomatoDedupResult, setTomatoDedupResult] = useState(null);
  const [tomatoMergeResult, setTomatoMergeResult] = useState(null);
  const [normalizeResult, setNormalizeResult] = useState(null);
  const [dedupPlantType, setDedupPlantType] = useState(null);
  const [dedupRunning, setDedupRunning] = useState(false);
  const [dedupResult, setDedupResult] = useState(null);
  const [normalizeSpacesRunning, setNormalizeSpacesRunning] = useState(false);
  const [normalizeSpacesResult, setNormalizeSpacesResult] = useState(null);
  const [squashMigrationRunning, setSquashMigrationRunning] = useState(false);
  const [squashMigrationResult, setSquashMigrationResult] = useState(null);
  const [subcatBackfillRunning, setSubcatBackfillRunning] = useState(false);
  const [subcatBackfillResult, setSubcatBackfillResult] = useState(null);
  const [selectedBackfillType, setSelectedBackfillType] = useState('');

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
    } catch (error) {
      window.location.href = createPageUrl('Dashboard');
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async () => {
    setBackfillRunning(true);
    setBackfillResult(null);
    
    try {
      const response = await base44.functions.invoke('backfillVarietySubcategories', {});
      
      if (response.data.success) {
        setBackfillResult({
          success: true,
          ...response.data.summary,
          timestamp: new Date().toISOString(),
          runBy: user.email
        });
        toast.success('Backfill completed successfully!');
      } else {
        throw new Error(response.data.error || 'Backfill failed');
      }
    } catch (error) {
      console.error('Backfill error:', error);
      setBackfillResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        runBy: user.email
      });
      toast.error('Backfill failed: ' + error.message);
    } finally {
      setBackfillRunning(false);
    }
  };

  const runPepperCleanup = async () => {
    if (!confirm('This will reorganize ALL Pepper varieties by heat level. Continue?')) {
      return;
    }

    setPepperCleanupRunning(true);
    setPepperCleanupResult(null);
    
    try {
      const response = await base44.functions.invoke('cleanupPepperSubcategories', {});
      
      if (response.data.success) {
        setPepperCleanupResult({
          success: true,
          ...response.data.summary,
          diagnostics: response.data.diagnostics,
          timestamp: new Date().toISOString(),
          runBy: user.email
        });
        toast.success('Pepper cleanup completed successfully!');
      } else {
        throw new Error(response.data.error || 'Cleanup failed');
      }
    } catch (error) {
      console.error('Pepper cleanup error:', error);
      setPepperCleanupResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        runBy: user.email
      });
      toast.error('Cleanup failed: ' + error.message);
    } finally {
      setPepperCleanupRunning(false);
    }
  };

  const exportPeppersMissingSHU = async () => {
    setExportingSHU(true);
    try {
      const response = await base44.functions.invoke('exportPeppersMissingSHU', {});
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'peppers_missing_shu.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('CSV exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed: ' + error.message);
    } finally {
      setExportingSHU(false);
    }
  };

  const runTomatoDedup = async () => {
    setTomatoDedupRunning(true);
    setTomatoDedupResult(null);
    
    try {
      const response = await base44.functions.invoke('tomatoDedupDryRun', {});
      
      if (response.data.success) {
        setTomatoDedupResult(response.data);
        toast.success('Dry run completed - review results below');
      } else {
        throw new Error(response.data.error || 'Dry run failed');
      }
    } catch (error) {
      console.error('Tomato dedup error:', error);
      toast.error('Dry run failed: ' + error.message);
    } finally {
      setTomatoDedupRunning(false);
    }
  };

  const runTomatoMerge = async () => {
    if (!confirm('This will MERGE duplicate Tomato varieties (20 groups per run). This cannot be easily undone. Continue?')) {
      return;
    }

    setTomatoMergeRunning(true);
    setTomatoMergeResult(null);
    
    try {
      const response = await base44.functions.invoke('mergeTomatoDuplicates', {});
      
      if (response.data.success) {
        setTomatoMergeResult({
          success: true,
          ...response.data.summary,
          timestamp: new Date().toISOString(),
          runBy: user.email
        });
        toast.success(response.data.summary.message || 'Tomato merge completed!');
      } else {
        throw new Error(response.data.error || 'Merge failed');
      }
    } catch (error) {
      console.error('Tomato merge error:', error);
      setTomatoMergeResult({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        runBy: user.email
      });
      toast.error('Merge failed: ' + error.message);
    } finally {
      setTomatoMergeRunning(false);
    }
  };

  const runNormalizeSubcats = async () => {
    setNormalizingSubcats(true);
    setNormalizeResult(null);
    
    try {
      const response = await base44.functions.invoke('normalizeVarietySubcategories', {});
      
      if (response.data.success) {
        setNormalizeResult({
          success: true,
          ...response.data.summary,
          timestamp: new Date().toISOString()
        });
        toast.success('Subcategory normalization completed!');
      } else {
        throw new Error(response.data.error || 'Normalization failed');
      }
    } catch (error) {
      console.error('Normalize error:', error);
      setNormalizeResult({
        success: false,
        error: error.message
      });
      toast.error('Normalization failed: ' + error.message);
    } finally {
      setNormalizingSubcats(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const runGenericDedup = async (dryRun = true) => {
    if (!dedupPlantType) {
      toast.error('Please select a plant type');
      return;
    }

    if (!dryRun && !confirm('This will merge duplicate varieties. This cannot be easily undone. Continue?')) {
      return;
    }

    setDedupRunning(true);
    setDedupResult(null);
    
    try {
      const response = await base44.functions.invoke('deduplicateVarietiesDryRun', {
        plant_type_id: dedupPlantType,
        execute_merge: !dryRun
      });
      
      if (response.data.success) {
        setDedupResult(response.data);
        toast.success(dryRun ? 'Dry run completed' : 'Merge completed');
      } else {
        throw new Error(response.data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Dedupe error:', error);
      toast.error('Operation failed: ' + error.message);
    } finally {
      setDedupRunning(false);
    }
  };

  const runNormalizeSpaces = async () => {
    if (!confirm('This will rename duplicate garden spaces. Continue?')) {
      return;
    }

    setNormalizeSpacesRunning(true);
    setNormalizeSpacesResult(null);
    
    try {
      const response = await base44.functions.invoke('normalizeGardenSpaces', {});
      
      if (response.data.success) {
        setNormalizeSpacesResult(response.data);
        toast.success('Spaces normalized');
      } else {
        throw new Error(response.data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Normalize spaces error:', error);
      toast.error('Operation failed: ' + error.message);
    } finally {
      setNormalizeSpacesRunning(false);
    }
  };

  const runSquashMigration = async (dryRun = true) => {
    if (!dryRun && !confirm('This will migrate ALL Squash varieties to canonical types (Summer/Winter/Zucchini/Pumpkin). Continue?')) {
      return;
    }

    setSquashMigrationRunning(true);
    setSquashMigrationResult(null);
    
    try {
      const response = await base44.functions.invoke('migrateSquashUmbrellaVarieties', { dry_run: dryRun });
      
      if (response.data.success) {
        setSquashMigrationResult(response.data);
        toast.success(dryRun ? 'Dry run completed' : 'Migration completed');
      } else {
        throw new Error(response.data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Squash migration error:', error);
      toast.error('Operation failed: ' + error.message);
    } finally {
      setSquashMigrationRunning(false);
    }
  };

  const runSubcatBackfill = async () => {
    if (!selectedBackfillType) {
      toast.error('Please select a plant type');
      return;
    }

    setSubcatBackfillRunning(true);
    setSubcatBackfillResult(null);
    
    try {
      const response = await base44.functions.invoke('backfillVarietySubcategories', { 
        plant_type_id: selectedBackfillType === 'all' ? null : selectedBackfillType 
      });
      
      if (response.data.success) {
        setSubcatBackfillResult(response.data);
        toast.success('Backfill completed');
      } else {
        throw new Error(response.data.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Backfill error:', error);
      toast.error('Backfill failed: ' + error.message);
    } finally {
      setSubcatBackfillRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('AdminDataImport')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Maintenance</h1>
          <p className="text-gray-600 mt-1">Run cleanup and normalization tasks</p>
        </div>
      </div>

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Data Diagnostics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GlobalDiagnostics />
        </CardContent>
      </Card>

      {/* Subcategory Health & Fixes */}
      <Card>
        <CardHeader>
          <CardTitle>Subcategory Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Activate All Subcategories</h3>
            <p className="text-sm text-blue-800 mb-3">
              Activates all inactive subcategories globally or for a specific plant type
            </p>
            <Button
              onClick={async () => {
                const result = await base44.functions.invoke('activateAllSubcategories', { dry_run: false });
                if (result.data.success) {
                  toast.success(`Activated ${result.data.activated} subcategories`);
                } else {
                  toast.error('Failed to activate subcategories');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Activate All Now
            </Button>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <h3 className="font-semibold text-purple-900 mb-2">Audit Variety Subcategories</h3>
            <p className="text-sm text-purple-800 mb-3">
              Find varieties with subcategory data issues (empty arrays, mismatches, inactive refs)
            </p>
            <Button
              onClick={async () => {
                const result = await base44.functions.invoke('auditVarietySubcategories', {});
                if (result.data.success) {
                  console.log('Audit results:', result.data);
                  alert(`Audit Complete:\n\nTotal Varieties: ${result.data.total_varieties}\n\nIssues Found:\n- Empty array but has primary: ${result.data.issues.emptyArrayButHasPrimary.count}\n- Inactive references: ${result.data.issues.inactiveReferences.count}\n- Missing references: ${result.data.issues.missingReferences.count}\n- Array mismatch: ${result.data.issues.arrayMismatch.count}\n\nSee console for details.`);
                } else {
                  toast.error('Audit failed');
                }
              }}
              variant="outline"
              className="border-purple-300"
            >
              Run Audit
            </Button>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg">
            <h3 className="font-semibold text-amber-900 mb-2">Fix Variety Subcategory Arrays</h3>
            <p className="text-sm text-amber-800 mb-3">
              Fixes varieties where primary subcategory is not in the array (batched: 50 at a time)
            </p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  const result = await base44.functions.invoke('fixVarietySubcategoryArrays', { dry_run: true, batch_size: 50 });
                  if (result.data.success) {
                    console.log('Dry run results:', result.data);
                    alert(`Dry Run Complete:\n\nProcessed: ${result.data.processed}/${result.data.total_varieties}\nWould fix: ${result.data.fixed}\nNo issues: ${result.data.skipped}\n\nSee console for details.`);
                  }
                }}
                variant="outline"
                className="border-amber-300"
              >
                Dry Run (50)
              </Button>
              <Button
                onClick={async () => {
                  const result = await base44.functions.invoke('fixVarietySubcategoryArrays', { dry_run: false, batch_size: 50 });
                  if (result.data.success) {
                    toast.success(`Fixed ${result.data.fixed} varieties. ${result.data.has_more ? 'Run again for more.' : 'All done!'}`);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Fix Next Batch (50)
              </Button>
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">Assign Default Subcategories</h3>
            <p className="text-sm text-green-800 mb-3">
              For varieties with NO subcategory, assigns the first active subcategory for their plant type (batched: 100 at a time)
            </p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  const result = await base44.functions.invoke('assignDefaultSubcategories', { dry_run: true, batch_size: 100 });
                  if (result.data.success) {
                    console.log('Dry run results:', result.data);
                    alert(`Dry Run:\n\nWould assign: ${result.data.would_assign}\nTotal checked: ${result.data.total_checked}\n\nSee console for samples.`);
                  }
                }}
                variant="outline"
                className="border-green-300"
              >
                Preview (100)
              </Button>
              <Button
                onClick={async () => {
                  const result = await base44.functions.invoke('assignDefaultSubcategories', { dry_run: false, batch_size: 100 });
                  if (result.data.success) {
                    toast.success(`Assigned defaults to ${result.data.assigned} varieties. ${result.data.has_more ? 'Run again for more.' : 'All done!'}`);
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Assign Batch (100)
              </Button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-700 font-semibold mb-2">🔧 Quick Fix for Beets/Others:</p>
            <ol className="text-xs text-gray-600 space-y-1 list-decimal ml-4">
              <li>Click "Activate All Now" above</li>
              <li>Click "Assign Batch (100)" to give uncategorized varieties their first active subcategory</li>
              <li>Refresh Plant Catalog to see updated counts</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Normalize Subcategories - Global */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            Normalize Variety Subcategories (Global)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Sanitizes and normalizes subcategory fields for ALL varieties. Removes invalid IDs, ensures consistency between single and array fields.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={runNormalizeSubcats}
              disabled={normalizingSubcats}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {normalizingSubcats ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Normalizing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Normalize All
                </>
              )}
            </Button>

            {normalizeResult && (
              <Badge variant={normalizeResult.success ? "default" : "destructive"} className="gap-1">
                {normalizeResult.success ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {normalizeResult.success ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>

          {normalizeResult && (
            <Alert className={normalizeResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={normalizeResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">Results:</div>
                  {normalizeResult.success ? (
                    <>
                      <ul className="text-sm space-y-1">
                        <li>• Varieties scanned: {normalizeResult.varieties_scanned}</li>
                        <li>• Varieties updated: {normalizeResult.varieties_updated || normalizeResult.would_update}</li>
                        <li>• Already OK: {normalizeResult.already_ok}</li>
                        <li>• String arrays fixed: {normalizeResult.had_string_array_fixed}</li>
                        <li>• Inactive removed: {normalizeResult.had_inactive_removed}</li>
                        <li>• Became uncategorized: {normalizeResult.became_uncategorized}</li>
                      </ul>
                      {normalizeResult.sample_changes?.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold">View sample changes</summary>
                          <div className="mt-2 space-y-1 max-h-48 overflow-auto">
                            {normalizeResult.sample_changes.map((change, i) => (
                              <div key={i} className="p-2 bg-white rounded border text-xs">
                                {change.name}: {change.before.ids.length} → {change.after.ids.length} subcats
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">{normalizeResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subcategory Health by Plant Type */}
      <SubcategoryHealthByPlantType />

      {/* Pepper Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🌶️</span>
            Pepper Heat Level Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Normalizes all Pepper varieties into canonical heat level buckets based on Scoville ratings.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-blue-900 mb-1">This will:</div>
              <ul className="text-blue-800 space-y-1">
                <li>• Create 7 canonical heat level subcategories (Sweet, Mild, Medium, Hot, Extra Hot, Superhot, Unknown)</li>
                <li>• Deactivate all other Pepper subcategories</li>
                <li>• Reassign ALL Pepper varieties to heat buckets based on Scoville values</li>
                <li>• Preserve old subcategory info as traits (species, pepper_type, culinary_use)</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={runPepperCleanup}
              disabled={pepperCleanupRunning}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {pepperCleanupRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Pepper Cleanup
                </>
              )}
            </Button>

            {pepperCleanupResult && (
              <Badge variant={pepperCleanupResult.success ? "default" : "destructive"} className="gap-1">
                {pepperCleanupResult.success ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {pepperCleanupResult.success ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>

          {pepperCleanupResult && (
            <Alert className={pepperCleanupResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={pepperCleanupResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">Results:</div>
                  {pepperCleanupResult.success ? (
                    <>
                      <ul className="text-sm space-y-1">
                        <li>• Canonical subcategories created/updated: {pepperCleanupResult.canonicalSubcatsCreated}</li>
                        <li>• Old subcategories deactivated: {pepperCleanupResult.oldSubcatsDeactivated}</li>
                        <li>• Pepper varieties updated: {pepperCleanupResult.varietiesUpdated}</li>
                        <li>• Run at: {new Date(pepperCleanupResult.timestamp).toLocaleString()}</li>
                        <li>• Run by: {pepperCleanupResult.runBy}</li>
                      </ul>
                      {pepperCleanupResult.diagnostics && (
                        <div className="mt-3 pt-3 border-t border-green-300">
                          <p className="font-semibold text-sm mb-2">Bucket Distribution:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(pepperCleanupResult.diagnostics.bucketCounts).map(([code, count]) => (
                              <div key={code} className="flex justify-between">
                                <span className="font-mono">{code.replace('PSC_PEPPER_HEAT_', '')}:</span>
                                <span className="font-bold">{count}</span>
                              </div>
                            ))}
                          </div>
                          {pepperCleanupResult.diagnostics.sweetWith0SHU?.length > 0 && (
                            <div className="mt-2">
                              <p className="font-semibold text-xs mb-1">Sample Sweet (0 SHU) assignments:</p>
                              <ul className="text-xs space-y-0.5">
                                {pepperCleanupResult.diagnostics.sweetWith0SHU.slice(0, 5).map((item, i) => (
                                  <li key={i}>• {item.name} - {item.reason}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">{pepperCleanupResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex gap-3">
            <Button
              onClick={exportPeppersMissingSHU}
              disabled={exportingSHU}
              variant="outline"
              className="gap-2"
            >
              {exportingSHU ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Peppers Missing SHU
                </>
              )}
            </Button>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <div className="font-semibold mb-1">To backfill SHU data:</div>
            <ol className="space-y-1 list-decimal ml-4">
              <li>Export peppers missing SHU using the button above</li>
              <li>Fill in scoville_min and scoville_max columns in Excel/Sheets</li>
              <li>Go to Data Imports → Upload the CSV with UPSERT mode</li>
              <li>Re-run Pepper Cleanup to reassign buckets</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Pepper Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Pepper Subcategory Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PepperDiagnostics />
        </CardContent>
      </Card>

      {/* Tomato Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🍅</span>
            Tomato Data Cleanup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Identifies and merges duplicate Tomato varieties based on variety_code and normalized names.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-amber-900 mb-1">This will:</div>
              <ul className="text-amber-800 space-y-1">
                <li>• Find duplicates by variety_code or normalized name</li>
                <li>• Merge data from duplicates into the most complete record</li>
                <li>• Update all references (seed stash, plantings, etc.)</li>
                <li>• Mark duplicates as removed</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={runTomatoDedup}
              disabled={tomatoDedupRunning}
              variant="outline"
              className="gap-2"
            >
              {tomatoDedupRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Tomato Dedup Dry Run
                </>
              )}
            </Button>
            
            <Button
              onClick={runTomatoMerge}
              disabled={tomatoMergeRunning}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              {tomatoMergeRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Merge Tomato Duplicates
                </>
              )}
            </Button>
          </div>

          {tomatoDedupResult && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-blue-800">
                <div className="space-y-2">
                  <div className="font-semibold">Dry Run Results:</div>
                  <ul className="text-sm space-y-1">
                    <li>• Duplicate groups found: {tomatoDedupResult.duplicate_groups}</li>
                    <li>• Total duplicates to remove: {tomatoDedupResult.total_duplicates}</li>
                  </ul>
                  {tomatoDedupResult.groups?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold">View duplicate groups (sample)</summary>
                      <div className="mt-2 space-y-2 max-h-64 overflow-auto">
                        {tomatoDedupResult.groups.slice(0, 10).map((group, i) => (
                          <div key={i} className="p-2 bg-white rounded border text-xs">
                            <div className="font-semibold">{group.sample} ({group.count} duplicates)</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {tomatoMergeResult && (
            <Alert className={tomatoMergeResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={tomatoMergeResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">Merge Results:</div>
                  {tomatoMergeResult.success ? (
                   <>
                     <ul className="text-sm space-y-1">
                       <li>• Groups merged: {tomatoMergeResult.groups_merged}</li>
                       <li>• Records removed: {tomatoMergeResult.records_removed}</li>
                       <li>• {tomatoMergeResult.message}</li>
                       <li>• Run at: {new Date(tomatoMergeResult.timestamp).toLocaleString()}</li>
                     </ul>
                     {tomatoMergeResult.groups_remaining > 0 && (
                       <div className="mt-2 p-2 bg-white rounded text-amber-700 text-xs">
                         ⚠️ {tomatoMergeResult.groups_remaining} groups remaining. Click "Merge" again to continue.
                       </div>
                     )}
                   </>
                  ) : (
                   <div className="text-sm">{tomatoMergeResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Subcategory Backfill from Codes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Backfill Subcategory IDs from Codes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            For varieties with empty subcategory_ids but with codes in extended_data (from previous imports), this resolves codes to actual IDs.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="font-semibold text-blue-900 mb-1">This will:</div>
            <ul className="text-blue-800 space-y-1">
              <li>• Find varieties with empty plant_subcategory_ids</li>
              <li>• Extract codes from extended_data (import metadata)</li>
              <li>• Resolve codes to PlantSubCategory IDs</li>
              <li>• Write both plant_subcategory_ids (array) and plant_subcategory_id (primary)</li>
            </ul>
          </div>
          <div>
            <Label>Select Plant Type</Label>
            <Select value={selectedBackfillType} onValueChange={setSelectedBackfillType}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose plant type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plant Types</SelectItem>
                <SelectItem value="69575e5ecdbb16ee56fa7508">Zucchini</SelectItem>
                <SelectItem value="69594a9f1243f13d1245edfd">Summer Squash</SelectItem>
                <SelectItem value="69594a9f1243f13d1245edfe">Winter Squash</SelectItem>
                <SelectItem value="69594a9f1243f13d1245edff">Pumpkin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={runSubcatBackfill}
              disabled={subcatBackfillRunning || !selectedBackfillType}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {subcatBackfillRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Backfilling...</>
              ) : (
                <><Play className="w-4 h-4" />Run Backfill</>
              )}
            </Button>
          </div>
          {subcatBackfillResult && (
            <Alert className={subcatBackfillResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={subcatBackfillResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">Backfill Results:</div>
                  {subcatBackfillResult.success ? (
                    <>
                      <ul className="text-sm space-y-1">
                        <li>• Total varieties: {subcatBackfillResult.stats?.total || 0}</li>
                        <li>• Needed backfill: {subcatBackfillResult.stats?.needed_backfill || 0}</li>
                        <li>• Fixed: {subcatBackfillResult.stats?.fixed || 0}</li>
                        <li>• Failed: {subcatBackfillResult.stats?.failed || 0}</li>
                      </ul>
                      {subcatBackfillResult.stats?.failures?.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold">
                            View failures ({subcatBackfillResult.stats.failures.length})
                          </summary>
                          <div className="mt-2 space-y-1 max-h-48 overflow-auto">
                            {subcatBackfillResult.stats.failures.map((item, i) => (
                              <div key={i} className="p-2 bg-white rounded border text-xs">
                                {item.name} - {item.reason}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">{subcatBackfillResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generic Dedupe Tool */}
      <GenericDedupeTool 
        dedupPlantType={dedupPlantType}
        setDedupPlantType={setDedupPlantType}
        dedupRunning={dedupRunning}
        dedupResult={dedupResult}
        runGenericDedup={runGenericDedup}
      />

      {/* Squash Umbrella Migration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎃 Squash Umbrella Migration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <div className="font-semibold text-blue-900 mb-1">This will:</div>
            <ul className="text-blue-800 space-y-1">
              <li>• Migrate all "Squash" varieties to canonical types</li>
              <li>• Zucchini varieties → Zucchini type</li>
              <li>• Pumpkin varieties → Pumpkin type</li>
              <li>• Winter varieties → Winter Squash type</li>
              <li>• Ambiguous varieties → Summer Squash (default)</li>
              <li>• Preserve all subcategory assignments</li>
              <li>• Run normalization after migration</li>
            </ul>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => runSquashMigration(true)}
              disabled={squashMigrationRunning}
              variant="outline"
              className="gap-2"
            >
              {squashMigrationRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Running...</>
              ) : (
                <><Play className="w-4 h-4" />Dry Run Preview</>
              )}
            </Button>
            <Button
              onClick={() => runSquashMigration(false)}
              disabled={squashMigrationRunning}
              className="bg-orange-600 hover:bg-orange-700 gap-2"
            >
              {squashMigrationRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Migrating...</>
              ) : (
                <><RefreshCw className="w-4 h-4" />Execute Migration</>
              )}
            </Button>
          </div>
          {squashMigrationResult && (
            <Alert className={squashMigrationResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={squashMigrationResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">{squashMigrationResult.dry_run ? 'Dry Run Results:' : 'Migration Results:'}</div>
                  {squashMigrationResult.success ? (
                    <>
                      <ul className="text-sm space-y-1">
                        <li>• Total varieties: {squashMigrationResult.summary?.total || 0}</li>
                        <li>• Zucchini: {squashMigrationResult.summary?.zucchini || 0}</li>
                        <li>• Pumpkin: {squashMigrationResult.summary?.pumpkin || 0}</li>
                        <li>• Winter Squash: {squashMigrationResult.summary?.winter || 0}</li>
                        <li>• Summer Squash (default): {squashMigrationResult.summary?.summer || 0}</li>
                      </ul>
                      {squashMigrationResult.migrations?.summer?.length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold">
                            Varieties defaulted to Summer Squash ({squashMigrationResult.migrations.summer.length})
                          </summary>
                          <div className="mt-2 space-y-1 max-h-48 overflow-auto">
                            {squashMigrationResult.migrations.summer.slice(0, 20).map((item, i) => (
                              <div key={i} className="p-2 bg-white rounded border text-xs">
                                {item.name} - {item.reason}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="text-sm">{squashMigrationResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Normalize Garden Spaces */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🏡 Normalize Garden Spaces
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Detects and renames duplicate space names within gardens
          </p>
          <div className="flex items-center gap-3">
            <Button
              onClick={runNormalizeSpaces}
              disabled={normalizeSpacesRunning}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {normalizeSpacesRunning ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Normalizing...</>
              ) : (
                <><Play className="w-4 h-4" />Normalize Spaces</>
              )}
            </Button>
          </div>
          {normalizeSpacesResult && (
            <Alert className={normalizeSpacesResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={normalizeSpacesResult.success ? 'text-green-800' : 'text-red-800'}>
                {normalizeSpacesResult.success ? (
                  <ul className="text-sm space-y-1">
                    <li>• Spaces renamed: {normalizeSpacesResult.summary?.spaces_renamed || 0}</li>
                    <li>• Duplicates found: {normalizeSpacesResult.summary?.duplicates_found || 0}</li>
                  </ul>
                ) : (
                  <div className="text-sm">{normalizeSpacesResult.error}</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Other Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Other Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link to={createPageUrl('AdminDataCleanup')}>
            <Button variant="outline" className="w-full justify-start gap-2">
              <AlertCircle className="w-4 h-4" />
              Data Cleanup
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <div className="font-semibold mb-1">Important Notes:</div>
              <ul className="space-y-1">
                <li>• These operations are safe to re-run multiple times</li>
                <li>• No data is permanently deleted (old subcategories are deactivated, not deleted)</li>
                <li>• Large operations may take 30-60 seconds to complete</li>
                <li>• After running, refresh catalog pages to see updated counts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GlobalDiagnostics() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    try {
      const [allVarieties, allSubcats] = await Promise.all([
        base44.entities.Variety.list(),
        base44.entities.PlantSubCategory.list()
      ]);

      const validSubcatIds = new Set(allSubcats.map(s => s.id));
      const activeSubcatIds = new Set(allSubcats.filter(s => s.is_active).map(s => s.id));

      // Normalize variety name
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

      // Group by normalized name + plant_type_id
      const nameGroups = {};
      const codeGroups = {};
      
      for (const v of allVarieties) {
        if (v.status !== 'active') continue;
        
        // Group by name
        const key = `${v.plant_type_id}__${normalizeVarietyName(v.variety_name)}`;
        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(v);
        
        // Group by variety_code
        if (v.variety_code) {
          if (!codeGroups[v.variety_code]) codeGroups[v.variety_code] = [];
          codeGroups[v.variety_code].push(v);
        }
      }

      const duplicatesByName = Object.entries(nameGroups)
        .filter(([_, varieties]) => varieties.length > 1)
        .map(([key, varieties]) => ({
          key,
          count: varieties.length,
          sample: varieties[0].variety_name,
          plant_type: varieties[0].plant_type_name
        }));

      const duplicatesByCode = Object.entries(codeGroups)
        .filter(([_, varieties]) => varieties.length > 1)
        .map(([code, varieties]) => ({
          code,
          count: varieties.length,
          sample: varieties[0].variety_name
        }));

      // Count invalid subcategories
      let invalidSubcatCount = 0;
      let emptySubcatCount = 0;

      for (const v of allVarieties) {
        if (v.status !== 'active') continue;
        
        // Get effective IDs
        let effectiveIds = [];
        if (v.plant_subcategory_id) effectiveIds.push(v.plant_subcategory_id);
        if (Array.isArray(v.plant_subcategory_ids)) {
          effectiveIds = effectiveIds.concat(v.plant_subcategory_ids);
        }
        effectiveIds = [...new Set(effectiveIds.filter(id => id && typeof id === 'string' && id.trim() !== ''))];

        // Check if has invalid/inactive subcats
        const hasInvalid = effectiveIds.some(id => !validSubcatIds.has(id) || !activeSubcatIds.has(id));
        if (hasInvalid) invalidSubcatCount++;

        // Check if truly empty
        if (effectiveIds.length === 0 || !effectiveIds.some(id => validSubcatIds.has(id))) {
          emptySubcatCount++;
        }
      }

      setDiagnostics({
        totalVarieties: allVarieties.filter(v => v.status === 'active').length,
        duplicatesByName: duplicatesByName.length,
        duplicatesByCode: duplicatesByCode.length,
        duplicateNameGroups: duplicatesByName.slice(0, 10),
        duplicateCodeGroups: duplicatesByCode.slice(0, 10),
        invalidSubcatCount,
        emptySubcatCount
      });
    } catch (error) {
      console.error('Error loading diagnostics:', error);
      setDiagnostics({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  }

  if (diagnostics?.error) {
    return <div className="text-red-600">Error: {diagnostics.error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-600">Total Varieties</div>
          <div className="text-2xl font-bold text-blue-700">{diagnostics.totalVarieties}</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="text-sm text-amber-600">Duplicate Groups (Name)</div>
          <div className="text-2xl font-bold text-amber-700">{diagnostics.duplicatesByName}</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg">
          <div className="text-sm text-orange-600">Duplicate Groups (Code)</div>
          <div className="text-2xl font-bold text-orange-700">{diagnostics.duplicatesByCode}</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          <div className="text-sm text-red-600">Invalid/Inactive Subcats</div>
          <div className="text-2xl font-bold text-red-700">{diagnostics.invalidSubcatCount}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">True Uncategorized</div>
          <div className="text-2xl font-bold text-gray-700">{diagnostics.emptySubcatCount}</div>
        </div>
      </div>

      {diagnostics.duplicateNameGroups.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Sample Duplicate Groups (by name)</summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-auto">
            {diagnostics.duplicateNameGroups.map((group, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded text-xs">
                {group.sample} ({group.plant_type}) - {group.count} duplicates
              </div>
            ))}
          </div>
        </details>
      )}

      {diagnostics.duplicateCodeGroups.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Sample Duplicate Groups (by code)</summary>
          <div className="mt-2 space-y-1 max-h-48 overflow-auto">
            {diagnostics.duplicateCodeGroups.map((group, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded text-xs">
                {group.code} - {group.sample} - {group.count} duplicates
              </div>
            ))}
          </div>
        </details>
      )}

      <Button onClick={loadDiagnostics} variant="outline" size="sm" className="gap-2">
        <RefreshCw className="w-4 h-4" />
        Refresh Diagnostics
      </Button>
    </div>
  );
}

function GenericDedupeTool({ dedupPlantType, setDedupPlantType, dedupRunning, dedupResult, runGenericDedup }) {
  const [plantTypes, setPlantTypes] = useState([]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-indigo-600" />
          Generic Variety Deduplication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Find and merge duplicate varieties for ANY plant type
        </p>
        
        <div>
          <Label>Select Plant Type</Label>
          <Select value={dedupPlantType || ''} onValueChange={setDedupPlantType}>
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

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => runGenericDedup(true)}
            disabled={dedupRunning || !dedupPlantType}
            variant="outline"
            className="gap-2"
          >
            {dedupRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Running...</>
            ) : (
              <><Play className="w-4 h-4" />Dry Run</>
            )}
          </Button>
          
          <Button
            onClick={() => runGenericDedup(false)}
            disabled={dedupRunning || !dedupPlantType}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            {dedupRunning ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Merging...</>
            ) : (
              <><RefreshCw className="w-4 h-4" />Execute Merge</>
            )}
          </Button>
        </div>

        {dedupResult && (
          <Alert className={dedupResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <AlertDescription className={dedupResult.success ? 'text-green-800' : 'text-red-800'}>
              <div className="space-y-2">
                <div className="font-semibold">
                  {dedupResult.dry_run ? 'Dry Run Results:' : 'Merge Results:'}
                </div>
                {dedupResult.success ? (
                  <>
                    <ul className="text-sm space-y-1">
                      <li>• Duplicate groups: {dedupResult.summary?.duplicate_groups || 0}</li>
                      <li>• Records to merge/merged: {dedupResult.summary?.records_to_merge || dedupResult.summary?.records_merged || 0}</li>
                      <li>• References updated: {dedupResult.summary?.references_updated || 0}</li>
                    </ul>
                    {dedupResult.groups && dedupResult.groups.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold">View groups (sample)</summary>
                        <div className="mt-2 space-y-2 max-h-64 overflow-auto">
                          {dedupResult.groups.slice(0, 10).map((group, i) => (
                            <div key={i} className="p-2 bg-white rounded border text-xs">
                              <div className="font-semibold">{group.canonical_name}</div>
                              <div className="text-gray-600">{group.duplicates} duplicates, completeness: {group.completeness_score}%</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <div className="text-sm">{dedupResult.error}</div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SubcategoryHealthByPlantType() {
  const [selectedType, setSelectedType] = useState('');
  const [plantTypes, setPlantTypes] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [normalizeResult, setNormalizeResult] = useState(null);

  useEffect(() => {
    loadPlantTypes();
  }, []);

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
      // Auto-select Zucchini for testing
      const zucchini = types.find(t => t.common_name === 'Zucchini');
      if (zucchini) setSelectedType(zucchini.id);
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const loadDiagnostics = async () => {
    if (!selectedType) return;
    
    setLoading(true);
    try {
      const [allSubcats, activeSubcats, varieties] = await Promise.all([
        base44.entities.PlantSubCategory.filter({ plant_type_id: selectedType }),
        base44.entities.PlantSubCategory.filter({ plant_type_id: selectedType, is_active: true }),
        base44.entities.Variety.filter({ plant_type_id: selectedType, status: 'active' })
      ]);
      
      const activeIds = new Set(activeSubcats.map(s => s.id));
      
      let withEffective = 0;
      let assignedToInactive = 0;
      let uncategorized = 0;
      
      for (const v of varieties) {
        // Get effective IDs
        let ids = [];
        if (Array.isArray(v.plant_subcategory_ids)) {
          ids = ids.concat(v.plant_subcategory_ids);
        }
        if (v.plant_subcategory_id) {
          ids.push(v.plant_subcategory_id);
        }
        ids = [...new Set(ids.filter(id => id && id.trim() !== ''))];
        
        const hasActive = ids.some(id => activeIds.has(id));
        const hasInactive = ids.some(id => !activeIds.has(id));
        
        if (ids.length === 0) {
          uncategorized++;
        } else if (hasActive) {
          withEffective++;
        }
        
        if (hasInactive) {
          assignedToInactive++;
        }
      }
      
      setDiagnostics({
        totalSubcats: allSubcats.length,
        activeSubcats: activeSubcats.length,
        inactiveSubcats: allSubcats.length - activeSubcats.length,
        totalVarieties: varieties.length,
        withEffective,
        assignedToInactive,
        uncategorized,
        activeList: activeSubcats
      });
    } catch (error) {
      console.error('Error loading diagnostics:', error);
      toast.error('Failed to load diagnostics');
    } finally {
      setLoading(false);
    }
  };

  const runNormalize = async () => {
    if (!selectedType) return;
    
    setNormalizing(true);
    setNormalizeResult(null);
    
    try {
      const response = await base44.functions.invoke('normalizeVarietySubcategories', { 
        plant_type_id: selectedType,
        dry_run: dryRun
      });
      
      if (response.data.success) {
        setNormalizeResult(response.data);
        toast.success(dryRun ? 'Dry run completed' : 'Normalization completed');
        if (!dryRun) {
          loadDiagnostics(); // Refresh
        }
      } else {
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('Normalize error:', error);
      toast.error('Normalization failed: ' + error.message);
    } finally {
      setNormalizing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔍 Subcategory Health (by Plant Type)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Select Plant Type</Label>
          <Select value={selectedType} onValueChange={(v) => {
            setSelectedType(v);
            setDiagnostics(null);
            setNormalizeResult(null);
          }}>
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
          onClick={loadDiagnostics}
          disabled={loading || !selectedType}
          variant="outline"
          className="gap-2"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
          ) : (
            <><RefreshCw className="w-4 h-4" />Load Diagnostics</>
          )}
        </Button>

        {diagnostics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Subcats</div>
                <div className="text-2xl font-bold">{diagnostics.totalSubcats}</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-green-600">Active</div>
                <div className="text-2xl font-bold text-green-700">{diagnostics.activeSubcats}</div>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-sm text-red-600">Inactive</div>
                <div className="text-2xl font-bold text-red-700">{diagnostics.inactiveSubcats}</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-600">Total Varieties</div>
                <div className="text-2xl font-bold text-blue-700">{diagnostics.totalVarieties}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <div className="text-sm text-emerald-600">With Subcategory</div>
                <div className="text-2xl font-bold text-emerald-700">{diagnostics.withEffective}</div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-600">Assigned to Inactive</div>
                <div className="text-2xl font-bold text-orange-700">{diagnostics.assignedToInactive}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Uncategorized</div>
                <div className="text-2xl font-bold text-gray-700">{diagnostics.uncategorized}</div>
              </div>
            </div>

            {diagnostics.activeList?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Active Subcategories:</h4>
                <div className="space-y-1">
                  {diagnostics.activeList.map(s => (
                    <div key={s.id} className="text-sm p-2 bg-white rounded border flex items-center gap-2">
                      {s.icon && <span>{s.icon}</span>}
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-gray-500 font-mono ml-auto">{s.subcat_code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Dry Run (preview only)</span>
                </label>
              </div>
              <Button
                onClick={runNormalize}
                disabled={normalizing}
                className="bg-purple-600 hover:bg-purple-700 gap-2"
              >
                {normalizing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Normalizing...</>
                ) : (
                  <><Play className="w-4 h-4" />Normalize Subcategories</>
                )}
              </Button>
            </div>

            {normalizeResult && (
              <Alert className={normalizeResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <AlertDescription className={normalizeResult.success ? 'text-green-800' : 'text-red-800'}>
                  <div className="space-y-2">
                    <div className="font-semibold">{normalizeResult.dry_run ? 'Dry Run:' : 'Results:'}</div>
                    {normalizeResult.success ? (
                      <>
                        <ul className="text-sm space-y-1">
                          <li>• Would update: {normalizeResult.summary?.would_update || normalizeResult.summary?.varieties_updated}</li>
                          <li>• Already OK: {normalizeResult.summary?.already_ok}</li>
                          <li>• String arrays fixed: {normalizeResult.summary?.had_string_array_fixed}</li>
                          <li>• Inactive removed: {normalizeResult.summary?.had_inactive_removed}</li>
                          <li>• Became uncategorized: {normalizeResult.summary?.became_uncategorized}</li>
                        </ul>
                        {normalizeResult.summary?.sample_changes?.length > 0 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-semibold">Sample changes</summary>
                            <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                              {normalizeResult.summary.sample_changes.map((c, i) => (
                                <div key={i} className="p-1 bg-white rounded text-xs">
                                  {c.name}: {c.before.ids.length} → {c.after.ids.length} subcats
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <div className="text-sm">{normalizeResult.error}</div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PepperDiagnostics() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const loadDiagnostics = async () => {
    try {
      // Find Pepper plant type
      const pepperTypes = await base44.entities.PlantType.filter({ common_name: 'Pepper' });
      if (pepperTypes.length === 0) {
        setDiagnostics({ error: 'Pepper plant type not found' });
        return;
      }
      
      const pepperTypeId = pepperTypes[0].id;
      
      // Load subcategories and varieties
      const [allSubcats, activeSubcats, varieties] = await Promise.all([
        base44.entities.PlantSubCategory.filter({ plant_type_id: pepperTypeId }),
        base44.entities.PlantSubCategory.filter({ plant_type_id: pepperTypeId, is_active: true }),
        base44.entities.Variety.filter({ plant_type_id: pepperTypeId })
      ]);
      
      // Count variety assignments
      const canonicalIds = activeSubcats.map(s => s.id);
      const inactiveIds = allSubcats.filter(s => !s.is_active).map(s => s.id);
      
      let assignedToCanonical = 0;
      let assignedToInactive = 0;
      let uncategorized = 0;
      
      for (const v of varieties) {
        const subcatIds = v.plant_subcategory_ids || (v.plant_subcategory_id ? [v.plant_subcategory_id] : []);
        
        if (subcatIds.length === 0) {
          uncategorized++;
        } else if (subcatIds.some(id => canonicalIds.includes(id))) {
          assignedToCanonical++;
        } else if (subcatIds.some(id => inactiveIds.includes(id))) {
          assignedToInactive++;
        }
      }
      
      setDiagnostics({
        totalSubcats: allSubcats.length,
        activeSubcats: activeSubcats.length,
        inactiveSubcats: allSubcats.length - activeSubcats.length,
        totalVarieties: varieties.length,
        assignedToCanonical,
        assignedToInactive,
        uncategorized,
        canonicalBuckets: activeSubcats.map(s => ({
          id: s.id,
          name: s.name,
          subcat_code: s.subcat_code,
          sort_order: s.sort_order
        }))
      });
    } catch (error) {
      console.error('Error loading diagnostics:', error);
      setDiagnostics({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  }

  if (diagnostics?.error) {
    return <div className="text-red-600">Error: {diagnostics.error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">Total Subcategories</div>
          <div className="text-2xl font-bold">{diagnostics.totalSubcats}</div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="text-sm text-green-600">Active</div>
          <div className="text-2xl font-bold text-green-700">{diagnostics.activeSubcats}</div>
        </div>
        <div className="p-3 bg-red-50 rounded-lg">
          <div className="text-sm text-red-600">Inactive</div>
          <div className="text-2xl font-bold text-red-700">{diagnostics.inactiveSubcats}</div>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-600">Total Varieties</div>
          <div className="text-2xl font-bold text-blue-700">{diagnostics.totalVarieties}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
          <div className="text-sm text-emerald-600">Assigned to Canonical</div>
          <div className="text-xl font-bold text-emerald-700">{diagnostics.assignedToCanonical}</div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-sm text-orange-600">Assigned to Inactive</div>
          <div className="text-xl font-bold text-orange-700">{diagnostics.assignedToInactive}</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600">Uncategorized</div>
          <div className="text-xl font-bold text-gray-700">{diagnostics.uncategorized}</div>
        </div>
      </div>

      {diagnostics.canonicalBuckets.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Active Canonical Buckets:</h4>
          <div className="space-y-2">
            {diagnostics.canonicalBuckets.map(bucket => (
              <div key={bucket.id} className="flex items-center gap-2 text-sm p-2 bg-white rounded border">
                <Badge variant="outline">{bucket.sort_order}</Badge>
                <span className="font-medium">{bucket.name}</span>
                <span className="text-xs text-gray-500 font-mono">{bucket.subcat_code}</span>
                <span className="text-xs text-gray-400 ml-auto">{bucket.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={loadDiagnostics}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh Diagnostics
      </Button>
    </div>
  );
}