import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { cn } from '@/lib/utils';

export function ThemeToggle({ showLabels = false }) {
  const { preference, updatePreference } = useTheme();

  const options = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-[var(--surface-hover)] rounded-xl">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => updatePreference(opt.value)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
            'min-h-[44px] touch-feedback',
            preference === opt.value 
              ? 'bg-[var(--primary)] text-white shadow-sm' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          )}
          aria-label={opt.label}
        >
          <opt.icon size={18} />
          {showLabels && <span className="text-sm font-medium">{opt.label}</span>}
        </button>
      ))}
    </div>
  );
}

// Compact version for header
export function ThemeToggleCompact() {
  const { theme, updatePreference } = useTheme();

  const toggle = () => {
    updatePreference(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      className="w-10 h-10 rounded-lg flex items-center justify-center
                 bg-[var(--surface-hover)] text-[var(--text-secondary)]
                 hover:bg-[var(--surface-active)] transition-all
                 touch-feedback min-h-[44px] min-w-[44px]"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}