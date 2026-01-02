import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Download,
  Eye,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ENTITY_MAP = {
  'AG_PlantGroup.csv': 'PlantGroup',
  'AG_PlantFamily.csv': 'PlantFamily',
  'AG_PlantType.csv': 'PlantType',
  'AG_FacetGroup.csv': 'FacetGroup',
  'AG_Facet.csv': 'Facet',
  'AG_PlantTypeFacetGroupMap.csv': 'PlantTypeFacetGroupMap',
  'AG_TraitDefinition.csv': 'TraitDefinition',
  'AG_PlantTypeTraitTemplate.csv': 'PlantTypeTraitTemplate',
};

export default function AdminDataImport() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState({});
  const [processing, setProcessing] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData?.role !== 'admin') {
        window.location.href = '/';
        return;
      }
      setUser(userData);
    } catch (error) {
      window.location.href = '/';
    }
  };

  const handleFileUpload = (fileName, event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.csv')) {
      setFiles(prev => ({ ...prev, [fileName]: file }));
    } else {
      toast.error('Please upload a CSV file');
    }
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index];
        // Parse boolean
        if (value === 'true' || value === 'TRUE') value = true;
        if (value === 'false' || value === 'FALSE') value = false;
        // Parse number
        if (value && !isNaN(value) && value !== '') {
          const num = parseFloat(value);
          if (!isNaN(num)) value = num;
        }
        row[header] = value;
      });
      rows.push(row);
    }
    return rows;
  };

  const handleImport = async () => {
    if (Object.keys(files).length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setProcessing(true);
    setResults(null);
    const importResults = {};

    try {
      // Process in order (dependencies first)
      const orderedFiles = [
        'AG_PlantGroup.csv',
        'AG_PlantFamily.csv',
        'AG_PlantType.csv',
        'AG_FacetGroup.csv',
        'AG_Facet.csv',
        'AG_PlantTypeFacetGroupMap.csv',
        'AG_TraitDefinition.csv',
        'AG_PlantTypeTraitTemplate.csv',
      ];

      for (const fileName of orderedFiles) {
        const file = files[fileName];
        if (!file) continue;

        const entityName = ENTITY_MAP[fileName];
        const text = await file.text();
        const rows = parseCSV(text);

        if (dryRun) {
          // Preview mode
          importResults[fileName] = {
            status: 'preview',
            count: rows.length,
            sample: rows.slice(0, 5)
          };
        } else {
          // Actual import with upsert
          const imported = [];
          const errors = [];

          for (const row of rows) {
            try {
              // Check if exists (by ID or unique field)
              let existing = null;
              if (row.id) {
                const results = await base44.entities[entityName].filter({ id: row.id });
                existing = results[0];
              }

              if (existing) {
                await base44.entities[entityName].update(existing.id, row);
                imported.push({ action: 'updated', data: row });
              } else {
                await base44.entities[entityName].create(row);
                imported.push({ action: 'created', data: row });
              }

              // Audit log
              await base44.entities.TaxonomyAuditLog.create({
                actor_user_id: user.id,
                actor_email: user.email,
                action: `CSV_IMPORT ${existing ? 'UPDATE' : 'CREATE'} ${entityName}`,
                object_type: entityName,
                object_id: existing?.id || 'new',
                before_payload: existing || {},
                after_payload: row
              });
            } catch (error) {
              errors.push({ row, error: error.message });
            }
          }

          importResults[fileName] = {
            status: 'complete',
            imported: imported.length,
            errors: errors.length,
            errorDetails: errors.slice(0, 10)
          };
        }
      }

      setResults(importResults);
      if (!dryRun) {
        toast.success('Import complete!');
      } else {
        toast.success('Preview generated');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plant Master Taxonomy Import</h1>
        <p className="text-gray-600 mt-1">Upload CSV files to populate the plant database</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Admin only. Files will be processed in order to maintain referential integrity.
        </AlertDescription>
      </Alert>

      {/* File Upload Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(ENTITY_MAP).map(([fileName, entityName]) => {
          const uploaded = files[fileName];
          return (
            <Card key={fileName} className={cn(
              "transition-colors",
              uploaded && "border-emerald-300 bg-emerald-50/50"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{fileName}</span>
                  {uploaded && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                </CardTitle>
                <p className="text-sm text-gray-600">{entityName}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileUpload(fileName, e)}
                    className="flex-1"
                  />
                  {uploaded && (
                    <Badge variant="outline" className="text-emerald-600">
                      {uploaded.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Import Options */}
      <Card>
        <CardHeader>
          <CardTitle>Import Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="dryRun"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
            <Label htmlFor="dryRun" className="text-sm font-normal">
              Preview mode (dry run) - Don't save to database
            </Label>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={processing || Object.keys(files).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : dryRun ? (
                <>
                  <Eye className="w-4 h-4" />
                  Preview Import
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Import
                </>
              )}
            </Button>
            {results && dryRun && (
              <Button
                onClick={() => setDryRun(false)}
                variant="outline"
                className="gap-2"
              >
                Looks good? Run actual import
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>
              {dryRun ? 'Import Preview' : 'Import Results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(results).map(([fileName, result]) => (
                <div key={fileName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{fileName}</h4>
                    <Badge className={
                      result.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }>
                      {result.status}
                    </Badge>
                  </div>
                  
                  {result.status === 'preview' && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        {result.count} rows to import
                      </p>
                      {result.sample && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                            View sample (first 5 rows)
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 rounded overflow-x-auto">
                            {JSON.stringify(result.sample, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  {result.status === 'complete' && (
                    <div className="text-sm space-y-1">
                      <p className="text-green-600">✓ {result.imported} records imported</p>
                      {result.errors > 0 && (
                        <details className="text-red-600">
                          <summary className="cursor-pointer">
                            ✗ {result.errors} errors
                          </summary>
                          <div className="mt-2 space-y-1">
                            {result.errorDetails?.map((err, i) => (
                              <div key={i} className="text-xs bg-red-50 p-2 rounded">
                                {err.error}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}