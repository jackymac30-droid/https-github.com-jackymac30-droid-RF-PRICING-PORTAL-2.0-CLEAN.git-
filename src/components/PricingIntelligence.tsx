import React, { useState, useMemo, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Target, Zap, BarChart3, Sparkles, Filter, X, ChevronRight, DollarSign, TrendingUp as TrendUp, Activity, Award, Clock, ArrowRight, Download, Layers, TrendingDown as TrendDown, Minus, Plus, Eye, List } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { fetchCompleteHistoricalData, formatForPricingIntelligence, type CompleteHistoricalData } from '../utils/historicalData';
import { logger } from '../utils/logger';
import type { QuoteWithDetails, Item, Week } from '../types';

interface PricingIntelligenceProps {
  quotes: QuoteWithDetails[];
  items: Item[];
  week: Week | null;
  historicalData?: Array<{
    item_id: string;
    avgPrice: number;
    trend: 'up' | 'down' | 'stable';
    volatility: number;
  }>;
}

interface PricingInsight {
  type: 'opportunity' | 'risk' | 'recommendation' | 'anomaly';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  impact?: string;
  itemId?: string;
  supplierId?: string;
}

export function PricingIntelligence({ quotes, items, week, historicalData: propHistoricalData = [] }: PricingIntelligenceProps) {
  const [selectedInsight, setSelectedInsight] = useState<PricingInsight | null>(null);
  const [completeHistoricalData, setCompleteHistoricalData] = useState<CompleteHistoricalData[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'opportunity' | 'risk' | 'recommendation' | 'anomaly'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedInsights, setExpandedInsights] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'category'>('list');

  // Fetch complete historical data on mount
  useEffect(() => {
    async function loadHistoricalData() {
      try {
        setLoadingHistorical(true);
        const data = await fetchCompleteHistoricalData();
        setCompleteHistoricalData(data);
      } catch (err) {
        logger.error('Error loading historical data for pricing intelligence:', err);
      } finally {
        setLoadingHistorical(false);
      }
    }
    loadHistoricalData();
  }, []);

  const insights = useMemo(() => {
    logger.debug(`PricingIntelligence: Generating insights for ${quotes.length} quotes, ${items.length} items, ${completeHistoricalData.length} historical items`);
    
    const insightsList: PricingInsight[] = [];
    const itemMap = new Map(items.map(i => [i.id, i]));
    
    // Use complete historical data if available, otherwise fall back to prop
    const historicalToUse = completeHistoricalData.length > 0
      ? formatForPricingIntelligence(completeHistoricalData)
      : propHistoricalData;
    
    logger.debug(`PricingIntelligence: Using ${historicalToUse.length} historical data points`);
    const historicalMap = new Map(historicalToUse.map(d => [d.item_id, d]));

    // Group quotes by item (current week quotes)
    const quotesByItem = new Map<string, QuoteWithDetails[]>();
    quotes.forEach(q => {
      if (!quotesByItem.has(q.item_id)) {
        quotesByItem.set(q.item_id, []);
      }
      quotesByItem.get(q.item_id)!.push(q);
    });
    
    logger.debug(`PricingIntelligence: Grouped into ${quotesByItem.size} items with quotes, ${historicalMap.size} items with historical data`);

    // First, analyze items with current quotes
    quotesByItem.forEach((itemQuotes, itemId) => {
      const item = itemMap.get(itemId);
      if (!item) return;

      // Get valid quotes with prices (priority: rf_final_fob > supplier_revised_fob > supplier_fob)
      const validQuotes = itemQuotes
        .map(q => {
          // Use the same price priority as Analytics
          const price = q.rf_final_fob ?? q.supplier_revised_fob ?? q.supplier_fob;
          return { ...q, effectivePrice: price };
        })
        .filter(q => q.effectivePrice !== null && q.effectivePrice !== undefined && q.effectivePrice > 0);

      if (validQuotes.length === 0) return;

      const prices = validQuotes.map(q => q.effectivePrice!);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = prices.length > 1 ? ((maxPrice - minPrice) / avgPrice) * 100 : 0;

      const historical = historicalMap.get(itemId);
      
      // Always show at least one insight if we have quotes
      let hasInsight = false;
      
      // Opportunity: Large price spread (negotiation room) - lowered threshold
      if (spread > 10) {
        insightsList.push({
          type: 'opportunity',
          priority: spread > 20 ? 'high' : 'medium',
          title: `Price Spread: ${item.name}`,
          description: `${spread.toFixed(1)}% spread between suppliers ($${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}). ${spread > 20 ? 'Strong' : 'Good'} negotiation opportunity.`,
          action: `Consider countering at $${(avgPrice * 0.95).toFixed(2)}`,
          impact: `Potential savings: $${((maxPrice - minPrice) * 100).toFixed(2)} per 100 cases`,
          itemId,
        });
        hasInsight = true;
      }

      // Risk: Prices significantly higher than historical - lowered threshold
      if (historical && historical.avgPrice > 0 && avgPrice > historical.avgPrice * 1.05) {
        const increasePercent = ((avgPrice / historical.avgPrice - 1) * 100);
        insightsList.push({
          type: 'risk',
          priority: increasePercent > 15 ? 'high' : 'medium',
          title: `Price Increase: ${item.name}`,
          description: `Current avg $${avgPrice.toFixed(2)} is ${increasePercent.toFixed(1)}% above historical avg ($${historical.avgPrice.toFixed(2)}).`,
          action: 'Review market conditions and supplier costs',
          impact: `Cost impact: +$${((avgPrice - historical.avgPrice) * 100).toFixed(2)} per 100 cases`,
          itemId,
        });
        hasInsight = true;
      }

      // Recommendation: Best price supplier - always show if multiple suppliers
      if (validQuotes.length > 1) {
        const bestQuote = validQuotes.reduce((best, q) => 
          (!best || q.effectivePrice! < best.effectivePrice!) ? q : best
        );
        
        if (bestQuote && bestQuote.effectivePrice! < avgPrice * 0.98) {
          const savingsPercent = ((1 - bestQuote.effectivePrice! / avgPrice) * 100);
          insightsList.push({
            type: 'recommendation',
            priority: savingsPercent > 5 ? 'high' : 'medium',
            title: `Best Price: ${bestQuote.supplier?.name || 'Supplier'}`,
            description: `$${bestQuote.effectivePrice!.toFixed(2)} is ${savingsPercent.toFixed(1)}% below average ($${avgPrice.toFixed(2)}).`,
            action: 'Consider prioritizing this supplier',
            itemId,
            supplierId: bestQuote.supplier_id,
          });
          hasInsight = true;
        }
      }

      // Anomaly: Unusually low price - lowered threshold
      if (minPrice < avgPrice * 0.90 && validQuotes.length > 1) {
        const lowQuote = validQuotes.find(q => q.effectivePrice === minPrice);
        const discountPercent = ((1 - minPrice / avgPrice) * 100);
        insightsList.push({
          type: 'anomaly',
          priority: discountPercent > 15 ? 'high' : 'medium',
          title: `Low Price Alert: ${item.name}`,
          description: `${lowQuote?.supplier?.name || 'Supplier'} quoted $${minPrice.toFixed(2)}, ${discountPercent.toFixed(1)}% below average.`,
          action: 'Verify quality and terms before accepting',
          itemId,
          supplierId: lowQuote?.supplier_id,
        });
        hasInsight = true;
      }

      // If no specific insights but we have data, show a general summary
      if (!hasInsight && validQuotes.length > 0) {
        insightsList.push({
          type: 'recommendation',
          priority: 'low',
          title: `Pricing Summary: ${item.name}`,
          description: `${validQuotes.length} supplier${validQuotes.length > 1 ? 's' : ''} submitted pricing. Average: $${avgPrice.toFixed(2)}${prices.length > 1 ? `, Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}` : ''}. ${historical ? `Historical avg: $${historical.avgPrice.toFixed(2)}.` : 'No historical data available yet.'}`,
          action: 'Review pricing and proceed with negotiations',
          itemId,
        });
      }
    });

    // Also generate insights from historical data even if no current quotes
    // This ensures we show insights based on previous weeks' patterns
    items.forEach(item => {
      // Skip if we already processed this item from current quotes
      if (quotesByItem.has(item.id)) return;
      
      const historical = historicalMap.get(item.id);
      if (!historical || historical.avgPrice <= 0) return;

      // Generate insights based on historical patterns
      // High volatility indicates price instability
      if (historical.volatility > 2) {
        insightsList.push({
          type: 'risk',
          priority: historical.volatility > 4 ? 'high' : 'medium',
          title: `Price Volatility: ${item.name}`,
          description: `Historical price volatility of $${historical.volatility.toFixed(2)} indicates unstable pricing. Average historical price: $${historical.avgPrice.toFixed(2)}.`,
          action: 'Monitor closely and negotiate stable pricing',
          itemId: item.id,
        });
      }

      // Trend analysis
      if (historical.trend === 'up') {
        insightsList.push({
          type: 'risk',
          priority: 'medium',
          title: `Upward Price Trend: ${item.name}`,
          description: `Historical data shows upward pricing trend. Average: $${historical.avgPrice.toFixed(2)}.`,
          action: 'Consider locking in pricing early',
          itemId: item.id,
        });
      } else if (historical.trend === 'down') {
        insightsList.push({
          type: 'opportunity',
          priority: 'medium',
          title: `Declining Price Trend: ${item.name}`,
          description: `Historical data shows declining pricing trend. Average: $${historical.avgPrice.toFixed(2)}.`,
          action: 'Good time to negotiate favorable pricing',
          itemId: item.id,
        });
      }
    });

    // Sort by priority and type
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { risk: 0, anomaly: 1, opportunity: 2, recommendation: 3 };
    
    const sorted = insightsList.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    logger.debug(`PricingIntelligence: Generated ${sorted.length} insights`);
    return sorted;
  }, [quotes, items, completeHistoricalData, propHistoricalData]);

  const insightsByType = useMemo(() => {
    return {
      opportunity: insights.filter(i => i.type === 'opportunity'),
      risk: insights.filter(i => i.type === 'risk'),
      recommendation: insights.filter(i => i.type === 'recommendation'),
      anomaly: insights.filter(i => i.type === 'anomaly'),
    };
  }, [insights]);

  // Filtered insights
  const filteredInsights = useMemo(() => {
    return insights.filter(insight => {
      const typeMatch = filterType === 'all' || insight.type === filterType;
      const priorityMatch = filterPriority === 'all' || insight.priority === filterPriority;
      return typeMatch && priorityMatch;
    });
  }, [insights, filterType, filterPriority]);

  // Calculate total potential savings
  const totalSavings = useMemo(() => {
    return insights
      .filter(i => i.impact && i.type === 'opportunity')
      .reduce((sum, i) => {
        const match = i.impact?.match(/\$([\d.]+)/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0);
  }, [insights]);

  // Get supplier performance data
  const supplierPerformance = useMemo(() => {
    const supplierMap = new Map<string, { name: string; wins: number; avgPrice: number; count: number }>();
    
    completeHistoricalData.forEach(item => {
      item.supplierData.forEach(supplier => {
        const existing = supplierMap.get(supplier.supplier_id) || { 
          name: supplier.supplier_name, 
          wins: 0, 
          avgPrice: 0, 
          count: 0 
        };
        existing.wins += supplier.winRate > 50 ? 1 : 0;
        existing.avgPrice = (existing.avgPrice * existing.count + supplier.avgPrice) / (existing.count + 1);
        existing.count += 1;
        supplierMap.set(supplier.supplier_id, existing);
      });
    });

    return Array.from(supplierMap.values())
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 5);
  }, [completeHistoricalData]);

  const getIcon = (type: PricingInsight['type']) => {
    switch (type) {
      case 'opportunity': return <TrendingDown className="w-5 h-5" />;
      case 'risk': return <AlertCircle className="w-5 h-5" />;
      case 'recommendation': return <Lightbulb className="w-5 h-5" />;
      case 'anomaly': return <Zap className="w-5 h-5" />;
    }
  };

  const getColor = (type: PricingInsight['type']) => {
    switch (type) {
      case 'opportunity': return 'emerald';
      case 'risk': return 'red';
      case 'recommendation': return 'blue';
      case 'anomaly': return 'yellow';
    }
  };

  // Group insights by category
  const insightsByCategory = useMemo(() => {
    const categoryMap = new Map<string, PricingInsight[]>();
    insights.forEach(insight => {
      if (insight.itemId) {
        const item = items.find(i => i.id === insight.itemId);
        const category = item?.category || 'Other';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(insight);
      }
    });
    return Array.from(categoryMap.entries()).map(([category, insights]) => ({
      category,
      insights,
      count: insights.length,
    })).sort((a, b) => b.count - a.count);
  }, [insights, items]);

  // Mini price trend chart component - defined as a function component
  function MiniTrendChart({ itemId }: { itemId: string }) {
    const itemData = completeHistoricalData.find(d => d.item_id === itemId);
    if (!itemData || itemData.prices.length < 2) return null;

    const prices = itemData.prices.slice(-6); // Last 6 data points
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const range = maxPrice - minPrice || 1;
    const width = 120;
    const height = 40;
    const padding = 4;

    const points = prices.map((price, idx) => {
      const x = padding + (idx / (prices.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((price - minPrice) / range) * (height - padding * 2);
      return { x, y, price };
    });

    const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const isUpward = prices[prices.length - 1] > prices[0];

    return (
      <div className="flex items-center gap-2">
        <svg width={width} height={height} className="flex-shrink-0">
          <defs>
            <linearGradient id={`trendGradient-${itemId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isUpward ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"} />
              <stop offset="100%" stopColor={isUpward ? "rgba(239, 68, 68, 0.05)" : "rgba(16, 185, 129, 0.05)"} />
            </linearGradient>
          </defs>
          <path
            d={`${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
            fill={`url(#trendGradient-${itemId})`}
          />
          <path
            d={pathData}
            fill="none"
            stroke={isUpward ? "rgba(239, 68, 68, 0.8)" : "rgba(16, 185, 129, 0.8)"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-xs text-white/50">
          {isUpward ? <TrendingUp className="w-3 h-3 text-red-400" /> : <TrendingDown className="w-3 h-3 text-emerald-400" />}
        </div>
      </div>
    );
  }

  // Export insights as JSON
  const exportInsights = () => {
    const exportData = {
      generatedAt: new Date().toISOString(),
      week: week ? { id: week.id, week_number: week.week_number } : null,
      summary: {
        total: insights.length,
        opportunities: insightsByType.opportunity.length,
        risks: insightsByType.risk.length,
        recommendations: insightsByType.recommendation.length,
        anomalies: insightsByType.anomaly.length,
        potentialSavings: totalSavings,
      },
      insights: filteredInsights,
      topSuppliers: supplierPerformance,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pricing-insights-${week ? `week-${week.week_number}` : 'historical'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loadingHistorical) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white/60">Loading historical data for accurate insights...</p>
      </div>
    );
  }

  // Show historical insights even if no week is selected
  // if (!week) {
  //   return (
  //     <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
  //       <Brain className="w-12 h-12 text-white/30 mx-auto mb-4" />
  //       <p className="text-white/60">Select a week to view AI-powered pricing insights</p>
  //     </div>
  //   );
  // }

  // Debug info
  logger.debug(`PricingIntelligence render: ${quotes.length} quotes, ${items.length} items, ${insights.length} insights, ${completeHistoricalData.length} historical items`);

  if (insights.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
        <Brain className="w-12 h-12 text-white/30 mx-auto mb-4" />
        <p className="text-white/60">
          {completeHistoricalData.length > 0 
            ? 'No insights generated from historical data. Need more pricing history to identify patterns.'
            : 'No insights available yet. Submit pricing and close weeks to build historical data for AI-powered recommendations.'}
        </p>
        <div className="mt-4 text-xs text-white/40 space-y-1">
          <p>Debug: {quotes.length} quotes for {week ? `week ${week.week_number}` : 'current week'}</p>
          <p>{items.length} items available</p>
          <p>{completeHistoricalData.length} historical items loaded</p>
          {completeHistoricalData.length === 0 && (
            <p className="mt-2 text-emerald-300">Need closed or finalized weeks to generate historical insights.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Savings */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-emerald-400" />
            AI Pricing Intelligence
          </h2>
          <p className="text-white/60 text-sm mt-1">
            {week ? `Week ${week.week_number} Analysis` : 'Historical Analysis'} • {completeHistoricalData.length} items tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalSavings > 0 && (
            <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/30 px-6 py-4">
              <div className="text-xs text-emerald-300 mb-1">Potential Savings</div>
              <div className="text-2xl font-bold text-emerald-300">${totalSavings.toFixed(2)}</div>
              <div className="text-xs text-emerald-400/70 mt-1">per 100 cases</div>
            </div>
          )}
          <button
            onClick={exportInsights}
            className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2 flex items-center gap-2 text-white text-sm font-medium transition-all"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg border border-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/60">Opportunities</span>
          </div>
          <div className="text-2xl font-bold text-emerald-300">{insightsByType.opportunity.length}</div>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-lg border border-red-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-white/60">Risks</span>
          </div>
          <div className="text-2xl font-bold text-red-300">{insightsByType.risk.length}</div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg border border-blue-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/60">Recommendations</span>
          </div>
          <div className="text-2xl font-bold text-blue-300">{insightsByType.recommendation.length}</div>
        </div>
        
        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-lg border border-yellow-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-white/60">Anomalies</span>
          </div>
          <div className="text-2xl font-bold text-yellow-300">{insightsByType.anomaly.length}</div>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/60" />
          <span className="text-sm text-white/60">Filter:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'opportunity', 'risk', 'recommendation', 'anomaly'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === type
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)} ({type === 'all' ? insights.length : insightsByType[type].length})
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'high', 'medium', 'low'] as const).map(priority => (
            <button
              key={priority}
              onClick={() => setFilterPriority(priority)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterPriority === priority
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {priority === 'all' ? 'All Priorities' : priority.charAt(0).toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            List
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              viewMode === 'category'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Layers className="w-3 h-3" />
            Category
          </button>
        </div>
      </div>

      {/* Top Suppliers Performance */}
      {supplierPerformance.length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Top Performing Suppliers</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {supplierPerformance.map((supplier, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg border border-white/10 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-300' :
                    idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                    idx === 2 ? 'bg-orange-500/20 text-orange-300' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-white truncate">{supplier.name}</span>
                </div>
                <div className="text-xs text-white/60">Avg: ${supplier.avgPrice.toFixed(2)}</div>
                <div className="text-xs text-emerald-400 mt-1">{supplier.wins} best price wins</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            AI-Powered Insights ({filteredInsights.length})
          </h3>
          {(filterType !== 'all' || filterPriority !== 'all') && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterPriority('all');
              }}
              className="text-xs text-white/60 hover:text-white flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
        
        {filteredInsights.length === 0 ? (
          <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
            <Filter className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/60">No insights match the current filters</p>
            <button
              onClick={() => {
                setFilterType('all');
                setFilterPriority('all');
              }}
              className="mt-4 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Clear filters to see all insights
            </button>
          </div>
        ) : viewMode === 'category' ? (
          // Category View
          <div className="space-y-4">
            {insightsByCategory
              .filter(cat => cat.insights.some(i => {
                const typeMatch = filterType === 'all' || i.type === filterType;
                const priorityMatch = filterPriority === 'all' || i.priority === filterPriority;
                return typeMatch && priorityMatch;
              }))
              .map(({ category, insights: categoryInsights }) => {
                const filtered = categoryInsights.filter(i => {
                  const typeMatch = filterType === 'all' || i.type === filterType;
                  const priorityMatch = filterPriority === 'all' || i.priority === filterPriority;
                  return typeMatch && priorityMatch;
                });
                if (filtered.length === 0) return null;
                
                return (
                  <div key={category} className="bg-white/5 rounded-xl border border-white/10 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white capitalize">{category}</h4>
                      <span className="text-xs text-white/60 bg-white/10 px-3 py-1 rounded-full">
                        {filtered.length} insight{filtered.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {filtered.map((insight, idx) => {
                        const color = getColor(insight.type);
                        const bgClasses = color === 'emerald' ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30' :
                                        color === 'red' ? 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30' :
                                        color === 'blue' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30' :
                                        'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30';
                        return (
                          <div key={idx} className={`${bgClasses} rounded-lg border p-3 text-sm`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white">{insight.title}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                insight.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                insight.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-blue-500/20 text-blue-300'
                              }`}>
                                {insight.priority}
                              </span>
                            </div>
                            <p className="text-white/70 text-xs">{insight.description}</p>
                            {insight.impact && (
                              <div className="mt-2 text-xs text-emerald-400">{insight.impact}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          filteredInsights.map((insight, idx) => {
          const color = getColor(insight.type);
          const priorityBadge = insight.priority === 'high' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                               insight.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                               'bg-blue-500/20 text-blue-300 border-blue-500/30';

          // Use conditional classes instead of template literals for Tailwind
          const bgClasses = color === 'emerald' ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400/50' :
                          color === 'red' ? 'bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30 hover:border-red-400/50' :
                          color === 'blue' ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 hover:border-blue-400/50' :
                          'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30 hover:border-yellow-400/50';
          
          const iconBgClasses = color === 'emerald' ? 'bg-emerald-500/20 group-hover:bg-emerald-500/30' :
                               color === 'red' ? 'bg-red-500/20 group-hover:bg-red-500/30' :
                               color === 'blue' ? 'bg-blue-500/20 group-hover:bg-blue-500/30' :
                               'bg-yellow-500/20 group-hover:bg-yellow-500/30';

          return (
            <div
              key={idx}
              className={`${bgClasses} rounded-lg border p-4 transition-all cursor-pointer group`}
              onClick={() => {
                const newExpanded = new Set(expandedInsights);
                if (newExpanded.has(idx)) {
                  newExpanded.delete(idx);
                } else {
                  newExpanded.add(idx);
                }
                setExpandedInsights(newExpanded);
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${iconBgClasses} transition-colors`}>
                    {getIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{insight.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded border ${priorityBadge}`}>
                        {insight.priority}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 mb-2">{insight.description}</p>
                    {insight.action && (
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <Target className="w-3 h-3" />
                        <span>{insight.action}</span>
                      </div>
                    )}
                    {insight.impact && (
                      <div className="mt-2 flex items-center gap-2">
                        <DollarSign className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs font-medium text-emerald-400">{insight.impact}</span>
                      </div>
                    )}
                    {insight.itemId && completeHistoricalData.length > 0 && (() => {
                      const itemData = completeHistoricalData.find(d => d.item_id === insight.itemId);
                      if (itemData && itemData.prices.length > 1) {
                        const recentPrices = itemData.prices.slice(-4); // Last 4 weeks
                        const trend = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'up' : 'down';
                        return (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Activity className="w-3 h-3 text-white/40" />
                              <span className="text-white/50">
                                {itemData.prices.length} weeks tracked • 
                                {itemData.volatility > 0 && ` Volatility: $${itemData.volatility.toFixed(2)}`}
                                {trend === 'up' && <TrendingUp className="w-3 h-3 inline text-red-400 ml-1" />}
                                {trend === 'down' && <TrendingDown className="w-3 h-3 inline text-emerald-400 ml-1" />}
                              </span>
                            </div>
                            {expandedInsights.has(idx) && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <MiniTrendChart itemId={insight.itemId} />
                                <div className="mt-2 text-xs text-white/60 space-y-1">
                                  <div>Historical Avg: ${itemData.avgPrice.toFixed(2)}</div>
                                  <div>Price Range: ${Math.min(...itemData.prices).toFixed(2)} - ${Math.max(...itemData.prices).toFixed(2)}</div>
                                  {itemData.supplierData.length > 0 && (
                                    <div>Suppliers: {itemData.supplierData.length} tracked</div>
                                  )}
                                </div>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newExpanded = new Set(expandedInsights);
                                if (newExpanded.has(idx)) {
                                  newExpanded.delete(idx);
                                } else {
                                  newExpanded.add(idx);
                                }
                                setExpandedInsights(newExpanded);
                              }}
                              className="text-xs text-white/60 hover:text-white flex items-center gap-1 mt-1"
                            >
                              {expandedInsights.has(idx) ? (
                                <>
                                  <Eye className="w-3 h-3" />
                                  Hide details
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3" />
                                  Show details
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-white/40" />
                  </div>
                  {insight.type === 'opportunity' && insight.action && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Extract suggested price from action text
                        const priceMatch = insight.action.match(/\$([\d.]+)/);
                        if (priceMatch) {
                          logger.debug(`Suggested counter price: $${priceMatch[1]}`);
                          // Could trigger a modal or callback here
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1"
                    >
                      <Target className="w-3 h-3" />
                      Apply
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Detailed Insight Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedInsight(null)}>
          <div className="bg-slate-900 rounded-xl border border-white/20 p-6 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{selectedInsight.title}</h3>
              <button onClick={() => setSelectedInsight(null)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="space-y-4">
              <p className="text-white/80">{selectedInsight.description}</p>
              {selectedInsight.action && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-white">Recommended Action</span>
                  </div>
                  <p className="text-sm text-white/80">{selectedInsight.action}</p>
                </div>
              )}
              {selectedInsight.impact && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">Potential Impact</span>
                  </div>
                  <p className="text-sm text-white/80">{selectedInsight.impact}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

