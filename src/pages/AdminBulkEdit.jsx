import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, Save, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminBulkEdit() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedPlantType, setSelectedPlantType] = useState('');
  const [varieties, setVarieties] = useState([]);
  const [selectedVarieties, setSelectedVarieties] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    sun_requirement: null,
    water_requirement: null,
    trellis_required: null,
    container_friendly: null,
    seed_line_type: null,
    season_timing: null
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (selectedPlantType) {
      loadVarieties();
    }
  }, [selectedPlantType]);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = createPageUrl('Dashboard');
        return;
      }
      setUser(userData);
      loadPlantTypes();
    } catch (error) {
      window.location.href = createPageUrl('Dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPlantTypes = async () => {
    try {
      const types = await base44.entities.PlantType.list('common_name');
      setPlantTypes(types);
    } catch (error) {
      console.error('Error loading plant types:', error);
    }
  };

  const loadVarieties = async () => {
    try {
      const vars = await base44.entities.Variety.filter({ 
        plant_type_id: selectedPlantType,
        status: 'active'
      }, 'variety_name');
      setVarieties(vars);
      setSelectedVarieties(new Set());
    } catch (error) {
      console.error('Error loading varieties:', error);
      toast.error('Failed to load varieties');
    }
  };

  const toggleVariety = (varietyId) => {
    const newSet = new Set(selectedVarieties);
    if (newSet.has(varietyId)) {
      newSet.delete(varietyId);
    } else {
      newSet.add(varietyId);
    }
    setSelectedVarieties(newSet);
  };

  const toggleAll = () => {
    if (selectedVarieties.size === varieties.length) {
      setSelectedVarieties(new Set());
    } else {
      setSelectedVarieties(new Set(varieties.map(v => v.id)));
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedVarieties.size === 0) {
      toast.error('Please select at least one variety');
      return;
    }

    const updates = {};
    Object.entries(editFields).forEach(([key, value]) => {
      if (value !== null && value !== '') {
        updates[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
    });

    if (Object.keys(updates).length === 0) {
      toast.error('Please select at least one field to update');
      return;
    }

    if (!confirm(`Update ${selectedVarieties.size} varieties with ${Object.keys(updates).length} field(s)?`)) {
      return;
    }

    setSaving(true);
    try {
      let updated = 0;
      for (const varietyId of selectedVarieties) {
        await base44.entities.Variety.update(varietyId, updates);
        updated++;
      }

      await base44.entities.AuditLog.create({
        action_type: 'variety_update',
        entity_type: 'Variety',
        entity_id: 'bulk',
        entity_name: `Bulk edit: ${updated} varieties`,
        action_details: { 
          fields_updated: Object.keys(updates),
          varieties_count: updated,
          plant_type_id: selectedPlantType
        },
        user_role: user.role
      });

      toast.success(`Updated ${updated} varieties!`);
      loadVarieties();
      setEditFields({
        sun_requirement: null,
        water_requirement: null,
        trellis_required: null,
        container_friendly: null,
        seed_line_type: null,
        season_timing: null
      });
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update varieties');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('AdminDataMaintenance')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Bulk Edit Varieties</h1>
          <p className="text-gray-600 mt-1">Update multiple varieties at once</p>
        </div>
      </div>

      {/* Plant Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Plant Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlantType} onValueChange={setSelectedPlantType}>
            <SelectTrigger>
              <SelectValue placeholder="Select plant type..." />
            </SelectTrigger>
            <SelectContent>
              {plantTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.icon} {type.common_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Variety Selection */}
      {selectedPlantType && varieties.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Step 2: Select Varieties ({selectedVarieties.size} selected)</span>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectedVarieties.size === varieties.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {varieties.map(variety => (
                <label 
                  key={variety.id}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <Checkbox
                    checked={selectedVarieties.has(variety.id)}
                    onCheckedChange={() => toggleVariety(variety.id)}
                  />
                  <span className="flex-1">{variety.variety_name}</span>
                  {variety.plant_subcategory_id && (
                    <Badge variant="outline" className="text-xs">
                      {variety.plant_subcategory_id}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Fields */}
      {selectedVarieties.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Choose Fields to Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Only selected fields will be updated. Leave fields blank to skip them.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Sun Requirement</Label>
                <Select 
                  value={editFields.sun_requirement || ''} 
                  onValueChange={(v) => setEditFields({ ...editFields, sun_requirement: v || null })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="full_sun">Full Sun</SelectItem>
                    <SelectItem value="partial_sun">Partial Sun</SelectItem>
                    <SelectItem value="partial_shade">Partial Shade</SelectItem>
                    <SelectItem value="full_shade">Full Shade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Water Requirement</Label>
                <Select 
                  value={editFields.water_requirement || ''} 
                  onValueChange={(v) => setEditFields({ ...editFields, water_requirement: v || null })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Trellis Required</Label>
                <Select 
                  value={editFields.trellis_required === null ? '' : String(editFields.trellis_required)} 
                  onValueChange={(v) => setEditFields({ ...editFields, trellis_required: v === '' ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Container Friendly</Label>
                <Select 
                  value={editFields.container_friendly === null ? '' : String(editFields.container_friendly)} 
                  onValueChange={(v) => setEditFields({ ...editFields, container_friendly: v === '' ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Seed Line Type</Label>
                <Select 
                  value={editFields.seed_line_type || ''} 
                  onValueChange={(v) => setEditFields({ ...editFields, seed_line_type: v || null })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="heirloom">Heirloom</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="open_pollinated">Open-Pollinated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Season Timing</Label>
                <Select 
                  value={editFields.season_timing || ''} 
                  onValueChange={(v) => setEditFields({ ...editFields, season_timing: v || null })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Don't change" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Don't change</SelectItem>
                    <SelectItem value="early">Early</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button 
                onClick={handleBulkUpdate}
                disabled={saving || selectedVarieties.size === 0}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating {selectedVarieties.size} varieties...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Update {selectedVarieties.size} Varieties
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}