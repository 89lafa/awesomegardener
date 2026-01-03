import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Trash2, 
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDataCleanup() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [cleanupComplete, setCleanupComplete] = useState(false);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
      }
      setUser(userData);
      await loadPreview();
    } catch (error) {
      window.location.href = '/Dashboard';
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      const allTypes = await base44.entities.PlantType.list();
      
      const invalidTypes = allTypes.filter(type => {
        const hasInvalidName = !type.common_name || type.common_name.trim().length < 2;
        const hasInvalidId = !type.id;
        return hasInvalidName || hasInvalidId;
      });

      setPreview({
        total: invalidTypes.length,
        samples: invalidTypes.slice(0, 10)
      });
    } catch (error) {
      console.error('Error loading preview:', error);
    }
  };

  const handleCleanup = async () => {
    if (!confirm(`Delete ${preview.total} invalid plant types? This cannot be undone.`)) return;

    setCleaning(true);
    try {
      const allTypes = await base44.entities.PlantType.list();
      
      const invalidTypes = allTypes.filter(type => {
        const hasInvalidName = !type.common_name || type.common_name.trim().length < 2;
        const hasInvalidId = !type.id;
        return hasInvalidName || hasInvalidId;
      });

      let deleted = 0;
      for (const type of invalidTypes) {
        try {
          // Check if plant type still exists
          const exists = await base44.entities.PlantType.filter({ id: type.id });
          if (exists.length === 0) {
            console.log('PlantType already deleted:', type.id);
            deleted++;
            continue;
          }

          // Delete related records first
          const facetMaps = await base44.entities.PlantTypeFacetGroupMap.filter({ plant_type_id: type.id });
          for (const map of facetMaps) {
            try {
              await base44.entities.PlantTypeFacetGroupMap.delete(map.id);
            } catch (err) {
              if (!err.message?.includes('not found')) throw err;
            }
          }

          const traitTemplates = await base44.entities.PlantTypeTraitTemplate.filter({ plant_type_id: type.id });
          for (const template of traitTemplates) {
            try {
              await base44.entities.PlantTypeTraitTemplate.delete(template.id);
            } catch (err) {
              if (!err.message?.includes('not found')) throw err;
            }
          }

          // Delete the plant type
          await base44.entities.PlantType.delete(type.id);
          deleted++;
        } catch (error) {
          console.error(`Error deleting plant type ${type.id}:`, error);
        }
      }

      setCleanupComplete(true);
      toast.success(`Cleanup complete! Deleted ${deleted} invalid plant types.`);
      await loadPreview();
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Cleanup failed: ' + error.message);
    } finally {
      setCleaning(false);
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
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('AdminDataImport')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Cleanup</h1>
          <p className="text-gray-600 mt-1">Remove invalid plant type records</p>
        </div>
      </div>

      {cleanupComplete && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Cleanup completed successfully! Invalid plant types have been removed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invalid Plant Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview && preview.total > 0 ? (
            <>
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Found <strong>{preview.total}</strong> invalid plant type records that will be removed.
                </AlertDescription>
              </Alert>

              <div>
                <h3 className="font-semibold mb-2">Preview (first 10):</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 max-h-64 overflow-auto">
                  {preview.samples.map((type, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-mono text-gray-600">ID: {type.id || 'NULL'}</span>
                      {' - '}
                      <span className="text-gray-800">
                        Name: {type.common_name || 'NULL/EMPTY'}
                      </span>
                      {' - '}
                      <span className="text-gray-500">Category: {type.category || 'NULL'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">What will be deleted:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Plant types with missing or empty common_name</li>
                  <li>• Plant types with missing ID</li>
                  <li>• Related facet group mappings</li>
                  <li>• Related trait templates</li>
                </ul>
              </div>

              <Button
                onClick={handleCleanup}
                disabled={cleaning}
                className="w-full bg-red-600 hover:bg-red-700 gap-2"
              >
                {cleaning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {preview.total} Invalid Plant Types
                  </>
                )}
              </Button>
            </>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription className="text-green-800">
                No invalid plant types found. Your database is clean!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}