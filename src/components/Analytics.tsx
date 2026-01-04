import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TrendingUp, TrendingDown, ChevronDown, List, BarChart3, LineChart, DollarSign, Activity, ArrowUpRight, ArrowDownRight, Minus, PieChart, Gauge, Zap, Target, Award, TrendingUp as TrendUp, Sparkles } from 'lucide-react';
import { fetchWeeks, fetchItems, fetchQuotesWithDetails, fetchSuppliers } from '../utils/database';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';
import type { Week, Item, QuoteWithDetails, Supplier } from '../types';

interface HistoricalPrice {
  weekNumber: number;
  weekId: string;
  price: number;
  supplierId: string;
  supplierName: string;
}

interface SKUHistoricalData {
  item: Item;
  prices: HistoricalPrice[];
  bestPriceByWeek: Map<number, number>;
  avgPriceByWeek: Map<number, number>;
  suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    prices: number[];
    weeks: number[];
    avgPrice: number;
    volatility: number; // standard deviation
    consistency: number; // how often they're competitive
  }>;
}

interface PriceTrendChartProps {
  data: Array<{ week: number; price: number; label: string }>;
  height?: number;
}

function PriceTrendChart({ data, height = 200 }: PriceTrendChartProps) {
  if (data.length === 0) return null;

  const weeks = data.map(d => d.week);
  const prices = data.map(d => d.price);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;
  const padding = 50;
  const chartWidth = 600;
  const chartHeight = height;
  const chartId = `chart-${Math.random().toString(36).substr(2, 9)}`;

  const points = data.map((d, idx) => {
    const x = padding + (idx / (data.length - 1 || 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((d.price - minPrice) / range) * (chartHeight - padding * 2);
    return { x, y, ...d };
  });

  const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartWidth} height={chartHeight} className="min-w-full">
        <defs>
          <linearGradient id={`priceGradient-${chartId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`lineGradient-${chartId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id={`glow-${chartId}`}>
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + ratio * (chartHeight - padding * 2);
          const price = maxPrice - (ratio * range);
          return (
            <g key={idx}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padding - 12}
                y={y + 4}
                fill="rgba(255,255,255,0.5)"
                fontSize="11"
                textAnchor="end"
                fontWeight="500"
              >
                {formatCurrency(price)}
              </text>
            </g>
          );
        })}

        {/* Area under line */}
        <path
          d={`${pathData} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`}
          fill={`url(#priceGradient-${chartId})`}
        />

        {/* Line with gradient and glow */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#lineGradient-${chartId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#glow-${chartId})`}
        />

        {/* Data points with glow */}
        {points.map((point, idx) => (
          <g key={idx} className="group">
            <circle
              cx={point.x}
              cy={point.y}
              r="6"
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth="2.5"
              className="transition-all cursor-pointer group-hover:r-8"
              filter={`url(#glow-${chartId})`}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#34d399"
            />
            <text
              x={point.x}
              y={chartHeight - padding + 22}
              fill="rgba(255,255,255,0.7)"
              fontSize="11"
              textAnchor="middle"
              fontWeight="600"
            >
              W{point.week}
            </text>
            {/* Tooltip on hover */}
            <text
              x={point.x}
              y={point.y - 12}
              fill="white"
              fontSize="10"
              textAnchor="middle"
              className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              fontWeight="600"
            >
              {formatCurrency(point.price)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SupplierComparisonChart({ suppliers }: { suppliers: SKUHistoricalData['suppliers'] }) {
  if (suppliers.length === 0) return null;

  const maxPrice = Math.max(...suppliers.flatMap(s => s.prices));
  const minPrice = Math.min(...suppliers.flatMap(s => s.prices));
  const range = maxPrice - minPrice || 1;

  return (
    <div className="space-y-4">
      {suppliers.slice(0, 5).map((supplier, idx) => {
        const avgPrice = supplier.avgPrice;
        const barWidth = ((avgPrice - minPrice) / range) * 100;
        const isBest = idx === 0;

        return (
          <div key={supplier.supplier_id} className="group">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-28 text-sm text-white font-medium truncate">{supplier.supplier_name}</div>
              <div className="flex-1 relative h-8 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-700 ease-out ${
                    isBest 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/30' 
                      : 'bg-gradient-to-r from-white/25 to-white/15'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-3">
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(avgPrice)}
                  </span>
                </div>
              </div>
              <div className="w-20 text-xs text-white/60 text-right font-medium">
                ±{formatCurrency(supplier.volatility)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Supplier Win Rate Chart
function SupplierWinRateChart({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const supplierWins = useMemo(() => {
    const wins = new Map<string, number>();
    let totalSKUsWithWinners = 0;
    
    historicalData.forEach(sku => {
      // Only count SKUs with valid suppliers (prices > 0)
      const validSuppliers = sku.suppliers.filter(s => s.avgPrice > 0 && s.prices.length > 0);
      if (validSuppliers.length > 0) {
        const bestSupplier = validSuppliers[0]; // Already sorted by avgPrice
        wins.set(bestSupplier.supplier_id, (wins.get(bestSupplier.supplier_id) || 0) + 1);
        totalSKUsWithWinners++;
      }
    });
    
    if (totalSKUsWithWinners === 0) return [];
    
    return Array.from(wins.entries())
      .map(([id, count]) => {
        const supplier = historicalData
          .flatMap(s => s.suppliers)
          .find(s => s.supplier_id === id);
        return {
          name: supplier?.supplier_name || 'Unknown',
          wins: count,
          percentage: (count / totalSKUsWithWinners) * 100,
        };
      })
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);
  }, [historicalData]);

  if (supplierWins.length === 0) return null;

  const maxWins = Math.max(...supplierWins.map(s => s.wins));

  return (
    <div className="space-y-3">
      {supplierWins.map((supplier, idx) => {
        const barWidth = (supplier.wins / maxWins) * 100;
        const colors = [
          'from-emerald-500 to-emerald-400',
          'from-blue-500 to-blue-400',
          'from-purple-500 to-purple-400',
          'from-orange-500 to-orange-400',
          'from-pink-500 to-pink-400',
        ];
        
        return (
          <div key={supplier.name} className="group">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-32 text-sm text-white font-medium truncate">{supplier.name}</div>
              <div className="flex-1 relative h-7 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                <div
                  className={`h-full bg-gradient-to-r ${colors[idx]} transition-all duration-700 ease-out shadow-lg`}
                  style={{ width: `${barWidth}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-white">{supplier.wins} wins</span>
                  <span className="text-xs font-semibold text-white">{supplier.percentage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Category Price Comparison
function CategoryPriceChart({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const categoryData = useMemo(() => {
    const categories = new Map<string, { prices: number[]; skuCount: number }>();
    
    historicalData.forEach(sku => {
      // Use best prices from each week (more accurate than averaging all prices)
      const weekPrices = Array.from(sku.bestPriceByWeek.values());
      if (weekPrices.length > 0) {
        const existing = categories.get(sku.item.category) || { prices: [], skuCount: 0 };
        // Add average of best prices for this SKU
        const skuAvg = weekPrices.reduce((a, b) => a + b, 0) / weekPrices.length;
        existing.prices.push(skuAvg);
        existing.skuCount += 1;
        categories.set(sku.item.category, existing);
      }
    });

    return Array.from(categories.entries())
      .map(([category, data]) => ({
        category,
        avgPrice: data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : 0,
        count: data.skuCount,
      }))
      .filter(c => c.avgPrice > 0)
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [historicalData]);

  if (categoryData.length === 0) return null;

  const maxPrice = Math.max(...categoryData.map(c => c.avgPrice));
  const minPrice = Math.min(...categoryData.map(c => c.avgPrice));
  const range = maxPrice - minPrice || 1;

  return (
    <div className="space-y-3">
      {categoryData.map((cat, idx) => {
        const barWidth = ((cat.avgPrice - minPrice) / range) * 100;
        return (
          <div key={cat.category} className="group">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-28 text-sm text-white font-medium capitalize truncate">{cat.category}</div>
              <div className="flex-1 relative h-7 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/60 transition-all duration-700 ease-out"
                  style={{ width: `${barWidth}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-xs text-white/80">{cat.count} SKUs</span>
                  <span className="text-xs font-semibold text-white">{formatCurrency(cat.avgPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Price Range Chart (Min/Max/Avg over time) - Clean Design
function PriceRangeChart({ data }: { data: SKUHistoricalData[] }) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  
  const rangeData = useMemo(() => {
    const weekMap = new Map<number, { min: number; max: number; prices: number[]; skuCount: number }>();
    
    data.forEach(sku => {
      Array.from(sku.bestPriceByWeek.entries()).forEach(([week, price]) => {
        if (price && price > 0) {
          const existing = weekMap.get(week) || { 
            min: Infinity, 
            max: -Infinity, 
            prices: [] as number[],
            skuCount: 0,
          };
          existing.min = Math.min(existing.min, price);
          existing.max = Math.max(existing.max, price);
          existing.prices.push(price);
          existing.skuCount += 1;
          weekMap.set(week, existing);
        }
      });
    });

    return Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, weekData]) => {
        if (weekData.prices.length === 0) return null;
        return {
          week,
          min: weekData.min === Infinity ? 0 : weekData.min,
          max: weekData.max === -Infinity ? 0 : weekData.max,
          avg: weekData.prices.reduce((a, b) => a + b, 0) / weekData.prices.length,
          spread: (weekData.max === -Infinity || weekData.min === Infinity) 
            ? 0 
            : weekData.max - weekData.min,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [data]);

  if (rangeData.length === 0) return null;

  const maxPrice = Math.max(...rangeData.map(d => d.max));
  const minPrice = Math.min(...rangeData.map(d => d.min));
  const range = maxPrice - minPrice || 1;
  const width = 1000;
  const height = 320;
  const padding = { top: 30, right: 50, bottom: 40, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Build path strings for lines
  const avgPoints: string[] = [];
  const minPoints: string[] = [];
  const maxPoints: string[] = [];

  rangeData.forEach((d, idx) => {
    const x = padding.left + (idx / (rangeData.length - 1 || 1)) * chartWidth;
    const minY = padding.top + chartHeight - ((d.min - minPrice) / range) * chartHeight;
    const maxY = padding.top + chartHeight - ((d.max - minPrice) / range) * chartHeight;
    const avgY = padding.top + chartHeight - ((d.avg - minPrice) / range) * chartHeight;
    
    if (idx === 0) {
      minPoints.push(`M ${x} ${minY}`);
      maxPoints.push(`M ${x} ${maxY}`);
      avgPoints.push(`M ${x} ${avgY}`);
    } else {
      minPoints.push(`L ${x} ${minY}`);
      maxPoints.push(`L ${x} ${maxY}`);
      avgPoints.push(`L ${x} ${avgY}`);
    }
  });

  const hoveredData = hoveredWeek !== null ? rangeData.find(d => d.week === hoveredWeek) : null;
  const hoveredIndex = hoveredWeek !== null ? rangeData.findIndex(d => d.week === hoveredWeek) : -1;
  const hoveredX = hoveredIndex >= 0 ? padding.left + (hoveredIndex / (rangeData.length - 1 || 1)) * chartWidth : 0;

  return (
    <div className="relative w-full">
      <div className="w-full overflow-x-auto pb-2">
        <svg width={width} height={height} className="min-w-full" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="rangeFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
            </linearGradient>
          </defs>

          {/* Subtle grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padding.top + chartHeight - (ratio * chartHeight);
            const price = minPrice + (range * (1 - ratio));
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 12}
                  y={y + 4}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="11"
                  textAnchor="end"
                >
                  {formatCurrency(price)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {rangeData.length > 0 && (
            <path
              d={`M ${padding.left} ${padding.top + chartHeight} ${maxPoints.join(' ')} L ${width - padding.right} ${padding.top + chartHeight} Z`}
              fill="url(#rangeFill)"
            />
          )}

          {/* Min line - subtle */}
          <path
            d={minPoints.join(' ')}
            fill="none"
            stroke="rgba(239, 68, 68, 0.4)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Max line - subtle */}
          <path
            d={maxPoints.join(' ')}
            fill="none"
            stroke="rgba(59, 130, 246, 0.4)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Average line - prominent */}
          <path
            d={avgPoints.join(' ')}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover indicator line */}
          {hoveredWeek !== null && (
            <line
              x1={hoveredX}
              y1={padding.top}
              x2={hoveredX}
              y2={padding.top + chartHeight}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
          )}

          {/* Data points */}
          {rangeData.map((d, idx) => {
            const x = padding.left + (idx / (rangeData.length - 1 || 1)) * chartWidth;
            const minY = padding.top + chartHeight - ((d.min - minPrice) / range) * chartHeight;
            const maxY = padding.top + chartHeight - ((d.max - minPrice) / range) * chartHeight;
            const avgY = padding.top + chartHeight - ((d.avg - minPrice) / range) * chartHeight;
            const isHovered = hoveredWeek === d.week;

            return (
              <g key={d.week}>
                {/* Invisible hover area */}
                <rect
                  x={x - 20}
                  y={padding.top}
                  width={40}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredWeek(d.week)}
                  onMouseLeave={() => setHoveredWeek(null)}
                  className="cursor-pointer"
                />
                
                {/* Points - only show on hover */}
                {isHovered && (
                  <>
                    <circle cx={x} cy={minY} r="4" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={x} cy={maxY} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
                    <circle cx={x} cy={avgY} r="5" fill="#10b981" stroke="#fff" strokeWidth="2" />
                  </>
                )}

                {/* Week labels */}
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  fill={isHovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"}
                  fontSize="10"
                  fontWeight={isHovered ? "600" : "400"}
                  textAnchor="middle"
                  className="transition-colors duration-150"
                >
                  {d.week}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Clean tooltip */}
      {hoveredData && hoveredWeek !== null && (
        <div 
          className="absolute bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-10 pointer-events-none min-w-[160px]"
          style={{
            left: `${Math.min(Math.max(hoveredX - 80, 10), width - 180)}px`,
            top: '10px',
          }}
        >
          <div className="text-xs font-semibold text-white/90 mb-2.5">Week {hoveredData.week}</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Min</span>
              <span className="font-medium text-white">{formatCurrency(hoveredData.min)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Avg</span>
              <span className="font-semibold text-emerald-400">{formatCurrency(hoveredData.avg)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Max</span>
              <span className="font-medium text-white">{formatCurrency(hoveredData.max)}</span>
            </div>
            <div className="pt-1.5 mt-1.5 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Spread</span>
                <span className="font-medium text-white/80">{formatCurrency(hoveredData.spread)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Competitive Index Gauge with animated glow
function CompetitiveIndexGauge({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const competitiveIndex = useMemo(() => {
    let totalCompetitiveness = 0;
    let count = 0;

    historicalData.forEach(sku => {
      // Need at least 2 suppliers with valid prices
      const validSuppliers = sku.suppliers.filter(s => s.avgPrice > 0);
      if (validSuppliers.length >= 2) {
        const bestPrice = validSuppliers[0].avgPrice;
        const secondBest = validSuppliers[1].avgPrice;
        
        if (bestPrice > 0) {
          // Calculate price spread percentage
          const spread = ((secondBest - bestPrice) / bestPrice) * 100;
          // Lower spread = more competitive
          // Formula: 100 - (spread * 2) with max 100, min 0
          // If spread is 0% (tied), competitiveness = 100
          // If spread is 5%, competitiveness = 90
          // If spread is 10%, competitiveness = 80
          const competitiveness = Math.max(0, Math.min(100, 100 - (spread * 2)));
          totalCompetitiveness += competitiveness;
          count++;
        }
      }
    });

    return count > 0 ? totalCompetitiveness / count : 0;
  }, [historicalData]);

  const percentage = Math.round(competitiveIndex);
  const color = percentage >= 70 ? 'emerald' : percentage >= 40 ? 'yellow' : 'red';
  const gaugeId = `gauge-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg width="192" height="192" className="transform -rotate-90">
        <defs>
          <filter id={`glow-${gaugeId}`}>
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id={`gaugeGrad-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color === 'emerald' ? '#10b981' : color === 'yellow' ? '#eab308' : '#ef4444'} />
            <stop offset="100%" stopColor={color === 'emerald' ? '#34d399' : color === 'yellow' ? '#fde047' : '#f87171'} />
          </linearGradient>
        </defs>
        <circle
          cx="96"
          cy="96"
          r="80"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="12"
        />
        <circle
          cx="96"
          cy="96"
          r="80"
          fill="none"
          stroke={`url(#gaugeGrad-${gaugeId})`}
          strokeWidth="12"
          strokeDasharray={`${(percentage / 100) * 502.4} 502.4`}
          strokeLinecap="round"
          className="transition-all duration-1000"
          filter={`url(#glow-${gaugeId})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-4xl font-bold ${
          color === 'emerald' ? 'text-emerald-400' : color === 'yellow' ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {percentage}
        </div>
        <div className="text-xs text-white/60 mt-1">Competitive</div>
      </div>
    </div>
  );
}

// Supplier Performance Heatmap
function SupplierHeatmap({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const heatmapData = useMemo(() => {
    const supplierMap = new Map<string, { name: string; scores: number[]; skuSet: Set<string> }>();
    
    historicalData.forEach(sku => {
      // Only count suppliers that actually have prices
      const suppliersWithPrices = sku.suppliers.filter(s => s.prices.length > 0 && s.avgPrice > 0);
      suppliersWithPrices.forEach((supplier, rank) => {
        const existing = supplierMap.get(supplier.supplier_id) || { 
          name: supplier.supplier_name, 
          scores: [],
          skuSet: new Set<string>(),
        };
        // Score: 100 for rank 1, 80 for rank 2, 60 for rank 3, etc.
        const score = Math.max(0, 100 - (rank * 20));
        existing.scores.push(score);
        existing.skuSet.add(sku.item.id);
        supplierMap.set(supplier.supplier_id, existing);
      });
    });

    return Array.from(supplierMap.entries())
      .map(([id, data]) => ({
        id,
        name: data.name,
        avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
        totalSKUs: data.skuSet.size,
      }))
      .filter(s => s.totalSKUs > 0 && s.avgScore > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);
  }, [historicalData]);

  if (heatmapData.length === 0) return null;

  const maxScore = Math.max(...heatmapData.map(d => d.avgScore));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {heatmapData.map((supplier) => {
        const intensity = (supplier.avgScore / maxScore) * 100;
        const opacity = 0.3 + (intensity / 100) * 0.7;
        
        return (
          <div
            key={supplier.id}
            className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg border border-emerald-500/30 p-4 hover:scale-105 transition-all duration-300 group cursor-pointer"
            style={{
              background: `linear-gradient(135deg, rgba(16, 185, 129, ${opacity}) 0%, rgba(5, 150, 105, ${opacity * 0.7}) 100%)`,
            }}
          >
            <div className="text-xs text-white/60 mb-1 truncate">{supplier.name}</div>
            <div className="text-2xl font-bold text-emerald-300">{supplier.avgScore.toFixed(0)}</div>
            <div className="text-xs text-white/50 mt-1">{supplier.totalSKUs} SKUs</div>
            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${intensity}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Volatility by Category - Bar Chart (with CONV/ORG breakdown)
function VolatilityByCategory({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const volatilityData = useMemo(() => {
    // Map: category -> { conv: {...}, org: {...} }
    const categories = new Map<string, { 
      conv: { volatilities: number[]; skuCount: number };
      org: { volatilities: number[]; skuCount: number };
    }>();
    
    historicalData.forEach(sku => {
      // Determine if organic or conventional
      const isOrganic = sku.item.organic_flag?.toLowerCase().includes('org') || 
                       sku.item.organic_flag?.toLowerCase().includes('organic');
      const flag = isOrganic ? 'org' : 'conv';
      
      // Only include suppliers with valid volatility data
      const validVols = sku.suppliers
        .filter(s => s.volatility >= 0 && s.prices.length > 0)
        .map(s => s.volatility);
      
      if (validVols.length > 0) {
        const avgVol = validVols.reduce((a, b) => a + b, 0) / validVols.length;
        const existing = categories.get(sku.item.category) || { 
          conv: { volatilities: [], skuCount: 0 },
          org: { volatilities: [], skuCount: 0 },
        };
        
        existing[flag].volatilities.push(avgVol);
        existing[flag].skuCount += 1;
        categories.set(sku.item.category, existing);
      }
    });

    // Flatten into array with CONV/ORG distinction
    const result: Array<{
      category: string;
      flag: 'CONV' | 'ORG';
      volatility: number;
      skuCount: number;
    }> = [];

    categories.forEach((data, category) => {
      // Add CONV entry
      if (data.conv.volatilities.length > 0) {
        result.push({
          category,
          flag: 'CONV',
          volatility: data.conv.volatilities.reduce((a, b) => a + b, 0) / data.conv.volatilities.length,
          skuCount: data.conv.skuCount,
        });
      }
      
      // Add ORG entry
      if (data.org.volatilities.length > 0) {
        result.push({
          category,
          flag: 'ORG',
          volatility: data.org.volatilities.reduce((a, b) => a + b, 0) / data.org.volatilities.length,
          skuCount: data.org.skuCount,
        });
      }
    });

    return result
      .filter(c => c.volatility > 0)
      .sort((a, b) => {
        // Sort by category first, then by volatility
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return b.volatility - a.volatility;
      });
  }, [historicalData]);

  if (volatilityData.length === 0) return null;

  const maxVol = Math.max(...volatilityData.map(d => d.volatility));

  // Group by category for display
  const groupedByCategory = new Map<string, typeof volatilityData>();
  volatilityData.forEach(item => {
    const existing = groupedByCategory.get(item.category) || [];
    existing.push(item);
    groupedByCategory.set(item.category, existing);
  });

  return (
    <div className="space-y-4">
      {Array.from(groupedByCategory.entries()).map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="text-sm font-semibold text-white/90 capitalize mb-2">{category}</div>
          {items.map((item, idx) => {
            const barWidth = (item.volatility / maxVol) * 100;
            const intensity = barWidth / 100;
            const isOrg = item.flag === 'ORG';
            
            return (
              <div key={`${category}-${item.flag}-${idx}`} className="group">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-20 flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      isOrg 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {item.flag}
                    </span>
                  </div>
                  <div className="flex-1 relative h-7 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                    <div
                      className={`h-full bg-gradient-to-r transition-all duration-700 ease-out shadow-lg ${
                        isOrg
                          ? 'from-emerald-500/80 to-emerald-400/80'
                          : 'from-orange-500/80 to-orange-400/80'
                      }`}
                      style={{ 
                        width: `${barWidth}%`,
                        opacity: 0.5 + (intensity * 0.5),
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs text-white/70">{item.skuCount} SKUs</span>
                      <span className="text-xs font-semibold text-white">{formatCurrency(item.volatility)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Price Momentum Indicator with Conv/Org
function PriceMomentumChart({ historicalData }: { historicalData: SKUHistoricalData[] }) {
  const momentumData = useMemo(() => {
    return historicalData
      .map(sku => {
        const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
        if (weeks.length < 3) return null;
        
        const firstPrice = sku.bestPriceByWeek.get(weeks[0]);
        const midIndex = Math.floor(weeks.length / 2);
        const midPrice = sku.bestPriceByWeek.get(weeks[midIndex]);
        const lastPrice = sku.bestPriceByWeek.get(weeks[weeks.length - 1]);
        
        // Validate all prices exist and are > 0
        if (!firstPrice || !midPrice || !lastPrice || 
            firstPrice <= 0 || midPrice <= 0 || lastPrice <= 0) {
          return null;
        }
        
        // Calculate percentage changes
        const earlyChange = ((midPrice - firstPrice) / firstPrice) * 100;
        const lateChange = ((lastPrice - midPrice) / midPrice) * 100;
        // Momentum = difference between late and early change rates
        // Positive = accelerating upward, Negative = decelerating/downward
        const momentum = lateChange - earlyChange;
        
        const isOrganic = sku.item.organic_flag?.toLowerCase().includes('org') || 
                         sku.item.organic_flag?.toLowerCase().includes('organic');
        const flag = isOrganic ? 'ORG' : 'CONV';
        
        return {
          name: sku.item.name,
          momentum,
          earlyChange,
          lateChange,
          flag,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))
      .slice(0, 10);
  }, [historicalData]);

  if (momentumData.length === 0) return null;

  const maxMomentum = Math.max(...momentumData.map(d => Math.abs(d.momentum)));

  return (
    <div className="space-y-2">
      {momentumData.map((item) => {
        const isPositive = item.momentum > 0;
        const barWidth = (Math.abs(item.momentum) / maxMomentum) * 100;
        const isOrg = item.flag === 'ORG';
        
        return (
          <div key={item.name} className="group">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-40">
                <span className="text-xs text-white font-medium truncate">{item.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isOrg 
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' 
                    : 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                }`}>
                  {item.flag}
                </span>
              </div>
              <div className="flex-1 relative h-6 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                <div
                  className={`h-full transition-all duration-700 ease-out ${
                    isPositive
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className="text-xs font-semibold text-white">
                    {isPositive ? '↑' : '↓'} {Math.abs(item.momentum).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Analytics() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'suppliers'>('overview');
  const [historicalData, setHistoricalData] = useState<SKUHistoricalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (weeks.length > 0) {
      calculateHistoricalAnalytics();
    }
  }, [weeks, calculateHistoricalAnalytics]);

  async function loadData() {
    try {
      const weeksData = await fetchWeeks();
      const closedWeeks = weeksData.filter(w => w.status === 'closed' || w.status === 'finalized');
      setWeeks(closedWeeks.sort((a, b) => a.week_number - b.week_number));
    } catch (err) {
      logger.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  const calculateHistoricalAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchItems();
      const allData: SKUHistoricalData[] = [];

      // Only process closed/finalized weeks (complete data only)
      // This ensures all calculations use actual final prices, not incomplete data
      const validWeeks = weeks.filter(w => w.status === 'closed' || w.status === 'finalized');
      
      if (validWeeks.length === 0) {
        logger.debug('No closed/finalized weeks found for analytics');
        logger.warn('Analytics requires closed or finalized weeks. Please seed the database or close some weeks.');
        setHistoricalData([]);
        setLoading(false);
        return;
      }

      logger.debug(`Calculating analytics for ${validWeeks.length} weeks, ${items.length} items`);

      // Fetch quotes for all weeks in parallel (better than sequential, uses existing tested code)
      const quotesPromises = validWeeks.map(week => fetchQuotesWithDetails(week.id));
      const quotesResults = await Promise.all(quotesPromises);
      
      // Group quotes by week_id for faster lookup
      const quotesByWeek = new Map<string, QuoteWithDetails[]>();
      validWeeks.forEach((week, index) => {
        quotesByWeek.set(week.id, quotesResults[index] || []);
      });

      for (const item of items) {
        const prices: HistoricalPrice[] = [];
        const bestPriceByWeek = new Map<number, number>();
        const avgPriceByWeek = new Map<number, number>();
        const supplierMap = new Map<string, SupplierPriceData>();

        // Collect all pricing data across all weeks (only closed/finalized)
        for (const week of validWeeks) {
          const quotes = quotesByWeek.get(week.id) || [];
          const itemQuotes = quotes.filter(q => q.item_id === item.id && q.supplier);

          if (itemQuotes.length === 0) continue;

          const weekPrices: number[] = [];
          
          for (const quote of itemQuotes) {
            // Priority: rf_final_fob > supplier_revised_fob > supplier_fob
            // Use nullish coalescing to properly handle 0 values
            const price = quote.rf_final_fob ?? quote.supplier_revised_fob ?? quote.supplier_fob;
            if (price !== null && price !== undefined && price > 0) {
              weekPrices.push(price);
              
              prices.push({
                weekNumber: week.week_number,
                weekId: week.id,
                price,
                supplierId: quote.supplier_id,
                supplierName: quote.supplier?.name || 'Unknown',
              });

              // Track supplier prices by week for accurate consistency calculation
              const existing = supplierMap.get(quote.supplier_id);
              if (existing) {
                existing.prices.push(price);
                existing.weeks.push(week.week_number);
                // Store price by week for consistency check
                if (!existing.pricesByWeek) existing.pricesByWeek = new Map();
                existing.pricesByWeek.set(week.week_number, price);
              } else {
                const pricesByWeek = new Map<number, number>();
                pricesByWeek.set(week.week_number, price);
                supplierMap.set(quote.supplier_id, {
                  prices: [price],
                  weeks: [week.week_number],
                  pricesByWeek,
                });
              }
            }
          }

          if (weekPrices.length > 0) {
            bestPriceByWeek.set(week.week_number, Math.min(...weekPrices));
            avgPriceByWeek.set(week.week_number, weekPrices.reduce((a, b) => a + b, 0) / weekPrices.length);
          }
        }

        // Calculate supplier statistics
        const suppliers = Array.from(supplierMap.entries())
          .filter(([_, data]) => data.prices.length > 0) // Only suppliers with valid prices
          .map(([supplierId, data]) => {
            const supplier = prices.find(p => p.supplierId === supplierId);
            
            // Calculate average price (ensure we have data)
            if (data.prices.length === 0) return null;
            const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
            
            // Calculate volatility (standard deviation)
            // Use sample standard deviation (n-1) for better accuracy with small samples
            let volatility = 0;
            if (data.prices.length > 1) {
              const variance = data.prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / (data.prices.length - 1);
              volatility = Math.sqrt(variance);
            }
            
            // Consistency: how often they're within 5% of best price
            let competitiveCount = 0;
            let totalWeeksChecked = 0;
            if (data.pricesByWeek) {
              data.pricesByWeek.forEach((price, weekNum) => {
                const bestPrice = bestPriceByWeek.get(weekNum);
                if (bestPrice && bestPrice > 0 && price > 0) {
                  totalWeeksChecked++;
                  if (price <= bestPrice * 1.05) {
                    competitiveCount++;
                  }
                }
              });
            }
            const consistency = totalWeeksChecked > 0 ? (competitiveCount / totalWeeksChecked) * 100 : 0;

            return {
              supplier_id: supplierId,
              supplier_name: supplier?.supplierName || 'Unknown',
              prices: data.prices,
              weeks: data.weeks,
              avgPrice,
              volatility,
              consistency,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        suppliers.sort((a, b) => a.avgPrice - b.avgPrice);

        if (prices.length > 0) {
          allData.push({
            item,
            prices,
            bestPriceByWeek,
            avgPriceByWeek,
            suppliers,
          });
        }
      }

      setHistoricalData(allData);
    } catch (err) {
      logger.error('Error calculating historical analytics:', err);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  }, [weeks]);

  // Summary metrics - all calculations verified for accuracy
  const summaryMetrics = useMemo(() => {
    if (historicalData.length === 0) return null;

    let totalPriceChange = 0;
    let priceIncreaseCount = 0;
    let priceDecreaseCount = 0;
    let priceNoChangeCount = 0;
    let totalVolatility = 0;
    let skusWithPriceChange = 0;
    let skusWithVolatility = 0;
    let totalValidSuppliers = 0;

    historicalData.forEach(sku => {
      const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
      if (weeks.length >= 2) {
        const firstPrice = sku.bestPriceByWeek.get(weeks[0]);
        const lastPrice = sku.bestPriceByWeek.get(weeks[weeks.length - 1]);
        
        // Validate both prices exist and are valid
        if (firstPrice && lastPrice && firstPrice > 0 && lastPrice > 0) {
          const change = ((lastPrice - firstPrice) / firstPrice) * 100;
          totalPriceChange += change;
          skusWithPriceChange++;
          
          // Use threshold to account for rounding
          if (change > 0.01) {
            priceIncreaseCount++;
          } else if (change < -0.01) {
            priceDecreaseCount++;
          } else {
            priceNoChangeCount++;
          }
        }
      }

      // Calculate average volatility (only for suppliers with valid data)
      const validSuppliers = sku.suppliers.filter(s => s.volatility >= 0 && s.prices.length > 0);
      if (validSuppliers.length > 0) {
        const avgVol = validSuppliers.reduce((sum, s) => sum + s.volatility, 0) / validSuppliers.length;
        totalVolatility += avgVol;
        totalValidSuppliers += validSuppliers.length;
        skusWithVolatility++;
      }
    });

    return {
      totalSKUs: historicalData.length,
      avgPriceChange: skusWithPriceChange > 0 ? totalPriceChange / skusWithPriceChange : 0,
      priceIncreaseCount,
      priceDecreaseCount,
      priceNoChangeCount,
      avgVolatility: skusWithVolatility > 0 ? totalVolatility / skusWithVolatility : 0,
      totalWeeks: weeks.length,
      skusWithPriceChange,
      skusWithVolatility,
      totalValidSuppliers,
    };
  }, [historicalData, weeks]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/70">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Empty state: no closed weeks
  if (weeks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <LineChart className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Historical Data Available</h3>
          <p className="text-white/60 mb-4">
            Analytics requires closed or finalized weeks with pricing data. Please seed the database or close some weeks to generate analytics.
          </p>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-left text-sm text-white/70">
            <p className="font-semibold mb-2">To get started:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Click "Seed Database" to populate with sample data</li>
              <li>Or close weeks after completing pricing workflows</li>
              <li>Analytics will automatically appear once data is available</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Empty state: no historical data calculated
  if (historicalData.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Analytics Data</h3>
          <p className="text-white/60 mb-4">
            Found {weeks.length} closed week(s), but no pricing data was found. Please ensure quotes exist for these weeks.
          </p>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-left text-sm text-white/70">
            <p className="font-semibold mb-2">Debug Info:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{weeks.length} closed week(s) found</li>
              <li>No quotes with pricing data found</li>
              <li>Try seeding the database to populate sample data</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
              <LineChart className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-white">Pricing Analytics</h2>
          </div>
          <p className="text-white/60 ml-14">Historical pricing intelligence across {weeks.length} weeks</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div className="text-sm text-white/60 mb-1 font-medium">Total SKUs Tracked</div>
            <div className="text-3xl font-bold text-white">{summaryMetrics.totalSKUs}</div>
            <div className="text-xs text-white/50 mt-2">Across {summaryMetrics.totalWeeks} weeks</div>
          </div>
          
          <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-orange-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-500/20 rounded-lg group-hover:bg-orange-500/30 transition-colors">
                <Activity className="w-5 h-5 text-orange-400" />
              </div>
            </div>
            <div className="text-sm text-white/60 mb-1 font-medium">Price Increases</div>
            <div className="text-3xl font-bold text-white">{summaryMetrics.priceIncreaseCount}</div>
            <div className="text-xs text-white/50 mt-2">
              {summaryMetrics.priceDecreaseCount} decreases • {summaryMetrics.priceNoChangeCount || 0} stable
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <DollarSign className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div className="text-sm text-white/60 mb-1 font-medium">Avg Volatility</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(summaryMetrics.avgVolatility)}</div>
            <div className="text-xs text-white/50 mt-2">Price variance</div>
          </div>
        </div>
      )}

      {/* Futuristic Stock Ticker */}
      {historicalData.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-white">Live Price Changes</h3>
            <div className="text-xs text-white/50">
              {historicalData.filter(sku => {
                const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
                return weeks.length >= 2;
              }).length} SKUs
            </div>
          </div>
          <div className="bg-gradient-to-r from-white/5 via-white/3 to-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3 overflow-hidden relative">
            <div className="flex gap-3 animate-ticker-scroll" style={{ width: 'max-content' }}>
              {/* Duplicate for seamless loop */}
              {[...historicalData, ...historicalData]
                .filter(sku => {
                  const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
                  return weeks.length >= 2;
                })
                .map((sku, idx) => {
                  const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
                  const firstPrice = sku.bestPriceByWeek.get(weeks[0]) || 0;
                  const lastPrice = sku.bestPriceByWeek.get(weeks[weeks.length - 1]) || 0;
                  const change = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
                  const isIncrease = change > 0.01;
                  const isDecrease = change < -0.01;

                  return (
                    <div
                      key={`${sku.item.id}-${idx}`}
                      className={`flex items-center gap-4 px-4 py-2 rounded-lg border min-w-fit whitespace-nowrap ${
                        isIncrease
                          ? 'bg-red-500/10 border-red-500/30'
                          : isDecrease
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {/* SKU Name */}
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{sku.item.name}</span>
                        <span className="text-xs text-white/50">•</span>
                        <span className="text-xs text-white/50">{sku.item.pack_size}</span>
                      </div>

                      {/* Price Change */}
                      <div className={`flex items-center gap-1.5 font-mono ${
                        isIncrease ? 'text-red-400' : isDecrease ? 'text-emerald-400' : 'text-white/60'
                      }`}>
                        {isIncrease ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : isDecrease ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                        <span className="text-sm font-bold">{Math.abs(change).toFixed(1)}%</span>
                      </div>

                      {/* Prices */}
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-white/40 line-through">{formatCurrency(firstPrice)}</span>
                        <span className="text-white/60">→</span>
                        <span className="text-white font-semibold">{formatCurrency(lastPrice)}</span>
                      </div>

                      {/* Week Range */}
                      <div className="text-xs text-white/40 font-mono">
                        W{weeks[0]}-{weeks[weeks.length - 1]}
                      </div>

                      {/* Supplier Count */}
                      <div className="text-xs text-white/40">
                        {sku.suppliers.length} sup
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => { setActiveTab('overview'); setSelectedItem(null); }}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-white/60 border-transparent hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'suppliers'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-white/60 border-transparent hover:text-white'
          }`}
        >
          Supplier Performance
        </button>
      </div>

      {/* Content */}
      <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Competitive Index & Key Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Competitive Index Gauge */}
              <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                    <Gauge className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Market Competitiveness</h4>
                </div>
                <CompetitiveIndexGauge historicalData={historicalData} />
                <p className="text-xs text-white/60 text-center mt-4">
                  Higher score = more competitive pricing
                </p>
              </div>

              {/* Supplier Win Rate */}
              <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Supplier Win Rate</h4>
                </div>
                <SupplierWinRateChart historicalData={historicalData} />
                <p className="text-xs text-white/60 mt-4">
                  Top suppliers by best price wins
                </p>
              </div>

              {/* Category Comparison */}
              <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-purple-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-purple-500/20 rounded-lg">
                    <PieChart className="w-5 h-5 text-purple-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Category Prices</h4>
                </div>
                <CategoryPriceChart historicalData={historicalData} />
                <p className="text-xs text-white/60 mt-4">
                  Average prices by category
                </p>
              </div>
            </div>

            {/* Advanced Visualizations Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Supplier Performance Heatmap */}
              <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                    <Target className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Supplier Performance Heatmap</h4>
                </div>
                <SupplierHeatmap historicalData={historicalData} />
                <p className="text-xs text-white/60 mt-4">
                  Performance score based on ranking across all SKUs
                </p>
              </div>

              {/* Volatility by Category */}
              <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-orange-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-orange-500/20 rounded-lg">
                    <Activity className="w-5 h-5 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">Volatility by Category</h4>
                </div>
                <VolatilityByCategory historicalData={historicalData} />
                <p className="text-xs text-white/60 mt-4">
                  Price volatility across product categories
                </p>
              </div>
            </div>

            {/* Price Momentum */}
            <div className="bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-red-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-red-500/20 rounded-lg">
                  <Zap className="w-5 h-5 text-red-400" />
                </div>
                <h4 className="text-lg font-semibold text-white">Price Momentum</h4>
                <div className="ml-auto flex items-center gap-4 text-xs text-white/60">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <span>Accelerating</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span>Decelerating</span>
                  </div>
                </div>
              </div>
              <PriceMomentumChart historicalData={historicalData} />
              <p className="text-xs text-white/60 mt-4">
                Shows if prices are accelerating up or slowing down
              </p>
            </div>

            {/* Price Range Chart */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-orange-400" />
                <h4 className="text-lg font-semibold text-white">Price Range Over Time</h4>
              </div>
              <div className="flex items-center gap-4 mb-4 text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Min</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span>Avg</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Max</span>
                </div>
              </div>
              <PriceRangeChart data={historicalData} />
            </div>

            {/* Price Trends by SKU */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Price Trends by SKU</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {historicalData.slice(0, 6).map((sku) => {
                  const trendData = Array.from(sku.bestPriceByWeek.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([week, price]) => ({
                      week,
                      price,
                      label: `Week ${week}`,
                    }));

                  const weeks = Array.from(sku.bestPriceByWeek.keys()).sort();
                  const firstPrice = sku.bestPriceByWeek.get(weeks[0]) || 0;
                  const lastPrice = sku.bestPriceByWeek.get(weeks[weeks.length - 1]) || 0;
                  const change = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;

                  return (
                    <div key={sku.item.id} className="bg-white/5 rounded-lg border border-white/10 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-white">{sku.item.name}</h4>
                          <p className="text-sm text-white/60">{sku.item.pack_size} • {sku.item.category}</p>
                        </div>
                        <div className={`text-right ${change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          <div className="text-sm font-medium">
                            {change >= 0 ? <TrendingUp className="w-4 h-4 inline" /> : <TrendingDown className="w-4 h-4 inline" />}
                            {' '}{Math.abs(change).toFixed(1)}%
                          </div>
                          <div className="text-xs text-white/60">
                            {formatCurrency(lastPrice)}
                          </div>
                        </div>
                      </div>
                      {trendData.length > 1 && (
                        <PriceTrendChart data={trendData} height={150} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4">Supplier Performance Across All SKUs</h3>
            <div className="text-white/60 text-sm mb-4">
              Average pricing, volatility, and consistency metrics
            </div>
            {/* TODO: Aggregate supplier data across all SKUs */}
            <div className="text-white/60 text-center py-12">
              Supplier aggregation view coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
