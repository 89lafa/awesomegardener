import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function SubcategoryMapping() {
  const [plantTypes, setPlantTypes] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
      await loadData();
    } catch (error) {
      window.location.href = '/Dashboard';
    }
  };

  const loadData = async () => {
    try {
      const [typesData, subcatsData] = await Promise.all([
        base44.entities.PlantType.list('common_name'),
        base44.entities.PlantSubCategory.list('plant_type_id')
      ]);

      setPlantTypes(typesData);
      setSubCategories(subcatsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load mapping data');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const rows = [['PlantType Name', 'PlantType ID', 'SubCategory Name', 'SubCategory ID']];

    plantTypes.forEach(type => {
      const typeSubs = subCategories.filter(s => s.plant_type_id === type.id);
      if (typeSubs.length === 0) {
        rows.push([type.common_name, type.id, '', '']);
      } else {
        typeSubs.forEach(sub => {
          rows.push([type.common_name, type.id, sub.name, sub.id]);
        });
      }
    });

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subcategory_mapping.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Exported mapping to CSV');
  };

  const filteredTypes = plantTypes.filter(type =>
    type.common_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SubCategory Mapping Reference</h1>
          <p className="text-gray-600 mt-1">Plant Type and SubCategory IDs for data import</p>
        </div>
        <Button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search plant types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">PlantType Name</th>
                  <th className="text-left p-3 text-sm font-semibold">PlantType ID</th>
                  <th className="text-left p-3 text-sm font-semibold">SubCategory Name</th>
                  <th className="text-left p-3 text-sm font-semibold">SubCategory ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredTypes.map(type => {
                  const typeSubs = subCategories.filter(s => s.plant_type_id === type.id);
                  if (typeSubs.length === 0) {
                    return (
                      <tr key={type.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{type.common_name}</td>
                        <td className="p-3 text-sm text-gray-600 font-mono">{type.id}</td>
                        <td className="p-3 text-sm text-gray-400 italic">No subcategories</td>
                        <td className="p-3"></td>
                      </tr>
                    );
                  }
                  return typeSubs.map((sub, idx) => (
                    <tr key={`${type.id}-${sub.id}`} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{idx === 0 ? type.common_name : ''}</td>
                      <td className="p-3 text-sm text-gray-600 font-mono">{idx === 0 ? type.id : ''}</td>
                      <td className="p-3 text-sm">{sub.name}</td>
                      <td className="p-3 text-sm text-gray-600 font-mono">{sub.id}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-semibold text-blue-900 mb-2">How to use this mapping:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Export this table to CSV for reference</li>
            <li>2. When importing varieties, use <code className="bg-white px-1 rounded">plant_type_id</code> to assign the parent type</li>
            <li>3. Use <code className="bg-white px-1 rounded">plant_subcategory_id</code> to assign the specific subcategory</li>
            <li>4. If a PlantType has no subcategories, leave <code className="bg-white px-1 rounded">plant_subcategory_id</code> blank</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}