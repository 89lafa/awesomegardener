import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw
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
  const [backfillResult, setBackfillResult] = useState(null);
  const [pepperCleanupResult, setPepperCleanupResult] = useState(null);

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

      {/* Backfill Subcategories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Backfill Variety Subcategories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Ensures all varieties have both <code className="bg-gray-100 px-1 rounded">plant_subcategory_id</code> and <code className="bg-gray-100 px-1 rounded">plant_subcategory_ids</code> populated for backwards compatibility.
          </p>

          <div className="flex items-center gap-3">
            <Button
              onClick={runBackfill}
              disabled={backfillRunning}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {backfillRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Backfill
                </>
              )}
            </Button>

            {backfillResult && (
              <Badge variant={backfillResult.success ? "default" : "destructive"} className="gap-1">
                {backfillResult.success ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {backfillResult.success ? 'Success' : 'Failed'}
              </Badge>
            )}
          </div>

          {backfillResult && (
            <Alert className={backfillResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={backfillResult.success ? 'text-green-800' : 'text-red-800'}>
                <div className="space-y-2">
                  <div className="font-semibold">Results:</div>
                  {backfillResult.success ? (
                    <ul className="text-sm space-y-1">
                      <li>• Total varieties: {backfillResult.totalVarieties}</li>
                      <li>• Updated: {backfillResult.updated}</li>
                      <li>• Skipped (already OK): {backfillResult.skipped}</li>
                      <li>• Run at: {new Date(backfillResult.timestamp).toLocaleString()}</li>
                      <li>• Run by: {backfillResult.runBy}</li>
                    </ul>
                  ) : (
                    <div className="text-sm">{backfillResult.error}</div>
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
                    <ul className="text-sm space-y-1">
                      <li>• Canonical subcategories created/updated: {pepperCleanupResult.canonicalSubcatsCreated}</li>
                      <li>• Old subcategories deactivated: {pepperCleanupResult.oldSubcatsDeactivated}</li>
                      <li>• Pepper varieties updated: {pepperCleanupResult.varietiesUpdated}</li>
                      <li>• Run at: {new Date(pepperCleanupResult.timestamp).toLocaleString()}</li>
                      <li>• Run by: {pepperCleanupResult.runBy}</li>
                    </ul>
                  ) : (
                    <div className="text-sm">{pepperCleanupResult.error}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
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