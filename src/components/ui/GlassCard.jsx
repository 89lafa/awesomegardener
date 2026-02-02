import React from 'react';
import { cn } from '@/lib/utils';

export function GlassCard({ 
  children, 
  className = '', 
  hover = true,
  padding = 'md',
  onClick,
  ...props 
}) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div 
      className={cn(
        // Base glass styles
        'rounded-2xl border transition-all duration-300',
        // Glass effect
        'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
        'border-[var(--glass-border)]',
        // Shadow
        'shadow-[var(--shadow-md)]',
        // Hover effect
        hover && 'hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5',
        // Click effect
        onClick && 'cursor-pointer active:scale-[0.98]',
        // Padding
        paddingClasses[padding],
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({ children, className = '' }) {
  return (
    <div className={cn(
      'flex items-center justify-between mb-4',
      className
    )}>
      {children}
    </div>
  );
}

export function GlassCardTitle({ children, icon, className = '' }) {
  return (
    <h3 className={cn(
      'text-base font-semibold flex items-center gap-2',
      'text-[var(--text-primary)]',
      className
    )}>
      {icon && <span className="text-lg">{icon}</span>}
      {children}
    </h3>
  );
}

export function GlassCardContent({ children, className = '' }) {
  return (
    <div className={cn('text-[var(--text-secondary)]', className)}>
      {children}
    </div>
  );
}

// Stat card variant
export function StatCard({ 
  icon, 
  label, 
  value, 
  trend, 
  color = 'var(--primary)',
  className = '' 
}) {
  return (
    <GlassCard className={cn('relative overflow-hidden', className)}>
      {/* Background icon */}
      <div 
        className="absolute -right-2 -top-2 text-6xl opacity-10"
        style={{ color }}
      >
        {icon}
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: `${color}20` }}
          >
            {icon}
          </div>
          {trend && (
            <span 
              className="text-xs font-medium px-2 py-1 rounded-full"
              style={{ 
                background: trend.startsWith('+') ? 'var(--badge-success-bg)' : 'var(--badge-warning-bg)',
                color: trend.startsWith('+') ? 'var(--success)' : 'var(--warning)'
              }}
            >
              {trend}
            </span>
          )}
        </div>
        
        <div 
          className="text-3xl font-bold tracking-tight"
          style={{ color }}
        >
          {value}
        </div>
        
        <div className="text-sm text-[var(--text-muted)] mt-1">
          {label}
        </div>
      </div>
    </GlassCard>
  );
}

// Task item card
export function TaskCard({ 
  task, 
  time, 
  type = 'default',
  priority,
  onComplete,
  className = '' 
}) {
  const typeColors = {
    seed: 'var(--primary)',
    water: 'var(--info)',
    transplant: 'var(--success)',
    harvest: 'var(--warning)',
    default: 'var(--text-muted)',
  };
  
  const color = typeColors[type] || typeColors.default;

  return (
    <div 
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl',
        'bg-[var(--surface-hover)] border-l-[3px]',
        'transition-all duration-200',
        'hover:bg-[var(--surface-active)]',
        className
      )}
      style={{ borderLeftColor: color }}
    >
      {/* Checkbox */}
      <button 
        onClick={onComplete}
        className="w-6 h-6 rounded-lg border-2 flex-shrink-0 
                   transition-all duration-200
                   hover:scale-110 active:scale-95"
        style={{ borderColor: color }}
      />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-[var(--text-primary)]">
          {task}
        </div>
        <div className="text-xs text-[var(--text-muted)]">{time}</div>
      </div>
      
      {/* Priority badge */}
      {priority === 'high' && (
        <span className="text-[10px] font-semibold px-2 py-1 rounded-md
                        bg-[var(--badge-danger-bg)] text-[var(--danger)]">
          HIGH
        </span>
      )}
    </div>
  );
}