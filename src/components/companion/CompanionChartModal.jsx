import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';

// ─── Chart data extracted from the HTML reference ──────────────
// Relationship matrix: 'G'=Good, 'C'=Conditional, 'B'=Bad, '~'=Same, ''=Unknown
const PLANTS = [
  { name: 'Tomato',       emoji: '🍅', cat: 'Nightshade' },
  { name: 'Pepper',       emoji: '🌶️', cat: 'Nightshade' },
  { name: 'Eggplant',     emoji: '🍆', cat: 'Nightshade' },
  { name: 'Potato',       emoji: '🥔', cat: 'Nightshade' },
  { name: 'Cucumber',     emoji: '🥒', cat: 'Cucurbit' },
  { name: 'Squash',       emoji: '🎃', cat: 'Cucurbit' },
  { name: 'Melon',        emoji: '🍈', cat: 'Cucurbit' },
  { name: 'Pumpkin',      emoji: '🎃', cat: 'Cucurbit' },
  { name: 'Carrot',       emoji: '🥕', cat: 'Root' },
  { name: 'Beet',         emoji: '🫚', cat: 'Root' },
  { name: 'Radish',       emoji: '🔴', cat: 'Root' },
  { name: 'Onion',        emoji: '🧅', cat: 'Allium' },
  { name: 'Garlic',       emoji: '🧄', cat: 'Allium' },
  { name: 'Leek',         emoji: '🌿', cat: 'Allium' },
  { name: 'Bean',         emoji: '🫘', cat: 'Legume' },
  { name: 'Pea',          emoji: '🟢', cat: 'Legume' },
  { name: 'Corn',         emoji: '🌽', cat: 'Grain' },
  { name: 'Lettuce',      emoji: '🥬', cat: 'Leafy' },
  { name: 'Spinach',      emoji: '🍃', cat: 'Leafy' },
  { name: 'Kale',         emoji: '🥦', cat: 'Leafy' },
  { name: 'Cabbage',      emoji: '🥬', cat: 'Brassica' },
  { name: 'Broccoli',     emoji: '🥦', cat: 'Brassica' },
  { name: 'Cauliflower',  emoji: '⚪', cat: 'Brassica' },
  { name: 'Brussels Spr.', emoji: '🟢', cat: 'Brassica' },
  { name: 'Basil',        emoji: '🌿', cat: 'Herb' },
  { name: 'Parsley',      emoji: '🌿', cat: 'Herb' },
  { name: 'Dill',         emoji: '🌾', cat: 'Herb' },
  { name: 'Cilantro',     emoji: '🌿', cat: 'Herb' },
  { name: 'Mint',         emoji: '🌿', cat: 'Herb' },
  { name: 'Marigold',     emoji: '🌼', cat: 'Flower' },
  { name: 'Nasturtium',   emoji: '🌸', cat: 'Flower' },
  { name: 'Sunflower',    emoji: '🌻', cat: 'Flower' },
  { name: 'Lavender',     emoji: '💜', cat: 'Flower' },
  { name: 'Borage',       emoji: '🔵', cat: 'Flower' },
  { name: 'Chamomile',    emoji: '🌼', cat: 'Flower' },
  { name: 'Calendula',    emoji: '🟡', cat: 'Flower' },
];

// Relationship data [rowIdx][colIdx]: 'G','C','B','~','?'
// Source: AwesomeGardener Companion Planting Chart
const RAW_MATRIX = {
  'Tomato':    { 'Basil':'G','Marigold':'G','Nasturtium':'G','Borage':'G','Carrot':'G','Parsley':'G','Garlic':'G','Spinach':'G','Lettuce':'G','Calendula':'G','Chamomile':'G','Lavender':'G','Dill':'C','Pepper':'C','Squash':'C','Cucumber':'C','Bean':'C','Corn':'C','Potato':'B','Eggplant':'C','Fennel':'B','Beet':'C','Onion':'C','Cilantro':'C' },
  'Pepper':    { 'Basil':'G','Carrot':'G','Onion':'G','Tomato':'C','Marigold':'G','Spinach':'G','Parsley':'G','Nasturtium':'G','Garlic':'G','Potato':'B','Fennel':'B','Beet':'C','Lettuce':'G','Cucumber':'C' },
  'Eggplant':  { 'Bean':'G','Marigold':'G','Pepper':'C','Tomato':'C','Nasturtium':'G','Potato':'C','Basil':'G','Dill':'C','Spinach':'G','Garlic':'G','Fennel':'B','Pea':'G' },
  'Potato':    { 'Bean':'G','Pea':'G','Marigold':'G','Nasturtium':'G','Horseradish':'G','Corn':'C','Cabbage':'C','Tomato':'B','Pepper':'B','Eggplant':'C','Cucumber':'B','Fennel':'B','Onion':'B','Garlic':'C','Squash':'C','Sunflower':'B' },
  'Cucumber':  { 'Bean':'G','Dill':'G','Marigold':'G','Nasturtium':'G','Pea':'G','Sunflower':'G','Radish':'G','Borage':'G','Celery':'G','Tomato':'C','Squash':'C','Melon':'C','Corn':'C','Potato':'B','Fennel':'B','Sage':'B','Basil':'C','Onion':'C','Garlic':'G' },
  'Squash':    { 'Bean':'G','Corn':'G','Nasturtium':'G','Marigold':'G','Borage':'G','Radish':'G','Dill':'G','Pea':'C','Tomato':'C','Cucumber':'C','Melon':'C','Fennel':'B','Potato':'C','Sunflower':'C','Garlic':'G' },
  'Melon':     { 'Marigold':'G','Nasturtium':'G','Corn':'G','Radish':'G','Basil':'G','Sunflower':'C','Cucumber':'C','Squash':'C','Potato':'B','Fennel':'B','Onion':'C' },
  'Corn':      { 'Bean':'G','Squash':'G','Pea':'G','Cucumber':'C','Melon':'G','Tomato':'C','Potato':'C','Pumpkin':'G','Radish':'C','Sunflower':'C','Dill':'G','Marigold':'G','Basil':'G','Fennel':'B' },
  'Carrot':    { 'Onion':'G','Leek':'G','Chive':'G','Rosemary':'G','Sage':'G','Lettuce':'G','Tomato':'G','Bean':'G','Dill':'B','Fennel':'B','Parsley':'C','Radish':'C','Pepper':'G','Marigold':'G','Pea':'G' },
  'Beet':      { 'Lettuce':'G','Onion':'G','Garlic':'G','Cabbage':'G','Kale':'G','Kohlrabi':'G','Broccoli':'G','Bean':'B','Fennel':'B','Tomato':'C','Radish':'C','Spinach':'G','Chard':'G' },
  'Radish':    { 'Nasturtium':'G','Chervil':'G','Cucumber':'G','Squash':'G','Bean':'C','Pea':'C','Carrot':'C','Beet':'C','Spinach':'G','Lettuce':'G','Marigold':'G','Tomato':'C','Onion':'C','Hyssop':'C','Fennel':'B' },
  'Onion':     { 'Carrot':'G','Beet':'G','Pepper':'G','Tomato':'C','Chamomile':'G','Marigold':'G','Strawberry':'G','Lettuce':'G','Dill':'C','Summer Savory':'G','Bean':'B','Pea':'B','Garlic':'C','Asparagus':'B','Sage':'G','Potato':'B' },
  'Garlic':    { 'Rose':'G','Tomato':'G','Pepper':'G','Carrot':'G','Cucumber':'G','Beet':'G','Spinach':'G','Celery':'G','Raspberry':'G','Marigold':'G','Bean':'B','Pea':'B','Cabbage':'G','Onion':'C','Asparagus':'B','Fennel':'B','Strawberry':'C' },
  'Bean':      { 'Carrot':'G','Cucumber':'G','Corn':'G','Squash':'G','Strawberry':'G','Eggplant':'G','Radish':'C','Pea':'C','Potato':'G','Celery':'C','Marigold':'G','Summer Savory':'G','Nasturtium':'G','Onion':'B','Garlic':'B','Fennel':'B','Beet':'B','Leek':'B','Shallot':'B' },
  'Pea':       { 'Carrot':'G','Radish':'G','Turnip':'G','Cucumber':'G','Bean':'C','Corn':'G','Mint':'C','Lettuce':'G','Spinach':'G','Potato':'G','Fennel':'B','Onion':'B','Garlic':'B','Leek':'B','Chive':'B' },
  'Lettuce':   { 'Carrot':'G','Radish':'G','Strawberry':'G','Onion':'G','Beet':'G','Tomato':'G','Spinach':'G','Chive':'G','Marigold':'G','Cucumber':'G','Dill':'G','Celery':'G','Parsley':'G','Nasturtium':'G','Fennel':'B','Broccoli':'C','Cabbage':'C' },
  'Spinach':   { 'Strawberry':'G','Lettuce':'G','Tomato':'G','Pea':'G','Bean':'G','Celery':'G','Nasturtium':'G','Fennel':'B','Beet':'G','Radish':'G','Garlic':'G','Onion':'G','Eggplant':'G','Pepper':'G','Cucumber':'G' },
  'Kale':      { 'Beet':'G','Celery':'G','Dill':'C','Marigold':'G','Nasturtium':'G','Garlic':'G','Onion':'G','Catnip':'G','Hyssop':'G','Rosemary':'G','Sage':'G','Potato':'C','Bean':'C','Strawberry':'C','Fennel':'B','Tomato':'C','Rue':'C' },
  'Cabbage':   { 'Dill':'G','Celery':'G','Onion':'G','Garlic':'G','Beet':'G','Marigold':'G','Mint':'G','Rosemary':'G','Sage':'G','Hyssop':'G','Nasturtium':'G','Chamomile':'G','Potato':'C','Tomato':'C','Lettuce':'C','Bean':'C','Strawberry':'C','Fennel':'B','Rue':'G','Broccoli':'C' },
  'Broccoli':  { 'Celery':'G','Dill':'G','Marigold':'G','Onion':'G','Garlic':'G','Rosemary':'G','Sage':'G','Nasturtium':'G','Beet':'G','Lettuce':'C','Cabbage':'C','Tomato':'C','Fennel':'B','Strawberry':'C','Bean':'C' },
  'Cauliflower':{ 'Celery':'G','Dill':'G','Onion':'G','Garlic':'G','Marigold':'G','Nasturtium':'G','Spinach':'G','Bean':'C','Broccoli':'C','Fennel':'B','Tomato':'C' },
  'Basil':     { 'Tomato':'G','Pepper':'G','Marigold':'G','Oregano':'G','Eggplant':'G','Asparagus':'G','Chamomile':'G','Borage':'G','Fennel':'B','Sage':'B','Rue':'B','Thyme':'C','Cucumber':'C' },
  'Parsley':   { 'Tomato':'G','Asparagus':'G','Corn':'G','Carrot':'C','Rose':'G','Chive':'G','Pea':'G','Fennel':'B','Onion':'C','Mint':'C' },
  'Dill':      { 'Cabbage':'G','Lettuce':'G','Cucumber':'G','Corn':'G','Onion':'G','Fennel':'B','Carrot':'B','Tomato':'C','Pepper':'C','Lavender':'C','Cilantro':'C' },
  'Marigold':  { 'Tomato':'G','Pepper':'G','Cucumber':'G','Squash':'G','Melon':'G','Basil':'G','Carrot':'G','Bean':'G','Corn':'G','Beet':'G','Lettuce':'G','Kale':'G','Cabbage':'G','Broccoli':'G','Radish':'G','Nasturtium':'G','Lavender':'G','Calendula':'G','Borage':'G','Garlic':'G','Eggplant':'G','Potato':'G','Onion':'G','Spinach':'G' },
  'Nasturtium':{ 'Tomato':'G','Cucumber':'G','Squash':'G','Melon':'G','Radish':'G','Marigold':'G','Bean':'G','Cabbage':'G','Broccoli':'G','Kale':'G','Cauliflower':'G','Lettuce':'G','Spinach':'G','Potato':'G','Eggplant':'G','Pepper':'G','Beet':'G','Corn':'C','Fennel':'C' },
  'Sunflower': { 'Cucumber':'G','Corn':'C','Squash':'C','Melon':'C','Tomato':'C','Potato':'B','Bean':'C','Basil':'G','Marigold':'G' },
  'Borage':    { 'Tomato':'G','Squash':'G','Strawberry':'G','Cucumber':'G','Basil':'G','Marigold':'G','Cabbage':'G','Chamomile':'G','Nasturtium':'G','Fennel':'C' },
  'Lavender':  { 'Tomato':'G','Cabbage':'G','Kale':'G','Marigold':'G','Vegetable garden':'G','Dill':'C','Cilantro':'C','Mint':'C','Fennel':'C' },
  'Chamomile': { 'Tomato':'G','Cabbage':'G','Onion':'G','Cucumber':'G','Basil':'G','Borage':'G','Marigold':'G','Lavender':'G','Nasturtium':'G','Mint':'C','Dill':'C' },
  'Calendula': { 'Tomato':'G','Marigold':'G','Basil':'G','Cucumber':'G','Squash':'G','Bean':'G','Nasturtium':'G','Carrot':'G','Asparagus':'G','Fennel':'C' },
};

const REL_COLORS = {
  G: { bg: 'bg-emerald-500', text: 'text-white', label: 'Good', symbol: '✓' },
  C: { bg: 'bg-amber-500',   text: 'text-white', label: 'Conditional', symbol: '~' },
  B: { bg: 'bg-red-500',     text: 'text-white', label: 'Bad', symbol: '✗' },
  '~': { bg: 'bg-gray-700',  text: 'text-white', label: 'Same plant', symbol: '=' },
  '?': { bg: 'bg-gray-100',  text: 'text-gray-400', label: 'Unknown', symbol: '' },
};

function getRelationship(plantA, plantB) {
  if (plantA === plantB) return '~';
  const row = RAW_MATRIX[plantA] || {};
  if (row[plantB]) return row[plantB];
  const rowB = RAW_MATRIX[plantB] || {};
  if (rowB[plantA]) return rowB[plantA];
  return '?';
}

export default function CompanionChartModal({ open, onOpenChange }) {
  const [search, setSearch] = useState('');
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);

  const filteredPlants = useMemo(() => {
    if (!search) return PLANTS;
    const q = search.toLowerCase();
    return PLANTS.filter(p => p.name.toLowerCase().includes(q));
  }, [search]);

  const displayPlants = search ? filteredPlants : PLANTS;

  const getGoodCompanions = (plant) => PLANTS.filter(p => getRelationship(plant.name, p.name) === 'G');
  const getBadCompanions  = (plant) => PLANTS.filter(p => getRelationship(plant.name, p.name) === 'B');
  const getCondCompanions = (plant) => PLANTS.filter(p => getRelationship(plant.name, p.name) === 'C');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b bg-gradient-to-r from-emerald-900 to-emerald-700 text-white rounded-t-lg">
          <DialogTitle className="text-xl font-bold text-white">🌿 Companion Planting Chart</DialogTitle>
          <p className="text-emerald-200 text-sm mt-1">Click any plant row or column to see its compatibility details</p>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Legend + Search */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-amber-50 border-b text-xs">
            <span className="font-semibold text-gray-700">Legend:</span>
            {Object.entries(REL_COLORS).filter(([k]) => k !== '~').map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded ${cfg.bg} flex items-center justify-center ${cfg.text} font-bold text-xs`}>{cfg.symbol}</div>
                <span className="text-gray-600">{cfg.label}</span>
              </div>
            ))}
            <div className="ml-auto relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter plants..." className="pl-6 h-7 text-xs w-40" />
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Matrix */}
            <div className="flex-1 overflow-auto p-4">
              <div className="inline-block min-w-max">
                {/* Column headers */}
                <div className="flex">
                  <div className="w-28 flex-shrink-0" />
                  {displayPlants.map(p => (
                    <button
                      key={p.name}
                      onClick={() => setSelectedPlant(selectedPlant?.name === p.name ? null : p)}
                      className={`w-8 flex-shrink-0 h-28 flex flex-col items-center justify-end pb-1 cursor-pointer hover:bg-emerald-50 rounded transition-colors ${selectedPlant?.name === p.name ? 'bg-emerald-100' : ''}`}
                      title={p.name}
                    >
                      <span className="text-[9px] font-semibold text-gray-700 leading-tight" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                        {p.emoji} {p.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Rows */}
                {displayPlants.map((rowPlant, ri) => (
                  <div key={rowPlant.name} className="flex items-center">
                    <button
                      onClick={() => setSelectedPlant(selectedPlant?.name === rowPlant.name ? null : rowPlant)}
                      className={`w-28 flex-shrink-0 h-8 flex items-center justify-end pr-2 gap-1 text-[11px] font-semibold text-gray-700 hover:bg-emerald-50 cursor-pointer transition-colors rounded ${selectedPlant?.name === rowPlant.name ? 'bg-emerald-100' : ri % 2 === 0 ? 'bg-gray-50/50' : ''}`}
                    >
                      <span>{rowPlant.emoji}</span>
                      <span className="truncate">{rowPlant.name}</span>
                    </button>
                    {displayPlants.map(colPlant => {
                      const rel = getRelationship(rowPlant.name, colPlant.name);
                      const cfg = REL_COLORS[rel] || REL_COLORS['?'];
                      const isHighlighted = selectedPlant && (selectedPlant.name === rowPlant.name || selectedPlant.name === colPlant.name);
                      return (
                        <div
                          key={colPlant.name}
                          className={`w-8 h-8 flex-shrink-0 border border-white/60 flex items-center justify-center text-xs font-bold transition-all cursor-default
                            ${cfg.bg} ${cfg.text}
                            ${rel === '~' ? 'opacity-60' : ''}
                            ${isHighlighted && rel !== '~' ? 'ring-2 ring-emerald-400 z-10 scale-110' : ''}
                            ${!isHighlighted && selectedPlant ? 'opacity-40' : ''}
                            hover:scale-125 hover:z-20 hover:shadow-lg`}
                          title={rel === '~' ? 'Same plant' : rel === '?' ? 'Unknown / Not studied' : `${rowPlant.name} + ${colPlant.name}: ${cfg.label}`}
                          onMouseEnter={() => setHoveredCell({ row: rowPlant.name, col: colPlant.name, rel })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {cfg.symbol}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected plant detail panel */}
            {selectedPlant && (
              <div className="w-56 border-l bg-white p-4 overflow-y-auto flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">{selectedPlant.emoji} {selectedPlant.name}</h3>
                  <button onClick={() => setSelectedPlant(null)}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
                <Badge variant="outline" className="mb-3 text-xs">{selectedPlant.cat}</Badge>

                {getGoodCompanions(selectedPlant).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">✓ Good Companions ({getGoodCompanions(selectedPlant).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {getGoodCompanions(selectedPlant).map(p => (
                        <button key={p.name} onClick={() => setSelectedPlant(p)} className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded hover:bg-emerald-100 transition-colors">
                          {p.emoji} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {getCondCompanions(selectedPlant).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1">~ Conditional ({getCondCompanions(selectedPlant).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {getCondCompanions(selectedPlant).map(p => (
                        <button key={p.name} onClick={() => setSelectedPlant(p)} className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded hover:bg-amber-100 transition-colors">
                          {p.emoji} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {getBadCompanions(selectedPlant).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">✗ Avoid Together ({getBadCompanions(selectedPlant).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {getBadCompanions(selectedPlant).map(p => (
                        <button key={p.name} onClick={() => setSelectedPlant(p)} className="text-[10px] bg-red-50 text-red-800 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors">
                          {p.emoji} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hover tooltip bar */}
          <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-600 h-8 flex items-center">
            {hoveredCell ? (
              <span>
                <strong>{hoveredCell.row}</strong> + <strong>{hoveredCell.col}</strong>:{' '}
                <span className={hoveredCell.rel === 'G' ? 'text-emerald-700 font-semibold' : hoveredCell.rel === 'B' ? 'text-red-700 font-semibold' : hoveredCell.rel === 'C' ? 'text-amber-700 font-semibold' : 'text-gray-500'}>
                  {REL_COLORS[hoveredCell.rel]?.label || 'Unknown'}
                </span>
              </span>
            ) : (
              <span className="text-gray-400">Hover over a cell to see details · Click a plant name to highlight its relationships</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}