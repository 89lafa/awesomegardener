import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or default to light
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    // Apply theme on mount and when changed
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDarkMode(!darkMode)}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative"
    >
      {darkMode ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5 text-gray-500" />
      )}
    </Button>
  );
}