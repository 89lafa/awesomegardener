import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    // Apply immediately on mount
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Apply on initial mount
  useEffect(() => {
    const root = document.documentElement;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDarkMode(!darkMode)}
      title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {darkMode ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
      )}
    </Button>
  );
}