import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function GrowLogComponent({ targetId, targetType }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    log_type: 'note',
    title: '',
    content: '',
    temperature_f: null,
    humidity: null,
    height_inches: null,
    leaf_count: null
  });

  useEffect(() => {
    loadLogs();
  }, [targetId, targetType]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      // For space-level view, aggregate logs from ALL child elements
      if (targetType === 'indoor_space_id') {
        const [spaceLogs, rackLogs, shelfLogs, trayLogs, cellLogs, containerLogs] = await Promise.all([
          base44.entities.GrowLog.filter({ indoor_space_id: targetId }, '-created_date'),
          base44.entities.GrowLog.filter({ indoor_space_id: targetId }, '-created_date'),
          base44.entities.GrowRack.filter({ indoor_space_id: targetId }).then(async racks => {
            if (racks.length === 0) return [];
            const rackIds = racks.map(r => r.id);
            const allLogs = await Promise.all(rackIds.map(rid => 
              base44.entities.GrowLog.filter({ rack_id: rid }, '-created_date')
            ));
            return allLogs.flat();
          }),
          base44.entities.SeedTray.filter({}).then(async trays => {
            const traysBySpace = [];
            for (const tray of trays) {
              if (tray.shelf_id) {
                const shelves = await base44.entities.GrowShelf.filter({ id: tray.shelf_id });
                if (shelves[0]?.rack_id) {
                  const racks = await base44.entities.GrowRack.filter({ id: shelves[0].rack_id });
                  if (racks[0]?.indoor_space_id === targetId) {
                    traysBySpace.push(tray);
                  }
                }
              }
            }
            if (traysBySpace.length === 0) return [];
            const allLogs = await Promise.all(traysBySpace.map(t => 
              base44.entities.GrowLog.filter({ tray_id: t.id }, '-created_date')
            ));
            return allLogs.flat();
          }),
          base44.entities.GrowLog.filter({ tray_cell_id: targetId }, '-created_date'),
          base44.entities.GrowLog.filter({ container_id: targetId }, '-created_date')
        ]);
        
        // Merge all logs and deduplicate by id
        const allLogs = [...spaceLogs, ...rackLogs, ...shelfLogs, ...trayLogs, ...cellLogs, ...containerLogs];
        const uniqueLogs = Array.from(new Map(allLogs.map(log => [log.id, log])).values());
        setLogs(uniqueLogs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
      } else {
        // For specific entity logs (tray, container, etc.)
        const query = { [targetType]: targetId };
        const logsData = await base44.entities.GrowLog.filter(query, '-created_date');
        setLogs(logsData);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitLog = async () => {
    if (!formData.content.trim()) {
      toast.error('Please enter log content');
      return;
    }

    setSubmitting(true);
    try {
      const logEntry = {
        [targetType]: targetId,
        ...formData,
        logged_at: new Date().toISOString()
      };
      
      const newLog = await base44.entities.GrowLog.create(logEntry);
      setLogs([newLog, ...logs]);
      setFormData({
        log_type: 'note',
        title: '',
        content: '',
        temperature_f: null,
        humidity: null,
        height_inches: null,
        leaf_count: null
      });
      setShowForm(false);
      toast.success('Log entry added!');
    } catch (error) {
      console.error('Error adding log:', error);
      toast.error('Failed to add log');
    } finally {
      setSubmitting(false);
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'note': return '📝';
      case 'observation': return '👀';
      case 'action': return '🔧';
      case 'issue': return '⚠️';
      case 'milestone': return '🎉';
      default: return '📝';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">📖 Growth Log</h3>
        <Button 
          onClick={() => setShowForm(!showForm)}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <Select 
            value={formData.log_type}
            onValueChange={(v) => setFormData({...formData, log_type: v})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note">📝 Note</SelectItem>
              <SelectItem value="observation">👀 Observation</SelectItem>
              <SelectItem value="action">🔧 Action</SelectItem>
              <SelectItem value="issue">⚠️ Issue</SelectItem>
              <SelectItem value="milestone">🎉 Milestone</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Optional title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
          />

          <Textarea
            placeholder="What's happening?"
            value={formData.content}
            onChange={(e) => setFormData({...formData, content: e.target.value})}
            className="h-24"
          />

          <div className="grid grid-cols-4 gap-2">
            <Input
              type="number"
              placeholder="Temp (°F)"
              value={formData.temperature_f || ''}
              onChange={(e) => setFormData({...formData, temperature_f: e.target.value ? parseFloat(e.target.value) : null})}
            />
            <Input
              type="number"
              placeholder="Humidity %"
              value={formData.humidity || ''}
              onChange={(e) => setFormData({...formData, humidity: e.target.value ? parseFloat(e.target.value) : null})}
            />
            <Input
              type="number"
              placeholder="Height (in)"
              value={formData.height_inches || ''}
              onChange={(e) => setFormData({...formData, height_inches: e.target.value ? parseFloat(e.target.value) : null})}
            />
            <Input
              type="number"
              placeholder="Leaves"
              value={formData.leaf_count || ''}
              onChange={(e) => setFormData({...formData, leaf_count: e.target.value ? parseInt(e.target.value) : null})}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSubmitLog}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Log
            </Button>
            <Button 
              onClick={() => setShowForm(false)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No log entries yet</p>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getLogIcon(log.log_type)}</span>
                <div className="flex-1 min-w-0">
                  {log.title && (
                    <p className="font-semibold text-gray-900">{log.title}</p>
                  )}
                  <p className="text-sm text-gray-700 mt-1">{log.content}</p>
                  
                  {/* Measurements */}
                  {(log.temperature_f || log.humidity || log.height_inches || log.leaf_count) && (
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      {log.temperature_f && <span>🌡️ {log.temperature_f}°F</span>}
                      {log.humidity && <span>💧 {log.humidity}%</span>}
                      {log.height_inches && <span>📏 {log.height_inches}in</span>}
                      {log.leaf_count && <span>🍃 {log.leaf_count} leaves</span>}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}