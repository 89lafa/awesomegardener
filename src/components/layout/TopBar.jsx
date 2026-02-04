import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Search, 
  Plus, 
  Bell, 
  User,
  TreeDeciduous,
  ListChecks,
  Package,
  Calendar,
  LogOut,
  Settings,
  Menu,
  PanelLeftClose,
  PanelLeft,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import DarkModeToggle from '@/components/common/DarkModeToggle';

export default function TopBar({ user, onMobileMenuToggle, onSidebarToggle, sidebarCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Determine if this is a child page (should show back button)
  const rootPaths = ['/Dashboard', '/PlantCatalog', '/SeedStash', '/Messages', '/'];
  const isChildPage = !rootPaths.includes(location.pathname);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
    }
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      let count = 0;
      
      // Regular notifications
      const notifications = await base44.entities.Notification.filter({ 
        user_email: user.email, 
        is_read: false 
      });
      count += notifications.length;
      
      // Admin/Mod notifications
      if (user.role === 'admin' || user.role === 'moderator') {
        const [varietySuggestions, featureRequests, imageSubmissions, changeRequests] = await Promise.all([
          base44.entities.VarietySuggestion.filter({ status: 'pending' }),
          base44.entities.FeatureRequest.filter({ status: 'submitted' }),
          base44.entities.VarietyImageSubmission.filter({ status: 'pending' }),
          base44.entities.VarietyChangeRequest.filter({ status: 'pending' }),
        ]);
        
        count += varietySuggestions.length + featureRequests.length + imageSubmissions.length + changeRequests.length;
        
        // Admin-only: User reports
        if (user.role === 'admin') {
          const userReports = await base44.entities.ContentReport.filter({ status: 'open' });
          count += userReports.length;
        }
      }
      
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (user) {
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
      // Force clear all state and redirect
      window.location.href = createPageUrl('Landing');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = createPageUrl('Landing');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header 
      className="h-16 border-b flex items-center justify-between px-4 lg:px-6" 
      style={{ 
        background: 'var(--bg-header)', 
        borderColor: 'var(--border-default)',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: '1rem'
      }}
    >
      {/* Sidebar Toggle OR Back Button */}
      <div className="flex items-center gap-2">
        {isChildPage ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="lg:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileMenuToggle}
            className="lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSidebarToggle}
          className="hidden lg:flex"
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </Button>
      </div>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md">
        <form 
          className="relative w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              window.location.href = createPageUrl('GlobalSearch') + '?q=' + encodeURIComponent(searchQuery);
            }
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search plants, varieties, gardens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchQuery.trim()) {
                  window.location.href = createPageUrl('GlobalSearch') + '?q=' + encodeURIComponent(searchQuery);
                }
              }
            }}
            className="pl-10 bg-gray-50 border-gray-200 focus:bg-white"
          />
        </form>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark Mode Toggle */}
        <DarkModeToggle />
        
        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Quick Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('Gardens') + '?action=new'} className="flex items-center gap-2">
                <TreeDeciduous className="w-4 h-4" />
                New Garden
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('SeedStash') + '?action=new'} className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Add Seeds
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('CalendarTasks') + '?action=new'} className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                New Task
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('GrowLists') + '?action=new'} className="flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                New Grow List
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('Calendar') + '?action=new'} className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Add to Calendar Planner
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Link to={createPageUrl('Notifications')}>
          <Button variant="ghost" size="icon" className="hidden sm:flex relative">
            <Bell className="w-5 h-5 text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold border-2 border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:block text-sm font-medium max-w-[120px] truncate">
                {user?.full_name || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b">
              <p className="font-medium text-sm">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <DropdownMenuItem asChild>
              <Link to={createPageUrl('Settings')} className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}