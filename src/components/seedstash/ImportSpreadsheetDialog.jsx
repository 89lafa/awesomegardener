import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLUMN_MAPPINGS = [
  // Basic Info
  { key: 'variety_name', label: 'Variety Name', required: true, category: 'basic', target: 'profile' },
  { key: 'common_name', label: 'Plant Type', required: false, category: 'basic', target: 'profile' },
  { key: 'description', label: 'Description', required: false, category: 'basic', target: 'profile' },
  
  // Seed Stash Fields
  { key: 'quantity', label: 'Quantity', required: false, category: 'inventory', target: 'seed' },
  { key: 'unit', label: 'Unit (seeds/packets/grams)', required: false, category: 'inventory', target: 'seed' },
  { key: 'year_acquired', label: 'Year Acquired', required: false, category: 'inventory', target: 'seed' },
  { key: 'packed_for_year', label: 'Packed For Year', required: false, category: 'inventory', target: 'seed' },
  { key: 'source_vendor_name', label: 'Vendor/Source', required: false, category: 'inventory', target: 'seed' },
  { key: 'source_vendor_url', label: 'Vendor URL', required: false, category: 'inventory', target: 'seed' },
  { key: 'storage_location', label: 'Storage Location', required: false, category: 'inventory', target: 'seed' },
  { key: 'lot_notes', label: 'Notes', required: false, category: 'inventory', target: 'seed' },
  { key: 'tags', label: 'Tags (comma separated)', required: false, category: 'inventory', target: 'seed' },
  
  // Variety Growing Info
  { key: 'days_to_maturity_seed', label: 'Days to Maturity', required: false, category: 'growing', target: 'profile' },
  { key: 'start_indoors_weeks_before_last_frost_min', label: 'Start Indoors (weeks)', required: false, category: 'growing', target: 'profile' },
  { key: 'transplant_weeks_after_last_frost_min', label: 'Transplant Week Min', required: false, category: 'growing', target: 'profile' },
  { key: 'transplant_weeks_after_last_frost_max', label: 'Transplant Week Max', required: false, category: 'growing', target: 'profile' },
  { key: 'direct_sow_weeks_relative_to_last_frost_min', label: 'Direct Sow Week Min', required: false, category: 'growing', target: 'profile' },
  { key: 'direct_sow_weeks_relative_to_last_frost_max', label: 'Direct Sow Week Max', required: false, category: 'growing', target: 'profile' },
  { key: 'spacing_in_min', label: 'Spacing Min (inches)', required: false, category: 'growing', target: 'profile' },
  { key: 'spacing_in_max', label: 'Spacing Max (inches)', required: false, category: 'growing', target: 'profile' },
  
  // Tomato-specific & Unified Fields
  { key: 'tomato_size', label: 'Tomato Size', required: false, category: 'characteristics', target: 'both' },
  { key: 'tomato_color', label: 'Tomato Color', required: false, category: 'characteristics', target: 'both' },
  { key: 'plant_growth', label: 'Plant Growth', required: false, category: 'characteristics', target: 'both' },
  { key: 'leaf_characteristics', label: 'Leaf Characteristics', required: false, category: 'characteristics', target: 'both' },
  { key: 'breeder', label: 'Breeder', required: false, category: 'characteristics', target: 'both' },
  { key: 'country_of_origin', label: 'Country of Origin', required: false, category: 'characteristics', target: 'both' },
  
  // Other Characteristics
  { key: 'fruit_color', label: 'Fruit Color', required: false, category: 'characteristics', target: 'profile' },
  { key: 'fruit_shape', label: 'Fruit Shape', required: false, category: 'characteristics', target: 'profile' },
  { key: 'fruit_size', label: 'Fruit Size', required: false, category: 'characteristics', target: 'profile' },
  { key: 'pod_color', label: 'Pod Color', required: false, category: 'characteristics', target: 'profile' },
  { key: 'pod_shape', label: 'Pod Shape', required: false, category: 'characteristics', target: 'profile' },
  { key: 'pod_size', label: 'Pod Size', required: false, category: 'characteristics', target: 'profile' },
  { key: 'heat_scoville_min', label: 'Scoville Min', required: false, category: 'characteristics', target: 'profile' },
  { key: 'heat_scoville_max', label: 'Scoville Max', required: false, category: 'characteristics', target: 'profile' },
  { key: 'flavor_profile', label: 'Flavor Profile', required: false, category: 'characteristics', target: 'profile' },
  
  // Other
  { key: 'sun_requirement', label: 'Sun (full_sun/partial_sun)', required: false, category: 'requirements', target: 'profile' },
  { key: 'water_requirement', label: 'Water (low/moderate/high)', required: false, category: 'requirements', target: 'profile' },
  { key: 'growth_habit', label: 'Growth Habit (legacy)', required: false, category: 'characteristics', target: 'profile' },
  { key: 'trellis_required', label: 'Trellis Required (true/false)', required: false, category: 'requirements', target: 'profile' },
  { key: 'container_friendly', label: 'Container Friendly (true/false)', required: false, category: 'requirements', target: 'profile' },
];

export default function ImportSpreadsheetDialog({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [preview, setPreview] = useState([]);
  const [mappings, setMappings] = useState({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [statusLog, setStatusLog] = useState([]);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line) => {
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      rows.push(obj);
    }

    return { headers, rows };
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    try {
      const text = await uploadedFile.text();
      const { headers: csvHeaders, rows } = parseCSV(text);

      setFile(uploadedFile);
      setHeaders(csvHeaders);
      setPreview(rows.slice(0, 10));

      // Auto-detect mappings
      const autoMappings = {};
      COLUMN_MAPPINGS.forEach(col => {
        const match = csvHeaders.find(h => 
          h.toLowerCase().includes(col.key.toLowerCase()) ||
          h.toLowerCase().includes(col.label.toLowerCase())
        );
        if (match) autoMappings[col.key] = match;
      });
      setMappings(autoMappings);

      setStep(2);
      toast.success(`Loaded ${rows.length} rows`);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast.error('Failed to parse file');
    }
  };

  const handleImport = async () => {
    if (!mappings.variety_name) {
      toast.error('Please map the Variety Name column');
      return;
    }

    setImporting(true);
    setStep(3);
    setProgress(0);
    setStatusLog([]);
    setResults({ inserted: 0, skipped: 0, errors: [] });

    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      const BATCH_SIZE = 30;
      const DELAY_MS = 3000; // 3 seconds pause after each batch

      let totalInserted = 0;
      let totalSkipped = 0;
      const errorsList = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        for (const row of batch) {
          try {
            const varietyName = row[mappings.variety_name];
            if (!varietyName || !varietyName.trim()) {
              totalSkipped++;
              setStatusLog(prev => [...prev, `Row ${i + batch.indexOf(row) + 1}: Skipped (no variety name)`]);
              continue;
            }

            const commonName = mappings.common_name ? row[mappings.common_name] : null;

            // UPSERT LOGIC: Find existing profile OR seed lot by variety name
            const user = await base44.auth.me();
            let profile = null;
            let existingSeedLot = null;

            const existingProfiles = await base44.entities.PlantProfile.filter({
              variety_name: varietyName,
              created_by: user.email
            });

            if (existingProfiles.length > 0) {
              profile = existingProfiles[0];
              
              // Check if seed lot already exists for this profile
              const existingSeeds = await base44.entities.SeedLot.filter({
                plant_profile_id: profile.id,
                created_by: user.email
              });
              if (existingSeeds.length > 0) {
                existingSeedLot = existingSeeds[0];
              }
            }

            // Build profile data from CSV
            const profileData = {
              variety_name: varietyName,
              common_name: commonName || 'Unknown',
              source_type: 'user_private'
            };
            
            // Add all mapped profile fields
            COLUMN_MAPPINGS.filter(m => (m.target === 'profile' || m.target === 'both') && mappings[m.key]).forEach(mapping => {
              const value = row[mappings[mapping.key]];
              if (value && value.trim()) {
                if (mapping.key === 'trellis_required' || mapping.key === 'container_friendly') {
                  profileData[mapping.key] = value.toLowerCase() === 'true';
                } else if (mapping.key.includes('days_to_maturity') || mapping.key.includes('weeks') || mapping.key.includes('spacing') || mapping.key.includes('scoville') || mapping.key.includes('height')) {
                  const num = parseFloat(value);
                  if (!isNaN(num)) profileData[mapping.key] = num;
                } else {
                  profileData[mapping.key] = value;
                }
              }
            });

            // UPSERT profile: update if exists, create if not
            if (profile) {
              await base44.entities.PlantProfile.update(profile.id, profileData);
            } else {
              profile = await base44.entities.PlantProfile.create(profileData);
            }

            // Build seed lot data from CSV
            const seedData = {
              plant_profile_id: profile.id
            };

            // Add all mapped seed fields
            COLUMN_MAPPINGS.filter(m => (m.target === 'seed' || m.target === 'both') && mappings[m.key]).forEach(mapping => {
              const value = row[mappings[mapping.key]];
              if (value && value.trim()) {
                if (mapping.key === 'quantity' || mapping.key === 'year_acquired' || mapping.key === 'packed_for_year') {
                  const num = parseInt(value);
                  if (!isNaN(num)) seedData[mapping.key] = num;
                } else if (mapping.key === 'tags') {
                  // Split comma-separated tags
                  seedData[mapping.key] = value.split(',').map(t => t.trim()).filter(Boolean);
                } else {
                  seedData[mapping.key] = value;
                }
              }
            });

            // UPSERT seed lot: update if exists, create if not
            if (existingSeedLot) {
              await base44.entities.SeedLot.update(existingSeedLot.id, seedData);
              setStatusLog(prev => [...prev, `Row ${i + batch.indexOf(row) + 1}: Updated "${varietyName}"`]);
            } else {
              await base44.entities.SeedLot.create(seedData);
              setStatusLog(prev => [...prev, `Row ${i + batch.indexOf(row) + 1}: Imported "${varietyName}"`]);
            }
            
            totalInserted++;
            setResults({ inserted: totalInserted, skipped: totalSkipped, errors: errorsList });
          } catch (error) {
            totalSkipped++;
            errorsList.push({ row: i + batch.indexOf(row) + 1, error: error.message });
            setStatusLog(prev => [...prev, `Row ${i + batch.indexOf(row) + 1}: Error - ${error.message}`]);
            setResults({ inserted: totalInserted, skipped: totalSkipped, errors: errorsList });
          }
        }

        setProgress(Math.min(100, Math.round(((i + batch.length) / rows.length) * 100)));

        // Wait between batches to avoid rate limits
        if (i + BATCH_SIZE < rows.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      setResults({ inserted: totalInserted, skipped: totalSkipped, errors: errorsList });
      toast.success(`Import complete! ${totalInserted} seeds added`);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = COLUMN_MAPPINGS.map(c => c.key).join(',');
    const example = [
      'Cherokee Purple,Tomato,Indeterminate heirloom tomato,25,seeds,2024,2024,Botanical Interests,https://example.com,Fridge Drawer 1,Great variety,antho;favorite,80,6,0,2,-2,4,18,30,Large,Dark pink,indeterminate,Potato Leaf,Unknown,USA,Dark pink,Round,Large,,,,,Sweet and complex,full_sun,moderate,indeterminate,false,true',
      'Carolina Reaper,Pepper,Super hot pepper,50,seeds,2023,2023,PepperSeeds.net,https://pepperseeds.net,Seed Box,Extremely hot!,superhot,90,8,2,4,,,18,,,,,bush,,Ed Currie,USA,,,Red,Wrinkled,Medium,1500000,2200000,Intense fruity,full_sun,moderate,bush,false,true'
    ].join('\n');
    const csv = headers + '\n' + example;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seed_stash_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Template downloaded');
  };

  const resetDialog = () => {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setMappings({});
    setProgress(0);
    setResults(null);
    setStatusLog([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetDialog}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Spreadsheet to Seed Stash</DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-semibold mb-2">
                📋 Import Guide
              </p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Download template to see all available fields</li>
                <li>• Only "Variety Name" is required, all other fields optional</li>
                <li>• Existing seeds will be updated with new data (no duplicates created)</li>
                <li>• Leave fields blank to keep existing values</li>
                <li>• For tags, use comma-separated values (e.g., "antho,favorite")</li>
              </ul>
            </div>

            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="w-full gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template CSV (Recommended)
            </Button>

            <div>
              <Label>Upload Your File (.csv)</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="mt-2"
              />
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">
                ✓ Loaded {preview.length} rows (showing first 10). Map your columns below:
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Basic Info</h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'basic').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">
                        {col.label} {col.required && <span className="text-red-600">*</span>}
                      </Label>
                    </div>
                    <Select
                      value={mappings[col.key] || ''}
                      onValueChange={(v) => setMappings({ ...mappings, [col.key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>-- None --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              {/* Inventory Fields */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Seed Stash Info</h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'inventory').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">{col.label}</Label>
                    </div>
                    <Select
                      value={mappings[col.key] || ''}
                      onValueChange={(v) => setMappings({ ...mappings, [col.key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>-- None --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              {/* Growing Info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Growing Info</h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'growing').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">{col.label}</Label>
                    </div>
                    <Select
                      value={mappings[col.key] || ''}
                      onValueChange={(v) => setMappings({ ...mappings, [col.key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>-- None --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              {/* Characteristics */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Characteristics</h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'characteristics').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">{col.label}</Label>
                    </div>
                    <Select
                      value={mappings[col.key] || ''}
                      onValueChange={(v) => setMappings({ ...mappings, [col.key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>-- None --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              
              {/* Requirements */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-sm">Requirements</h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'requirements').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">{col.label}</Label>
                    </div>
                    <Select
                      value={mappings[col.key] || ''}
                      onValueChange={(v) => setMappings({ ...mappings, [col.key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>-- None --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 mb-2">Preview (first 3 rows):</p>
              <div className="space-y-2 max-h-40 overflow-auto">
                {preview.slice(0, 3).map((row, idx) => (
                  <div key={idx} className="text-xs text-gray-600 p-2 bg-white rounded border">
                    {mappings.variety_name && <div><strong>Variety:</strong> {row[mappings.variety_name]}</div>}
                    {mappings.quantity && <div><strong>Qty:</strong> {row[mappings.quantity]}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={handleImport}
                disabled={!mappings.variety_name}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Start Import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {importing ? 'Importing...' : 'Complete!'}
                </span>
                <span className="font-semibold text-gray-900">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {results && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-green-700">Imported</p>
                      <p className="text-2xl font-bold text-green-900">{results.inserted}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <div>
                      <p className="text-xs text-yellow-700">Skipped/Errors</p>
                      <p className="text-2xl font-bold text-yellow-900">{results.skipped}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-lg max-h-64 overflow-auto">
              <p className="text-xs font-semibold text-gray-700 mb-2">Import Log:</p>
              <div className="space-y-1">
                {statusLog.map((log, idx) => (
                  <p key={idx} className="text-xs text-gray-600">{log}</p>
                ))}
              </div>
            </div>

            {!importing && (
              <Button onClick={resetDialog} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Done
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}