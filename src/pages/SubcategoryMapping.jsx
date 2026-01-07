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
    const rows = [['PlantType Name', 'PlantType ID', 'PlantType Code', 'SubCategory Name', 'SubCategory Code', 'SubCategory ID']];

    plantTypes.forEach(type => {
      const typeSubs = subCategories.filter(s => s.plant_type_id === type.id);
      if (typeSubs.length === 0) {
        rows.push([type.common_name, type.id, type.plant_type_code || '', '', '', '']);
      } else {
        typeSubs.forEach(sub => {
          rows.push([type.common_name, type.id, type.plant_type_code || '', sub.name, sub.subcat_code || '', sub.id]);
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

  const exportTemplate = () => {
    const template = `variety_code,variety_name,plant_type_id,plant_subcategory_code,plant_subcategory_name,days_to_maturity,spacing_recommended,sun_requirement,water_requirement
VAR_EXAMPLE_001,Example Variety,<paste_plant_type_id_here>,PSC_TOMATO_CHERRY,Cherry,70,24,full_sun,moderate`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'variety_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    toast.success('Downloaded import template');
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
        <div className="flex gap-2">
          <Button onClick={exportTemplate} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <Button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700">
            <Download className="w-4 h-4 mr-2" />
            Export Mapping
          </Button>
        </div>
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
                  <th className="text-left p-3 text-sm font-semibold">PlantType Code</th>
                  <th className="text-left p-3 text-sm font-semibold">SubCategory Name</th>
                  <th className="text-left p-3 text-sm font-semibold">SubCategory Code</th>
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
                        <td className="p-3 text-sm text-gray-600 font-mono">{type.plant_type_code || '-'}</td>
                        <td className="p-3 text-sm text-gray-400 italic" colSpan="3">No subcategories</td>
                      </tr>
                    );
                  }
                  return typeSubs.map((sub, idx) => (
                    <tr key={`${type.id}-${sub.id}`} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{idx === 0 ? type.common_name : ''}</td>
                      <td className="p-3 text-sm text-gray-600 font-mono">{idx === 0 ? type.id : ''}</td>
                      <td className="p-3 text-sm text-gray-600 font-mono">{idx === 0 ? (type.plant_type_code || '-') : ''}</td>
                      <td className="p-3 text-sm">{sub.name}</td>
                      <td className="p-3 text-sm text-gray-600 font-mono">{sub.subcat_code || '-'}</td>
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
          <ol className="text-sm text-blue-800 space-y-2">
            <li>1. <strong>Download "CSV Template"</strong> for the recommended import format</li>
            <li>2. <strong>Export Mapping</strong> to get a reference list of all types and subcategories</li>
            <li>3. In your variety CSV, use one of these to assign subcategory:
              <ul className="ml-4 mt-1 space-y-0.5">
                <li>• <code className="bg-white px-1 rounded">plant_subcategory_code</code> (PREFERRED - e.g., "PSC_TOMATO_CHERRY")</li>
                <li>• <code className="bg-white px-1 rounded">plant_subcategory_name</code> (e.g., "Cherry")</li>
                <li>• <code className="bg-white px-1 rounded">plant_subcategory_id</code> (raw ID)</li>
              </ul>
            </li>
            <li>4. If subcategory doesn't exist, it will be auto-created using the code/name provided</li>
            <li>5. Old "TOMATO_*" codes are auto-normalized to "PSC_TOMATO_*" format</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}