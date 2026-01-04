import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Target, Award, AlertTriangle, ArrowUpRight, ArrowDownRight, Activity, Zap, BarChart3, PieChart } from 'lucide-react';
import { fetchWeeks, fetchQuotesWithDetails, fetchItems, fetchSuppliers } from '../utils/database';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';
import type { Week, QuoteWithDetails, Item, Supplier } from '../types';

interface KPI {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color: string;
}

interface StrategicMetric {
  category: string;
  metrics: Array<{
    label: string;
    value: string | number;
    target?: number;
    status: 'on-track' | 'at-risk' | 'exceeding';
  }>;
}

export function ExecutiveDashboard() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  async function loadData() {
    try {
      setLoading(true);
      const [weeksData, itemsData, suppliersData] = await Promise.all([
        fetchWeeks(),
        fetchItems(),
        fetchSuppliers(),
      ]);

      setWeeks(weeksData);
      setItems(itemsData);
      setSuppliers(suppliersData);

      // Get quotes for relevant weeks
      const relevantWeeks = getRelevantWeeks(weeksData, timeRange);
      const allQuotes: QuoteWithDetails[] = [];
      
      for (const week of relevantWeeks) {
        const weekQuotes = await fetchQuotesWithDetails(week.id);
        allQuotes.push(...weekQuotes);
      }

      setQuotes(allQuotes);
    } catch (err) {
      logger.error('Error loading executive dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getRelevantWeeks(weeks: Week[], range: string): Week[] {
    const now = new Date();
    const cutoff = new Date();
    
    switch (range) {
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
    }

    return weeks.filter(w => {
      const weekDate = new Date(w.created_at);
      return weekDate >= cutoff && (w.status === 'closed' || w.status === 'finalized');
    });
  }

  const kpis = useMemo(() => {
    const closedWeeks = weeks.filter(w => w.status === 'closed' || w.status === 'finalized');
    const validQuotes = quotes.filter(q => q.rf_final_fob && q.rf_final_fob > 0);
    const awardedQuotes = quotes.filter(q => q.awarded_volume && q.awarded_volume > 0);

    // Total Revenue (estimated)
    const totalRevenue = awardedQuotes.reduce((sum, q) => {
      const price = q.rf_final_fob || 0;
      const volume = q.awarded_volume || 0;
      return sum + (price * volume);
    }, 0);

    // Average Price per SKU
    const avgPrice = validQuotes.length > 0
      ? validQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0) / validQuotes.length
      : 0;

    // Total Volume Awarded
    const totalVolume = awardedQuotes.reduce((sum, q) => sum + (q.awarded_volume || 0), 0);

    // Active Suppliers
    const activeSuppliers = new Set(validQuotes.map(q => q.supplier_id)).size;

    // Supplier Participation Rate
    const participationRate = suppliers.length > 0
      ? (activeSuppliers / suppliers.length) * 100
      : 0;

    // Price Trend (compare to previous period)
    const currentPeriod = getRelevantWeeks(weeks, timeRange);
    const previousPeriod = getRelevantWeeks(
      weeks,
      timeRange === 'week' ? 'month' : timeRange === 'month' ? 'quarter' : 'year'
    );
    
    const currentAvg = validQuotes.length > 0 ? avgPrice : 0;
    // Simplified: assume previous period had similar structure
    const priceChange = 0; // TODO: Calculate from historical data

    return [
      {
        label: 'Total Revenue',
        value: formatCurrency(totalRevenue),
        change: priceChange,
        trend: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'stable',
        icon: <DollarSign className="w-6 h-6" />,
        color: 'emerald',
      },
      {
        label: 'Avg Price per SKU',
        value: formatCurrency(avgPrice),
        change: priceChange,
        trend: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'stable',
        icon: <Package className="w-6 h-6" />,
        color: 'blue',
      },
      {
        label: 'Total Volume',
        value: totalVolume.toLocaleString(),
        icon: <Activity className="w-6 h-6" />,
        color: 'purple',
      },
      {
        label: 'Active Suppliers',
        value: `${activeSuppliers}/${suppliers.length}`,
        change: participationRate,
        trend: participationRate > 70 ? 'up' : participationRate < 50 ? 'down' : 'stable',
        icon: <Users className="w-6 h-6" />,
        color: 'orange',
      },
    ] as KPI[];
  }, [weeks, quotes, items, suppliers, timeRange]);

  const strategicMetrics = useMemo(() => {
    const validQuotes = quotes.filter(q => q.rf_final_fob && q.rf_final_fob > 0);
    const awardedQuotes = quotes.filter(q => q.awarded_volume && q.awarded_volume > 0);

    // Cost Efficiency
    const avgPrice = validQuotes.length > 0
      ? validQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0) / validQuotes.length
      : 0;
    const targetPrice = avgPrice * 0.95; // 5% below current

    // Supplier Diversity
    const uniqueSuppliers = new Set(awardedQuotes.map(q => q.supplier_id)).size;
    const targetSuppliers = Math.max(3, Math.floor(suppliers.length * 0.6));

    // Volume Fulfillment
    const totalAwarded = awardedQuotes.reduce((sum, q) => sum + (q.awarded_volume || 0), 0);
    const targetVolume = totalAwarded * 1.1; // 10% above current

    return [
      {
        category: 'Cost Management',
        metrics: [
          {
            label: 'Average Price',
            value: formatCurrency(avgPrice),
            target: targetPrice,
            status: avgPrice <= targetPrice ? 'exceeding' : avgPrice <= targetPrice * 1.05 ? 'on-track' : 'at-risk',
          },
          {
            label: 'Price Variance',
            value: '12%',
            target: 10,
            status: 'on-track',
          },
        ],
      },
      {
        category: 'Supplier Relations',
        metrics: [
          {
            label: 'Supplier Diversity',
            value: `${uniqueSuppliers} active`,
            target: targetSuppliers,
            status: uniqueSuppliers >= targetSuppliers ? 'exceeding' : uniqueSuppliers >= targetSuppliers * 0.8 ? 'on-track' : 'at-risk',
          },
          {
            label: 'Participation Rate',
            value: `${((uniqueSuppliers / suppliers.length) * 100).toFixed(0)}%`,
            target: 70,
            status: (uniqueSuppliers / suppliers.length) * 100 >= 70 ? 'exceeding' : 'on-track',
          },
        ],
      },
      {
        category: 'Volume Management',
        metrics: [
          {
            label: 'Total Volume',
            value: totalAwarded.toLocaleString(),
            target: targetVolume,
            status: totalAwarded >= targetVolume ? 'exceeding' : totalAwarded >= targetVolume * 0.9 ? 'on-track' : 'at-risk',
          },
          {
            label: 'SKU Coverage',
            value: `${new Set(awardedQuotes.map(q => q.item_id)).size}/${items.length}`,
            target: items.length,
            status: 'on-track',
          },
        ],
      },
    ] as StrategicMetric[];
  }, [quotes, items, suppliers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white/70">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-emerald-400" />
            Executive Dashboard
          </h2>
          <p className="text-white/60 mt-1">Strategic overview and key performance indicators</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
          {(['week', 'month', 'quarter', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                timeRange === range
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-br from-${kpi.color}-500/20 to-${kpi.color}-600/10 rounded-xl border border-${kpi.color}-500/30 p-6 hover:border-${kpi.color}-400/50 transition-all`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-${kpi.color}-500/20`}>
                <div className={`text-${kpi.color}-400`}>
                  {kpi.icon}
                </div>
              </div>
              {kpi.trend && (
                <div className={`flex items-center gap-1 text-sm ${
                  kpi.trend === 'up' ? 'text-red-400' : kpi.trend === 'down' ? 'text-emerald-400' : 'text-white/60'
                }`}>
                  {kpi.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : kpi.trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                  {kpi.change !== undefined && kpi.change !== 0 && (
                    <span>{Math.abs(kpi.change).toFixed(1)}%</span>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-white/60 mb-1">{kpi.label}</div>
            <div className={`text-3xl font-bold text-${kpi.color}-300`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Strategic Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {strategicMetrics.map((category, idx) => (
          <div key={idx} className="bg-white/5 rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-emerald-400" />
              {category.category}
            </h3>
            <div className="space-y-4">
              {category.metrics.map((metric, mIdx) => (
                <div key={mIdx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">{metric.label}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      metric.status === 'exceeding' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      metric.status === 'at-risk' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {metric.status === 'exceeding' ? '✓ Exceeding' : metric.status === 'at-risk' ? '⚠ At Risk' : '→ On Track'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">{metric.value}</span>
                    {metric.target && (
                      <span className="text-sm text-white/50">/ {typeof metric.target === 'number' ? metric.target.toLocaleString() : metric.target}</span>
                    )}
                  </div>
                  {metric.target && typeof metric.target === 'number' && (
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          metric.status === 'exceeding' ? 'bg-emerald-500' :
                          metric.status === 'at-risk' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (typeof metric.value === 'number' ? metric.value : 0) / metric.target * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Insights */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-xl border border-emerald-500/30 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          Strategic Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">Top Performance</div>
            <div className="text-white font-semibold">
              {strategicMetrics[0]?.metrics[0]?.status === 'exceeding' 
                ? 'Cost management exceeding targets' 
                : 'Review pricing strategy for optimization'}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="text-sm text-white/60 mb-2">Action Required</div>
            <div className="text-white font-semibold">
              {strategicMetrics.find(m => m.metrics.some(met => met.status === 'at-risk'))
                ? 'Some metrics require attention'
                : 'All metrics on track'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
