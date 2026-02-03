import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Leaf, Archive, Calendar, MoreHorizontal, Mail } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const navHistory = useRef({
    '/Dashboard': ['/Dashboard'],
    '/PlantCatalog': ['/PlantCatalog'],
    '/SeedStash': ['/SeedStash'],
    '/Messages': ['/Messages']
  });
  
  const items = [
    { path: '/Dashboard', icon: Home, label: 'Home' },
    { path: '/PlantCatalog', icon: Leaf, label: 'Plants' },
    { path: '/SeedStash', icon: Archive, label: 'Seeds' },
    { path: '/Messages', icon: Mail, label: 'Messages' },
  ];

  const handleTabClick = (tabPath) => {
    const currentPath = location.pathname;
    
    // If clicking the active tab, reset to root page
    if (currentPath === tabPath) {
      navHistory.current[tabPath] = [tabPath];
      navigate(tabPath, { replace: true });
    } else {
      // Navigate to the tab
      navigate(tabPath);
    }
  };
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t lg:hidden z-50" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
      <div className="flex justify-around h-16">
        {items.map(item => (
          <button
            key={item.path}
            onClick={() => handleTabClick(item.path)}
            className="flex flex-col items-center justify-center min-w-[64px]"
            style={{ 
              color: location.pathname === item.path ? 'var(--primary)' : 'var(--text-muted)' 
            }}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex flex-col items-center justify-center min-w-[64px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-xs">More</span>
        </button>
      </div>
    </nav>
  );
}