import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Bug, Droplet, AlertTriangle, Leaf, Loader2, Eye } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function PestLibrary() {
  const [pests, setPests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: 'all',
    severity: 'all',
    search: ''
  });

  useEffect(() => {
    loadPests();
  }, [filters]);

  const loadPests = async () => {
    try {
      setLoading(true);
      let results = await base44.entities.PestLibrary.filter({ is_active: true });

      if (filters.category !== 'all') {
        results = results.filter(p => p.category === filters.category);
      }
      if (filters.severity !== 'all') {
        results = results.filter(p => p.severity_potential === filters.severity);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        results = results.filter(p =>
          p.common_name.toLowerCase().includes(query) ||
          (p.symptoms || []).some(s => s.toLowerCase().includes(query))
        );
      }

      setPests(results);
    } catch (error) {
      console.error('Error loading pests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      insect: Bug,
      disease: AlertTriangle,
      fungus: Droplet,
      deficiency: Leaf
    };
    return icons[category] || Bug;
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    return colors[severity] || colors.medium;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pest & Disease Library</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive guide to common garden problems
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or symptom..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select
              value={filters.category}
              onValueChange={(v) => setFilters({ ...filters, category: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="insect">Insects</SelectItem>
                <SelectItem value="disease">Diseases</SelectItem>
                <SelectItem value="fungus">Fungus</SelectItem>
                <SelectItem value="bacteria">Bacteria</SelectItem>
                <SelectItem value="virus">Virus</SelectItem>
                <SelectItem value="deficiency">Deficiencies</SelectItem>
                <SelectItem value="environmental">Environmental</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select
              value={filters.severity}
              onValueChange={(v) => setFilters({ ...filters, severity: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity Levels</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : pests.length === 0 ? (
        <div className="text-center py-12">
          <Bug className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No entries found. Try different filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pests.map((pest) => {
            const CategoryIcon = getCategoryIcon(pest.category);
            return (
              <Link key={pest.id} to={createPageUrl('PestDetail') + '?id=' + pest.id}>
                <Card className="hover:shadow-lg transition cursor-pointer h-full">
                  {pest.primary_photo_url && (
                    <div className="h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={pest.primary_photo_url}
                        alt={pest.common_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{pest.common_name}</h3>
                      <CategoryIcon className="w-5 h-5 text-emerald-600" />
                    </div>
                    {pest.scientific_name && (
                      <p className="text-xs italic text-gray-600 mb-2">{pest.scientific_name}</p>
                    )}
                    <div className="flex gap-2 mb-3">
                      <Badge className="text-xs capitalize">{pest.category}</Badge>
                      <Badge className={getSeverityColor(pest.severity_potential)}>
                        {pest.severity_potential}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {pest.appearance}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && pests.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {pests.length} {pests.length === 1 ? 'entry' : 'entries'}
        </div>
      )}
    </div>
  );
}