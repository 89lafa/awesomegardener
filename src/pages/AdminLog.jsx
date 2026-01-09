import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, RefreshCw, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminLog() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
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
      await loadLogs();
    } catch (error) {
      window.location.href = '/Dashboard';
    }
  };

  const loadLogs = async () => {
    try {
      const auditLogs = await base44.entities.TaxonomyAuditLog.list('-created_date', 1000);
      setLogs(auditLogs);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = [...new Set(logs.map(l => l.action_type))].filter(Boolean);
  const users = [...new Set(logs.map(l => l.user_email))].filter(Boolean);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.entity_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.changes).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action_type === actionFilter;
    const matchesUser = userFilter === 'all' || log.user_email === userFilter;
    
    return matchesSearch && matchesAction && matchesUser;
  });

  const paginatedLogs = filteredLogs.slice(0, currentPage * itemsPerPage);

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'approve': return 'bg-emerald-100 text-emerald-800';
      case 'reject': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Admin Audit Log</h1>
          <p className="text-gray-600 mt-1">Track all actions taken by users and moderators</p>
        </div>
        <Button onClick={loadLogs} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map(action => (
                  <SelectItem key={action} value={action} className="capitalize">
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(email => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="space-y-2">
        {paginatedLogs.map((log) => (
          <Card key={log.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getActionBadgeColor(log.action_type)}>
                      {log.action_type}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">{log.entity_type}</span>
                    <span className="text-xs text-gray-500 font-mono truncate">{log.entity_id}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    by <span className="font-medium">{log.user_email}</span>
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        View changes
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(log.created_date), 'MMM d, h:mm a')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLogs.length > paginatedLogs.length && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Load More ({filteredLogs.length - paginatedLogs.length} remaining)
          </Button>
        </div>
      )}

      {filteredLogs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No logs found matching your filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}