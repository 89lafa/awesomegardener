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
  const [diagnostics, setDiagnostics] = useState(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  React.useEffect(() => {
    if (user) {
      loadDiagnostics();
    }
  }, [user]);

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

  const loadDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const response = await base44.functions.invoke('getDiagnostics', {});
      if (response.data.success) {
        setDiagnostics(response.data.diagnostics);
      }
    } catch (error) {
      console.error('Error loading diagnostics:', error);
    } finally {
      setLoadingDiagnostics(false);
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
        await loadDiagnostics(); // Refresh diagnostics
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

      {/* Data Health Diagnostics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              Data Health Overview
            </CardTitle>
            <Button
              onClick={loadDiagnostics}
              variant="outline"
              size="sm"
              disabled={loadingDiagnostics}
              className="gap-2"
            >
              {loadingDiagnostics ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDiagnostics ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : diagnostics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600">Total Varieties</div>
                  <div className="text-xl font-bold">{diagnostics.total_varieties}</div>
                </div>
                <div className={`p-3 rounded-lg ${diagnostics.duplicate_groups_by_code > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-xs ${diagnostics.duplicate_groups_by_code > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Duplicates (by code)
                  </div>
                  <div className={`text-xl font-bold ${diagnostics.duplicate_groups_by_code > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {diagnostics.duplicate_groups_by_code} groups
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${diagnostics.duplicate_groups_by_name > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                  <div className={`text-xs ${diagnostics.duplicate_groups_by_name > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                    Duplicates (by name)
                  </div>
                  <div className={`text-xl font-bold ${diagnostics.duplicate_groups_by_name > 0 ? 'text-yellow-700' : 'text-green-700'}`}>
                    {diagnostics.duplicate_groups_by_name} groups
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${diagnostics.varieties_with_invalid_subcats > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className={`text-xs ${diagnostics.varieties_with_invalid_subcats > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Invalid Subcats
                  </div>
                  <div className={`text-xl font-bold ${diagnostics.varieties_with_invalid_subcats > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {diagnostics.varieties_with_invalid_subcats}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-xs text-blue-600">Inactive Subcats</div>
                  <div className="text-lg font-bold text-blue-700">{diagnostics.varieties_with_inactive_subcats}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600">True Uncategorized</div>
                  <div className="text-lg font-bold">{diagnostics.true_uncategorized}</div>
                </div>
              </div>

              {diagnostics.sample_duplicates_by_code?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-gray-700">Sample duplicates by code</summary>
                  <div className="mt-2 space-y-1">
                    {diagnostics.sample_duplicates_by_code.map((g, i) => (
                      <div key={i} className="p-2 bg-white border rounded">
                        <span className="font-mono text-blue-600">{g.code}</span> - {g.count} copies: {g.names}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Click Refresh to load diagnostics</p>
          )}
        </CardContent>
      </Card>

      {/* Normalize Subcategories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            Normalize Variety Subcategories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Sanitizes and normalizes subcategory fields for all varieties. Removes invalid IDs, ensures consistency between single and array fields.
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
                  Normalize Subcategories
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
                    <ul className="text-sm space-y-1">
                      <li>• Varieties scanned: {normalizeResult.varieties_scanned}</li>
                      <li>• Varieties updated: {normalizeResult.varieties_updated}</li>
                      <li>• Invalid IDs removed: {normalizeResult.invalid_ids_removed}</li>
                      <li>• Run at: {new Date(normalizeResult.timestamp).toLocaleString()}</li>
                    </ul>
                  ) : (
                    <div className="text-sm">{normalizeResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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

      {/* Generic Deduplication Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Generic Variety Deduplication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Works for ANY plant type. Finds duplicates by variety_code or normalized name, merges data, and updates all references.
          </p>
          <Link to={createPageUrl('AdminDeduplicateVarieties')}>
            <Button variant="outline" className="w-full justify-start gap-2">
              <RefreshCw className="w-4 h-4" />
              Open Deduplication Tool
            </Button>
          </Link>
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