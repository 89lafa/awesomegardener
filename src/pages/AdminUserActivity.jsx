import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Users, TrendingUp, Clock, Calendar, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';

export default function AdminUserActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    checkAndLoad();
  }, []);

  const checkAndLoad = async () => {
    try {
      const userData = await base44.auth.me();
      if (!userData || userData.role !== 'admin') {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      await loadData();
    } catch (e) {
      navigate(createPageUrl('Dashboard'));
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, usersData] = await Promise.all([
        base44.entities.ActivityLog.list('-created_date', 2000),
        base44.entities.User.list('full_name', 500),
      ]);
      setLogs(logsData);
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Build daily stats for the last 14 days
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => subDays(today, 13 - i));

  const getDayKey = (date) => format(date, 'yyyy-MM-dd');

  // Group logs by day
  const logsByDay = {};
  logs.forEach(log => {
    const day = log.created_date ? getDayKey(new Date(log.created_date)) : null;
    if (!day) return;
    if (!logsByDay[day]) logsByDay[day] = [];
    logsByDay[day].push(log);
  });

  // Unique active users per day
  const dauByDay = days.map(day => {
    const key = getDayKey(day);
    const dayLogs = logsByDay[key] || [];
    const uniqueUsers = new Set(dayLogs.map(l => l.created_by)).size;
    return { date: day, key, count: uniqueUsers, sessions: dayLogs.length };
  });

  const todayKey = getDayKey(today);
  const todayDAU = dauByDay[dauByDay.length - 1]?.count || 0;
  const yesterdayDAU = dauByDay[dauByDay.length - 2]?.count || 0;

  // Weekly active users (last 7 days)
  const last7Keys = new Set(days.slice(-7).map(d => getDayKey(d)));
  const wauUsers = new Set();
  logs.forEach(log => {
    const day = log.created_date ? getDayKey(new Date(log.created_date)) : null;
    if (day && last7Keys.has(day)) wauUsers.add(log.created_by);
  });
  const WAU = wauUsers.size;

  // Total registered users
  const totalUsers = users.length;

  // Most active users (last 7 days)
  const userActivityMap = {};
  logs.forEach(log => {
    const day = log.created_date ? getDayKey(new Date(log.created_date)) : null;
    if (!day || !last7Keys.has(day)) return;
    const email = log.created_by;
    if (!userActivityMap[email]) userActivityMap[email] = { email, sessions: 0 };
    userActivityMap[email].sessions++;
  });
  const topUsers = Object.values(userActivityMap)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  const getUserName = (email) => users.find(u => u.email === email)?.full_name || email;

  const maxDAU = Math.max(...dauByDay.map(d => d.count), 1);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={createPageUrl('AdminHub')}>
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Admin Hub</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />User Activity
          </h1>
          <p className="text-sm text-gray-500">Daily & weekly engagement stats</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-emerald-700">{todayDAU}</p>
            <p className="text-xs text-gray-500 mt-1">Today's Active Users</p>
            {yesterdayDAU > 0 && (
              <p className={`text-xs mt-1 font-medium ${todayDAU >= yesterdayDAU ? 'text-green-600' : 'text-red-500'}`}>
                {todayDAU >= yesterdayDAU ? '↑' : '↓'} vs yesterday ({yesterdayDAU})
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-blue-700">{WAU}</p>
            <p className="text-xs text-gray-500 mt-1">Weekly Active Users</p>
            <p className="text-xs text-gray-400 mt-1">Last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-purple-700">{totalUsers}</p>
            <p className="text-xs text-gray-500 mt-1">Total Registered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-black text-amber-700">
              {totalUsers > 0 ? Math.round((WAU / totalUsers) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">7-Day Retention</p>
          </CardContent>
        </Card>
      </div>

      {/* DAU Chart (last 14 days) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />Daily Active Users — Last 14 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {dauByDay.map(({ date, key, count }) => {
              const barH = maxDAU > 0 ? Math.max((count / maxDAU) * 100, count > 0 ? 4 : 0) : 0;
              const isToday = key === todayKey;
              return (
                <div key={key} className="flex-1 flex flex-col items-center gap-1" title={`${format(date, 'MMM d')}: ${count} users`}>
                  <span className="text-[10px] text-gray-600 font-semibold">{count > 0 ? count : ''}</span>
                  <div className="w-full rounded-t-sm transition-all" style={{
                    height: `${barH}%`,
                    minHeight: count > 0 ? 4 : 2,
                    backgroundColor: isToday ? '#059669' : '#6ee7b7'
                  }} />
                  <span className={`text-[9px] ${isToday ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>
                    {format(date, 'M/d')}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Active Users (last 7 days) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />Most Active Users — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topUsers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No activity data yet. Activity is tracked when users load pages.</p>
          ) : (
            <div className="space-y-2">
              {topUsers.map((u, i) => (
                <div key={u.email} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{getUserName(u.email)}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{u.sessions} events</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Activity is tracked via ActivityLog entries created when users interact with the app. Data shown based on existing records.
      </p>
    </div>
  );
}