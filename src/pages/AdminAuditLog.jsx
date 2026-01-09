import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Filter, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminAuditLog() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(userData);
      loadLogs();
    } catch (error) {
      window.location.href = '/Dashboard';
    }
  };

  const loadLogs = async () => {
    try {
      const logsData = await base44.entities.AuditLog.list('-created_date', 1000);
      setLogs(logsData);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    const matchesSearch = !searchQuery || 
      log.entity_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.created_by?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const paginatedLogs = filteredLogs.slice(0, currentPage * itemsPerPage);
  const hasMore = filteredLogs.length > paginatedLogs.length;

  const actionTypes = [...new Set(logs.map(l => l.action_type))];

  const getActionColor = (type) => {
    if (type.includes('create')) return 'bg-green-100 text-green-800';
    if (type.includes('update') || type.includes('edit')) return 'bg-blue-100 text-blue-800';
    if (type.includes('delete') || type.includes('block')) return 'bg-red-100 text-red-800';
    if (type.includes('approve')) return 'bg-emerald-100 text-emerald-800';
    if (type.includes('reject')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Audit Log</h1>
        <p className="text-gray-600 mt-1">Track all user and admin actions across the system</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search by entity name or user..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Select value={actionFilter} onValueChange={(v) => {
              setActionFilter(v);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions ({logs.length})</SelectItem>
                {actionTypes.map(type => {
                  const count = logs.filter(l => l.action_type === type).length;
                  return (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {(actionFilter !== 'all' || searchQuery) && (
              <Button variant="outline" onClick={() => {
                setActionFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <div className="space-y-2">
        {paginatedLogs.map(log => (
          <Card key={log.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getActionColor(log.action_type)}>
                      {log.action_type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      {log.entity_type && `${log.entity_type}`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 mb-1">
                    {log.entity_name && <strong>{log.entity_name}</strong>}
                    {log.action_details && (
                      <div className="text-xs text-gray-600 mt-1 font-mono bg-gray-50 p-2 rounded">
                        {JSON.stringify(log.action_details, null, 2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>By: <strong>{log.created_by}</strong></span>
                    {log.user_role && <Badge variant="outline" className="text-xs">{log.user_role}</Badge>}
                    <span>{formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {paginatedLogs.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No audit log entries found</p>
          </CardContent>
        </Card>
      )}

      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setCurrentPage(currentPage + 1)}>
            Load More ({filteredLogs.length - paginatedLogs.length} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}