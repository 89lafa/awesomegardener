import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Printer, Search, ZoomIn, ZoomOut, X } from 'lucide-react';

const PLANTS = [
  'Basil','Beans','Beets','Borage','Cabbage','Carrots','Celery','Chamomile',
  'Chives','Corn','Cucumber','Dill','Eggplant','Fennel','Garlic','Kale',
  'Lavender','Leeks','Lettuce','Marigold','Mint','Nasturtium','Onions',
  'Parsley','Peas','Peppers','Potatoes','Pumpkin','Radishes','Rosemary',
  'Sage','Spinach','Squash','Strawberries','Sunflowers','Thyme','Tomatoes',
  'Turnips','Yarrow','Zucchini'
];

// Bidirectional companion matrix
const RAW_RULES = [
  ['Basil','Tomatoes','G'], ['Basil','Peppers','G'], ['Basil','Marigold','G'],
  ['Basil','Beans','B'], ['Basil','Sage','B'], ['Basil','Cucumber','G'],
  ['Beans','Corn','G'], ['Beans','Squash','G'], ['Beans','Carrots','G'],
  ['Beans','Lettuce','G'], ['Beans','Strawberries','G'], ['Beans','Radishes','G'],
  ['Beans','Onions','B'], ['Beans','Garlic','B'], ['Beans','Fennel','B'], ['Beans','Leeks','B'],
  ['Beets','Cabbage','G'], ['Beets','Lettuce','G'], ['Beets','Onions','G'], ['Beets','Radishes','G'],
  ['Beets','Fennel','B'],
  ['Borage','Tomatoes','G'], ['Borage','Strawberries','G'], ['Borage','Squash','G'], ['Borage','Cucumber','G'],
  ['Cabbage','Celery','G'], ['Cabbage','Dill','G'], ['Cabbage','Onions','G'],
  ['Cabbage','Nasturtium','G'], ['Cabbage','Rosemary','G'], ['Cabbage','Thyme','G'],
  ['Cabbage','Strawberries','B'], ['Cabbage','Tomatoes','B'],
  ['Carrots','Chives','G'], ['Carrots','Leeks','G'], ['Carrots','Onions','G'],
  ['Carrots','Rosemary','G'], ['Carrots','Sage','G'], ['Carrots','Tomatoes','G'], ['Carrots','Lettuce','G'],
  ['Carrots','Dill','B'], ['Carrots','Fennel','B'],
  ['Celery','Tomatoes','G'], ['Celery','Leeks','G'], ['Celery','Chives','G'], ['Celery','Nasturtium','G'],
  ['Chamomile','Cabbage','G'], ['Chamomile','Onions','G'],
  ['Chives','Carrots','G'], ['Chives','Tomatoes','G'],
  ['Corn','Beans','G'], ['Corn','Squash','G'], ['Corn','Cucumber','G'], ['Corn','Pumpkin','G'],
  ['Corn','Tomatoes','B'],
  ['Cucumber','Beans','G'], ['Cucumber','Corn','G'], ['Cucumber','Peas','G'], ['Cucumber','Radishes','G'],
  ['Cucumber','Sunflowers','G'], ['Cucumber','Nasturtium','G'], ['Cucumber','Lettuce','G'],
  ['Cucumber','Sage','B'], ['Cucumber','Fennel','B'],
  ['Dill','Cabbage','G'], ['Dill','Lettuce','G'], ['Dill','Onions','G'],
  ['Dill','Tomatoes','B'], ['Dill','Carrots','B'], ['Dill','Fennel','B'],
  ['Eggplant','Beans','G'], ['Eggplant','Marigold','G'], ['Eggplant','Peppers','G'], ['Eggplant','Spinach','G'],
  ['Eggplant','Fennel','B'],
  ['Fennel','Dill','C'], ['Fennel','Yarrow','G'],
  ['Fennel','Tomatoes','B'], ['Fennel','Beans','B'], ['Fennel','Peppers','B'],
  ['Fennel','Cabbage','B'], ['Fennel','Eggplant','B'], ['Fennel','Potatoes','B'],
  ['Garlic','Tomatoes','G'], ['Garlic','Carrots','G'],
  ['Garlic','Beans','B'], ['Garlic','Peas','B'],
  ['Kale','Beets','G'], ['Kale','Onions','G'], ['Kale','Marigold','G'],
  ['Lavender','Tomatoes','G'], ['Lavender','Cabbage','G'],
  ['Leeks','Carrots','G'], ['Leeks','Celery','G'], ['Leeks','Onions','G'],
  ['Leeks','Beans','B'],
  ['Lettuce','Radishes','G'], ['Lettuce','Carrots','G'], ['Lettuce','Strawberries','G'],
  ['Lettuce','Yarrow','C'],
  ['Marigold','Tomatoes','G'], ['Marigold','Peppers','G'], ['Marigold','Squash','G'], ['Marigold','Cucumber','G'],
  ['Mint','Cabbage','G'], ['Mint','Tomatoes','G'], ['Mint','Peas','G'],
  ['Nasturtium','Tomatoes','G'], ['Nasturtium','Cucumber','G'], ['Nasturtium','Squash','G'],
  ['Nasturtium','Beans','G'], ['Nasturtium','Radishes','G'],
  ['Onions','Carrots','G'], ['Onions','Beets','G'], ['Onions','Tomatoes','G'], ['Onions','Lettuce','G'],
  ['Onions','Beans','B'], ['Onions','Peas','B'],
  ['Parsley','Tomatoes','G'], ['Parsley','Carrots','G'],
  ['Peas','Carrots','G'], ['Peas','Corn','G'], ['Peas','Radishes','G'], ['Peas','Spinach','G'],
  ['Peas','Garlic','B'], ['Peas','Onions','B'],
  ['Peppers','Basil','G'], ['Peppers','Carrots','G'], ['Peppers','Tomatoes','G'], ['Peppers','Eggplant','G'],
  ['Peppers','Fennel','B'],
  ['Potatoes','Beans','G'], ['Potatoes','Corn','G'], ['Potatoes','Marigold','G'],
  ['Potatoes','Tomatoes','B'], ['Potatoes','Fennel','B'], ['Potatoes','Sunflowers','B'], ['Potatoes','Cucumber','B'],
  ['Pumpkin','Corn','G'], ['Pumpkin','Beans','G'], ['Pumpkin','Marigold','G'], ['Pumpkin','Nasturtium','G'],
  ['Radishes','Lettuce','G'], ['Radishes','Nasturtium','G'], ['Radishes','Cucumber','G'], ['Radishes','Peas','G'],
  ['Rosemary','Cabbage','G'], ['Rosemary','Beans','G'], ['Rosemary','Carrots','G'], ['Rosemary','Sage','G'],
  ['Sage','Carrots','G'], ['Sage','Cabbage','G'], ['Sage','Rosemary','G'],
  ['Sage','Cucumber','B'], ['Sage','Basil','B'],
  ['Spinach','Strawberries','G'], ['Spinach','Peas','G'], ['Spinach','Tomatoes','G'], ['Spinach','Eggplant','G'],
  ['Squash','Corn','G'], ['Squash','Beans','G'], ['Squash','Nasturtium','G'], ['Squash','Marigold','G'],
  ['Strawberries','Spinach','G'], ['Strawberries','Borage','G'], ['Strawberries','Lettuce','G'],
  ['Strawberries','Cabbage','B'],
  ['Sunflowers','Cucumber','G'], ['Sunflowers','Corn','G'], ['Sunflowers','Squash','G'],
  ['Sunflowers','Potatoes','B'], ['Sunflowers','Beans','C'],
  ['Thyme','Cabbage','G'], ['Thyme','Eggplant','G'], ['Thyme','Tomatoes','G'],
  ['Tomatoes','Basil','G'], ['Tomatoes','Garlic','G'], ['Tomatoes','Parsley','G'],
  ['Tomatoes','Marigold','G'], ['Tomatoes','Carrots','G'], ['Tomatoes','Spinach','G'],
  ['Tomatoes','Borage','G'], ['Tomatoes','Celery','G'],
  ['Tomatoes','Corn','B'], ['Tomatoes','Potatoes','B'], ['Tomatoes','Fennel','B'],
  ['Tomatoes','Dill','B'], ['Tomatoes','Cabbage','B'],
  ['Turnips','Peas','G'], ['Turnips','Nasturtium','G'],
  ['Turnips','Tomatoes','B'],
  ['Yarrow','Fennel','G'], ['Yarrow','Lavender','G'],
  ['Zucchini','Nasturtium','G'], ['Zucchini','Beans','G'], ['Zucchini','Corn','G'], ['Zucchini','Marigold','G'],
];

// Build bidirectional lookup
const MATRIX = {};
RAW_RULES.forEach(([a, b, type]) => {
  MATRIX[`${a}|${b}`] = type;
  // Only set reverse if not already set (directional rules take precedence)
  if (!MATRIX[`${b}|${a}`]) MATRIX[`${b}|${a}`] = type;
});

function getRel(a, b) {
  if (a === b) return '=';
  return MATRIX[`${a}|${b}`] || '';
}

// Build companions list for a given plant
function getCompanions(plant) {
  const good = [], bad = [], conditional = [];
  PLANTS.forEach(other => {
    if (other === plant) return;
    const rel = getRel(plant, other);
    if (rel === 'G') good.push(other);
    else if (rel === 'B') bad.push(other);
    else if (rel === 'C') conditional.push(other);
  });
  return { good, bad, conditional };
}

const CELL_STYLE = {
  'G': { bg: '#22c55e', color: 'white', label: '✓' },
  'B': { bg: '#ef4444', color: 'white', label: '✗' },
  'C': { bg: '#eab308', color: '#1a1a1a', label: '~' },
  '=': { bg: '#e5e7eb', color: '#9ca3af', label: '—' },
  '':  { bg: '#f9fafb', color: '#d1d5db', label: '' },
};

export default function CompanionChartModal({ open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(null);
  const [zoom, setZoom] = useState(0.85);
  const tableRef = useRef();

  const filteredPlants = search
    ? PLANTS.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : PLANTS;

  const rowPlants = highlighted ? PLANTS : filteredPlants;
  const colPlants = PLANTS;
  const companions = highlighted ? getCompanions(highlighted) : null;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    // Build table HTML inline (no React refs — just string)
    let rows = '';
    PLANTS.forEach(row => {
      let cells = `<td class="row-hdr">${row}</td>`;
      PLANTS.forEach(col => {
        const rel = getRel(row, col);
        const s = CELL_STYLE[rel] || CELL_STYLE[''];
        const cls = rel === 'G' ? 'g' : rel === 'B' ? 'b' : rel === 'C' ? 'c' : rel === '=' ? 's' : 'e';
        cells += `<td class="${cls}">${s.label}</td>`;
      });
      rows += `<tr>${cells}</tr>`;
    });
    let colHdrs = '<th class="corner"></th>' + PLANTS.map(p => `<th class="hdr">${p}</th>`).join('');

    win.document.write(`<html><head><title>Companion Planting Chart — AwesomeGardener</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:8px;margin:10px}
      h2{text-align:center;font-size:14px;margin-bottom:4px}
      p.legend{text-align:center;font-size:10px;margin-bottom:8px}
      table{border-collapse:collapse}
      th,td{border:1px solid #ddd;text-align:center;width:18px;height:18px;min-width:18px;padding:0;font-weight:bold}
      .hdr{writing-mode:vertical-rl;transform:rotate(180deg);width:18px;padding:2px 0;background:#f3f4f6;font-size:7px}
      .row-hdr{text-align:left;padding:1px 4px;white-space:nowrap;background:#f9fafb;font-size:7px;width:auto}
      .corner{background:#f9fafb}
      .g{background:#22c55e;color:white}
      .b{background:#ef4444;color:white}
      .c{background:#eab308;color:#111}
      .s{background:#e5e7eb;color:#9ca3af}
      .e{background:#f9fafb;color:#e5e7eb}
      @media print{body{margin:0}}
    </style></head><body>
    <h2>Companion Planting Chart — AwesomeGardener.com</h2>
    <p class="legend">🟢 Good companions &nbsp;&nbsp; 🔴 Avoid &nbsp;&nbsp; 🟡 Conditional</p>
    <table><thead><tr>${colHdrs}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[99vw] max-h-[97vh] w-full h-full overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-4 pt-3 pb-2 border-b flex-shrink-0 bg-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-lg font-bold">🌿 Companion Planting Chart</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); if (highlighted && !e.target.value.toLowerCase().includes(highlighted.toLowerCase())) setHighlighted(null); }}
                  placeholder="Search plant..."
                  className="pl-7 h-8 text-sm w-36"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))} className="h-8 w-8 p-0"><ZoomOut className="w-3 h-3" /></Button>
              <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(1.5, +(z + 0.1).toFixed(1)))} className="h-8 w-8 p-0"><ZoomIn className="w-3 h-3" /></Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 gap-1.5 px-3">
                <Printer className="w-3 h-3" />Print
              </Button>
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 text-xs mt-2 flex-wrap items-center">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: '#22c55e' }} />
              <strong>Good</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: '#ef4444' }} />
              <strong>Avoid</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded" style={{ background: '#eab308' }} />
              <strong>Conditional</strong>
            </span>
            <span className="text-gray-400">· Click a plant name to see its companions</span>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 overflow-auto p-3">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', display: 'inline-block', minWidth: 'max-content' }}>
              <table ref={tableRef} style={{ borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ 
                      position: 'sticky', left: 0, zIndex: 20, background: 'white',
                      border: '1px solid #e5e7eb', minWidth: 100, padding: '4px 8px',
                      textAlign: 'left', fontSize: 11, fontWeight: 700
                    }}>Plant ↓  →</th>
                    {colPlants.map(col => (
                      <th key={col}
                        onClick={() => setHighlighted(highlighted === col ? null : col)}
                        title={col}
                        style={{
                          border: '1px solid #e5e7eb',
                          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                          padding: '4px 2px', minWidth: 22, maxWidth: 22, width: 22,
                          cursor: 'pointer', userSelect: 'none',
                          background: highlighted === col ? '#d1fae5' : '#f9fafb',
                          color: highlighted === col ? '#065f46' : '#374151',
                          fontWeight: highlighted === col ? 700 : 500,
                          transition: 'background 0.15s',
                        }}
                      >{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowPlants.map(row => {
                    const isHRow = highlighted === row;
                    return (
                      <tr key={row}>
                        <td
                          onClick={() => setHighlighted(highlighted === row ? null : row)}
                          style={{
                            position: 'sticky', left: 0, zIndex: 10,
                            border: '1px solid #e5e7eb', padding: '2px 8px',
                            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                            background: isHRow ? '#d1fae5' : 'white',
                            color: isHRow ? '#065f46' : '#1f2937',
                            userSelect: 'none',
                          }}
                        >{row}</td>
                        {colPlants.map(col => {
                          const rel = getRel(row, col);
                          const s = CELL_STYLE[rel] || CELL_STYLE[''];
                          const dim = highlighted && highlighted !== row && highlighted !== col;
                          return (
                            <td key={col}
                              title={rel === 'G' ? `✓ ${row} + ${col}: Good companions` :
                                     rel === 'B' ? `✗ ${row} + ${col}: Avoid` :
                                     rel === 'C' ? `~ ${row} + ${col}: Conditional` : ''}
                              style={{
                                border: '1px solid #e5e7eb',
                                width: 22, height: 22, minWidth: 22,
                                textAlign: 'center', fontWeight: 700, fontSize: 11,
                                background: s.bg, color: s.color,
                                opacity: dim ? 0.15 : 1,
                                transition: 'opacity 0.15s',
                              }}
                            >{s.label}</td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side panel — shown when a plant is highlighted */}
          {highlighted && companions && (
            <div className="w-56 flex-shrink-0 border-l bg-gray-50 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b bg-white flex-shrink-0">
                <h3 className="font-bold text-sm text-gray-900">{highlighted}</h3>
                <button onClick={() => setHighlighted(null)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {companions.good.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
                      <span className="text-xs font-bold text-green-800">Good Companions ({companions.good.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {companions.good.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer"
                          style={{ background: '#dcfce7', color: '#166534' }}
                          onClick={() => setHighlighted(p)}
                        >{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {companions.bad.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                      <span className="text-xs font-bold text-red-800">Avoid ({companions.bad.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {companions.bad.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer"
                          style={{ background: '#fee2e2', color: '#991b1b' }}
                          onClick={() => setHighlighted(p)}
                        >{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {companions.conditional.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: '#eab308' }} />
                      <span className="text-xs font-bold text-yellow-800">Conditional ({companions.conditional.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {companions.conditional.map(p => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer"
                          style={{ background: '#fef9c3', color: '#854d0e' }}
                          onClick={() => setHighlighted(p)}
                        >{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {companions.good.length === 0 && companions.bad.length === 0 && companions.conditional.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No known companion relationships.</p>
                )}
                <p className="text-[10px] text-gray-400 mt-2">Click any plant name to switch focus.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}