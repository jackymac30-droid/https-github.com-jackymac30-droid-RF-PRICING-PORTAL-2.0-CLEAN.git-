import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface AdvancedChartProps {
  data: DataPoint[];
  type: 'bar' | 'line' | 'area';
  title: string;
  subtitle?: string;
  showTrend?: boolean;
}

export function AdvancedChart({ data, type, title, subtitle, showTrend }: AdvancedChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;

  const trend = data.length > 1 ? data[data.length - 1].value - data[0].value : 0;
  const trendPercent = data.length > 1 ? ((trend / data[0].value) * 100) : 0;

  const getBarHeight = (value: number) => {
    return ((value - minValue) / (maxValue - minValue)) * 100;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
        {showTrend && data.length > 1 && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {trend >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span className="font-bold text-lg">
              {trend >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {type === 'bar' && (
        <div className="space-y-4">
          {data.map((point, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{point.label}</span>
                <span className="font-bold text-gray-900">{point.value.toFixed(2)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    point.color || 'bg-gradient-to-r from-emerald-500 to-lime-500'
                  }`}
                  style={{ width: `${getBarHeight(point.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {type === 'line' && (
        <div className="relative h-64">
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
            </defs>

            {data.map((_, idx) => (
              <line
                key={`grid-${idx}`}
                x1="0"
                y1={200 - (idx * 200 / (data.length - 1 || 1))}
                x2="400"
                y2={200 - (idx * 200 / (data.length - 1 || 1))}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}

            <polyline
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={data
                .map((point, idx) => {
                  const x = (idx / (data.length - 1 || 1)) * 400;
                  const y = 200 - (getBarHeight(point.value) / 100) * 200;
                  return `${x},${y}`;
                })
                .join(' ')}
            />

            {data.map((point, idx) => {
              const x = (idx / (data.length - 1 || 1)) * 400;
              const y = 200 - (getBarHeight(point.value) / 100) * 200;
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="6"
                  fill="#10b981"
                  className="hover:r-8 transition-all cursor-pointer"
                />
              );
            })}
          </svg>

          <div className="flex justify-between mt-4">
            {data.map((point, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xs text-gray-600 font-medium">{point.label}</div>
                <div className="text-sm font-bold text-gray-900 mt-1">{point.value.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {type === 'area' && (
        <div className="relative h-64">
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            <polygon
              fill="url(#areaGradient)"
              points={`0,200 ${data
                .map((point, idx) => {
                  const x = (idx / (data.length - 1 || 1)) * 400;
                  const y = 200 - (getBarHeight(point.value) / 100) * 200;
                  return `${x},${y}`;
                })
                .join(' ')} 400,200`}
            />

            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              points={data
                .map((point, idx) => {
                  const x = (idx / (data.length - 1 || 1)) * 400;
                  const y = 200 - (getBarHeight(point.value) / 100) * 200;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>

          <div className="flex justify-between mt-4">
            {data.map((point, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xs text-gray-600 font-medium">{point.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <div className="text-xs text-gray-600 font-medium mb-1">Min</div>
          <div className="text-lg font-bold text-gray-900">{minValue.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 font-medium mb-1">Average</div>
          <div className="text-lg font-bold text-blue-600">{avgValue.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600 font-medium mb-1">Max</div>
          <div className="text-lg font-bold text-gray-900">{maxValue.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
