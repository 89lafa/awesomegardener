import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Leaf, Archive, Calendar, MoreHorizontal, Mail } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  
  const items = [
    { path: '/Dashboard', icon: Home, label: 'Home' },
    { path: '/PlantCatalog', icon: Leaf, label: 'Plants' },
    { path: '/SeedStash', icon: Archive, label: 'Seeds' },
    { path: '/Messages', icon: Mail, label: 'Messages' },
  ];
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t lg:hidden z-50">
      <div className="flex justify-around h-16">
        {items.map(item => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center min-w-[64px] ${
              location.pathname === item.path ? 'text-emerald-600' : 'text-gray-500'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex flex-col items-center justify-center min-w-[64px] text-gray-500"
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-xs">More</span>
        </button>
      </div>
    </nav>
  );
}