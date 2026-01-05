import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ListChecks } from 'lucide-react';

export default function VarietyListView({ 
  varieties, 
  subCategories,
  onAddToStash,
  onAddToGrowList
}) {
  const getSubCategoryName = (subcatId) => {
    const subcat = subCategories.find(s => s.id === subcatId);
    return subcat?.name || '-';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left p-3 text-sm font-semibold">Variety Name</th>
            <th className="text-left p-3 text-sm font-semibold">Sub-Category</th>
            <th className="text-left p-3 text-sm font-semibold">Days to Maturity</th>
            <th className="text-left p-3 text-sm font-semibold">Spacing</th>
            <th className="text-left p-3 text-sm font-semibold">Traits</th>
            <th className="text-right p-3 text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {varieties.map((variety) => (
            <tr key={variety.id} className="border-b hover:bg-gray-50">
              <td className="p-3">
                <Link 
                  to={createPageUrl('EditVariety') + `?id=${variety.id}`}
                  className="font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {variety.variety_name}
                </Link>
              </td>
              <td className="p-3 text-sm text-gray-600">
                {getSubCategoryName(variety.plant_subcategory_id)}
              </td>
              <td className="p-3 text-sm text-gray-600">
                {variety.days_to_maturity || variety.days_to_maturity_seed || '-'}
              </td>
              <td className="p-3 text-sm text-gray-600">
                {variety.spacing_recommended || variety.spacing_in_min ? 
                  `${variety.spacing_recommended || variety.spacing_in_min}"` : '-'}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {variety.trellis_required && (
                    <Badge variant="outline" className="text-xs">Trellis</Badge>
                  )}
                  {variety.container_friendly && (
                    <Badge variant="outline" className="text-xs">Container</Badge>
                  )}
                  {variety.growth_habit && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {variety.growth_habit.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="p-3">
                <div className="flex gap-1 justify-end">
                  <Link to={createPageUrl('EditVariety') + `?id=${variety.id}`}>
                    <Button size="sm" variant="ghost">
                      <span className="text-xs">Edit</span>
                    </Button>
                  </Link>
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