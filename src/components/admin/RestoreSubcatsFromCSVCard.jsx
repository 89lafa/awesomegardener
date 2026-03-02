/**
 * RestoreSubcatsFromCSVCard
 * Upload your Variety CSV export — this card reads plant_subcategory_id from each row
 * and restores it to any variety that currently has no subcategory in DB.
 * 
 * Strategy: the exported CSV is the ground truth. We match by variety `id` column.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

function parseCSVRows(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseLine = (line) => {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i], n = line[i + 1];
      if (c === '"') { if (inQ && n === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if ((c === ',' || c === '\t') && !inQ) { vals.push(cur); cur = ''; }
      else { cur += c; }
    }
    vals.push(cur);
    return vals;
  };

  const headers = parseLine(lines[0]).map(h => h.replace(/"/g, '').trim());
  const idIdx = headers.indexOf('id');
  const subcatIdx = headers.indexOf('plant_subcategory_id');

  if (idIdx === -1 || subcatIdx === -1) return null; // missing required cols

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const id = (vals[idIdx] || '').replace(/"/g, '').trim();
    const plant_subcategory_id = (vals[subcatIdx] || '').replace(/"/g, '').trim();
    if (id) rows.push({ id, plant_subcategory_id });
  }
  return rows;
}

export default function RestoreSubcatsFromCSVCard() {
  const [csvFile, setCsvFile] = useState(null);
  const [parsedRows, setParsedRows] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);
    setParsedRows(null);
    setResult(null);
    setParseError(null);

    const text = await file.text();
    const rows = parseCSVRows(text);
    if (rows === null) {
      setParseError('CSV must have "id" and "plant_subcategory_id" columns.');
      return;
    }
    const withSubcat = rows.filter(r => r.plant_subcategory_id);
    setParsedRows(rows);
    toast.success(`Parsed ${rows.length} rows — ${withSubcat.length} have a subcategory ID`);
  };

  const handleRun = async () => {
    if (!parsedRows?.length) return;
    setRunning(true);
    setResult(null);
    toast.info(`${dryRun ? 'Previewing' : 'Restoring'} subcategories from CSV... this may take several minutes.`);

    // Only send rows that have a subcategory_id
    const rowsToSend = parsedRows.filter(r => r.plant_subcategory_id);
    const CHUNK = 500; // Send in chunks to avoid payload limits
    let totalFixed = 0, totalSkipped = 0, totalInvalid = 0, totalNoSubcat = 0;
    const sampleFixes = [];

    for (let i = 0; i < rowsToSend.length; i += CHUNK) {
      const chunk = rowsToSend.slice(i, i + CHUNK);
      try {
        const res = await base44.functions.invoke('restoreSubcatsFromCSV', {
          rows: chunk,
          dry_run: dryRun,
          overwrite_existing: overwrite,
        });
        const d = res.data;
        totalFixed += d.fixed || 0;
        totalSkipped += d.skipped || 0;
        totalInvalid += d.invalid_subcat_id || 0;
        totalNoSubcat += d.no_subcat_in_csv || 0;
        if (sampleFixes.length < 15 && d.sample_fixes?.length) {
          sampleFixes.push(...d.sample_fixes.slice(0, 15 - sampleFixes.length));
        }
      } catch (err) {
        toast.error(`Chunk ${i}–${i + CHUNK} failed: ${err.message}`);
      }
    }

    setResult({ fixed: totalFixed, skipped: totalSkipped, invalid: totalInvalid, noSubcat: totalNoSubcat, sample: sampleFixes });
    toast.success(`Done! ${totalFixed} subcategories ${dryRun ? 'would be' : 'were'} restored.`);
    setRunning(false);
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          📂 Restore Subcategories from CSV Export (Most Accurate)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertCircle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            Upload your <strong>Variety_Export CSV</strong> (the one you just shared). This reads the original
            <code className="mx-1 px-1 bg-blue-100 rounded">plant_subcategory_id</code> from each row and
            restores it to the matching variety in DB — matched by variety <code className="mx-1 px-1 bg-blue-100 rounded">id</code>.
            Faster and more accurate than keyword matching.
          </AlertDescription>
        </Alert>

        <div>
          <label className="block text-sm font-medium mb-1">Upload Variety Export CSV</label>
          <input type="file" accept=".csv" onChange={handleFile} className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>

        {parseError && <p className="text-red-600 text-sm">⚠️ {parseError}</p>}

        {parsedRows && (
          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg border">
            <p>✅ <strong>{parsedRows.length}</strong> total rows parsed</p>
            <p>🏷️ <strong>{parsedRows.filter(r => r.plant_subcategory_id).length}</strong> rows have a subcategory ID to restore</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">Dry Run (preview — no DB changes)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} className="w-4 h-4" />
            <span>Also overwrite varieties that already have a subcategory</span>
          </label>
        </div>

        <Button
          onClick={handleRun}
          disabled={running || !parsedRows?.length}
          className="bg-blue-600 hover:bg-blue-700 gap-2 w-full"
        >
          {running ? <><Loader2 className="w-4 h-4 animate-spin" />Running...</> : <><Play className="w-4 h-4" />{dryRun ? 'Preview Restore' : 'Restore Subcategories'}</>}
        </Button>

        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-semibold mb-2">{dryRun ? 'Preview' : 'Restore'} Complete:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>✅ {dryRun ? 'Would fix' : 'Fixed'}: <strong>{result.fixed}</strong></div>
                <div>⏭️ Skipped (already had subcat): <strong>{result.skipped}</strong></div>
                <div>❓ No subcat in CSV: <strong>{result.noSubcat}</strong></div>
                <div>❌ Invalid subcat ID: <strong>{result.invalid}</strong></div>
              </div>
              {result.sample?.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  <strong>Sample:</strong> {result.sample.map(s => `${s.name} → ${s.subcat}`).join(', ')}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}