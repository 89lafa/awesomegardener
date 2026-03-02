import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Printer, Search, X, ZoomIn, ZoomOut } from 'lucide-react';

// Companion data embedded from the HTML chart
const PLANTS = [
  'Basil','Beans','Beets','Borage','Cabbage','Carrots','Celery','Chamomile',
  'Chives','Corn','Cucumber','Dill','Eggplant','Fennel','Garlic','Kale',
  'Lavender','Leeks','Lettuce','Marigold','Mint','Nasturtium','Onions',
  'Parsley','Peas','Peppers','Potatoes','Pumpkin','Radishes','Rosemary',
  'Sage','Spinach','Squash','Strawberries','Sunflowers','Thyme','Tomatoes',
  'Turnips','Yarrow','Zucchini'
];

// Relationship matrix — G=Good, B=Bad, C=Conditional, "=self
const MATRIX = {
  'Basil|Tomatoes': 'G', 'Basil|Peppers': 'G', 'Basil|Marigold': 'G', 'Basil|Oregano': 'G',
  'Basil|Beans': 'B', 'Basil|Sage': 'B', 'Basil|Cucumber': 'G',
  'Beans|Corn': 'G', 'Beans|Squash': 'G', 'Beans|Carrots': 'G', 'Beans|Lettuce': 'G',
  'Beans|Strawberries': 'G', 'Beans|Radishes': 'G',
  'Beans|Onions': 'B', 'Beans|Garlic': 'B', 'Beans|Fennel': 'B', 'Beans|Leeks': 'B',
  'Beets|Cabbage': 'G', 'Beets|Lettuce': 'G', 'Beets|Onions': 'G', 'Beets|Radishes': 'G',
  'Beets|Fennel': 'B',
  'Borage|Tomatoes': 'G', 'Borage|Strawberries': 'G', 'Borage|Squash': 'G', 'Borage|Cucumber': 'G',
  'Cabbage|Celery': 'G', 'Cabbage|Dill': 'G', 'Cabbage|Onions': 'G', 'Cabbage|Nasturtium': 'G',
  'Cabbage|Rosemary': 'G', 'Cabbage|Thyme': 'G',
  'Cabbage|Strawberries': 'B', 'Cabbage|Tomatoes': 'B',
  'Carrots|Chives': 'G', 'Carrots|Leeks': 'G', 'Carrots|Onions': 'G', 'Carrots|Rosemary': 'G',
  'Carrots|Sage': 'G', 'Carrots|Tomatoes': 'G', 'Carrots|Lettuce': 'G',
  'Carrots|Dill': 'B', 'Carrots|Fennel': 'B',
  'Celery|Tomatoes': 'G', 'Celery|Leeks': 'G', 'Celery|Chives': 'G', 'Celery|Nasturtium': 'G',
  'Chamomile|Cabbage': 'G', 'Chamomile|Onions': 'G',
  'Chives|Carrots': 'G', 'Chives|Tomatoes': 'G', 'Chives|Roses': 'G',
  'Corn|Beans': 'G', 'Corn|Squash': 'G', 'Corn|Cucumber': 'G', 'Corn|Pumpkin': 'G',
  'Corn|Tomatoes': 'B',
  'Cucumber|Beans': 'G', 'Cucumber|Corn': 'G', 'Cucumber|Peas': 'G', 'Cucumber|Radishes': 'G',
  'Cucumber|Sunflowers': 'G', 'Cucumber|Nasturtium': 'G', 'Cucumber|Lettuce': 'G',
  'Cucumber|Sage': 'B', 'Cucumber|Fennel': 'B',
  'Dill|Cabbage': 'G', 'Dill|Lettuce': 'G', 'Dill|Onions': 'G',
  'Dill|Tomatoes': 'B', 'Dill|Carrots': 'B', 'Dill|Fennel': 'B',
  'Eggplant|Beans': 'G', 'Eggplant|Marigold': 'G', 'Eggplant|Peppers': 'G', 'Eggplant|Spinach': 'G',
  'Eggplant|Fennel': 'B',
  'Fennel|Dill': 'C', 'Fennel|Yarrow': 'G',
  'Fennel|Tomatoes': 'B', 'Fennel|Beans': 'B', 'Fennel|Peppers': 'B', 'Fennel|Cabbage': 'B',
  'Fennel|Eggplant': 'B', 'Fennel|Potatoes': 'B',
  'Garlic|Tomatoes': 'G', 'Garlic|Roses': 'G', 'Garlic|Carrots': 'G', 'Garlic|Fruit trees': 'G',
  'Garlic|Beans': 'B', 'Garlic|Peas': 'B',
  'Kale|Beets': 'G', 'Kale|Onions': 'G', 'Kale|Marigold': 'G',
  'Lavender|Tomatoes': 'G', 'Lavender|Roses': 'G', 'Lavender|Cabbage': 'G',
  'Leeks|Carrots': 'G', 'Leeks|Celery': 'G', 'Leeks|Onions': 'G',
  'Leeks|Beans': 'B',
  'Lettuce|Radishes': 'G', 'Lettuce|Carrots': 'G', 'Lettuce|Strawberries': 'G',
  'Lettuce|Tall plants': 'C',
  'Marigold|Tomatoes': 'G', 'Marigold|Peppers': 'G', 'Marigold|Squash': 'G', 'Marigold|Cucumber': 'G',
  'Mint|Cabbage': 'G', 'Mint|Tomatoes': 'G', 'Mint|Peas': 'G',
  'Nasturtium|Tomatoes': 'G', 'Nasturtium|Cucumber': 'G', 'Nasturtium|Squash': 'G',
  'Nasturtium|Beans': 'G', 'Nasturtium|Radishes': 'G',
  'Onions|Carrots': 'G', 'Onions|Beets': 'G', 'Onions|Tomatoes': 'G', 'Onions|Lettuce': 'G',
  'Onions|Beans': 'B', 'Onions|Peas': 'B',
  'Parsley|Tomatoes': 'G', 'Parsley|Carrots': 'G', 'Parsley|Asparagus': 'G',
  'Peas|Carrots': 'G', 'Peas|Corn': 'G', 'Peas|Radishes': 'G', 'Peas|Spinach': 'G',
  'Peas|Garlic': 'B', 'Peas|Onions': 'B',
  'Peppers|Basil': 'G', 'Peppers|Carrots': 'G', 'Peppers|Tomatoes': 'G', 'Peppers|Eggplant': 'G',
  'Peppers|Fennel': 'B',
  'Potatoes|Beans': 'G', 'Potatoes|Corn': 'G', 'Potatoes|Horseradish': 'G', 'Potatoes|Marigold': 'G',
  'Potatoes|Tomatoes': 'B', 'Potatoes|Fennel': 'B', 'Potatoes|Sunflowers': 'B', 'Potatoes|Cucumber': 'B',
  'Pumpkin|Corn': 'G', 'Pumpkin|Beans': 'G', 'Pumpkin|Marigold': 'G', 'Pumpkin|Nasturtium': 'G',
  'Radishes|Lettuce': 'G', 'Radishes|Nasturtium': 'G', 'Radishes|Cucumber': 'G', 'Radishes|Peas': 'G',
  'Rosemary|Cabbage': 'G', 'Rosemary|Beans': 'G', 'Rosemary|Carrots': 'G', 'Rosemary|Sage': 'G',
  'Sage|Carrots': 'G', 'Sage|Cabbage': 'G', 'Sage|Rosemary': 'G',
  'Sage|Cucumber': 'B', 'Sage|Basil': 'B',
  'Spinach|Strawberries': 'G', 'Spinach|Peas': 'G', 'Spinach|Tomatoes': 'G', 'Spinach|Eggplant': 'G',
  'Squash|Corn': 'G', 'Squash|Beans': 'G', 'Squash|Nasturtium': 'G', 'Squash|Marigold': 'G',
  'Strawberries|Spinach': 'G', 'Strawberries|Borage': 'G', 'Strawberries|Lettuce': 'G',
  'Strawberries|Cabbage': 'B', 'Strawberries|Broccoli': 'B',
  'Sunflowers|Cucumber': 'G', 'Sunflowers|Corn': 'G', 'Sunflowers|Squash': 'G',
  'Sunflowers|Potatoes': 'B', 'Sunflowers|Beans': 'C',
  'Thyme|Cabbage': 'G', 'Thyme|Eggplant': 'G', 'Thyme|Tomatoes': 'G',
  'Tomatoes|Basil': 'G', 'Tomatoes|Garlic': 'G', 'Tomatoes|Parsley': 'G', 'Tomatoes|Marigold': 'G',
  'Tomatoes|Carrots': 'G', 'Tomatoes|Spinach': 'G', 'Tomatoes|Borage': 'G', 'Tomatoes|Celery': 'G',
  'Tomatoes|Corn': 'B', 'Tomatoes|Potatoes': 'B', 'Tomatoes|Fennel': 'B', 'Tomatoes|Dill': 'B', 'Tomatoes|Cabbage': 'B',
  'Turnips|Peas': 'G', 'Turnips|Nasturtium': 'G',
  'Turnips|Tomatoes': 'B',
  'Yarrow|Fennel': 'G', 'Yarrow|Lavender': 'G',
  'Zucchini|Nasturtium': 'G', 'Zucchini|Beans': 'G', 'Zucchini|Corn': 'G', 'Zucchini|Marigold': 'G',
};

function getRelationship(a, b) {
  if (a === b) return '=';
  return MATRIX[`${a}|${b}`] || MATRIX[`${b}|${a}`] || '';
}

const CELL_BG = {
  'G': 'bg-green-400 text-white',
  'B': 'bg-red-400 text-white',
  'C': 'bg-amber-300 text-gray-900',
  '=': 'bg-gray-200 text-gray-400',
  '': 'bg-gray-50 text-gray-300',
};
const CELL_LABEL = { 'G': '✓', 'B': '✗', 'C': '~', '=': '—', '': '' };

export default function CompanionChartModal({ open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState(null);
  const [zoom, setZoom] = useState(1);
  const printRef = useRef();

  const filteredPlants = search
    ? PLANTS.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : PLANTS;

  const activePlants = highlighted
    ? PLANTS
    : filteredPlants;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const tableHtml = printRef.current?.innerHTML || '';
    printWindow.document.write(`
      <html><head><title>Companion Planting Chart — AwesomeGardener</title>
      <style>
        body { font-family: sans-serif; font-size: 9px; }
        table { border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 2px; text-align: center; min-width: 22px; }
        .g { background: #4ade80; color: white; }
        .b { background: #f87171; color: white; }
        .c { background: #fcd34d; }
        .s { background: #e5e7eb; color: #9ca3af; }
        .hdr { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 8px; padding: 4px 2px; background: #f9fafb; font-weight: bold; }
      </style></head><body>
      <h2 style="text-align:center">Companion Planting Chart — AwesomeGardener.com</h2>
      <p style="text-align:center">🟢 Good companion &nbsp; 🔴 Avoid &nbsp; 🟡 Conditional</p>
      ${tableHtml}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const rowPlants = highlighted ? PLANTS : activePlants;
  const colPlants = PLANTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[95vh] w-full overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="text-lg font-bold">🌿 Companion Planting Chart</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setHighlighted(null); }}
                  placeholder="Search plant..."
                  className="pl-7 h-8 text-sm w-40"
                />
              </div>
              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="h-8 px-2">
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="h-8 px-2">
                <ZoomIn className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 gap-1">
                <Printer className="w-3 h-3" />Print
              </Button>
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 text-xs mt-2 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-green-400 inline-block"/><strong>Good</strong> companions</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-red-400 inline-block"/><strong>Avoid</strong> planting together</span>
            <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-300 inline-block"/><strong>Conditional</strong></span>
            <span className="text-gray-400 ml-2">Click a plant name to highlight its row</span>
          </div>
        </DialogHeader>

        <div className="overflow-auto flex-1 p-2">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: 'max-content' }}>
            <div ref={printRef}>
              <table className="border-collapse text-[10px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-white border border-gray-200 min-w-[90px] text-left px-2 py-1 text-xs font-bold">Plant</th>
                    {colPlants.map(col => (
                      <th key={col}
                        className={`border border-gray-200 text-center cursor-pointer transition-colors ${highlighted === col ? 'bg-emerald-100' : 'bg-gray-50 hover:bg-emerald-50'}`}
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '4px 2px', minWidth: 22, maxWidth: 22 }}
                        onClick={() => setHighlighted(highlighted === col ? null : col)}
                        title={col}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowPlants.map(row => {
                    const isHighlightedRow = highlighted === row;
                    return (
                      <tr key={row} className={isHighlightedRow ? 'ring-1 ring-emerald-400' : ''}>
                        <td
                          className={`sticky left-0 z-10 border border-gray-200 px-2 py-0.5 font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                            highlighted === row ? 'bg-emerald-100 text-emerald-900' : 'bg-white hover:bg-emerald-50 text-gray-800'
                          }`}
                          style={{ minWidth: 90 }}
                          onClick={() => setHighlighted(highlighted === row ? null : row)}
                        >
                          {row}
                        </td>
                        {colPlants.map(col => {
                          const rel = getRelationship(row, col);
                          const dim = highlighted && highlighted !== row && highlighted !== col;
                          return (
                            <td
                              key={col}
                              title={rel === 'G' ? `✓ ${row} + ${col}: Good companions` :
                                     rel === 'B' ? `✗ ${row} + ${col}: Avoid` :
                                     rel === 'C' ? `~ ${row} + ${col}: Conditional` : ''}
                              className={`border border-gray-200 text-center font-bold transition-all ${CELL_BG[rel]} ${dim ? 'opacity-20' : ''}`}
                              style={{ width: 22, height: 22, minWidth: 22 }}
                            >
                              {CELL_LABEL[rel]}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}