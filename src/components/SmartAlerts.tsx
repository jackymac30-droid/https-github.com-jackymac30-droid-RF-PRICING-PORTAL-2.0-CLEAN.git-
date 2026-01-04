import React, { useState, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, TrendingUp, TrendingDown, Clock, DollarSign, Users, Package, Zap, CheckCircle, X } from 'lucide-react';
import { fetchWeeks, fetchQuotesWithDetails, fetchItems } from '../utils/database';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';
import type { Week, QuoteWithDetails, Item } from '../types';

interface Alert {
  id: string;
  type: 'price_change' | 'deadline' | 'anomaly' | 'opportunity' | 'risk';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: Date;
  actionUrl?: string;
  dismissed?: boolean;
}

export function SmartAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [weeksData, itemsData] = await Promise.all([
        fetchWeeks(),
        fetchItems(),
      ]);

      setWeeks(weeksData);
      setItems(itemsData);

      // Get quotes for open weeks
      const openWeeks = weeksData.filter(w => w.status === 'open');
      const allQuotes: QuoteWithDetails[] = [];
      
      for (const week of openWeeks) {
        const weekQuotes = await fetchQuotesWithDetails(week.id);
        allQuotes.push(...weekQuotes);
      }

      setQuotes(allQuotes);
      detectAlerts(weeksData, allQuotes, itemsData);
    } catch (err) {
      logger.error('Error loading alerts data:', err);
    } finally {
      setLoading(false);
    }
  }

  function detectAlerts(weeks: Week[], quotes: QuoteWithDetails[], items: Item[]) {
    const newAlerts: Alert[] = [];

    // Deadline alerts
    const openWeeks = weeks.filter(w => w.status === 'open');
    openWeeks.forEach(week => {
      const weekQuotes = quotes.filter(q => q.week_id === week.id);
      const submittedCount = weekQuotes.filter(q => q.supplier_fob && q.supplier_fob > 0).length;
      const totalExpected = items.length * 3; // Assume 3 suppliers per item

      if (submittedCount < totalExpected * 0.5) {
        newAlerts.push({
          id: `deadline-${week.id}`,
          type: 'deadline',
          severity: 'high',
          title: `Week ${week.week_number}: Low Submission Rate`,
          message: `Only ${submittedCount} quotes submitted. Consider sending reminders.`,
          timestamp: new Date(),
          actionUrl: `/pricing?week=${week.id}`,
        });
      }
    });

    // Price change alerts
    const quotesByItem = new Map<string, QuoteWithDetails[]>();
    quotes.forEach(q => {
      if (!quotesByItem.has(q.item_id)) {
        quotesByItem.set(q.item_id, []);
      }
      quotesByItem.get(q.item_id)!.push(q);
    });

    quotesByItem.forEach((itemQuotes, itemId) => {
      const prices = itemQuotes
        .filter(q => q.supplier_fob && q.supplier_fob > 0)
        .map(q => q.supplier_fob!);
      
      if (prices.length < 2) return;

      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = ((maxPrice - minPrice) / avgPrice) * 100;

      // High spread opportunity
      if (spread > 20) {
        const item = items.find(i => i.id === itemId);
        newAlerts.push({
          id: `opportunity-${itemId}`,
          type: 'opportunity',
          severity: 'medium',
          title: `High Price Spread: ${item?.name || 'Item'}`,
          message: `${formatCurrency(spread)}% price spread detected. Strong negotiation opportunity.`,
          timestamp: new Date(),
        });
      }

      // Unusually high price
      if (avgPrice > 15) { // Threshold - adjust based on your data
        const item = items.find(i => i.id === itemId);
        newAlerts.push({
          id: `risk-${itemId}`,
          type: 'risk',
          severity: 'high',
          title: `High Price Alert: ${item?.name || 'Item'}`,
          message: `Average price ${formatCurrency(avgPrice)} is significantly above normal range.`,
          timestamp: new Date(),
        });
      }
    });

    // Anomaly detection
    quotes.forEach(quote => {
      if (!quote.supplier_fob || quote.supplier_fob <= 0) return;

      const itemQuotes = quotesByItem.get(quote.item_id) || [];
      const itemPrices = itemQuotes
        .filter(q => q.supplier_fob && q.supplier_fob > 0)
        .map(q => q.supplier_fob!);
      
      if (itemPrices.length < 3) return;

      const avgPrice = itemPrices.reduce((a, b) => a + b, 0) / itemPrices.length;
      const stdDev = Math.sqrt(
        itemPrices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / itemPrices.length
      );

      // Price is more than 2 standard deviations from mean
      if (Math.abs(quote.supplier_fob - avgPrice) > 2 * stdDev) {
        const item = items.find(i => i.id === quote.item_id);
        newAlerts.push({
          id: `anomaly-${quote.id}`,
          type: 'anomaly',
          severity: 'medium',
          title: `Price Anomaly: ${item?.name || 'Item'}`,
          message: `${quote.supplier?.name || 'Supplier'} quoted ${formatCurrency(quote.supplier_fob)}, significantly different from average.`,
          timestamp: new Date(),
        });
      }
    });

    setAlerts(newAlerts);
  }

  function dismissAlert(alertId: string) {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, dismissed: true } : a
    ));
  }

  const activeAlerts = useMemo(() => 
    alerts.filter(a => !a.dismissed).sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    [alerts]
  );

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'price_change': return <TrendingUp className="w-5 h-5" />;
      case 'deadline': return <Clock className="w-5 h-5" />;
      case 'anomaly': return <AlertTriangle className="w-5 h-5" />;
      case 'opportunity': return <Zap className="w-5 h-5" />;
      case 'risk': return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return 'red';
      case 'medium': return 'yellow';
      case 'low': return 'blue';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white/60">Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Smart Alerts</h3>
          {activeAlerts.length > 0 && (
            <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-semibold border border-red-500/30">
              {activeAlerts.length}
            </span>
          )}
        </div>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-400/50 mx-auto mb-4" />
          <p className="text-white/60">No active alerts. Everything looks good!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeAlerts.map((alert) => {
            const color = getColor(alert.severity);
            
            return (
              <div
                key={alert.id}
                className={`bg-gradient-to-br from-${color}-500/10 to-${color}-600/5 rounded-lg border border-${color}-500/30 p-4 hover:border-${color}-400/50 transition-all group`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg bg-${color}-500/20`}>
                      <div className={`text-${color}-400`}>
                        {getIcon(alert.type)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{alert.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded border border-${color}-500/30 bg-${color}-500/20 text-${color}-300`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-sm text-white/70 mb-2">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span>{alert.timestamp.toLocaleTimeString()}</span>
                        {alert.actionUrl && (
                          <a href={alert.actionUrl} className="text-emerald-400 hover:text-emerald-300">
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white/60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

