import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle, FileText, Pause, Play } from 'lucide-react';
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

// ============================================================
// RATE LIMIT PROTECTION
// ============================================================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimitError(error) {
  if (!error) return false;
  const msg = (error?.message || error?.toString() || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('throttl')
  );
}

/**
 * Execute an API call with automatic retry on rate limit.
 * Up to maxRetries attempts with exponential backoff.
 */
async function safeApiCall(fn, label = '', maxRetries = 3) {
  let backoffMs = 3000; // Start with 3s for imports (more conservative)

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (isRateLimitError(error) && attempt < maxRetries) {
        console.warn(`[Import] ${label} rate limited, attempt ${attempt + 1}. Waiting ${backoffMs}ms...`);
        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, 20000); // Max 20s
        continue;
      }
      throw error;
    }
  }
}

// ============================================================
// COLUMN MAPPINGS
// ============================================================

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
  
  // Variety Growing Info - REQUIRED FOR CALENDAR
  { key: 'days_to_maturity_seed', label: 'Days to Maturity', required: true, category: 'growing', target: 'profile', calendarRequired: true },
  { key: 'start_indoors_weeks_before_last_frost_min', label: 'Start Indoors (weeks)', required: true, category: 'growing', target: 'profile', calendarRequired: true },
  { key: 'transplant_weeks_after_last_frost_min', label: 'Transplant Week Min', required: false, category: 'growing', target: 'profile' },
  { key: 'transplant_weeks_after_last_frost_max', label: 'Transplant Week Max', required: false, category: 'growing', target: 'profile' },
  { key: 'direct_sow_weeks_relative_to_last_frost_min', label: 'Direct Sow Week Min', required: true, category: 'growing', target: 'profile', calendarRequired: true },
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

// ============================================================
// COMPONENT
// ============================================================

export default function ImportSpreadsheetDialog({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [preview, setPreview] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [mappings, setMappings] = useState({});
  const [importing, setImporting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [statusLog, setStatusLog] = useState([]);

  // Refs for pause/cancel support
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);

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
      setAllRows(rows);
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

  // ==========================================================
  // MAIN IMPORT LOGIC — COMPLETELY REWRITTEN FOR RATE LIMITS
  // 
  // OLD CODE PROBLEMS:
  // 1. Called base44.auth.me() inside the loop for EVERY ROW (71+ wasted calls)
  // 2. No delay between rows within a batch (30 rows = ~120 rapid API calls)
  // 3. No retry on 429 — just logged error and moved to next row
  // 4. Each row made 3-5 API calls with zero throttling
  //
  // NEW APPROACH:
  // - Auth cached ONCE before loop
  // - Process ONE row at a time with 1.5s delay between rows
  // - Each API call wrapped in safeApiCall() with retry + exponential backoff
  // - Adaptive delay: increases on rate limit, decreases on success
  // - Pause/resume support
  // ==========================================================

  const handleImport = async () => {
    if (!mappings.variety_name) {
      toast.error('Please map the Variety Name column');
      return;
    }

    setImporting(true);
    setPaused(false);
    pausedRef.current = false;
    cancelledRef.current = false;
    setStep(3);
    setProgress(0);
    setStatusLog([]);
    setResults({ inserted: 0, updated: 0, skipped: 0, errors: [] });

    try {
      const rows = allRows;
      const totalRows = rows.length;

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const errorsList = [];

      // =====================================================
      // FIX #1: Get user ONCE before the loop
      // Old code called base44.auth.me() for EVERY row = 71 wasted API calls
      // =====================================================
      const user = await base44.auth.me();
      const userEmail = user.email;

      // =====================================================
      // FIX #2: Pre-fetch ALL existing profiles + seed lots in bulk
      // This replaces per-row filter calls (saves ~142 API calls for 71 rows)
      // =====================================================
      let existingProfilesMap = {};
      let existingSeedLotsMap = {};

      addLog('Preparing: Loading existing data...');

      try {
        const allProfiles = await safeApiCall(
          () => base44.entities.PlantProfile.filter({ created_by: userEmail }),
          'Pre-fetch profiles'
        );
        allProfiles.forEach(p => {
          if (p.variety_name) {
            existingProfilesMap[p.variety_name.toLowerCase().trim()] = p;
          }
        });
        addLog(`Found ${allProfiles.length} existing profiles`);
      } catch (err) {
        addLog('Warning: Could not pre-fetch profiles, will check per-row');
      }

      await sleep(1000);

      try {
        const allSeedLots = await safeApiCall(
          () => base44.entities.SeedLot.filter({ created_by: userEmail }),
          'Pre-fetch seed lots'
        );
        allSeedLots.forEach(s => {
          if (s.plant_profile_id) {
            if (!existingSeedLotsMap[s.plant_profile_id]) {
              existingSeedLotsMap[s.plant_profile_id] = s;
            }
          }
        });
        addLog(`Found ${allSeedLots.length} existing seed lots`);
      } catch (err) {
        addLog('Warning: Could not pre-fetch seed lots, will check per-row');
      }

      await sleep(1000);
      addLog(`Starting import of ${totalRows} rows...`);

      // =====================================================
      // FIX #3: Process ONE row at a time with adaptive delay
      // Old code: 30 rows rapid-fire, then 3s pause
      // New code: 1 row, wait, 1 row, wait — much gentler on API
      // =====================================================
      let baseDelay = 1500; // 1.5s between rows
      let consecutiveSuccesses = 0;

      for (let i = 0; i < totalRows; i++) {
        // Check for cancel
        if (cancelledRef.current) {
          addLog('⛔ Import cancelled by user');
          break;
        }

        // Check for pause
        while (pausedRef.current) {
          await sleep(500);
          if (cancelledRef.current) break;
        }
        if (cancelledRef.current) break;

        const row = rows[i];
        const rowNum = i + 1;

        try {
          const varietyName = row[mappings.variety_name];
          if (!varietyName || !varietyName.trim()) {
            totalSkipped++;
            addLog(`Row ${rowNum}: Skipped (no variety name)`);
            updateResults(totalInserted, totalUpdated, totalSkipped, errorsList);
            setProgress(Math.round((rowNum / totalRows) * 100));
            continue;
          }

          const commonName = mappings.common_name ? row[mappings.common_name] : null;
          const varietyKey = varietyName.toLowerCase().trim();

          // =====================================================
          // FIX #4: Use pre-fetched data instead of per-row filter calls
          // Old code: 2 filter() calls per row = 142 extra API calls for 71 rows
          // New code: Simple in-memory lookup = 0 API calls
          // =====================================================
          let profile = existingProfilesMap[varietyKey] || null;
          let existingSeedLot = profile ? (existingSeedLotsMap[profile.id] || null) : null;

          // Build profile data from CSV
          const profileData = {
            variety_name: varietyName.trim(),
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
            await safeApiCall(
              () => base44.entities.PlantProfile.update(profile.id, profileData),
              `Row ${rowNum} update profile`
            );
          } else {
            profile = await safeApiCall(
              () => base44.entities.PlantProfile.create(profileData),
              `Row ${rowNum} create profile`
            );
            // Add to local cache so subsequent rows can find it
            existingProfilesMap[varietyKey] = profile;
          }

          // Small delay between profile and seed lot API calls
          await sleep(500);

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
                seedData[mapping.key] = value.split(',').map(t => t.trim()).filter(Boolean);
              } else {
                seedData[mapping.key] = value;
              }
            }
          });

          // UPSERT seed lot: update if exists, create if not
          if (existingSeedLot) {
            await safeApiCall(
              () => base44.entities.SeedLot.update(existingSeedLot.id, seedData),
              `Row ${rowNum} update seed`
            );
            totalUpdated++;
            addLog(`Row ${rowNum}: Updated "${varietyName}"`);
          } else {
            const newSeedLot = await safeApiCall(
              () => base44.entities.SeedLot.create(seedData),
              `Row ${rowNum} create seed`
            );
            // Add to local cache
            existingSeedLotsMap[profile.id] = newSeedLot;
            totalInserted++;
            addLog(`Row ${rowNum}: Imported "${varietyName}"`);
          }

          // =====================================================
          // FIX #5: Adaptive delay — speeds up on success, slows on errors
          // =====================================================
          consecutiveSuccesses++;
          if (consecutiveSuccesses > 10 && baseDelay > 800) {
            baseDelay = Math.max(800, baseDelay - 100); // Speed up slightly
          }

        } catch (error) {
          totalSkipped++;
          const errMsg = error?.message || String(error);
          errorsList.push({ row: rowNum, error: errMsg });
          addLog(`Row ${rowNum}: ❌ Error - ${errMsg}`);
          consecutiveSuccesses = 0;

          // If rate limited even after retries, slow down significantly
          if (isRateLimitError(error)) {
            baseDelay = Math.min(baseDelay + 2000, 10000); // Add 2s, max 10s
            addLog(`⚠️ Rate limited — slowing down to ${baseDelay}ms between rows`);
            await sleep(5000); // Extra 5s cooldown
          }
        }

        // Update progress
        updateResults(totalInserted, totalUpdated, totalSkipped, errorsList);
        setProgress(Math.round((rowNum / totalRows) * 100));

        // =====================================================
        // FIX #6: Wait between EVERY row (not just between batches)
        // Old code: 30 rows rapid fire, 3s pause = still too many calls
        // New code: ~1.5s between every row = smooth, no bursts
        // =====================================================
        if (i < totalRows - 1) {
          await sleep(baseDelay);
        }
      }

      updateResults(totalInserted, totalUpdated, totalSkipped, errorsList);
      setProgress(100);

      const totalProcessed = totalInserted + totalUpdated;
      if (totalProcessed > 0) {
        toast.success(`Import complete! ${totalInserted} added, ${totalUpdated} updated`);
      }
      if (errorsList.length > 0) {
        toast.warning(`${errorsList.length} rows had errors`);
      }
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('[Import] Fatal error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Helper to update results state
  const updateResults = (inserted, updated, skipped, errors) => {
    setResults({ inserted, updated, skipped, errors });
  };

  // Helper to add a log line
  const addLog = (msg) => {
    setStatusLog(prev => [...prev, msg]);
  };

  const handlePauseResume = () => {
    if (pausedRef.current) {
      pausedRef.current = false;
      setPaused(false);
      addLog('▶️ Resumed');
    } else {
      pausedRef.current = true;
      setPaused(true);
      addLog('⏸️ Paused');
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setPaused(false);
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
    cancelledRef.current = true; // Stop any running import
    pausedRef.current = false;
    setStep(1);
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setAllRows([]);
    setMappings({});
    setProgress(0);
    setResults(null);
    setStatusLog([]);
    setImporting(false);
    setPaused(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : resetDialog}>
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
                <li>• <strong>Variety Name</strong> is required</li>
                <li>• <strong className="text-red-700">For Calendar Integration:</strong> Must include <strong>Days to Maturity</strong>, <strong>Start Indoors (weeks)</strong>, and <strong>Direct Sow Week Min</strong></li>
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
                ✓ Loaded <strong>{allRows.length}</strong> rows. Map your columns below:
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
                <h4 className="font-semibold text-gray-900 text-sm">
                  Growing Info <span className="text-red-600 text-xs">(Required for Calendar)</span>
                </h4>
                {COLUMN_MAPPINGS.filter(c => c.category === 'growing').map(col => (
                  <div key={col.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <Label className="text-sm">
                        {col.label} {col.calendarRequired && <span className="text-red-600">*</span>}
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
                    {mappings.common_name && <div><strong>Type:</strong> {row[mappings.common_name]}</div>}
                    {mappings.quantity && <div><strong>Qty:</strong> {row[mappings.quantity]}</div>}
                    {mappings.source_vendor_name && <div><strong>Source:</strong> {row[mappings.source_vendor_name]}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Time estimate */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                ⏱️ Estimated time: <strong>~{Math.ceil(allRows.length * 2.5 / 60)} minutes</strong> for {allRows.length} rows
                <br />
                <span className="text-xs">Import processes rows one at a time to avoid rate limits. You can pause/resume.</span>
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={handleImport}
                disabled={!mappings.variety_name}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Start Import ({allRows.length} rows)
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
                  {importing 
                    ? (paused ? '⏸️ Paused' : '⏳ Importing...') 
                    : '✅ Complete!'}
                </span>
                <span className="font-semibold text-gray-900">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {results && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-xs text-green-700">Added</p>
                      <p className="text-xl font-bold text-green-900">{results.inserted}</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs text-blue-700">Updated</p>
                      <p className="text-xl font-bold text-blue-900">{results.updated}</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <div>
                      <p className="text-xs text-yellow-700">Errors</p>
                      <p className="text-xl font-bold text-yellow-900">{results.skipped}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-lg max-h-64 overflow-auto" id="import-log">
              <p className="text-xs font-semibold text-gray-700 mb-2">Import Log:</p>
              <div className="space-y-1">
                {statusLog.map((log, idx) => (
                  <p key={idx} className={`text-xs ${
                    log.includes('❌') || log.includes('Error') ? 'text-red-600' :
                    log.includes('⚠️') ? 'text-amber-600' :
                    log.includes('Updated') ? 'text-blue-600' :
                    log.includes('Imported') ? 'text-green-600' :
                    'text-gray-600'
                  }`}>{log}</p>
                ))}
              </div>
            </div>

            {/* Pause/Resume/Cancel controls */}
            {importing && (
              <div className="flex gap-2">
                <Button 
                  onClick={handlePauseResume} 
                  variant="outline" 
                  className="flex-1 gap-2"
                >
                  {paused ? (
                    <><Play className="w-4 h-4" /> Resume</>
                  ) : (
                    <><Pause className="w-4 h-4" /> Pause</>
                  )}
                </Button>
                <Button 
                  onClick={handleCancel} 
                  variant="destructive" 
                  className="gap-2"
                >
                  Cancel Import
                </Button>
              </div>
            )}

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
