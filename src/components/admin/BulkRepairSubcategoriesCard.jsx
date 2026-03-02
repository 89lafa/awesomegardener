import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function BulkRepairSubcategoriesCard() {
  const [plantTypes, setPlantTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('__ALL__');
  const [running, setRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    base44.entities.PlantType.list('common_name').then(setPlantTypes).catch(console.error);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    const ptId = selectedType === '__ALL__' ? null : selectedType;
    const label = ptId ? plantTypes.find(p => p.id === ptId)?.common_name : 'ALL plant types';
    toast.info(`Running subcategory repair on ${label}... this may take several minutes.`);

    try {
      const payload = { dry_run: dryRun };
      if (ptId) payload.plant_type_id = ptId;
      const res = await base44.functions.invoke('bulkRepairAllSubcategories', payload);
      setResult(res.data);
      toast.success(`Done! Fixed ${res.data.fixed} / ${res.data.total_missing} missing subcategories`);
    } catch (err) {
      toast.error('Repair failed: ' + err.message);
      setResult({ error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-900">
          🔧 Repair Subcategories 2 — Bulk Fix ALL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-purple-50 border-purple-200">
          <AlertCircle className="w-4 h-4 text-purple-600" />
          <AlertDescription className="text-sm text-purple-800">
            <div className="font-semibold mb-1">New bulk repair tool — matches by:</div>
            <ul className="space-y-0.5 text-xs">
              <li>• Scoville range (peppers heat bands)</li>
              <li>• Fruit shape / growth habit (tomatoes)</li>
              <li>• Variety name / description keywords</li>
              <li>• Fallback: first active subcategory for plant type</li>
              <li>• Only touches varieties with NO subcategory assigned</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div>
          <Label>Plant Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">🌱 ALL Plant Types (full DB repair)</SelectItem>
              {plantTypes.map(pt => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.icon && <span className="mr-2">{pt.icon}</span>}
                  {pt.common_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm font-medium">Dry Run (preview — no DB changes)</span>
        </label>

        <Button
          onClick={handleRun}
          disabled={running}
          className="bg-purple-600 hover:bg-purple-700 gap-2 w-full"
        >
          {running ? <><Loader2 className="w-4 h-4 animate-spin" />Running...</> : <><Play className="w-4 h-4" />Run Subcategory Repair 2</>}
        </Button>

        {result && (
          <Alert className={result.error ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            {result.error ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
            <AlertDescription className={result.error ? 'text-red-800' : 'text-green-800'}>
              {result.error ? (
                <span className="text-sm">{result.error}</span>
              ) : (
                <div className="space-y-2">
                  <div className="font-semibold">{result.dry_run ? 'Preview Results' : 'Repair Complete'}:</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>Total Missing: <strong>{result.total_missing}</strong></div>
                    <div>Fixed: <strong className="text-green-700">{result.fixed}</strong></div>
                    <div>No Match: <strong className="text-amber-700">{result.no_match}</strong></div>
                  </div>
                  {result.no_match_sample?.length > 0 && (
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border">
                      <strong>Still unmatched (sample):</strong><br />
                      {result.no_match_sample.map((v, i) => <span key={i}>{v.name}{i < result.no_match_sample.length - 1 ? ', ' : ''}</span>)}
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}