import React, { useMemo, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Target, ArrowUpRight, ArrowDownRight, Sparkles, BarChart3, Filter, ChevronDown, ChevronUp, Zap, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { fetchCompleteHistoricalData, formatForPredictiveAnalytics, type CompleteHistoricalData } from '../utils/historicalData';
import { logger } from '../utils/logger';
import type { QuoteWithDetails, Item } from '../types';

interface PredictiveAnalyticsProps {
  quotes: QuoteWithDetails[];
  items: Item[];
  historicalData: Array<{
    item_id: string;
    weeks: number[];
    prices: number[];
    trend: 'up' | 'down' | 'stable';
    volatility: number;
  }>;
}

interface PriceForecast {
  itemId: string;
  itemName: string;
  category: string;
  organicFlag: string | null;
  currentPrice: number;
  forecastPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  factors: string[];
  historicalPrices: number[];
  historicalWeeks: number[];
  volatility: number;
}

// Trend Chart Component
function ForecastTrendChart({ forecast, historicalData }: { forecast: PriceForecast; historicalData: CompleteHistoricalData | undefined }) {
  if (!historicalData || historicalData.prices.length < 2) return null;

  const prices = [...historicalData.prices, forecast.forecastPrice];
  const weeks = [...historicalData.weeks, Math.max(...historicalData.weeks) + 1];
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const range = maxPrice - minPrice || 1;
  const width = 280;
  const height = 100;
  const padding = 20;

  const points = prices.map((price, idx) => {
    const x = padding + (idx / (prices.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((price - minPrice) / range) * (height - padding * 2);
    return { x, y, price, isForecast: idx === prices.length - 1 };
  });

  const historicalPath = points.slice(0, -1).map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const forecastPoint = points[points.length - 1];
  const isUpward = forecast.forecastPrice > forecast.currentPrice;

  return (
    <div className="relative">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`forecastGradient-${forecast.itemId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isUpward ? "#ef4444" : "#10b981"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUpward ? "#ef4444" : "#10b981"} stopOpacity="0" />
          </linearGradient>
          <filter id={`forecastGlow-${forecast.itemId}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Historical line */}
        <path
          d={historicalPath}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Forecast line (dashed) */}
        <line
          x1={points[points.length - 2].x}
          y1={points[points.length - 2].y}
          x2={forecastPoint.x}
          y2={forecastPoint.y}
          stroke={isUpward ? "#ef4444" : "#10b981"}
          strokeWidth="2"
          strokeDasharray="4,4"
          opacity="0.6"
        />
        
        {/* Forecast point */}
        <circle
          cx={forecastPoint.x}
          cy={forecastPoint.y}
          r="4"
          fill={isUpward ? "#ef4444" : "#10b981"}
          filter={`url(#forecastGlow-${forecast.itemId})`}
        />
        
        {/* Historical points */}
        {points.slice(0, -1).map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="rgba(255,255,255,0.6)"
          />
        ))}
      </svg>
    </div>
  );
}

// Confidence Gauge Component
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const circumference = 2 * Math.PI * 18;
  const offset = circumference - (confidence / 100) * circumference;
  const color = confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-12 h-12">
      <svg className="transform -rotate-90" width="48" height="48">
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{confidence}%</span>
      </div>
    </div>
  );
}

export function PredictiveAnalytics({ quotes, items, historicalData: propHistoricalData }: PredictiveAnalyticsProps) {
  const [completeHistoricalData, setCompleteHistoricalData] = useState<CompleteHistoricalData[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [filterTrend, setFilterTrend] = useState<'all' | 'up' | 'down' | 'stable'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'change' | 'confidence' | 'name'>('change');
  const [expandedForecasts, setExpandedForecasts] = useState<Set<string>>(new Set());

  // Fetch complete historical data on mount
  useEffect(() => {
    async function loadHistoricalData() {
      try {
        setLoadingHistorical(true);
        const data = await fetchCompleteHistoricalData();
        setCompleteHistoricalData(data);
      } catch (err) {
        logger.error('Error loading historical data for predictive analytics:', err);
      } finally {
        setLoadingHistorical(false);
      }
    }
    loadHistoricalData();
  }, []);

  const forecasts = useMemo(() => {
    logger.debug(`PredictiveAnalytics: Generating forecasts for ${quotes.length} quotes, ${items.length} items, ${completeHistoricalData.length} historical items`);
    
    const itemMap = new Map(items.map(i => [i.id, i]));
    
    // Use complete historical data if available, otherwise fall back to prop
    const historicalToUse = completeHistoricalData.length > 0
      ? formatForPredictiveAnalytics(completeHistoricalData)
      : propHistoricalData;
    
    logger.debug(`PredictiveAnalytics: Using ${historicalToUse.length} historical data points`);
    const historicalMap = new Map(historicalToUse.map(d => [d.item_id, d]));
    const forecastsList: PriceForecast[] = [];

    // Group quotes by item to get current prices (if available)
    const quotesByItem = new Map<string, QuoteWithDetails[]>();
    quotes.forEach(q => {
      if (!quotesByItem.has(q.item_id)) {
        quotesByItem.set(q.item_id, []);
      }
      quotesByItem.get(q.item_id)!.push(q);
    });

    // Process ALL items with historical data, not just those with current quotes
    const itemsToProcess = new Set<string>();
    
    // Add items with historical data
    historicalMap.forEach((_, itemId) => {
      itemsToProcess.add(itemId);
    });
    
    // Add items with current quotes (even if no historical data yet)
    quotesByItem.forEach((_, itemId) => {
      itemsToProcess.add(itemId);
    });

    itemsToProcess.forEach((itemId) => {
      const item = itemMap.get(itemId);
      if (!item) return;
      
      const historical = historicalMap.get(itemId);
      const itemQuotes = quotesByItem.get(itemId) || [];
      const fullHistoricalData = completeHistoricalData.find(d => d.item_id === itemId);
      
      // Get current price: from quotes if available, otherwise use most recent historical price
      let currentPrice: number;
      let hasCurrentQuotes = false;
      
      if (itemQuotes.length > 0) {
        const currentQuotes = itemQuotes
          .map(q => {
            const price = q.rf_final_fob ?? q.supplier_revised_fob ?? q.supplier_fob;
            return { ...q, effectivePrice: price };
          })
          .filter(q => q.effectivePrice !== null && q.effectivePrice !== undefined && q.effectivePrice > 0);
        
        if (currentQuotes.length > 0) {
          currentPrice = currentQuotes.reduce((sum, q) => sum + (q.effectivePrice || 0), 0) / currentQuotes.length;
          hasCurrentQuotes = true;
        } else if (historical && historical.prices.length > 0) {
          currentPrice = historical.prices[historical.prices.length - 1];
        } else {
          return;
        }
      } else if (historical && historical.prices.length > 0) {
        currentPrice = historical.prices[historical.prices.length - 1];
      } else {
        return;
      }
      
      // Need at least 2 weeks of historical data for accurate forecast
      if (!historical || historical.prices.length < 2) {
        if (hasCurrentQuotes) {
          forecastsList.push({
            itemId,
            itemName: item.name,
            category: item.category,
            organicFlag: item.organic_flag,
            currentPrice,
            forecastPrice: currentPrice,
            confidence: 0,
            trend: 'stable',
            factors: ['Insufficient historical data for accurate forecast'],
            historicalPrices: [],
            historicalWeeks: [],
            volatility: 0,
          });
        }
        return;
      }
      
      // Simple linear regression for trend
      const prices = historical.prices;
      const weeks = historical.weeks;
      
      if (prices.length < 2) return;

      const n = prices.length;
      const sumX = weeks.reduce((a, b) => a + b, 0);
      const sumY = prices.reduce((a, b) => a + b, 0);
      const sumXY = weeks.reduce((sum, w, i) => sum + w * prices[i], 0);
      const sumX2 = weeks.reduce((sum, w) => sum + w * w, 0);
      
      const denominator = (n * sumX2 - sumX * sumX);
      if (Math.abs(denominator) < 0.0001) return;
      
      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;
      
      const nextWeek = Math.max(...weeks) + 1;
      const forecastPrice = slope * nextWeek + intercept;
      
      const meanY = sumY / n;
      const ssRes = prices.reduce((sum, p, i) => {
        const predicted = slope * weeks[i] + intercept;
        return sum + Math.pow(p - predicted, 2);
      }, 0);
      const ssTot = prices.reduce((sum, p) => sum + Math.pow(p - meanY, 2), 0);
      const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
      const confidence = Math.max(0, Math.min(100, rSquared * 100));

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (forecastPrice > currentPrice * 1.02) trend = 'up';
      else if (forecastPrice < currentPrice * 0.98) trend = 'down';

      const factors: string[] = [];
      if (historical.volatility > 2) {
        factors.push('High volatility detected');
      }
      if (slope > 0.1) {
        factors.push('Strong upward trend');
      } else if (slope < -0.1) {
        factors.push('Declining trend');
      }
      if (itemQuotes.length >= 3) {
        factors.push('Multiple competitive suppliers');
      } else if (historical.prices.length >= 4) {
        factors.push('Strong historical pattern');
      }

      forecastsList.push({
        itemId,
        itemName: item.name,
        category: item.category,
        organicFlag: item.organic_flag,
        currentPrice,
        forecastPrice: Math.max(0, forecastPrice),
        confidence: Math.round(confidence),
        trend,
        factors,
        historicalPrices: prices,
        historicalWeeks: weeks,
        volatility: historical.volatility,
      });
    });

    // Apply filters
    let filtered = forecastsList;
    if (filterTrend !== 'all') {
      filtered = filtered.filter(f => f.trend === filterTrend);
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter(f => f.category === filterCategory);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'change') {
        return Math.abs(b.forecastPrice - b.currentPrice) - Math.abs(a.forecastPrice - a.currentPrice);
      } else if (sortBy === 'confidence') {
        return b.confidence - a.confidence;
      } else {
        return a.itemName.localeCompare(b.itemName);
      }
    });

    logger.debug(`PredictiveAnalytics: Generated ${sorted.length} forecasts`);
    return sorted;
  }, [quotes, items, completeHistoricalData, propHistoricalData, filterTrend, filterCategory, sortBy]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const total = forecasts.length;
    const rising = forecasts.filter(f => f.trend === 'up').length;
    const falling = forecasts.filter(f => f.trend === 'down').length;
    const stable = forecasts.filter(f => f.trend === 'stable').length;
    const avgConfidence = total > 0 
      ? Math.round(forecasts.reduce((sum, f) => sum + f.confidence, 0) / total)
      : 0;
    const avgChange = total > 0
      ? forecasts.reduce((sum, f) => sum + (f.forecastPrice - f.currentPrice), 0) / total
      : 0;
    const highConfidence = forecasts.filter(f => f.confidence >= 70).length;

    return { total, rising, falling, stable, avgConfidence, avgChange, highConfidence };
  }, [forecasts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(forecasts.map(f => f.category));
    return Array.from(cats).sort();
  }, [forecasts]);

  if (loadingHistorical) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white/60">Loading historical data for accurate predictions...</p>
      </div>
    );
  }

  logger.debug(`PredictiveAnalytics render: ${quotes.length} quotes, ${items.length} items, ${forecasts.length} forecasts, ${completeHistoricalData.length} historical items`);

  if (forecasts.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
        <Activity className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <p className="text-white/60">Need more historical data for accurate forecasts.</p>
        <div className="mt-4 text-xs text-white/40 space-y-1">
          <p>Debug: {quotes.length} quotes for this week</p>
          <p>{items.length} items available</p>
          <p>{completeHistoricalData.length} historical items loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Price Predictions</h2>
            <p className="text-sm text-white/60">AI-powered forecasts for next week's pricing</p>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Total Forecasts</span>
            <BarChart3 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{summaryStats.total}</div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-xl border border-red-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Rising Prices</span>
            <TrendingUp className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-300">{summaryStats.rising}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-xl border border-emerald-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Falling Prices</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300">{summaryStats.falling}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl border border-blue-500/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Avg Confidence</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-300">{summaryStats.avgConfidence}%</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/60" />
          <span className="text-sm text-white/60">Filter:</span>
        </div>
        <button
          onClick={() => setFilterTrend('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filterTrend === 'all'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
          }`}
        >
          All Trends
        </button>
        <button
          onClick={() => setFilterTrend('up')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filterTrend === 'up'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
          }`}
        >
          Rising
        </button>
        <button
          onClick={() => setFilterTrend('down')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filterTrend === 'down'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
          }`}
        >
          Falling
        </button>
        <button
          onClick={() => setFilterTrend('stable')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            filterTrend === 'stable'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
          }`}
        >
          Stable
        </button>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'change' | 'confidence' | 'name')}
          className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-white border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="change">Sort by Change</option>
          <option value="confidence">Sort by Confidence</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {/* Forecasts Grid */}
      <div className="grid gap-4">
        {forecasts.map((forecast) => {
          const change = forecast.forecastPrice - forecast.currentPrice;
          const changePercent = (change / forecast.currentPrice) * 100;
          const isIncrease = change > 0;
          const isExpanded = expandedForecasts.has(forecast.itemId);
          const fullHistoricalData = completeHistoricalData.find(d => d.item_id === forecast.itemId);

          return (
            <div
              key={forecast.itemId}
              className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/10 p-6 hover:border-emerald-500/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-lg font-bold text-white truncate">{forecast.itemName}</h4>
                    {forecast.organicFlag === 'ORG' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                        ORG
                      </span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      forecast.trend === 'up' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      forecast.trend === 'down' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {forecast.trend === 'up' ? '↑ Rising' : forecast.trend === 'down' ? '↓ Falling' : '→ Stable'}
                    </span>
                    <span className="text-xs text-white/40">{forecast.category}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-white/60 mb-1">Current Price</div>
                      <div className="text-xl font-bold text-white">{formatCurrency(forecast.currentPrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60 mb-1">Forecast</div>
                      <div className={`text-xl font-bold flex items-center gap-1 ${
                        isIncrease ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {isIncrease ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        {formatCurrency(forecast.forecastPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/60 mb-1">Change</div>
                      <div className={`text-xl font-bold flex items-center gap-1 ${
                        isIncrease ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {isIncrease ? '+' : ''}{formatCurrency(Math.abs(change))}
                        <span className="text-sm">({isIncrease ? '+' : ''}{changePercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-4">
                    <ForecastTrendChart forecast={forecast} historicalData={fullHistoricalData} />
                  </div>

                  {/* Confidence and Factors */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <ConfidenceGauge confidence={forecast.confidence} />
                      <div>
                        <div className="text-xs text-white/60">Confidence</div>
                        <div className="text-sm font-medium text-white">
                          {forecast.confidence >= 70 ? 'High' : forecast.confidence >= 40 ? 'Medium' : 'Low'}
                        </div>
                      </div>
                    </div>
                    {forecast.volatility > 2 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-yellow-300">High Volatility</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Expand Button */}
                <button
                  onClick={() => {
                    const newSet = new Set(expandedForecasts);
                    if (newSet.has(forecast.itemId)) {
                      newSet.delete(forecast.itemId);
                    } else {
                      newSet.add(forecast.itemId);
                    }
                    setExpandedForecasts(newSet);
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-white/60" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white/60" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3 animate-fade-in">
                  {forecast.factors.length > 0 && (
                    <div>
                      <div className="text-xs text-white/60 mb-2 flex items-center gap-2">
                        <Zap className="w-3 h-3" />
                        Key Factors
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {forecast.factors.map((factor, idx) => (
                          <span key={idx} className="text-xs px-2.5 py-1 bg-white/5 rounded-lg text-white/70 border border-white/10">
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/60">Volatility:</span>
                      <span className="ml-2 text-white font-medium">{forecast.volatility.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Data Points:</span>
                      <span className="ml-2 text-white font-medium">{forecast.historicalPrices.length} weeks</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
