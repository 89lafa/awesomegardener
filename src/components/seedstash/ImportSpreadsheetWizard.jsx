import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  ArrowRight,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const TEMPLATE_HEADERS = [
  'variety_name',
  'plant_type',
  'quantity',
  'unit',
  'year_acquired',
  'packed_for_year',
  'vendor_name',
  'vendor_url',
  'storage_location',
  'notes'
];

export default function ImportSpreadsheetWizard({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(1); // 1=upload, 2=mapping, 3=importing
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        toast.error('File is empty');
        return;
      }

      const parseLine = (line) => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          const nextChar = line[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values.map(v => v.replace(/^"(.*)"$/, '$1'));
      };

      const fileHeaders = parseLine(lines[0]);
      const previewData = lines.slice(1, 11).map(line => {
        const values = parseLine(line);
        const obj = {};
        fileHeaders.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });

      setFile(uploadedFile);
      setHeaders(fileHeaders);
      setPreview(previewData);
      
      // Auto-map common headers
      const autoMappings = {};
      fileHeaders.forEach((header) => {
        const normalized = header.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
        if (normalized.includes('variety') || normalized.includes('name')) autoMappings.variety_name = header;
        else if (normalized.includes('type') || normalized.includes('crop')) autoMappings.plant_type = header;
        else if (normalized.includes('quantity') || normalized.includes('qty')) autoMappings.quantity = header;
        else if (normalized.includes('unit')) autoMappings.unit = header;
        else if (normalized.includes('year') || normalized.includes('acquired')) autoMappings.year_acquired = header;
        else if (normalized.includes('packed')) autoMappings.packed_for_year = header;
        else if (normalized.includes('vendor') || normalized.includes('source')) autoMappings.vendor_name = header;
        else if (normalized.includes('url') || normalized.includes('link')) autoMappings.vendor_url = header;
        else if (normalized.includes('storage') || normalized.includes('location')) autoMappings.storage_location = header;
        else if (normalized.includes('note')) autoMappings.notes = header;
      });
      setMappings(autoMappings);
      setStep(2);
    };
    reader.readAsText(uploadedFile);
  };

  const handleImport = async () => {
    if (!mappings.variety_name) {
      toast.error('Variety name mapping is required');
      return;
    }

    setImporting(true);
    setStep(3);
    setProgress({ current: 0, total: 0 });
    setLog([]);
    setSummary(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        const parseLine = (line) => {
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values.map(v => v.replace(/^"(.*)"$/, '$1'));
        };

        const fileHeaders = parseLine(lines[0]);
        const dataRows = lines.slice(1).map(line => {
          const values = parseLine(line);
          const obj = {};
          fileHeaders.forEach((h, i) => { obj[h] = values[i] || ''; });
          return obj;
        });

        setProgress({ current: 0, total: dataRows.length });

        let inserted = 0;
        let skipped = 0;
        let suggested = 0;
        const BATCH_SIZE = 100;

        // Pre-load plant types, profiles, varieties, and existing user seeds
        const user = await base44.auth.me();
        const [allPlantTypes, allProfiles, allVarieties, existingSeeds] = await Promise.all([
          base44.entities.PlantType.list(),
          base44.entities.PlantProfile.list(),
          base44.entities.Variety.list(),
          base44.entities.SeedLot.filter({ created_by: user.email })
        ]);
        
        const plantTypesByName = {};
        allPlantTypes.forEach(pt => {
          if (pt.common_name) plantTypesByName[pt.common_name.toLowerCase()] = pt;
        });

        // Map existing seeds by profile ID to prevent duplicates
        const existingSeedProfiles = new Set(existingSeeds.map(s => s.plant_profile_id).filter(Boolean));

        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const rowNum = i + 1;

          try {
            const varietyName = row[mappings.variety_name]?.trim();
            if (!varietyName) {
              setLog(prev => [...prev, { row: rowNum, status: 'skip', message: 'No variety name' }]);
              skipped++;
              setProgress({ current: i + 1, total: dataRows.length });
              continue;
            }

            const plantTypeName = mappings.plant_type ? row[mappings.plant_type]?.trim() : null;
            let plantType = null;
            if (plantTypeName) {
              plantType = plantTypesByName[plantTypeName.toLowerCase()];
            }

            // Find or create PlantProfile
            let profile = allProfiles.find(p => 
              p.variety_name?.toLowerCase() === varietyName.toLowerCase() &&
              (!plantType || p.plant_type_id === plantType?.id)
            );

            // Check if user already has this seed in their stash
            if (profile && existingSeedProfiles.has(profile.id)) {
              setLog(prev => [...prev, { row: rowNum, status: 'skip', message: `Already in stash: ${varietyName}` }]);
              skipped++;
              setProgress({ current: i + 1, total: dataRows.length });
              continue;
            }

            // Try to find matching variety in public catalog
            let catalogVariety = null;
            if (plantType) {
              catalogVariety = allVarieties.find(v => 
                v.variety_name?.toLowerCase() === varietyName.toLowerCase() &&
                v.plant_type_id === plantType.id
              );
            }

            if (!profile) {
              // Create new PlantProfile with catalog data if available
              const profileData = {
                common_name: plantType?.common_name || plantTypeName || 'Unknown',
                variety_name: varietyName,
                plant_type_id: plantType?.id || null,
                variety_id: catalogVariety?.id || null,
                source_type: 'user_private'
              };
              
              // Transfer catalog data to profile
              if (catalogVariety) {
                profileData.days_to_maturity_seed = catalogVariety.days_to_maturity;
                profileData.sun_requirement = catalogVariety.sun_requirement;
                profileData.water_requirement = catalogVariety.water_requirement;
                profileData.spacing_in_min = catalogVariety.spacing_min;
                profileData.spacing_in_max = catalogVariety.spacing_max;
                profileData.height_in_min = catalogVariety.height_min;
                profileData.height_in_max = catalogVariety.height_max;
                profileData.container_friendly = catalogVariety.container_friendly;
                profileData.trellis_required = catalogVariety.trellis_required;
                profileData.notes_public = catalogVariety.description;
              }
              
              profile = await base44.entities.PlantProfile.create(profileData);
              allProfiles.push(profile);
              existingSeedProfiles.add(profile.id);
              
              if (catalogVariety) {
                setLog(prev => [...prev, { row: rowNum, status: 'info', message: `✓ Created ${varietyName} with catalog data` }]);
              } else {
                setLog(prev => [...prev, { row: rowNum, status: 'info', message: `Created profile for ${varietyName}` }]);
              }
            } else {
              existingSeedProfiles.add(profile.id);
            }

            // Create SeedLot
            const lotData = {
              plant_profile_id: profile.id,
              quantity: mappings.quantity ? parseInt(row[mappings.quantity]) || null : null,
              unit: mappings.unit ? row[mappings.unit] || 'seeds' : 'seeds',
              year_acquired: mappings.year_acquired ? parseInt(row[mappings.year_acquired]) || null : null,
              packed_for_year: mappings.packed_for_year ? parseInt(row[mappings.packed_for_year]) || null : null,
              source_vendor_name: mappings.vendor_name ? row[mappings.vendor_name] || null : null,
              source_vendor_url: mappings.vendor_url ? row[mappings.vendor_url] || null : null,
              storage_location: mappings.storage_location ? row[mappings.storage_location] || null : null,
              lot_notes: mappings.notes ? row[mappings.notes] || null : null,
              from_catalog: false
            };

            await base44.entities.SeedLot.create(lotData);
            inserted++;
            setLog(prev => [...prev, { row: rowNum, status: 'success', message: `✓ Added ${varietyName}` }]);
          } catch (error) {
            setLog(prev => [...prev, { row: rowNum, status: 'error', message: error.message }]);
            skipped++;
          }

          setProgress({ current: i + 1, total: dataRows.length });

          // Batch delay for rate limiting - wait 3 seconds every 100 rows
          if ((i + 1) % BATCH_SIZE === 0 && i + 1 < dataRows.length) {
            setLog(prev => [...prev, { row: rowNum, status: 'info', message: '⏳ Rate limit pause (3s)...' }]);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        setSummary({ inserted, skipped, suggested });
        setCompleted(true);
        toast.success(`Import completed! ${inserted} added, ${skipped} skipped`);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = TEMPLATE_HEADERS.join(',') + '\n' +
      'Cherry Tomato,Tomato,25,seeds,2024,2024,Baker Creek,https://example.com,Fridge Box A,Early season variety\n' +
      'Jalapeño,Pepper,50,seeds,2023,2023,Johnny\'s Seeds,,Drawer 2,Mild heat\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seed_stash_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleClose = () => {
    if (completed && onSuccess) onSuccess();
    setStep(1);
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setMappings({});
    setImporting(false);
    setCompleted(false);
    setSummary(null);
    setLog([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Import Your Spreadsheet</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                Import your seed inventory from Excel or CSV. Download our template for best results.
              </AlertDescription>
            </Alert>

            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 transition-colors">
              <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <Button
                onClick={() => document.getElementById('spreadsheet-upload').click()}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2 mb-3"
              >
                <Upload className="w-4 h-4" />
                Upload CSV File
              </Button>
              <p className="text-sm text-gray-600">Supports .csv files</p>
              <input
                id="spreadsheet-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="w-full gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template CSV
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div>
              <h3 className="font-semibold mb-2">Preview First 10 Rows</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.slice(0, 5).map((h, i) => (
                        <th key={i} className="border px-2 py-1 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {headers.slice(0, 5).map((h, j) => (
                          <td key={j} className="border px-2 py-1">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Map Columns</h3>
              <div className="space-y-3">
                <div>
                  <Label>Variety Name (Required)</Label>
                  <Select value={mappings.variety_name || ''} onValueChange={(v) => setMappings({ ...mappings, variety_name: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {['plant_type', 'quantity', 'unit', 'year_acquired', 'packed_for_year', 'vendor_name', 'vendor_url', 'storage_location', 'notes'].map(field => (
                  <div key={field}>
                    <Label className="capitalize">{field.replace(/_/g, ' ')} (Optional)</Label>
                    <Select value={mappings[field] || ''} onValueChange={(v) => setMappings({ ...mappings, [field]: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Skip this field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Skip</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!mappings.variety_name}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                Start Import
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {completed ? 'Import Complete' : 'Importing...'}
                </span>
                <span className="text-sm text-gray-600">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            </div>

            {summary && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="font-semibold mb-1">Summary</div>
                  <div className="text-sm space-y-1">
                    <div>✓ {summary.inserted} seeds added</div>
                    {summary.skipped > 0 && <div>⚠ {summary.skipped} rows skipped</div>}
                    {summary.suggested > 0 && <div>📝 {summary.suggested} varieties suggested</div>}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h3 className="font-semibold mb-2 text-sm">Import Log</h3>
              <div className="max-h-64 overflow-y-auto space-y-1 bg-gray-50 rounded-lg p-3">
                {log.map((entry, i) => (
                  <div key={i} className="text-xs flex items-start gap-2">
                    {entry.status === 'success' && <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5" />}
                    {entry.status === 'error' && <X className="w-3 h-3 text-red-600 mt-0.5" />}
                    {entry.status === 'skip' && <AlertCircle className="w-3 h-3 text-yellow-600 mt-0.5" />}
                    {entry.status === 'info' && <span className="w-3 h-3 text-blue-600 mt-0.5">ℹ</span>}
                    <span className="text-gray-600">Row {entry.row}:</span>
                    <span className={
                      entry.status === 'success' ? 'text-green-700' :
                      entry.status === 'error' ? 'text-red-700' :
                      entry.status === 'skip' ? 'text-yellow-700' : 'text-blue-700'
                    }>{entry.message}</span>
                  </div>
                ))}
                {!completed && (
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
            </div>

            {completed && (
              <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}