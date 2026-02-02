import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [preference, setPreference] = useState('system');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage or system
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme_preference') || 'system';
    setPreference(stored);
    applyTheme(stored);

    // Listen for system changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = localStorage.getItem('theme_preference') || 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const applyTheme = (pref) => {
    let activeTheme;
    if (pref === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? 'dark' : 'light';
    } else {
      activeTheme = pref;
    }
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.style.colorScheme = activeTheme;
  };

  const updatePreference = (newPref) => {
    setPreference(newPref);
    localStorage.setItem('theme_preference', newPref);
    applyTheme(newPref);
  };

  if (!mounted) {
    return children;
  }

  return (
    <ThemeContext.Provider value={{ theme, preference, updatePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};