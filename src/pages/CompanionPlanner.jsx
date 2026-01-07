import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  Users, 
  Plus, 
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  AlertTriangle,
  Upload,
  Download,
  Edit
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
  const [user, setUser] = useState(null);
  const [plantTypes, setPlantTypes] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [filterPlantId, setFilterPlantId] = useState('');
  
  const [formData, setFormData] = useState({
    plant_type_id: '',
    companion_type: 'GOOD',
    companion_plant_type_id: '',
    notes: '',
    evidence_level: 'C'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      
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
    
    // Validation
    if (formData.plant_type_id === formData.companion_plant_type_id) {
      toast.error('Plant A and B cannot be the same');
      return;
    }
    
    setSaving(true);
    try {
      // Canonical ordering
      let plantA = formData.plant_type_id;
      let plantB = formData.companion_plant_type_id;
      if (plantA > plantB) {
        [plantA, plantB] = [plantB, plantA];
      }
      
      const ruleData = {
        plant_type_id: plantA,
        companion_plant_type_id: plantB,
        companion_type: formData.companion_type,
        notes: formData.notes,
        evidence_level: formData.evidence_level
      };
      
      // Check for duplicates
      const existing = rules.find(r => 
        r.plant_type_id === plantA && r.companion_plant_type_id === plantB
      );
      
      if (existing && !editingRule) {
        toast.error('This companion pair already exists');
        setSaving(false);
        return;
      }
      
      if (editingRule) {
        await base44.entities.CompanionRule.update(editingRule.id, ruleData);
        setRules(rules.map(r => r.id === editingRule.id ? { ...r, ...ruleData } : r));
        toast.success('Rule updated!');
      } else {
        const rule = await base44.entities.CompanionRule.create(ruleData);
        setRules([rule, ...rules]);
        toast.success('Companion rule added!');
      }
      
      setShowDialog(false);
      setEditingRule(null);
      setFormData({
        plant_type_id: '',
        companion_type: 'GOOD',
        companion_plant_type_id: '',
        notes: '',
        evidence_level: 'C'
      });
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      plant_type_id: rule.plant_type_id,
      companion_plant_type_id: rule.companion_plant_type_id,
      companion_type: rule.companion_type,
      notes: rule.notes || '',
      evidence_level: rule.evidence_level || 'C'
    });
    setShowDialog(true);
  };

  const handleDelete = async (rule) => {
    if (!confirm('Delete this companion rule?')) return;
    
    try {
      await base44.entities.CompanionRule.delete(rule.id);
      setRules(rules.filter(r => r.id !== rule.id));
      toast.success('Rule deleted');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleImport = async (dryRun = false) => {
    if (!csvFile || importing) return;
    
    setImporting(true);
    try {
      const text = await csvFile.text();
      const response = await base44.functions.invoke('importCompanionRules', {
        csvData: text,
        dryRun
      });
      
      if (response.data.success) {
        setImportResults(response.data);
        
        if (!dryRun) {
          toast.success(`Import complete: ${response.data.created} created, ${response.data.updated} updated`);
          setShowImportDialog(false);
          setCsvFile(null);
          setImportResults(null);
          loadData();
        } else {
          toast.success('Preview loaded');
        }
      } else {
        toast.error('Import failed');
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `plant_a,plant_b,relationship,why,evidence_level
Tomato,Basil,Good,Basil repels aphids and improves tomato flavor,B
Tomato,Potato,Bad,Share late blight & other Solanaceae diseases/pests,A
Carrot,Onion,Good,Onions repel carrot fly,B
Cucumber,Radish,Good Conditional,Radishes can deter cucumber beetles but compete early,C`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'companion_rules_template.csv';
    a.click();
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
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <>
              <Button 
                onClick={() => setShowImportDialog(true)}
                variant="outline"
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
              <Button 
                onClick={() => {
                  setEditingRule(null);
                  setFormData({
                    plant_type_id: '',
                    companion_type: 'GOOD',
                    companion_plant_type_id: '',
                    notes: '',
                    evidence_level: 'C'
                  });
                  setShowDialog(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter by Plant */}
      <Card>
        <CardContent className="p-4">
          <Label>Filter by Plant</Label>
          <Select value={filterPlantId} onValueChange={setFilterPlantId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a plant to see its companions..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Plants</SelectItem>
              {plantTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.icon && <span className="mr-2">{type.icon}</span>}
                  {type.common_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
          {rules
            .filter(rule => {
              if (!filterPlantId) return true;
              return rule.plant_type_id === filterPlantId || rule.companion_plant_type_id === filterPlantId;
            })
            .map((rule) => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      rule.companion_type === 'GOOD' ? 'bg-green-100' : 
                      rule.companion_type === 'BAD' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      {rule.companion_type === 'GOOD' ? (
                        <ThumbsUp className="w-5 h-5 text-green-600" />
                      ) : rule.companion_type === 'BAD' ? (
                        <ThumbsDown className="w-5 h-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1">
                     <p className="font-medium text-gray-900">
                       {getPlantTypeName(rule.plant_type_id)} + {getPlantTypeName(rule.companion_plant_type_id)}
                     </p>
                     {rule.notes && (
                       <p className="text-sm text-gray-600 mt-1">{rule.notes}</p>
                     )}
                     <div className="flex items-center gap-2 mt-2 text-xs">
                       <Badge variant="outline" className="text-xs">
                         Evidence: {rule.evidence_level || 'C'}
                       </Badge>
                       {rule.source && (
                         <span className="text-gray-500">Source: {rule.source}</span>
                       )}
                     </div>
                    </div>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="w-4 h-4 text-gray-400" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(rule)}
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit' : 'Add'} Companion Rule</DialogTitle>
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
                  <SelectItem value="GOOD_CONDITIONAL">Good / Conditional</SelectItem>
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
              <Label>Evidence Level</Label>
              <Select 
                value={formData.evidence_level} 
                onValueChange={(v) => setFormData({ ...formData, evidence_level: v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Scientific Research</SelectItem>
                  <SelectItem value="B">B - Experienced Growers</SelectItem>
                  <SelectItem value="C">C - Anecdotal</SelectItem>
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
              {editingRule ? 'Update' : 'Add'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Companion Rules from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0])}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required columns: plant_a, plant_b, relationship, why, evidence_level
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template CSV
            </Button>

            {csvFile && (
              <Button
                onClick={() => handleImport(true)}
                disabled={importing}
                variant="outline"
                className="w-full"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Preview Import
              </Button>
            )}

            {importResults && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <h4 className="font-semibold">Import Preview:</h4>
                <div className="text-sm space-y-1">
                  <p>✅ Will create: {importResults.created || importResults.preview?.length || 0}</p>
                  <p>🔄 Will update: {importResults.updated || 0}</p>
                  <p>⏭️ Skipped: {importResults.skipped || 0}</p>
                  {importResults.failed?.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 rounded">
                      <p className="text-red-800 font-medium">Failed rows:</p>
                      {importResults.failed.slice(0, 5).map((f, i) => (
                        <p key={i} className="text-xs text-red-700">
                          Row {f.row}: {f.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setCsvFile(null);
              setImportResults(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleImport(false)}
              disabled={!csvFile || importing || !importResults}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Import Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}