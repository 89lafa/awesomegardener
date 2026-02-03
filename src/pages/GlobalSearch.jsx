import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { getVarietyDisplayName } from '@/components/utils/varietyHelpers';

export default function GlobalSearch() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [displayNames, setDisplayNames] = useState({});

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const user = await base44.auth.me();
      
      // Search across Variety and PlantProfile entities
      const [varieties, profiles, plantTypes] = await Promise.all([
        base44.entities.Variety.list(),
        base44.entities.PlantProfile.list(),
        base44.entities.PlantType.list()
      ]);

      const searchLower = searchTerm.toLowerCase();
      
      // Create plant type lookup
      const typeMap = new Map(plantTypes.map(t => [t.id, t]));
      
      // Search varieties (public catalog only)
      const matchingVarieties = varieties.filter(v => 
        v.variety_name?.toLowerCase().includes(searchLower) ||
        v.name?.toLowerCase().includes(searchLower) ||
        v.description?.toLowerCase().includes(searchLower)
      );

      // Search profiles - ONLY user's own profiles (not other users' private stash)
      const matchingProfiles = profiles.filter(p => {
        const matchesSearch = p.variety_name?.toLowerCase().includes(searchLower) ||
          p.common_name?.toLowerCase().includes(searchLower);
        const isUsersOwn = p.created_by === user.email;
        return matchesSearch && isUsersOwn && p.plant_type_id; // Must have plant_type_id
      });

      // Combine and deduplicate
      const combined = [];
      const seen = new Set();

      matchingVarieties.forEach(v => {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          const plantType = typeMap.get(v.plant_type_id);
          combined.push({
            id: v.id,
            name: v.variety_name || v.name,
            type: 'variety',
            plant_type_name: plantType?.common_name,
            plant_type_id: v.plant_type_id,
            description: v.description
          });
        }
      });

      matchingProfiles.forEach(p => {
        const plantType = typeMap.get(p.plant_type_id);
        combined.push({
          id: p.id,
          name: p.variety_name,
          type: 'profile',
          plant_type_name: plantType?.common_name || p.common_name,
          plant_type_id: p.plant_type_id,
          description: p.description
        });
      });

      setResults(combined);
      
      // Get display names for varieties
      const names = {};
      for (const result of combined) {
        if (result.plant_type_name) {
          names[result.id] = `${result.name} - ${result.plant_type_name}`;
        } else {
          names[result.id] = result.name;
        }
      }
      setDisplayNames(names);
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Search Results</h1>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch(query);
              }
            }}
            placeholder="Search for varieties..."
            className="pl-12 text-lg h-12"
            autoFocus
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : results.length === 0 && query.trim() ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No results found for "{query}"</p>
          <p className="text-sm text-gray-500 mt-2">Try searching for a different variety name</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Enter a search term to find varieties</p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          
          <div className="space-y-2">
            {results.map((result) => (
              <Link
                key={`${result.type}-${result.id}`}
                to={result.type === 'variety' 
                  ? createPageUrl('ViewVariety') + `?id=${result.id}`
                  : createPageUrl('PlantCatalogDetail') + `?id=${result.plant_type_id}`
                }
              >
                <Card className="hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {displayNames[result.id] || result.name}
                      </h3>
                      {result.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {result.type}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}