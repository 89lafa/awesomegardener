import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, Filter, Leaf, ArrowLeft, ExternalLink, Calendar, Droplet, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PublicPlantCatalog() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [filteredVarieties, setFilteredVarieties] = useState([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, categoryFilter, typeFilter, varieties]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [types, vars] = await Promise.all([
        base44.entities.PlantType.list('common_name'),
        base44.entities.Variety.list('variety_name', 1000)
      ]);
      setPlantTypes(types);
      setVarieties(vars);
      setFilteredVarieties(vars);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...varieties];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.variety_name?.toLowerCase().includes(term) ||
        v.plant_type_name?.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      const typeObj = plantTypes.find(t => t.id === categoryFilter);
      if (typeObj) {
        filtered = filtered.filter(v => v.plant_type_id === categoryFilter);
      }
    }

    setFilteredVarieties(filtered);
    
    // Update URL
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    setSearchParams(params);
  };

  const categories = plantTypes.filter(t => t.category).reduce((acc, t) => {
    if (!acc.includes(t.category)) acc.push(t.category);
    return acc;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <Link to={createPageUrl('Landing')}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Leaf className="w-8 h-8 text-emerald-600" />
            Plant Catalog
          </h1>
          <p className="text-gray-600 mt-2">
            Browse {varieties.length}+ plant varieties • Free to view, account required to save
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search plants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plants</SelectItem>
                {plantTypes.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.icon} {type.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {filteredVarieties.length} varieties</span>
            {(searchTerm || categoryFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setTypeFilter('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVarieties.map(variety => (
            <Card key={variety.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {variety.variety_name}
                    </h3>
                    <p className="text-sm text-gray-500">{variety.plant_type_name}</p>
                  </div>
                  {plantTypes.find(t => t.id === variety.plant_type_id)?.icon && (
                    <span className="text-2xl">
                      {plantTypes.find(t => t.id === variety.plant_type_id).icon}
                    </span>
                  )}
                </div>

                {variety.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {variety.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {variety.days_to_maturity && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="w-3 h-3 mr-1" />
                      {variety.days_to_maturity} days
                    </Badge>
                  )}
                  {variety.sun_requirement && (
                    <Badge variant="outline" className="text-xs">
                      <Sun className="w-3 h-3 mr-1" />
                      {variety.sun_requirement.replace('_', ' ')}
                    </Badge>
                  )}
                  {variety.water_requirement && (
                    <Badge variant="outline" className="text-xs">
                      <Droplet className="w-3 h-3 mr-1" />
                      {variety.water_requirement}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => navigate(createPageUrl('PlantDetail') + '?id=' + variety.id)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredVarieties.length === 0 && (
          <div className="text-center py-12">
            <Leaf className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No plants found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}