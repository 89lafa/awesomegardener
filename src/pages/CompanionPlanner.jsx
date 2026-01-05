import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Users, 
  Plus, 
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function CompanionPlanner() {
  const [plantTypes, setPlantTypes] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    plant_type_id: '',
    companion_type: 'GOOD',
    companion_plant_type_id: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [typesData, rulesData] = await Promise.all([
        base44.entities.PlantType.list('common_name', 200),
        base44.entities.CompanionRule.list()
      ]);
      
      setPlantTypes(typesData);
      setRules(rulesData);
    } catch (error) {
      console.error('Error loading companion rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.plant_type_id || !formData.companion_plant_type_id || saving) return;
    
    setSaving(true);
    try {
      const rule = await base44.entities.CompanionRule.create(formData);
      setRules([rule, ...rules]);
      setShowDialog(false);
      setFormData({
        plant_type_id: '',
        companion_type: 'GOOD',
        companion_plant_type_id: '',
        notes: ''
      });
      toast.success('Companion rule added!');
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule) => {
    try {
      await base44.entities.CompanionRule.delete(rule.id);
      setRules(rules.filter(r => r.id !== rule.id));
      toast.success('Rule deleted');
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const getPlantTypeName = (id) => {
    return plantTypes.find(t => t.id === id)?.common_name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Companion Planting</h1>
          <p className="text-gray-600 mt-1">Define which plants grow well together</p>
        </div>
        <Button 
          onClick={() => setShowDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="py-16">
          <CardContent className="text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Companion Rules</h3>
            <p className="text-gray-600 mb-6">Add rules to track good and bad plant companions</p>
            <Button 
              onClick={() => setShowDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Add First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      rule.companion_type === 'GOOD' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {rule.companion_type === 'GOOD' ? (
                        <ThumbsUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <ThumbsDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {getPlantTypeName(rule.plant_type_id)} + {getPlantTypeName(rule.companion_plant_type_id)}
                      </p>
                      {rule.notes && (
                        <p className="text-sm text-gray-600">{rule.notes}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDelete(rule)}
                  >
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Companion Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plant Type *</Label>
              <Select 
                value={formData.plant_type_id} 
                onValueChange={(v) => setFormData({ ...formData, plant_type_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select plant" />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.icon && <span className="mr-2">{type.icon}</span>}
                      {type.common_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Companion Type *</Label>
              <Select 
                value={formData.companion_type} 
                onValueChange={(v) => setFormData({ ...formData, companion_type: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GOOD">Good Companion</SelectItem>
                  <SelectItem value="BAD">Bad Companion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Companion Plant *</Label>
              <Select 
                value={formData.companion_plant_type_id} 
                onValueChange={(v) => setFormData({ ...formData, companion_plant_type_id: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select companion" />
                </SelectTrigger>
                <SelectContent>
                  {plantTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.icon && <span className="mr-2">{type.icon}</span>}
                      {type.common_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Why are they good/bad companions?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={!formData.plant_type_id || !formData.companion_plant_type_id || saving}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}