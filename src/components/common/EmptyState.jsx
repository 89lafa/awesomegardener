import React from 'react';

export function EmptyState({ 
  icon = '🌱', 
  title = 'Nothing here yet', 
  message, 
  action 
}) {
  return (
    <div className="min-h-[300px] flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        {message && <p className="text-gray-600 mb-4">{message}</p>}
        {action}
      </div>
    </div>
  );
}