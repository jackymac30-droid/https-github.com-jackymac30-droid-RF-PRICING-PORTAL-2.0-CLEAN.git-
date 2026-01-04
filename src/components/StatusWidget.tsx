import React from 'react';
import { CheckCircle, Clock, AlertCircle, TrendingUp, Users } from 'lucide-react';

interface StatusWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: 'check' | 'clock' | 'alert' | 'trending' | 'users';
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatusWidget({ title, value, subtitle, icon, color, trend }: StatusWidgetProps) {
  const icons = {
    check: CheckCircle,
    clock: Clock,
    alert: AlertCircle,
    trending: TrendingUp,
    users: Users,
  };

  const colors = {
    green: {
      bg: 'from-green-500 to-emerald-500',
      icon: 'bg-green-100',
      iconColor: 'text-green-600',
      text: 'text-green-700',
    },
    blue: {
      bg: 'from-blue-500 to-cyan-500',
      icon: 'bg-blue-100',
      iconColor: 'text-blue-600',
      text: 'text-blue-700',
    },
    orange: {
      bg: 'from-orange-500 to-amber-500',
      icon: 'bg-orange-100',
      iconColor: 'text-orange-600',
      text: 'text-orange-700',
    },
    red: {
      bg: 'from-red-500 to-pink-500',
      icon: 'bg-red-100',
      iconColor: 'text-red-600',
      text: 'text-red-700',
    },
    purple: {
      bg: 'from-purple-500 to-indigo-500',
      icon: 'bg-purple-100',
      iconColor: 'text-purple-600',
      text: 'text-purple-700',
    },
  };

  const Icon = icons[icon];
  const colorScheme = colors[color];

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden hover-lift transition-smooth animate-scale-in">
      <div className={`bg-gradient-to-r ${colorScheme.bg} p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-white text-sm font-semibold uppercase tracking-wide mb-2 opacity-90">
              {title}
            </h3>
            <div className="flex items-baseline gap-3">
              <p className="text-4xl font-extrabold text-white">{value}</p>
              {trend && (
                <span className={`text-sm font-bold px-2 py-1 rounded ${trend.isPositive ? 'bg-white/30' : 'bg-black/20'} text-white`}>
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-white/80 text-sm mt-2 font-medium">{subtitle}</p>
            )}
          </div>
          <div className={`${colorScheme.icon} p-4 rounded-2xl shadow-lg`}>
            <Icon className={`w-10 h-10 ${colorScheme.iconColor}`} />
          </div>
        </div>
      </div>
      <div className="h-2 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-shimmer"></div>
    </div>
  );
}
