import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download,
  Info,
  Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const IMPORT_ORDER = [
  { key: 'PlantGroup', label: 'Plant Groups', file: 'AG_PlantGroup.csv' },
  { key: 'PlantFamily', label: 'Plant Families', file: 'AG_PlantFamily.csv' },
  { key: 'PlantType', label: 'Plant Types', file: 'AG_PlantType.csv' },
  { key: 'Variety', label: 'Plant Varieties', file: 'AG_Variety_Starter_350.csv or AG_Variety_Extended_583.csv' },
  { key: 'FacetGroup', label: 'Facet Groups', file: 'AG_FacetGroup.csv' },
  { key: 'Facet', label: 'Facets', file: 'AG_Facet.csv' },
  { key: 'PlantTypeFacetGroupMap', label: 'Plant Type Facet Maps', file: 'AG_PlantTypeFacetGroupMap.csv' },
  { key: 'TraitDefinition', label: 'Trait Definitions', file: 'AG_TraitDefinition.csv' },
  { key: 'PlantTypeTraitTemplate', label: 'Plant Type Trait Templates', file: 'AG_PlantTypeTraitTemplate.csv' },
];

export default function AdminDataImport() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState({});
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [importMode, setImportMode] = useState('UPSERT_BY_ID');
  const [results, setResults] = useState(null);

  React.useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      console.log('[AdminDataImport] Checking admin access...');
      const userData = await base44.auth.me();
      console.log('[AdminDataImport] User loaded:', userData?.email, 'Role:', userData?.role);
      
      if (!userData || userData.role !== 'admin') {
        console.log('[AdminDataImport] Not admin, redirecting');
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('[AdminDataImport] Auth check failed:', error);
      window.location.href = '/Dashboard';
    }
  };

  const handleFileChange = (key, e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles({ ...files, [key]: file });
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      data.push(obj);
    }
    
    return data;
  };

  const handleImport = async () => {
    if (Object.keys(files).length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const importResults = {};

      for (const item of IMPORT_ORDER) {
        const file = files[item.key];
        if (!file) continue;

        const text = await file.text();
        const data = parseCSV(text);

        if (data.length === 0) {
          importResults[item.key] = {
            status: 'error',
            message: 'No data found in file',
            inserted: 0,
            updated: 0,
            skipped: 0
          };
          continue;
        }

        if (dryRun) {
          importResults[item.key] = {
            status: 'success',
            message: 'Dry run - no changes made',
            inserted: data.length,
            updated: 0,
            skipped: 0,
            rejected: 0,
            preview: data.slice(0, 25)
          };
        } else {
          let inserted = 0;
          let updated = 0;
          let skipped = 0;
          let rejected = 0;
          const skipReasons = [];

          // For Variety import, preload PlantType lookup
          let plantTypeLookup = {};
          if (item.key === 'Variety') {
            const allPlantTypes = await base44.entities.PlantType.list();
            allPlantTypes.forEach(pt => {
              if (pt.plant_type_code) plantTypeLookup[pt.plant_type_code] = pt.id;
              plantTypeLookup[pt.id] = pt.id; // Also map id to id
            });
          }

          for (const row of data) {
            try {
              // Validate required fields
              if (item.key === 'PlantType') {
                if (!row.common_name || row.common_name.trim().length < 2) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing or invalid common_name' });
                  continue;
                }
              }

              if (item.key === 'Variety') {
                if (!row.variety_name || !row.plant_type_id) {
                  rejected++;
                  skipReasons.push({ row, reason: 'Missing variety_name or plant_type_id' });
                  continue;
                }

                // Resolve plant_type_id
                let resolvedTypeId = row.plant_type_id;
                if (!plantTypeLookup[resolvedTypeId]) {
                  // Not found, skip
                  rejected++;
                  skipReasons.push({ row, reason: `Unknown plant_type_code: ${row.plant_type_id}` });
                  continue;
                }
                resolvedTypeId = plantTypeLookup[resolvedTypeId];

                // Check for duplicate
                const existing = await base44.entities.Variety.filter({ 
                  plant_type_id: resolvedTypeId,
                  variety_name: row.variety_name 
                });

                const varietyData = {
                  plant_type_id: resolvedTypeId,
                  variety_name: row.variety_name,
                  synonyms: row.synonyms ? row.synonyms.split('|') : [],
                  days_to_maturity: row.days_to_maturity ? parseInt(row.days_to_maturity) : null,
                  spacing_recommended: row.spacing_recommended ? parseInt(row.spacing_recommended) : null,
                  plant_height_typical: row.plant_height_typical || null,
                  sun_requirement: row.sun_requirement || null,
                  water_requirement: row.water_requirement || null,
                  trellis_required: row.trellis_required === 'true',
                  grower_notes: row.grower_notes || null,
                  source_attribution: row.source_attribution || 'CSV Import',
                  status: 'active',
                  is_custom: false
                };

                if (existing.length > 0) {
                  await base44.entities.Variety.update(existing[0].id, varietyData);
                  updated++;
                } else {
                  await base44.entities.Variety.create(varietyData);
                  inserted++;
                }
                continue;
              }

              if (importMode === 'INSERT_ONLY') {
                await base44.entities[item.key].create(row);
                inserted++;
              } else if (importMode === 'UPSERT_BY_ID') {
                // Try to find existing by id
                const existing = row.id ? await base44.entities[item.key].filter({ id: row.id }) : [];
                
                if (existing.length > 0) {
                  await base44.entities[item.key].update(existing[0].id, row);
                  updated++;
                } else {
                  await base44.entities[item.key].create(row);
                  inserted++;
                }
              }
            } catch (error) {
              console.error(`Error importing ${item.key}:`, error);
              skipped++;
              skipReasons.push({ row, reason: error.message });
            }
          }

          importResults[item.key] = {
            status: 'success',
            message: 'Import completed',
            inserted,
            updated,
            skipped,
            rejected,
            skipReasons: skipReasons.slice(0, 20) // First 20 reasons
          };
        }
      }

      setResults(importResults);
      
      if (!dryRun) {
        toast.success('Import completed successfully!');
      } else {
        toast.success('Dry run completed - review results below');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleZipUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    toast.error('ZIP import not yet implemented. Please upload individual CSV files.');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Data Import Error" fallbackMessage="An error occurred loading the import page. Please refresh and try again.">
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Data Imports</h1>
        <p className="text-gray-600 mt-1">Import plant taxonomy and catalog data</p>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          <strong>Import Order:</strong> Files must be imported in the correct order to maintain referential integrity.
          PlantGroup → PlantFamily → PlantType → FacetGroup → Facet → Mappings
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Data Cleanup</h3>
              <p className="text-sm text-gray-600">Remove invalid plant type records</p>
            </div>
            <Link to={createPageUrl('AdminDataCleanup')}>
              <Button variant="outline" className="gap-2">
                <Trash2 className="w-4 h-4" />
                Cleanup Tool
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Import Method */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="zip">Upload ZIP (All CSVs)</Label>
            <Input
              id="zip"
              type="file"
              accept=".zip"
              onChange={handleZipUpload}
              className="mt-2"
            />
            <p className="text-sm text-gray-500 mt-1">Upload a ZIP file containing all required CSVs</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">OR upload individually</span>
            </div>
          </div>

          {/* Individual File Uploads */}
          <div className="grid md:grid-cols-2 gap-4">
            {IMPORT_ORDER.map((item) => (
              <div key={item.key} className="space-y-2">
                <Label htmlFor={item.key}>{item.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={item.key}
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileChange(item.key, e)}
                    className="flex-1"
                  />
                  {files[item.key] && (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-gray-500">{item.file}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Import Controls */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Import Mode</Label>
            <Select value={importMode} onValueChange={setImportMode}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INSERT_ONLY">Insert Only (skip existing)</SelectItem>
                <SelectItem value="UPSERT_BY_ID">Upsert by ID (update existing)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Upsert mode will update existing records by ID, or insert if not found
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Dry Run (Preview only)</span>
              </label>
            </div>
            <Button
              onClick={handleImport}
              disabled={importing || Object.keys(files).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {dryRun ? 'Preview Import' : 'Start Import'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold">
              {dryRun ? 'Preview Results' : 'Import Results'}
            </h2>
            {Object.entries(results).map(([key, result]) => (
              <Card key={key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {IMPORT_ORDER.find(i => i.key === key)?.label}
                    </CardTitle>
                    {result.status === 'success' ? (
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">Error</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-green-600">
                      Inserted: <strong>{result.inserted}</strong>
                    </span>
                    <span className="text-blue-600">
                      Updated: <strong>{result.updated}</strong>
                    </span>
                    {result.skipped > 0 && (
                      <span className="text-yellow-600">
                        Skipped: <strong>{result.skipped}</strong>
                      </span>
                    )}
                    {result.rejected > 0 && (
                      <span className="text-red-600">
                        Rejected: <strong>{result.rejected}</strong>
                      </span>
                    )}
                  </div>
                  {result.skipReasons && result.skipReasons.length > 0 && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-xs text-yellow-800 mb-2 font-medium">Skip/Reject Reasons:</p>
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {result.skipReasons.map((item, idx) => (
                          <p key={idx} className="text-xs text-yellow-700">
                            Row {idx + 1}: {item.reason}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.preview && result.preview.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-2">First 5 records:</p>
                      <pre className="text-xs text-gray-700 overflow-auto max-h-32">
                        {JSON.stringify(result.preview, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
    </ErrorBoundary>
  );
}