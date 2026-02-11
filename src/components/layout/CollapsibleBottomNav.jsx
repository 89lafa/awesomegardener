import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Leaf, Archive, Mail, MoreHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerClose 
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const getMoreMenuItems = (user) => {
  const isAdmin = user?.role === 'admin';
  const isEditor = user?.is_editor;
  const isMod = user?.is_moderator;
  
  return [
    { category: 'PLANTING & PLANNING' },
    { name: 'Gardens', icon: Leaf, page: 'Gardens' },
    { name: 'My Garden Plants', icon: Leaf, page: 'MyPlants' },
    { name: 'Grow Lists', icon: Leaf, page: 'GrowLists' },
    
    { category: 'GARDEN MANAGEMENT' },
    { name: 'Calendar', icon: Leaf, page: 'Calendar' },
    { name: 'Tasks', icon: Leaf, page: 'CalendarTasks' },
    { name: 'Indoor Grow', icon: Leaf, page: 'IndoorGrowSpaces' },
    { name: 'Houseplant Spaces', icon: Leaf, page: 'IndoorPlants' },
    { name: 'My Houseplants', icon: Leaf, page: 'MyIndoorPlants' },
    
    { category: 'TRACKING' },
    { name: 'Diary', icon: Leaf, page: 'GardenDiary' },
    { name: 'Harvest Log', icon: Leaf, page: 'HarvestLog' },
    
    { category: 'COMMUNITY' },
    { name: 'Seed Trading', icon: Leaf, page: 'SeedTrading' },
    { name: 'Browse Gardens', icon: Leaf, page: 'BrowseGardens' },
    { name: 'Community Board', icon: Leaf, page: 'CommunityBoard' },
    
    ...(isEditor || isAdmin || isMod 
      ? [
          { category: 'ADMIN' },
          { name: 'Admin Hub', icon: Leaf, page: 'AdminHub' },
        ]
      : []
    ),
  ];
};

export default function CollapsibleBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [user, setUser] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('bottom_nav_collapsed') === 'true';
  });
  
  const getStoredPath = (tabRoot) => {
    return localStorage.getItem(`bottomnav_stack_${tabRoot}`) || tabRoot;
  };
  
  const setStoredPath = (tabRoot, path) => {
    localStorage.setItem(`bottomnav_stack_${tabRoot}`, path);
  };
  
  useEffect(() => {
    const currentPath = location.pathname;
    
    if (currentPath.startsWith('/Dashboard') || currentPath === '/') {
      setStoredPath('/Dashboard', currentPath);
    } else if (currentPath.includes('PlantCatalog') || currentPath.includes('ViewVariety')) {
      setStoredPath('/PlantCatalog', currentPath);
    } else if (currentPath.includes('SeedStash')) {
      setStoredPath('/SeedStash', currentPath);
    } else if (currentPath.includes('Messages')) {
      setStoredPath('/Messages', currentPath);
    }
  }, [location.pathname]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('bottom_nav_collapsed', String(newCollapsed));
  };
  
  const items = [
    { path: '/Dashboard', icon: Home, label: 'Home' },
    { path: '/PlantCatalog', icon: Leaf, label: 'Plants' },
    { path: '/SeedStash', icon: Archive, label: 'Seeds' },
    { path: '/Messages', icon: Mail, label: 'Messages' },
  ];

  const handleTabClick = (tabPath) => {
    const currentPath = location.pathname;
    const isOnTab = currentPath === tabPath || getStoredPath(tabPath) === currentPath;
    
    if (isOnTab && currentPath === tabPath) {
      setStoredPath(tabPath, tabPath);
      navigate(tabPath, { replace: true });
    } else if (isOnTab && currentPath !== tabPath) {
      setStoredPath(tabPath, tabPath);
      navigate(tabPath);
    } else {
      const storedPath = getStoredPath(tabPath);
      navigate(storedPath);
    }
  };
  
  const moreMenuItems = user ? getMoreMenuItems(user) : [];
  
  return (
    <>
      {/* Collapse/Expand Button - ALWAYS VISIBLE */}
      <button
        onClick={toggleCollapse}
        className="fixed bottom-2 right-2 lg:hidden z-[60] bg-emerald-600 text-white rounded-full p-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
        style={{ 
          bottom: isCollapsed ? '8px' : `calc(64px + env(safe-area-inset-bottom, 0px) + 8px)`
        }}
      >
        {isCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Bottom Navigation Bar */}
      <nav 
        className={cn(
          "fixed left-0 right-0 border-t lg:hidden backdrop-blur-md bg-white dark:bg-gray-900 transition-all duration-300",
          isCollapsed ? 'bottom-[-64px]' : 'bottom-0'
        )}
        style={{ 
          borderColor: 'var(--border-default)', 
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 50
        }}
      >
        <div className="flex justify-around h-16">
          {items.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleTabClick(item.path)}
                className="flex flex-col items-center justify-center min-w-[64px] touch-manipulation text-gray-700 dark:text-gray-300"
                style={{ 
                  color: isActive ? '#10b981' : undefined
                }}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMoreDrawer(true)}
            className="flex flex-col items-center justify-center min-w-[64px] touch-manipulation text-gray-700 dark:text-gray-300"
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={showMoreDrawer} onOpenChange={setShowMoreDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More Navigation</DrawerTitle>
            <DrawerDescription>Access all app features</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="h-[70vh] px-4">
            <div className="space-y-1 pb-4">
              {moreMenuItems.map((item, idx) => {
                if (item.category) {
                  return (
                    <div key={`cat-${idx}`} className="pt-4 pb-2 px-3 mt-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{item.category}</p>
                    </div>
                  );
                }
                
                const Icon = item.icon;
                return (
                  <button
                    key={item.page}
                    onClick={() => {
                      navigate(createPageUrl(item.page));
                      setShowMoreDrawer(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all touch-manipulation",
                      location.pathname.includes(item.page) 
                        ? "bg-emerald-50 text-emerald-700" 
                        : "text-gray-700 active:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium text-sm">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}