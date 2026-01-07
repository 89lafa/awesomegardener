import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanionRulesAudit() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
      window.location.href = '/Dashboard';
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setRunning(true);
    try {
      const response = await base44.functions.invoke('auditCompanionRules');
      setResults(response.data);
      toast.success('Audit completed');
    } catch (error) {
      console.error('Error running audit:', error);
      toast.error('Audit failed: ' + error.message);
    } finally {
      setRunning(false);
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
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Companion Rules Audit</h1>
          <p className="text-gray-600 mt-1">Validate data quality</p>
        </div>
        <Button 
          onClick={runAudit} 
          disabled={running}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Audit
        </Button>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Overview Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">Total Rules: {results.total_rules}</p>
            </CardContent>
          </Card>

          {/* Companion Type Stats */}
          <Card>
            <CardHeader>
              <CardTitle>By Companion Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span>GOOD</span>
                <Badge className="bg-green-600">{results.type_stats.GOOD}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>GOOD_CONDITIONAL</span>
                <Badge className="bg-amber-600">{results.type_stats.GOOD_CONDITIONAL}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>BAD</span>
                <Badge className="bg-red-600">{results.type_stats.BAD}</Badge>
              </div>
              {results.type_stats.other > 0 && (
                <div className="flex items-center justify-between text-red-600">
                  <span>Invalid</span>
                  <Badge variant="destructive">{results.type_stats.other}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence Level Stats */}
          <Card>
            <CardHeader>
              <CardTitle>By Evidence Level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span>A - Scientific</span>
                <Badge>{results.evidence_stats.A}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>B - Experienced</span>
                <Badge>{results.evidence_stats.B}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>C - Anecdotal</span>
                <Badge>{results.evidence_stats.C}</Badge>
              </div>
              {results.evidence_stats.missing > 0 && (
                <div className="flex items-center justify-between text-red-600">
                  <span>Missing</span>
                  <Badge variant="destructive">{results.evidence_stats.missing}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Duplicates */}
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Pairs ({results.duplicates.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {results.duplicates.length === 0 ? (
                <p className="text-gray-500">No duplicates found</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {results.duplicates.slice(0, 10).map((dup, idx) => (
                    <div key={idx} className="p-2 bg-red-50 rounded border border-red-200">
                      <p className="font-medium">Pair: {dup.pair}</p>
                      <p className="text-xs text-gray-600">IDs: {dup.ids.join(', ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Missing Data */}
          <Card>
            <CardHeader>
              <CardTitle>Missing Notes or Source ({results.missing_data.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {results.missing_data.length === 0 ? (
                <p className="text-gray-500">All rules have notes and source</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {results.missing_data.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 rounded border border-amber-200">
                      <p className="font-medium">ID: {item.id}</p>
                      <p className="text-xs text-gray-600">
                        {item.missing_notes && 'Missing notes'}
                        {item.missing_notes && item.missing_source && ' & '}
                        {item.missing_source && 'Missing source'}
                      </p>
                    </div>
                  ))}
                  {results.missing_data.length > 10 && (
                    <p className="text-xs text-gray-500">... and {results.missing_data.length - 10} more</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}