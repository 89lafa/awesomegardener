import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, BookOpen, Sprout, ListChecks, Grid3X3, Calendar,
  CheckSquare, Wheat, BookText, Users, Sparkles, Settings,
  LogOut, ChevronLeft, X, Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navSections = [
  {
    title: 'Main',
    items: [
      { path: '/Dashboard', icon: Home, label: 'Dashboard' },
      { path: '/PlantCatalog', icon: BookOpen, label: 'Plant Catalog', badge: '4000+' },
      { path: '/SeedStash', icon: Sprout, label: 'Seed Stash' },
      { path: '/GrowLists', icon: ListChecks, label: 'Grow Lists' },
    ]
  },
  {
    title: 'Garden',
    items: [
      { path: '/MyGarden', icon: Grid3X3, label: 'My Garden' },
      { path: '/Calendar', icon: Calendar, label: 'Calendar' },
      { path: '/CalendarTasks', icon: CheckSquare, label: 'Tasks' },
      { path: '/HarvestLog', icon: Wheat, label: 'Harvest Log' },
      { path: '/GardenDiary', icon: BookText, label: 'Diary' },
    ]
  },
  {
    title: 'Community',
    items: [
      { path: '/Community', icon: Users, label: 'Community', badge: 'NEW' },
      { path: '/ZoneMap', icon: Sparkles, label: 'AI Assistant' },
    ]
  }
];

export default function Sidebar({ 
  collapsed, 
  onToggle, 
  currentPage, 
  user, 
  isMobile 
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path) => {
    navigate(path);
    if (isMobile) onToggle?.();
  };

  const handleLogout = async () => {
    await window.base44?.auth.logout();
  };

  return (
    <aside 
      className={cn(
        'flex flex-col h-screen',
        'bg-[var(--bg-sidebar)]',
        'border-r border-[var(--border-default)]',
        'transition-all duration-300'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
        {!collapsed && (
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 
                           flex items-center justify-center text-white font-bold text-lg shadow-lg">
              🌱
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[var(--text-primary)] truncate">
                AwesomeGardener
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Plan • Grow • Harvest
              </div>
            </div>
          </div>
        )}
        
        <button 
          onClick={onToggle}
          className="w-9 h-9 rounded-lg flex items-center justify-center
                     bg-[var(--surface-hover)] text-[var(--text-muted)]
                     hover:bg-[var(--surface-active)] hover:text-[var(--text-primary)]
                     transition-all duration-200 touch-feedback"
        >
          {isMobile ? <X size={20} /> : <ChevronLeft size={20} className={cn(
            'transition-transform duration-300',
            collapsed && 'rotate-180'
          )} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scroll-container">
        {navSections.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && 'mt-6')}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {section.title}
              </div>
            )}
            
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = location.pathname.includes(item.path.substring(1)) || location.pathname === item.path;
                
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                      'transition-all duration-200 touch-feedback',
                      'min-h-[44px]',
                      isActive 
                        ? 'bg-gradient-to-r from-[var(--surface-selected)] to-transparent text-[var(--primary)] font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon 
                      size={20} 
                      className={cn(
                        'flex-shrink-0',
                        isActive && 'text-[var(--primary)]'
                      )} 
                    />
                    
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left text-sm">
                          {item.label}
                        </span>
                        
                        {item.badge && (
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
                            item.badge === 'NEW' 
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--surface-active)] text-[var(--text-muted)]'
                          )}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-default)] space-y-2">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
            'transition-all duration-200 min-h-[44px] touch-feedback',
            collapsed && 'justify-center'
          )}
          onClick={() => handleNavClick('/Settings')}
        >
          <Settings size={20} />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Button>

        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950',
            'transition-all duration-200 min-h-[44px] touch-feedback',
            collapsed && 'justify-center'
          )}
          onClick={handleLogout}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm">Logout</span>}
        </Button>
        
        {user && !collapsed && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--surface-hover)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white 
                             flex items-center justify-center text-sm font-medium flex-shrink-0">
                {user.full_name?.[0] || user.email?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-[var(--text-primary)]">
                  {user.full_name || 'Gardener'}
                </div>
                <div className="text-xs text-[var(--text-muted)] truncate">
                  {user.email}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}