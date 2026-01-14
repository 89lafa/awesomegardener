import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ListChecks } from 'lucide-react';

export default function VarietyListView({ 
  varieties, 
  subCategories,
  onAddToStash,
  onAddToGrowList,
  visibleColumns = ['name', 'subcategory', 'days', 'spacing', 'traits', 'actions'],
  sortBy,
  onSortChange
}) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleHeaderClick = (column) => {
    if (!onSortChange) return;
    
    // Determine new sort direction
    const currentCol = sortBy?.split('_')[0];
    const currentDir = sortBy?.split('_')[1];
    
    if (currentCol === column) {
      // Toggle direction
      onSortChange(currentDir === 'asc' ? `${column}_desc` : `${column}_asc`);
    } else {
      // New column, default asc
      onSortChange(`${column}_asc`);
    }
  };

  const getSortIcon = (column) => {
    if (!sortBy) return null;
    const [currentCol, dir] = sortBy.split('_');
    if (currentCol !== column) return '⇅';
    return dir === 'asc' ? '↑' : '↓';
  };

  const getSubCategoryName = (variety) => {
    // NEW SYSTEM: Display ONLY the primary subcategory name
    if (!variety.plant_subcategory_id) return 'Uncategorized';
    
    const subcat = subCategories.find(s => s.id === variety.plant_subcategory_id);
    return subcat?.name || 'Uncategorized';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            {visibleColumns.includes('name') && (
              <th 
                className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleHeaderClick('name')}
              >
                Variety Name {getSortIcon('name')}
              </th>
            )}
            {visibleColumns.includes('subcategory') && <th className="text-left p-3 text-sm font-semibold">Sub-Category</th>}
            {visibleColumns.includes('days') && (
              <th 
                className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleHeaderClick('days')}
              >
                Days to Maturity {getSortIcon('days')}
              </th>
            )}
            {visibleColumns.includes('spacing') && (
              <th 
                className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleHeaderClick('spacing')}
              >
                Spacing {getSortIcon('spacing')}
              </th>
            )}
            {visibleColumns.includes('height') && <th className="text-left p-3 text-sm font-semibold">Height</th>}
            {visibleColumns.includes('sun') && <th className="text-left p-3 text-sm font-semibold">Sun</th>}
            {visibleColumns.includes('water') && <th className="text-left p-3 text-sm font-semibold">Water</th>}
            {visibleColumns.includes('color') && <th className="text-left p-3 text-sm font-semibold">Color</th>}
            {visibleColumns.includes('species') && (
              <th 
                className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleHeaderClick('species')}
              >
                Species {getSortIcon('species')}
              </th>
            )}
            {visibleColumns.includes('seed_line') && (
              <th 
                className="text-left p-3 text-sm font-semibold cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleHeaderClick('seed_line')}
              >
                Seed Line {getSortIcon('seed_line')}
              </th>
            )}
            {visibleColumns.includes('season') && <th className="text-left p-3 text-sm font-semibold">Season</th>}
            {visibleColumns.includes('traits') && <th className="text-left p-3 text-sm font-semibold">Traits</th>}
            {visibleColumns.includes('actions') && <th className="text-right p-3 text-sm font-semibold">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {varieties.map((variety) => (
            <tr key={variety.id} className="border-b hover:bg-gray-50">
              {visibleColumns.includes('name') && (
                <td className="p-3">
                  <Link 
                    to={(user?.role === 'admin' ? createPageUrl('EditVariety') : createPageUrl('ViewVariety')) + `?id=${variety.id}`}
                    className="font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    {variety.variety_name}
                  </Link>
                </td>
              )}
              {visibleColumns.includes('subcategory') && (
                <td className="p-3 text-sm text-gray-600">
                  {getSubCategoryName(variety)}
                </td>
              )}
              {visibleColumns.includes('days') && (
                <td className="p-3 text-sm text-gray-600">
                  {variety.days_to_maturity || variety.days_to_maturity_seed || '-'}
                </td>
              )}
              {visibleColumns.includes('spacing') && (
                <td className="p-3 text-sm text-gray-600">
                  {variety.spacing_recommended || variety.spacing_in_min ? 
                    `${variety.spacing_recommended || variety.spacing_in_min}"` : '-'}
                </td>
              )}
              {visibleColumns.includes('height') && (
                <td className="p-3 text-sm text-gray-600">
                  {variety.plant_height_typical || (variety.height_min && variety.height_max ? 
                    `${variety.height_min}-${variety.height_max}"` : '-')}
                </td>
              )}
              {visibleColumns.includes('sun') && (
                <td className="p-3 text-sm text-gray-600 capitalize">
                  {variety.sun_requirement?.replace(/_/g, ' ') || '-'}
                </td>
              )}
              {visibleColumns.includes('water') && (
                <td className="p-3 text-sm text-gray-600 capitalize">
                  {variety.water_requirement || '-'}
                </td>
              )}
              {visibleColumns.includes('color') && (
                <td className="p-3 text-sm text-gray-600">
                  {variety.fruit_color || variety.pod_color || '-'}
                </td>
              )}
              {visibleColumns.includes('species') && (
                <td className="p-3 text-sm text-gray-600 italic capitalize">
                  {variety.species || '-'}
                </td>
              )}
              {visibleColumns.includes('seed_line') && (
                <td className="p-3">
                  {variety.seed_line_type && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {variety.seed_line_type === 'open_pollinated' ? 'OP' : variety.seed_line_type}
                    </Badge>
                  )}
                </td>
              )}
              {visibleColumns.includes('season') && (
                <td className="p-3">
                  {variety.season_timing && (
                    <Badge variant="outline" className="text-xs capitalize">{variety.season_timing}</Badge>
                  )}
                </td>
              )}
              {visibleColumns.includes('traits') && (
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {variety.trellis_required && (
                      <Badge variant="outline" className="text-xs">Trellis</Badge>
                    )}
                    {variety.container_friendly && (
                      <Badge variant="outline" className="text-xs">Container</Badge>
                    )}
                    {variety.is_ornamental && (
                      <Badge className="bg-pink-100 text-pink-800 text-xs">Ornamental</Badge>
                    )}
                    {variety.is_organic && (
                      <Badge className="bg-green-100 text-green-800 text-xs">Organic</Badge>
                    )}
                    {variety.growth_habit && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {variety.growth_habit.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                </td>
              )}
              {visibleColumns.includes('actions') && (
                <td className="p-3">
                  <div className="flex gap-1 justify-end">
                    {user?.role === 'admin' ? (
                      <>
                        <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
                          <Button size="sm" variant="ghost">
                            <span className="text-xs">View</span>
                          </Button>
                        </Link>
                        <Link to={createPageUrl('EditVariety') + `?id=${variety.id}`}>
                          <Button size="sm" variant="ghost">
                            <span className="text-xs">Edit</span>
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link to={createPageUrl('ViewVariety') + `?id=${variety.id}`}>
                        <Button size="sm" variant="ghost">
                          <span className="text-xs">View</span>
                        </Button>
                      </Link>
                    )}
                    <Button 
                      size="sm"
                      variant="ghost"
                      onClick={() => onAddToStash(variety)}
                      title="Add to Seed Stash"
                    >
                      <Package className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm"
                      variant="ghost"
                      onClick={() => onAddToGrowList(variety)}
                      title="Add to Grow List"
                    >
                      <ListChecks className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      {varieties.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No varieties match your filters
        </div>
      )}
    </div>
  );
}