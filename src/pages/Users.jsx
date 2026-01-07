import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Search, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setCurrentUser(userData);

      if (userData.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const allUsers = await base44.entities.User.list('-created_date');
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModerator = async (user) => {
    if (user.role === 'admin') {
      toast.error('Cannot change moderator status for admins');
      return;
    }

    try {
      await base44.entities.User.update(user.id, {
        is_moderator: !user.is_moderator
      });

      setUsers(users.map(u => 
        u.id === user.id 
          ? { ...u, is_moderator: !u.is_moderator }
          : u
      ));

      toast.success(user.is_moderator ? 'Moderator removed' : 'Moderator added');
    } catch (error) {
      console.error('Error updating moderator status:', error);
      toast.error('Failed to update moderator status');
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users and moderator permissions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {user.full_name || 'No name'}
                  </p>
                  <p className="text-sm text-gray-600 truncate">{user.email}</p>
                  <p className="text-xs text-gray-500">
                    Joined {format(new Date(user.created_date), 'MMM d, yyyy')}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {user.role === 'admin' ? (
                    <Badge className="bg-purple-100 text-purple-800">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  ) : user.is_moderator ? (
                    <Badge className="bg-blue-100 text-blue-800">
                      <Shield className="w-3 h-3 mr-1" />
                      Moderator
                    </Badge>
                  ) : (
                    <Badge variant="outline">User</Badge>
                  )}

                  {user.role !== 'admin' && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`mod-${user.id}`} className="text-sm">
                        Moderator
                      </Label>
                      <Switch
                        id={`mod-${user.id}`}
                        checked={user.is_moderator || false}
                        onCheckedChange={() => handleToggleModerator(user)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No users found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}