import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CompanionRuleImport() {
  const [user, setUser] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  React.useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    if (userData?.role !== 'admin') {
      window.location.href = createPageUrl('Dashboard');
    }
    setUser(userData);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files?.[0];

    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await base44.functions.invoke('importCompanionRulesUpdated', formData);
      
      if (response.data.success) {
        setResults(response.data);
        toast.success('Import completed');
      } else {
        toast.error('Import failed: ' + response.data.error);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Import failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Companion Rule Import</h1>
        <p className="text-gray-600 mt-1">Upload CSV to update companion planting rules</p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 space-y-2">
              <p><strong>Import Rules:</strong></p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Rows with <code className="bg-blue-100 px-1 rounded">id</code> will update existing records</li>
                <li>Rows without <code className="bg-blue-100 px-1 rounded">id</code> will create new records</li>
                <li>Duplicate (plant_type_id, companion_plant_type_id) pairs are skipped</li>
                <li><code className="bg-blue-100 px-1 rounded">companion_type</code> must be: GOOD, BAD, or GOOD_CONDITIONAL</li>
                <li><code className="bg-blue-100 px-1 rounded">evidence_level</code> must be: A, B, or C (if provided)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <Label htmlFor="csv-file">Select CompanionRule CSV</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                className="mt-2"
              />
            </div>
            <Button type="submit" disabled={importing} className="bg-emerald-600 hover:bg-emerald-700">
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Import Rules</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Inserted</p>
                  <p className="text-2xl font-bold text-green-700">{results.results.inserted}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Updated</p>
                  <p className="text-2xl font-bold text-blue-700">{results.results.updated}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Skipped</p>
                  <p className="text-2xl font-bold text-gray-700">{results.results.skipped}</p>
                </div>
              </div>

              {results.results.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-900 mb-2">Errors ({results.results.errors.length})</p>
                  <div className="space-y-1 text-sm text-red-800">
                    {results.results.errors.slice(0, 10).map((err, idx) => (
                      <p key={idx}>• {err}</p>
                    ))}
                    {results.results.errors.length > 10 && (
                      <p className="text-red-600 italic">... and {results.results.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}

              {results.results.duplicates.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-semibold text-amber-900 mb-2">
                    Duplicates Skipped ({results.results.duplicates.length})
                  </p>
                  <div className="text-sm text-amber-800">
                    {results.results.duplicates.slice(0, 5).map((dup, idx) => (
                      <p key={idx}>• {dup.plant_type_id} ↔ {dup.companion_plant_type_id}</p>
                    ))}
                    {results.results.duplicates.length > 5 && (
                      <p className="text-amber-600 italic">... and {results.results.duplicates.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {results.results.missingData.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-semibold text-yellow-900 mb-2">
                    Missing Notes/Source ({results.results.missingData.length})
                  </p>
                  <div className="text-sm text-yellow-800">
                    {results.results.missingData.slice(0, 5).map((item, idx) => (
                      <p key={idx}>• Row {item.row}: Missing {item.missing}</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Rules</p>
                <p className="text-3xl font-bold">{results.audit.total}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">By Companion Type</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <Badge className="bg-green-600 mb-2">GOOD</Badge>
                    <p className="text-2xl font-bold text-green-700">{results.audit.by_companion_type.GOOD}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <Badge className="bg-red-600 mb-2">BAD</Badge>
                    <p className="text-2xl font-bold text-red-700">{results.audit.by_companion_type.BAD}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <Badge className="bg-amber-600 mb-2">CONDITIONAL</Badge>
                    <p className="text-2xl font-bold text-amber-700">{results.audit.by_companion_type.GOOD_CONDITIONAL}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">By Evidence Level</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Badge variant="outline" className="mb-2">A (Scientific)</Badge>
                    <p className="text-xl font-bold text-purple-700">{results.audit.by_evidence_level.A}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Badge variant="outline" className="mb-2">B (Experienced)</Badge>
                    <p className="text-xl font-bold text-blue-700">{results.audit.by_evidence_level.B}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Badge variant="outline" className="mb-2">C (Anecdotal)</Badge>
                    <p className="text-xl font-bold text-gray-700">{results.audit.by_evidence_level.C}</p>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <Badge variant="outline" className="mb-2">Not Set</Badge>
                    <p className="text-xl font-bold text-gray-500">{results.audit.by_evidence_level.null}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Missing Notes</p>
                  <p className="text-2xl font-bold text-yellow-700">{results.audit.missing_notes}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm text-gray-600">Missing Source</p>
                  <p className="text-2xl font-bold text-yellow-700">{results.audit.missing_source}</p>
                </div>
              </div>

              {results.audit.duplicates_in_db && results.audit.duplicates_in_db.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Database Duplicates Found ({results.audit.duplicates_in_db.length})
                  </p>
                  <div className="text-sm text-red-800">
                    {results.audit.duplicates_in_db.map((dup, idx) => (
                      <p key={idx}>• {dup.pair} ({dup.count} occurrences)</p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}