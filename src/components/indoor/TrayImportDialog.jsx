import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight, Info } from 'lucide-react';

// ─── Rate limit helpers ────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function safeCall(fn, retries = 3) {
  let delay = 2000;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = (e?.message || '').toLowerCase();
      const isRL = msg.includes('rate') || msg.includes('429') || msg.includes('throttl') || msg.includes('quota');
      if (isRL && i < retries) { await sleep(delay); delay = Math.min(delay * 2, 15000); continue; }
      throw e;
    }
  }
}

// ─── Fill pattern options ─────────────────────────────────────────────────
const FILL_PATTERNS = [
  {
    id: 'pairs_down',
    label: '2 cells per variety, going down (1-2, 13-14, 25-26…)',
    description: 'Your default: fill 2 consecutive cells in each column pair, advancing by row',
  },
  {
    id: 'single_col_down',
    label: 'Full column down, then next column (1,13,25… then 2,14,26…)',
    description: 'One variety fills an entire column before moving to the next',
  },
  {
    id: 'single_row_across',
    label: 'Full row across, then next row (1,2,3,4… then 13,14,15…)',
    description: 'One variety fills an entire row before moving to the next',
  },
  {
    id: 'one_per_row_down',
    label: 'One cell per variety, going down each column (1,13,25,37…)',
    description: 'One cell per variety, advancing down columns',
  },
  {
    id: 'one_per_row_across',
    label: 'One cell per variety, going across each row (1,2,3,4…)',
    description: 'One cell per variety, advancing left to right',
  },
  {
    id: 'custom',
    label: 'Custom / Manual — click cells in the tray to define order',
    description: 'You define the order by clicking cells visually',
  },
];

// ─── Build ordered list of tray cell numbers based on pattern ────────────
function buildCellOrder(rows, cols, pattern, customOrder) {
  const totalCells = rows * cols;
  if (pattern === 'custom') return customOrder || [];

  const order = [];

  if (pattern === 'pairs_down') {
    // 1-2, 13-14, 25-26 ... (cols=12 example)
    // Groups: col pairs (0-1), (2-3), ...
    // Within each pair group, go down rows
    const pairGroups = Math.ceil(cols / 2);
    for (let pg = 0; pg < pairGroups; pg++) {
      const col1 = pg * 2;
      const col2 = pg * 2 + 1;
      for (let r = 0; r < rows; r++) {
        const n1 = r * cols + col1 + 1;
        if (n1 <= totalCells) order.push(n1);
        if (col2 < cols) {
          const n2 = r * cols + col2 + 1;
          if (n2 <= totalCells) order.push(n2);
        }
      }
    }
  } else if (pattern === 'single_col_down') {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        order.push(r * cols + c + 1);
      }
    }
  } else if (pattern === 'single_row_across') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        order.push(r * cols + c + 1);
      }
    }
  } else if (pattern === 'one_per_row_down') {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        order.push(r * cols + c + 1);
      }
    }
  } else if (pattern === 'one_per_row_across') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        order.push(r * cols + c + 1);
      }
    }
  }

  return order;
}

// ─── Custom order picker ──────────────────────────────────────────────────
function CustomOrderPicker({ tray, onDone }) {
  const rows = tray.cells_rows || 1;
  const cols = tray.cells_cols || 1;
  const total = rows * cols;
  const [order, setOrder] = useState([]);
  const cellSize = cols > 10 ? 28 : cols > 6 ? 32 : 38;

  const toggleCell = (num) => {
    setOrder(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num);
      return [...prev, num];
    });
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>Click cells in the order you plant them.</strong> Numbers show fill order. Click again to deselect.
      </div>
      <div className="overflow-auto">
        <div className="inline-block">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div key={rIdx} className="flex">
              {Array.from({ length: cols }).map((_, cIdx) => {
                const num = rIdx * cols + cIdx + 1;
                const pos = order.indexOf(num);
                const selected = pos !== -1;
                return (
                  <button
                    key={num}
                    onClick={() => toggleCell(num)}
                    className={cn(
                      'border flex items-center justify-center font-bold transition-all text-xs',
                      selected
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-emerald-50'
                    )}
                    style={{ width: cellSize, height: cellSize, fontSize: '9px' }}
                  >
                    {selected ? pos + 1 : num}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOrder([])}>Clear</Button>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1"
          onClick={() => onDone(order)} disabled={order.length === 0}>
          Use This Order ({order.length} cells defined)
        </Button>
      </div>
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────
export default function TrayImportDialog({ open, onClose, tray, cells, onImported }) {
  const rows = tray?.cells_rows || 1;
  const cols = tray?.cells_cols || 1;

  const [step, setStep] = useState(1); // 1=upload, 2=map+pattern, 3=custom order, 4=preview, 5=importing, 6=done
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [preview, setPreview] = useState([]);

  // Column mapping
  const [colVariety, setColVariety] = useState('');
  const [colPlantType, setColPlantType] = useState('');
  const [colSource, setColSource] = useState('');
  const [colQty, setColQty] = useState('');
  const [colCellId, setColCellId] = useState('');
  const [colPlantId, setColPlantId] = useState('');

  const [fillPattern, setFillPattern] = useState('pairs_down');
  const [customOrder, setCustomOrder] = useState([]);

  // Import progress
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [results, setResults] = useState(null);
  const cancelRef = useRef(false);

  const addLog = (msg) => setLog(prev => [...prev, msg]);

  // ── Parse uploaded file ──
  const handleFileUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      // Find the header row (first row with more than 2 non-empty cells)
      let headerRow = 0;
      for (let i = 0; i < Math.min(5, raw.length); i++) {
        if (raw[i].filter(c => c !== '').length > 2) { headerRow = i; break; }
      }

      const hdrs = raw[headerRow].map(h => String(h || '').trim());
      const dataRows = raw.slice(headerRow + 1)
        .filter(r => r.some(c => c !== ''))
        .map(r => {
          const obj = {};
          hdrs.forEach((h, i) => { obj[h] = String(r[i] ?? '').trim(); });
          return obj;
        });

      setHeaders(hdrs);
      setAllRows(dataRows);
      setPreview(dataRows.slice(0, 5));

      // Auto-detect columns
      const find = (...terms) => hdrs.find(h => terms.some(t => h.toLowerCase().includes(t.toLowerCase()))) || '';
      setColVariety(find('variety', 'name', 'plant'));
      setColPlantType(find('type', 'plant type', 'kind'));
      setColSource(find('source', 'vendor', 'supplier'));
      setColQty(find('qty', 'quantity', 'count', 'seeds'));
      setColCellId(find('cell id', 'cell#', 'cell number', 'cell_id'));
      setColPlantId(find('plant id', 'plant#', 'plant_id', 'id#'));

      setStep(2);
      toast.success(`Loaded ${dataRows.length} rows from ${wb.SheetNames[0]}`);
    };
    reader.readAsArrayBuffer(f);
  };

  // ── Build import plan ──
  const buildImportPlan = () => {
    // Filter rows with variety names
    const validRows = allRows.filter(r => colVariety && r[colVariety]?.trim());

    // If user has Cell IDs in the sheet, map by cell ID → app cell number
    // Otherwise use the chosen fill pattern
    const hasCellIds = colCellId && validRows.every(r => r[colCellId]);

    let assignments = []; // [{row, cellNumber}]

    if (hasCellIds) {
      // Use user's cell IDs mapped to our cell numbering via pairs_down default
      // User's cell 1 → our cell 1, user's cell 2 → our cell 2,
      // user's cell 3 → our cell 13 (if pairs_down) etc.
      const userOrder = buildCellOrder(rows, cols, fillPattern, customOrder);
      validRows.forEach((row, i) => {
        const userCellId = parseInt(row[colCellId]) - 1; // 0-indexed
        const appCellNum = userOrder[userCellId];
        if (appCellNum) assignments.push({ row, cellNumber: appCellNum });
      });
    } else {
      // Sequential fill
      const cellOrder = buildCellOrder(rows, cols, fillPattern, customOrder);
      // Group rows by variety to know how many cells each gets
      const varietyBlocks = [];
      let lastVariety = null;
      validRows.forEach(row => {
        const v = row[colVariety]?.trim();
        if (v === lastVariety && varietyBlocks.length > 0) {
          varietyBlocks[varietyBlocks.length - 1].rows.push(row);
        } else {
          varietyBlocks.push({ variety: v, rows: [row] });
          lastVariety = v;
        }
      });

      let cellIdx = 0;
      varietyBlocks.forEach(block => {
        block.rows.forEach(row => {
          if (cellIdx < cellOrder.length) {
            assignments.push({ row, cellNumber: cellOrder[cellIdx++] });
          }
        });
      });
    }

    return assignments;
  };

  // ── Run the import ──
  const handleImport = async () => {
    setStep(5);
    setImporting(true);
    cancelRef.current = false;
    setLog([]);
    setProgress(0);

    const plan = buildImportPlan();
    const totalRows = plan.length;
    let seeded = 0, stashAdded = 0, stashFound = 0, errors = 0;

    try {
      const user = await base44.auth.me();

      addLog('Loading existing seed stash...');
      const allProfiles = await safeCall(() => base44.entities.PlantProfile.filter({ created_by: user.email }));
      const allSeedLots = await safeCall(() => base44.entities.SeedLot.filter({ created_by: user.email }));

      const profileMap = {}; // variety_name.lower → profile
      allProfiles.forEach(p => { if (p.variety_name) profileMap[p.variety_name.toLowerCase().trim()] = p; });
      const seedLotMap = {}; // profile_id → seedLot
      allSeedLots.forEach(s => { if (s.plant_profile_id && !seedLotMap[s.plant_profile_id]) seedLotMap[s.plant_profile_id] = s; });

      addLog(`Found ${allProfiles.length} profiles, ${allSeedLots.length} seed lots in your stash.`);
      await sleep(500);

      for (let i = 0; i < plan.length; i++) {
        if (cancelRef.current) { addLog('⛔ Cancelled'); break; }

        const { row, cellNumber } = plan[i];
        const varietyName = row[colVariety]?.trim();
        const plantTypeName = colPlantType ? row[colPlantType]?.trim() : '';
        const sourceName = colSource ? row[colSource]?.trim() : '';
        const plantedQty = colQty ? parseInt(row[colQty]) || 1 : 1;
        const plantId = colPlantId ? row[colPlantId]?.trim() : '';

        // Find the tray cell
        const trayCell = cells.find(c => c.cell_number === cellNumber);
        if (!trayCell) {
          addLog(`Cell ${cellNumber}: ⚠️ Not found in tray, skipping`);
          errors++;
          setProgress(Math.round(((i + 1) / totalRows) * 100));
          continue;
        }

        try {
          // 1. Find or create profile + seed lot
          const key = varietyName.toLowerCase();
          let profile = profileMap[key];
          let seedLot = profile ? seedLotMap[profile.id] : null;

          if (!profile) {
            // Create new profile
            profile = await safeCall(() => base44.entities.PlantProfile.create({
              variety_name: varietyName,
              common_name: plantTypeName || 'Unknown',
              source_type: 'user_private',
            }));
            profileMap[key] = profile;
            addLog(`  ✅ Created profile for "${varietyName}"`);
          }

          if (!seedLot) {
            // Create seed lot — count = at least how many we planted
            seedLot = await safeCall(() => base44.entities.SeedLot.create({
              plant_profile_id: profile.id,
              quantity: plantedQty + 5, // give them a few extra
              unit: 'seeds',
              source_vendor_name: sourceName || undefined,
              lot_notes: `Imported from tray: ${tray?.name || 'Unknown Tray'}`,
            }));
            seedLotMap[profile.id] = seedLot;
            stashAdded++;
            addLog(`  🌰 Added to seed stash: "${varietyName}" (qty: ${plantedQty + 5})`);
          } else {
            stashFound++;
          }

          await sleep(300);

          // 2. Seed the tray cell
          const today = new Date().toISOString().split('T')[0];
          await safeCall(() => base44.entities.TrayCell.update(trayCell.id, {
            status: 'seeded',
            variety_name: varietyName,
            plant_type_name: plantTypeName || undefined,
            seed_lot_id: seedLot.id,
            seeded_date: today,
            notes: plantId ? `Plant ID: ${plantId}` : undefined,
          }));

          seeded++;
          addLog(`Cell ${cellNumber}: 🌱 Seeded "${varietyName}"${plantId ? ` (ID: ${plantId})` : ''}`);
        } catch (err) {
          errors++;
          addLog(`Cell ${cellNumber}: ❌ Error — ${err.message}`);
        }

        setProgress(Math.round(((i + 1) / totalRows) * 100));
        await sleep(400);
      }

      setResults({ seeded, stashAdded, stashFound, errors });
      addLog(`\n✅ Done! ${seeded} cells seeded, ${stashAdded} varieties added to stash, ${errors} errors.`);
      setStep(6);
      if (onImported) onImported();
    } catch (err) {
      addLog(`❌ Fatal: ${err.message}`);
      toast.error('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(1); setFile(null); setHeaders([]); setAllRows([]); setPreview([]);
    setColVariety(''); setColPlantType(''); setColSource(''); setColQty('');
    setColCellId(''); setColPlantId(''); setFillPattern('pairs_down');
    setCustomOrder([]); setLog([]); setResults(null); setProgress(0);
    onClose();
  };

  const plan = (step === 4 || step === 5 || step === 6) ? buildImportPlan() : [];

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : reset}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Import Spreadsheet into Tray
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          {['Upload', 'Map Columns', 'Fill Pattern', 'Preview', 'Import'].map((s, i) => (
            <React.Fragment key={i}>
              <span className={cn('px-2 py-0.5 rounded-full font-medium',
                step === i + 1 ? 'bg-emerald-600 text-white' :
                step > i + 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              )}>{s}</span>
              {i < 4 && <ArrowRight className="w-3 h-3 text-gray-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-1">
              <p className="font-semibold">📋 What this does:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Reads your XLS/CSV seedling spreadsheet</li>
                <li>Checks each variety against your Seed Stash — adds if missing</li>
                <li>Seeds the tray cells in the order you choose</li>
                <li>Supports any layout: pairs, columns, rows, or custom click order</li>
              </ul>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>Tray:</strong> {tray?.name} — {rows}×{cols} grid ({rows * cols} total cells)
            </div>
            <div>
              <Label>Upload your spreadsheet (.xls, .xlsx, or .csv)</Label>
              <Input type="file" accept=".xls,.xlsx,.csv" onChange={handleFileUpload} className="mt-2" />
            </div>
          </div>
        )}

        {/* ── STEP 2: Map Columns ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              ✓ Loaded <strong>{allRows.length}</strong> rows. Map your spreadsheet columns below:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Variety/Plant Name *', state: colVariety, set: setColVariety, required: true },
                { label: 'Plant Type (Pepper, Tomato…)', state: colPlantType, set: setColPlantType },
                { label: 'Seed Source / Vendor', state: colSource, set: setColSource },
                { label: 'Quantity Planted (for stash)', state: colQty, set: setColQty },
                { label: 'Cell ID (your numbering)', state: colCellId, set: setColCellId },
                { label: 'Plant ID# (unique plant identifier)', state: colPlantId, set: setColPlantId },
              ].map(({ label, state, set, required }) => (
                <div key={label}>
                  <Label className="text-xs">{label}</Label>
                  <Select value={state} onValueChange={set}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select column…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— None —</SelectItem>
                      {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs font-semibold text-gray-700 mb-2">Preview (first 5 rows):</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="border-b">
                      {[colCellId, colVariety, colPlantType, colSource, colQty, colPlantId].filter(Boolean).map(h => (
                        <th key={h} className="px-2 py-1 text-left text-gray-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {[colCellId, colVariety, colPlantType, colSource, colQty, colPlantId].filter(Boolean).map(h => (
                          <td key={h} className="px-2 py-1 text-gray-700">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!colVariety} className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setStep(fillPattern === 'custom' ? 3 : 3)}>
                Next: Fill Pattern
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP 3: Fill Pattern ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 font-medium">How should varieties be placed into the tray cells?</p>

            <div className="space-y-2">
              {FILL_PATTERNS.map(p => (
                <label key={p.id}
                  className={cn('flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    fillPattern === p.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                  )}>
                  <input type="radio" name="fill" value={p.id} checked={fillPattern === p.id}
                    onChange={() => setFillPattern(p.id)} className="mt-0.5 accent-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {fillPattern === 'custom' ? (
              <>
                <p className="text-sm font-medium text-gray-700">Click cells in your planting order:</p>
                <CustomOrderPicker tray={tray} onDone={(order) => { setCustomOrder(order); setStep(4); }} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                </DialogFooter>
              </>
            ) : (
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStep(4)}>
                  Next: Preview
                </Button>
              </DialogFooter>
            )}
          </div>
        )}

        {/* ── STEP 4: Preview plan ── */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              Ready to import <strong>{plan.length}</strong> varieties into tray <strong>{tray?.name}</strong>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="text-xs w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500">Cell #</th>
                    <th className="px-3 py-2 text-left text-gray-500">Variety</th>
                    <th className="px-3 py-2 text-left text-gray-500">Type</th>
                    {colPlantId && <th className="px-3 py-2 text-left text-gray-500">Plant ID</th>}
                    {colSource && <th className="px-3 py-2 text-left text-gray-500">Source</th>}
                  </tr>
                </thead>
                <tbody>
                  {plan.map(({ row, cellNumber }, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">Cell {cellNumber}</td>
                      <td className="px-3 py-1.5 font-medium">{row[colVariety]}</td>
                      <td className="px-3 py-1.5 text-gray-500">{colPlantType ? row[colPlantType] : '—'}</td>
                      {colPlantId && <td className="px-3 py-1.5 text-gray-500">{row[colPlantId] || '—'}</td>}
                      {colSource && <td className="px-3 py-1.5 text-gray-500">{row[colSource] || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Info className="w-4 h-4 inline mr-1" />
              Any varieties not in your Seed Stash will be added automatically. Seeds quantity will be set to planted count + 5.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />
                Start Import ({plan.length} cells)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── STEP 5: Importing ── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Importing…</span>
                <span className="font-bold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="p-3 bg-gray-50 rounded-lg max-h-64 overflow-auto font-mono text-xs space-y-0.5">
              {log.map((l, i) => (
                <p key={i} className={cn(
                  l.includes('❌') ? 'text-red-600' :
                  l.includes('✅') || l.includes('🌱') || l.includes('🌰') ? 'text-emerald-700' :
                  l.includes('⚠️') ? 'text-amber-600' : 'text-gray-600'
                )}>{l}</p>
              ))}
            </div>
            <Button variant="destructive" size="sm" onClick={() => { cancelRef.current = true; }}>
              Cancel
            </Button>
          </div>
        )}

        {/* ── STEP 6: Done ── */}
        {step === 6 && results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <p className="text-2xl font-black text-emerald-900">{results.seeded}</p>
                <p className="text-xs text-emerald-700">Cells Seeded</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-2xl font-black text-blue-900">{results.stashFound}</p>
                <p className="text-xs text-blue-700">Found in Stash</p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                <p className="text-2xl font-black text-amber-900">{results.stashAdded}</p>
                <p className="text-xs text-amber-700">Added to Stash</p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-2xl font-black text-red-900">{results.errors}</p>
                <p className="text-xs text-red-700">Errors</p>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg max-h-48 overflow-auto font-mono text-xs space-y-0.5">
              {log.map((l, i) => (
                <p key={i} className={cn(
                  l.includes('❌') ? 'text-red-600' :
                  l.includes('✅') || l.includes('🌱') || l.includes('🌰') ? 'text-emerald-700' :
                  'text-gray-500'
                )}>{l}</p>
              ))}
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={reset}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}