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
  const [selectedPlantType, setSelectedPlantType] = useState('all');
  const [matchingMode, setMatchingMode] = useState('code_first');
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
    setDryRunning(true);
    setDryRunResult(null);
    
    try {
      const response = await base44.functions.invoke('deduplicateVarietiesDryRun', {
        plant_type_id: selectedPlantType === 'all' ? null : selectedPlantType,
        matching_mode: matchingMode
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
    if (!dryRunResult || dryRunResult.duplicateGroups.length === 0) {
      toast.error('Run dry-run first to see what will be merged');
      return;
    }

    if (!confirm(`Merge ${dryRunResult.duplicateGroups.length} duplicate groups? This will update references and mark duplicates as removed.`)) {
      return;
    }

    setMerging(true);
    setMergeResult(null);
    
    try {
      const response = await base44.functions.invoke('mergeVarietyDuplicates', {
        plant_type_id: selectedPlantType === 'all' ? null : selectedPlantType,
        matching_mode: matchingMode
      });
      
      if (response.data.success) {
        setMergeResult(response.data);
        toast.success('Merge completed successfully!');
        // Clear dry run so user runs it again to see results
        setDryRunResult(null);
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plant Types</SelectItem>
                  {plantTypes.map(pt => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.common_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matching Mode</Label>
              <Select value={matchingMode} onValueChange={setMatchingMode}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code_first">Variety Code (primary), Name (fallback)</SelectItem>
                  <SelectItem value="name_only">Normalized Name Only</SelectItem>
                </SelectContent>
              </Select>
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
      {dryRunResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Dry-Run Results
              <Badge variant={dryRunResult.duplicateGroups.length > 0 ? 'destructive' : 'default'}>
                {dryRunResult.duplicateGroups.length} duplicate groups
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dryRunResult.duplicateGroups.length === 0 ? (
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
                    Found {dryRunResult.duplicateGroups.length} duplicate groups affecting {dryRunResult.totalDuplicates} varieties
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {dryRunResult.duplicateGroups.slice(0, 10).map((group, idx) => (
                    <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {group.variety_name}
                          <span className="text-sm text-gray-500 ml-2">({group.plant_type_name})</span>
                        </h4>
                        <Badge variant="outline">{group.duplicates.length} records</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        {group.duplicates.map((dup, dupIdx) => (
                          <div 
                            key={dup.id}
                            className={`p-2 rounded ${dup.isCanonical ? 'bg-green-100 border border-green-300' : 'bg-white border'}`}
                          >
                            <div className="flex items-center gap-2">
                              {dup.isCanonical && <Badge className="bg-green-600">CANONICAL</Badge>}
                              <span className="font-mono text-xs text-gray-500">{dup.id}</span>
                              {dup.variety_code && (
                                <Badge variant="outline" className="text-xs">Code: {dup.variety_code}</Badge>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              Created: {new Date(dup.created_date).toLocaleDateString()} • 
                              Fields: {dup.fieldCount} • 
                              Images: {dup.imageCount}
                            </div>
                          </div>
                        ))}
                      </div>
                      {group.mergePreview && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                          <div className="font-semibold text-blue-900">After merge:</div>
                          <div className="text-blue-800 mt-1">
                            Images: {group.mergePreview.images?.length || 0} | 
                            Synonyms: {group.mergePreview.synonyms?.length || 0} | 
                            Subcategories: {group.mergePreview.plant_subcategory_ids?.length || 0}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {dryRunResult.duplicateGroups.length > 10 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... and {dryRunResult.duplicateGroups.length - 10} more groups
                    </p>
                  )}
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
                      Apply Merge ({dryRunResult.duplicateGroups.length} groups)
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merge Results */}
      {mergeResult && (
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
                  <div className="font-semibold">Results:</div>
                  <ul className="text-sm space-y-1">
                    <li>• Groups merged: {mergeResult.summary.groupsMerged}</li>
                    <li>• Records merged into canonical: {mergeResult.summary.recordsMerged}</li>
                    <li>• References updated: {mergeResult.summary.referencesUpdated}</li>
                    <li>• Remaining duplicates: {mergeResult.summary.remainingDuplicates}</li>
                    <li>• Completed at: {new Date(mergeResult.timestamp).toLocaleString()}</li>
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