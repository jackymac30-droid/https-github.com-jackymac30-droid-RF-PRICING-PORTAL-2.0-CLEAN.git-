import React from 'react';

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'header' | 'list';
  rows?: number;
}

export function LoadingSkeleton({ type = 'table', rows = 5 }: LoadingSkeletonProps) {
  if (type === 'table') {
    return (
      <div className="animate-pulse">
        <div className="bg-gray-200 h-12 rounded-t-lg mb-4"></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 mb-3">
            <div className="bg-gray-200 h-16 rounded flex-1"></div>
            <div className="bg-gray-200 h-16 rounded w-32"></div>
            <div className="bg-gray-200 h-16 rounded w-32"></div>
            <div className="bg-gray-200 h-16 rounded w-32"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (type === 'header') {
    return (
      <div className="animate-pulse">
        <div className="bg-gray-200 h-8 w-64 rounded mb-2"></div>
        <div className="bg-gray-200 h-4 w-96 rounded"></div>
      </div>
    );
  }

  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-gray-200 h-12 rounded-lg"></div>
      ))}
    </div>
  );
}
