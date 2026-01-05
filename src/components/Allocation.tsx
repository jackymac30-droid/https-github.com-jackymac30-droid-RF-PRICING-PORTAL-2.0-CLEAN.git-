/**
 * AI Allocation Component
 * 
 * Combines Volume Needed + Acceptance into one futuristic allocation experience
 * Features:
 * - Manual allocation mode
 * - AI Target Price allocation mode
 * - Lock SKU workflow
 * - Exceptions mode (after sending awards)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Award, Save, Check, Package, Lock, Unlock, Send, RefreshCw, 
  Info, CheckCircle, Zap, Target, TrendingUp, AlertTriangle,
  Sparkles, Brain, Sliders, XCircle, Edit3, ChevronDown, ChevronUp,
  TrendingDown, DollarSign, BarChart3, History
} from 'lucide-react';
import {
  fetchItems,
  fetchQuotesWithDetails,
  fetchVolumeNeeds,
  updateVolumeNeeded as updateVolumeNeededDB,
  submitAllocationsToSuppliers,
  fetchItemPricingCalculations,
  fetchHistoricalSupplierShares,
  closeVolumeLoop,
} from '../utils/database';
import { formatCurrency } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../contexts/AppContext';
import { logger } from '../utils/logger';
import { useRealtime } from '../hooks/useRealtime';
import type { Week, Item } from '../types';
import { optimizeAllocation, calculateHistoricalShares, type SupplierQuote, type HistoricalShare } from '../utils/allocationOptimizer';

interface AllocationEntry {
  quote_id: string;
  supplier_name: string;
  supplier_id: string;
  price: number;
  dlvd_price: number | null;
  awarded_volume: number;
  supplier_response_status?: string | null;
  supplier_response_volume?: number | null;
  supplier_response_notes?: string | null;
}

interface SKUAllocation {
  item: Item;
  entries: AllocationEntry[];
  volumeNeeded: number;
  totalAllocated: number;
  weightedAvgPrice: number;
  isLocked: boolean;
  aiModeEnabled: boolean;
  targetPrice: number;
  fairnessWeight: number; // 0-100
}

interface AllocationProps {
  selectedWeek: Week | null;
  onWeekUpdate?: (week: Week) => void;
}

export function Allocation({ selectedWeek, onWeekUpdate }: AllocationProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [skuAllocations, setSkuAllocations] = useState<SKUAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exceptionsMode, setExceptionsMode] = useState(false);
  const [closingLoop, setClosingLoop] = useState(false);
  
  const { showToast } = useToast();
  const { session } = useApp();
  const draftSaveTimerRef = useRef<NodeJS.Timeout>();

  // Track actual week status from database (not just prop)
  const [actualWeekStatus, setActualWeekStatus] = useState<string | null>(null);
  const [hasFinalizedQuotes, setHasFinalizedQuotes] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!selectedWeek) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check database status directly (not just prop)
      const { supabase } = await import('../utils/supabase');
      const { data: weekData } = await supabase
        .from('weeks')
        .select('status')
        .eq('id', selectedWeek.id)
        .single();
      
      const dbStatus = weekData?.status || selectedWeek.status;
      setActualWeekStatus(dbStatus);

      const [itemsData, quotes, volumeNeedsData, pricingData] = await Promise.all([
        fetchItems(),
        fetchQuotesWithDetails(selectedWeek.id),
        fetchVolumeNeeds(selectedWeek.id),
        fetchItemPricingCalculations(selectedWeek.id),
      ]);

      // Check if there are any finalized quotes (rf_final_fob set)
      const hasAnyFinalized = quotes.some(q => 
        q.rf_final_fob !== null && 
        q.rf_final_fob !== undefined && 
        q.rf_final_fob > 0
      );
      setHasFinalizedQuotes(hasAnyFinalized);

      // Deduplicate items
      const uniqueItems = Array.from(
        new Map(itemsData.map(item => [item.id, item])).values()
      );
      setItems(uniqueItems);

      // Check if we're in exceptions mode (allocations sent and there are responses)
      const hasResponses = quotes.some(q => 
        q.supplier_volume_response && 
        (q.supplier_volume_response === 'update' || q.supplier_volume_response === 'decline')
      );
      setExceptionsMode(selectedWeek.allocation_submitted === true && hasResponses);

      // Build SKU allocations
      const allocations: SKUAllocation[] = [];
      const volumeNeedsMap = new Map<string, number>();
      volumeNeedsData.forEach(vn => {
        volumeNeedsMap.set(vn.item_id, vn.volume_needed || 0);
      });

      for (const item of uniqueItems) {
        // Only show items with finalized pricing
        const itemQuotes = quotes.filter(q => 
          q.item_id === item.id && 
          q.rf_final_fob !== null && 
          q.rf_final_fob !== undefined && 
          q.rf_final_fob > 0
        );

        if (itemQuotes.length === 0) continue;

        const entries: AllocationEntry[] = [];
        for (const quote of itemQuotes) {
          entries.push({
            quote_id: quote.id,
            supplier_name: quote.supplier?.name || 'Unknown',
            supplier_id: quote.supplier_id,
            price: quote.rf_final_fob!,
            dlvd_price: quote.supplier_dlvd ?? null,
            awarded_volume: quote.awarded_volume || 0,
            supplier_response_status: quote.supplier_volume_approval || 
              (quote.supplier_volume_response ? 
                (quote.supplier_volume_response === 'accept' ? 'accepted' : 
                 quote.supplier_volume_response === 'update' ? 'revised' : 
                 'pending') : null),
            supplier_response_volume: quote.supplier_volume_accepted ?? null,
            supplier_response_notes: quote.supplier_volume_response_notes ?? null,
          });
        }

        // Sort by price
        entries.sort((a, b) => a.price - b.price);

        const volumeNeeded = volumeNeedsMap.get(item.id) || 0;
        const totalAllocated = entries.reduce((sum, e) => sum + e.awarded_volume, 0);
        const totalCost = entries.reduce((sum, e) => sum + (e.price * e.awarded_volume), 0);
        const weightedAvgPrice = totalAllocated > 0 ? totalCost / totalAllocated : 0;

        allocations.push({
          item,
          entries,
          volumeNeeded,
          totalAllocated,
          weightedAvgPrice,
          isLocked: false, // TODO: Load from database when locked column exists
          aiModeEnabled: false,
          targetPrice: weightedAvgPrice || 0,
          fairnessWeight: 50, // Default to balanced
        });
      }

      setSkuAllocations(allocations);
    } catch (err) {
      logger.error('Error loading allocation data:', err);
      showToast('Failed to load allocation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedWeek?.id, selectedWeek?.allocation_submitted, showToast]);

  useEffect(() => {
    if (selectedWeek) {
      loadData();
    }
  }, [selectedWeek?.id, selectedWeek?.status, selectedWeek?.allocation_submitted, loadData]);
  
  // Realtime subscription: Refresh when quotes are updated (rf_final_fob set)
  const handleQuotesUpdate = useCallback(() => {
    if (selectedWeek?.id) {
      logger.debug('Quotes updated, refreshing allocation data...');
      loadData();
    }
  }, [selectedWeek?.id, loadData]);

  // Subscribe to quotes table changes for this week
  useRealtime('quotes', handleQuotesUpdate, { 
    column: 'week_id', 
    value: selectedWeek?.id 
  });
  
  // Re-check week status periodically if still open (to catch status changes)
  useEffect(() => {
    if (!selectedWeek || selectedWeek.status === 'finalized' || selectedWeek.status === 'closed') {
      return;
    }
    
    const interval = setInterval(async () => {
      const { supabase } = await import('../utils/supabase');
      const { data: weekData } = await supabase
        .from('weeks')
        .select('status')
        .eq('id', selectedWeek.id)
        .single();
      
      if (weekData?.status && weekData.status !== selectedWeek.status) {
        // Status changed, reload data
        loadData();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [selectedWeek?.id, selectedWeek?.status, loadData]);

  // Update volume needed for a SKU
  const updateVolumeNeeded = useCallback(async (itemId: string, volume: number) => {
    if (!selectedWeek) return;

    setSkuAllocations(prev => prev.map(sku => {
      if (sku.item.id !== itemId) return sku;
      return { ...sku, volumeNeeded: volume };
    }));

    // Debounced save
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(async () => {
      try {
        const success = await updateVolumeNeededDB(selectedWeek.id, itemId, volume);
        if (!success) {
          showToast('Failed to save volume needed', 'error');
        }
      } catch (err) {
        logger.error('Error saving volume needed:', err);
      }
    }, 500);
  }, [selectedWeek, showToast]);

  // Update allocated volume for a supplier
  const updateAllocation = useCallback(async (
    itemId: string, 
    supplierId: string, 
    quoteId: string, 
    volume: number
  ) => {
    if (!selectedWeek) return;

    setSkuAllocations(prev => prev.map(sku => {
      if (sku.item.id !== itemId) return sku;

      const updatedEntries = sku.entries.map(entry => {
        if (entry.quote_id === quoteId) {
          return { ...entry, awarded_volume: volume };
        }
        return entry;
      });

      const totalAllocated = updatedEntries.reduce((sum, e) => sum + e.awarded_volume, 0);
      const totalCost = updatedEntries.reduce((sum, e) => sum + (e.price * e.awarded_volume), 0);
      const weightedAvgPrice = totalAllocated > 0 ? totalCost / totalAllocated : 0;

      return {
        ...sku,
        entries: updatedEntries,
        totalAllocated,
        weightedAvgPrice,
      };
    }));

    // Debounced save to database
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(async () => {
      try {
        const { supabase } = await import('../utils/supabase');
        await supabase
          .from('quotes')
          .upsert({
            week_id: selectedWeek.id,
            supplier_id: supplierId,
            item_id: itemId,
            awarded_volume: volume > 0 ? volume : null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'week_id,item_id,supplier_id'
          });
      } catch (err) {
        logger.error('Error saving allocation:', err);
        showToast('Failed to save allocation', 'error');
      }
    }, 500);
  }, [selectedWeek, showToast]);

  // Lock/unlock SKU
  const toggleLockSKU = useCallback((itemId: string) => {
    setSkuAllocations(prev => prev.map(sku => {
      if (sku.item.id !== itemId) return sku;
      return { ...sku, isLocked: !sku.isLocked };
    }));
  }, []);

  // AI Auto-Allocate
  const handleAIAutoAllocate = useCallback(async (sku: SKUAllocation) => {
    if (!selectedWeek || sku.volumeNeeded <= 0) {
      showToast('Please set volume needed first', 'error');
      return;
    }

    try {
      // Fetch historical shares
      const historicalShares = await fetchHistoricalSupplierShares(
        sku.item.id,
        selectedWeek.week_number,
        10
      );

      // Convert to optimizer format
      const quotes: SupplierQuote[] = sku.entries.map(entry => ({
        supplierId: entry.supplier_id,
        supplierName: entry.supplier_name,
        price: entry.price,
        maxVolume: undefined, // TODO: Add if tracked
      }));

      const historicalSharesFormatted: HistoricalShare[] = historicalShares.map(share => ({
        supplierId: share.supplierId,
        sharePercent: share.sharePercent,
        averageVolume: share.averageVolume,
      }));

      // Optimize
      const result = optimizeAllocation({
        quotes,
        totalVolumeNeeded: sku.volumeNeeded,
        targetAvgPrice: sku.targetPrice,
        historicalShares: historicalSharesFormatted,
        fairnessWeight: sku.fairnessWeight,
      });

      if (!result.isAchievable && result.reason) {
        showToast(result.reason, 'warning');
      }

      // Apply allocations
      result.allocations.forEach((volume, supplierId) => {
        const entry = sku.entries.find(e => e.supplier_id === supplierId);
        if (entry && volume > 0) {
          updateAllocation(sku.item.id, supplierId, entry.quote_id, volume);
        }
      });

      showToast(
        `AI allocation complete! Achieved: ${formatCurrency(result.achievedPrice)}`,
        'success'
      );
    } catch (err) {
      logger.error('Error in AI auto-allocate:', err);
      showToast('Failed to run AI allocation', 'error');
    }
  }, [selectedWeek, showToast, updateAllocation]);

  // Send Awards to Suppliers
  const handleSendAwards = useCallback(async () => {
    if (!selectedWeek || !session) return;

    // Check all SKUs are locked
    const allLocked = skuAllocations.every(sku => sku.isLocked);
    if (!allLocked) {
      showToast('Please lock all SKUs before sending awards', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitAllocationsToSuppliers(selectedWeek.id, session.user_name);
      if (result.success) {
        showToast(`Awards sent to ${result.count} supplier(s)`, 'success');
        await loadData();
        
        // Update week status
        if (onWeekUpdate) {
          const { supabase } = await import('../utils/supabase');
          const { data: updatedWeek } = await supabase
            .from('weeks')
            .select('*')
            .eq('id', selectedWeek.id)
            .single();
          if (updatedWeek) {
            onWeekUpdate(updatedWeek as Week);
          }
        }
      } else {
        showToast(result.error || 'Failed to send awards', 'error');
      }
    } catch (err) {
      logger.error('Error sending awards:', err);
      showToast('Failed to send awards', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [selectedWeek, session, skuAllocations, showToast, loadData, onWeekUpdate]);

  // Close Loop
  const handleCloseLoop = useCallback(async () => {
    if (!selectedWeek || !session) return;

    setClosingLoop(true);
    try {
      const result = await closeVolumeLoop(selectedWeek.id, session.user_name);
      if (result.success) {
        showToast(result.message, 'success');
        await loadData();
      } else {
        showToast(result.message, 'error');
      }
    } catch (err) {
      logger.error('Error closing loop:', err);
      showToast('Failed to close loop', 'error');
    } finally {
      setClosingLoop(false);
    }
  }, [selectedWeek, session, showToast, loadData]);

  if (!selectedWeek) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-12 text-center border border-white/20">
        <Award className="w-16 h-16 text-white/40 mx-auto mb-4" />
        <p className="text-white text-lg font-medium">No week selected</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-12 text-center border border-white/20">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-white font-semibold text-lg">Loading allocation data...</p>
      </div>
    );
  }

  // Check if week is finalized - use database status OR check for finalized quotes
  // This allows access if: week status is finalized/closed OR there are finalized quotes
  const weekStatus = actualWeekStatus || selectedWeek.status;
  const canAccess = weekStatus === 'finalized' || weekStatus === 'closed' || hasFinalizedQuotes;
  
  if (!canAccess) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-12 text-center border border-white/20">
        <Info className="w-16 h-16 text-white/40 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-white mb-3">Allocation Not Available</h3>
        <p className="text-white/70 mb-2 text-lg">Please finalize pricing first</p>
        <p className="text-white/50 text-sm mt-2">
          Go to Pricing tab and set final prices (rf_final_fob) for at least one supplier per SKU
        </p>
      </div>
    );
  }

  const allSKUsLocked = skuAllocations.length > 0 && skuAllocations.every(sku => sku.isLocked);
  const hasExceptions = skuAllocations.some(sku => 
    sku.entries.some(e => 
      e.supplier_response_status === 'revised' || 
      (e.supplier_response_status === 'pending' && e.supplier_response_volume !== null)
    )
  );
  const allExceptionsResolved = !hasExceptions || skuAllocations.every(sku =>
    sku.entries.every(e => 
      e.supplier_response_status === 'accepted' || 
      e.supplier_response_status === null
    )
  );

  // Calculate overall summary
  const overallTotalVolume = skuAllocations.reduce((sum, sku) => sum + sku.totalAllocated, 0);
  const overallTotalNeeded = skuAllocations.reduce((sum, sku) => sum + sku.volumeNeeded, 0);
  const overallTotalCost = skuAllocations.reduce((sum, sku) => {
    return sum + sku.entries.reduce((s, e) => s + (e.price * e.awarded_volume), 0);
  }, 0);
  const overallWeightedAvg = overallTotalVolume > 0 ? overallTotalCost / overallTotalVolume : 0;
  const lockedCount = skuAllocations.filter(sku => sku.isLocked).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500/20 via-lime-500/20 to-emerald-500/20 backdrop-blur-xl rounded-xl border-2 border-emerald-400/50 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/30 rounded-xl border border-emerald-400/50">
              <Sparkles className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                AI Allocation
                {exceptionsMode && (
                  <span className="text-sm font-normal bg-orange-500/30 text-orange-200 px-3 py-1 rounded-full border border-orange-400/50">
                    Exceptions Mode
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-white/70">
                <span>Week {selectedWeek.week_number}</span>
                <span>•</span>
                <span>
                  {new Date(selectedWeek.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
                  {new Date(selectedWeek.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              disabled={refreshing}
              className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {!exceptionsMode && allSKUsLocked && !selectedWeek.allocation_submitted && (
              <button
                onClick={handleSendAwards}
                disabled={submitting}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Awards to Suppliers
                  </>
                )}
              </button>
            )}

            {exceptionsMode && allExceptionsResolved && (
              <button
                onClick={handleCloseLoop}
                disabled={closingLoop}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 shadow-lg hover:shadow-xl"
              >
                {closingLoop ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Closing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Close Loop
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overall Summary Panel */}
      {skuAllocations.length > 0 && !exceptionsMode && (
        <div className="bg-gradient-to-br from-slate-800/40 via-emerald-900/30 to-slate-800/40 backdrop-blur-xl rounded-2xl border-2 border-emerald-400/30 p-6 shadow-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-2">Total Volume</div>
              <div className="text-3xl font-black text-white">
                {overallTotalVolume.toLocaleString()} / {overallTotalNeeded.toLocaleString()}
              </div>
              <div className="text-xs text-white/50 mt-1">cases</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-2">Blended Avg Cost</div>
              <div className="text-3xl font-black text-emerald-300">
                {overallWeightedAvg > 0 ? formatCurrency(overallWeightedAvg) : '-'}
              </div>
              <div className="text-xs text-white/50 mt-1">per case</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-2">Total Cost</div>
              <div className="text-3xl font-black text-lime-300">
                {formatCurrency(overallTotalCost)}
              </div>
              <div className="text-xs text-white/50 mt-1">FOB</div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-xs text-white/60 font-bold uppercase tracking-wider mb-2">Locked SKUs</div>
              <div className="text-3xl font-black text-blue-300">
                {lockedCount} / {skuAllocations.length}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {allSKUsLocked ? '✓ Ready to Send' : 'Lock all to send'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SKU Allocations */}
      {skuAllocations.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-12 text-center border border-white/20">
          <Package className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <p className="text-white/80 text-lg font-bold">No SKUs with finalized pricing</p>
        </div>
      ) : (
        <div className="space-y-4">
          {skuAllocations.map((sku) => {
            const remaining = sku.volumeNeeded - sku.totalAllocated;
            const isComplete = sku.totalAllocated === sku.volumeNeeded && sku.volumeNeeded > 0;
            const isOver = sku.totalAllocated > sku.volumeNeeded;
            const isExpanded = expandedSKUs.has(sku.item.id);
            const cheapestPrice = sku.entries.length > 0 ? Math.min(...sku.entries.map(e => e.price)) : 0;
            const cheapestSupplier = sku.entries.find(e => e.price === cheapestPrice);
            const targetDiff = sku.targetPrice > 0 ? sku.weightedAvgPrice - sku.targetPrice : 0;

            // In exceptions mode, only show SKUs with exceptions
            if (exceptionsMode) {
              const hasException = sku.entries.some(e => 
                e.supplier_response_status === 'revised' || 
                (e.supplier_response_status === 'pending' && e.supplier_response_volume !== null)
              );
              if (!hasException) return null;
            }

            return (
              <div key={sku.item.id} className="bg-gradient-to-br from-slate-800/40 via-emerald-900/20 to-slate-800/40 backdrop-blur-xl rounded-2xl border-2 border-emerald-400/30 overflow-hidden shadow-2xl hover:border-emerald-400/50 transition-all">
                {/* SKU Header */}
                <div className="bg-gradient-to-r from-emerald-500/15 to-lime-500/15 px-6 py-5 border-b border-white/10">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-black text-white">{sku.item.name}</h3>
                        {sku.isLocked && (
                          <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 rounded-full text-xs font-bold border border-emerald-400/50 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Locked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-sm text-white/80">
                        <span>{sku.item.pack_size}</span>
                        <span className="px-2 py-1 bg-white/20 rounded-lg font-bold text-white border border-white/30">
                          {sku.item.organic_flag}
                        </span>
                        <span className="capitalize">{sku.item.category}</span>
                      </div>
                    </div>

                    {/* Volume Progress */}
                    <div className="bg-white/8 backdrop-blur-sm rounded-xl border border-white/15 px-6 py-4 min-w-[240px]">
                      <div className="text-xs text-white/80 font-bold mb-2 uppercase tracking-wider">Allocation</div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={`text-4xl font-black ${
                          isComplete ? 'text-green-300' : isOver ? 'text-red-300' : 'text-emerald-300'
                        }`}>
                          {sku.totalAllocated.toLocaleString()}
                        </span>
                        <span className="text-white/40 text-2xl">/</span>
                        <span className="text-4xl font-black text-white">
                          {sku.volumeNeeded.toLocaleString()}
                        </span>
                        <span className="text-sm text-white/70 font-semibold ml-1">cases</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 mb-1 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isComplete ? 'bg-gradient-to-r from-green-400 to-green-500' :
                            isOver ? 'bg-gradient-to-r from-red-400 to-red-500' :
                            'bg-gradient-to-r from-emerald-400 to-lime-400'
                          }`}
                          style={{ width: `${Math.min((sku.totalAllocated / sku.volumeNeeded) * 100, 100)}%` }}
                        />
                      </div>
                      {sku.volumeNeeded > 0 && (
                        <div className="text-xs text-white/60 mt-1">
                          {isComplete ? '✓ Complete' : isOver ? `${Math.abs(remaining).toLocaleString()} over` : `${remaining.toLocaleString()} remaining`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Details Section */}
                {isExpanded && (
                  <div className="border-t-2 border-white/10 bg-white/5">
                    {/* AI Suggestions Panel */}
                    {!exceptionsMode && (
                      <div className="p-6 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border-b border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                          <Brain className="w-5 h-5 text-blue-300" />
                          <h4 className="text-lg font-bold text-white">AI Suggestions</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                            <div className="text-xs text-white/70 font-bold uppercase tracking-wider mb-2">Cheapest Mix</div>
                            <div className="text-xl font-black text-blue-300">
                              {cheapestSupplier ? formatCurrency(cheapestPrice) : '-'}
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {cheapestSupplier ? `All to ${cheapestSupplier.supplier_name}` : 'No suppliers'}
                            </div>
                          </div>
                          <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                            <div className="text-xs text-white/70 font-bold uppercase tracking-wider mb-2">Target Status</div>
                            {sku.targetPrice > 0 ? (
                              <>
                                <div className={`text-xl font-black flex items-center gap-2 ${
                                  Math.abs(targetDiff) < 0.01 ? 'text-green-300' :
                                  targetDiff > 0 ? 'text-orange-300' : 'text-blue-300'
                                }`}>
                                  {targetDiff > 0 ? (
                                    <TrendingUp className="w-5 h-5" />
                                  ) : targetDiff < 0 ? (
                                    <TrendingDown className="w-5 h-5" />
                                  ) : (
                                    <CheckCircle className="w-5 h-5" />
                                  )}
                                  {Math.abs(targetDiff) < 0.01 ? 'On Target' : 
                                   targetDiff > 0 ? `+${formatCurrency(targetDiff)}` : 
                                   formatCurrency(Math.abs(targetDiff))}
                                </div>
                                <div className="text-xs text-white/50 mt-1">
                                  {targetDiff > 0 ? 'Above target' : targetDiff < 0 ? 'Below target' : 'Perfect'}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xl font-black text-white/50">Not Set</div>
                                <div className="text-xs text-white/50 mt-1">Set target price above</div>
                              </>
                            )}
                          </div>
                          <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                            <div className="text-xs text-white/70 font-bold uppercase tracking-wider mb-2">Fairness Score</div>
                            <div className="text-xl font-black text-purple-300">
                              {sku.fairnessWeight}%
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {sku.fairnessWeight === 0 ? 'Pure cheapest' :
                               sku.fairnessWeight === 100 ? 'Pure history' :
                               'Balanced'}
                            </div>
                          </div>
                        </div>

                        {/* AI Controls */}
                        {!sku.isLocked && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs text-white/70 font-bold uppercase tracking-wider mb-2 block">
                                  Fairness vs Cheapest: {sku.fairnessWeight}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={sku.fairnessWeight}
                                  onChange={(e) => setSkuAllocations(prev => prev.map(s => 
                                    s.item.id === sku.item.id ? { ...s, fairnessWeight: parseInt(e.target.value) } : s
                                  ))}
                                  className="w-full"
                                />
                                <div className="flex justify-between text-xs text-white/60 mt-1">
                                  <span>Cheapest</span>
                                  <span>Fair</span>
                                </div>
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => handleAIAutoAllocate(sku)}
                                  disabled={sku.targetPrice <= 0}
                                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Zap className="w-5 h-5" />
                                  Auto Allocate to Target
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compact Supplier Rows */}
                    <div className="p-6">
                      <div className="text-xs text-white/70 font-bold uppercase tracking-wider mb-4">Supplier Allocations</div>
                      <div className="space-y-2">
                        {sku.entries.map((entry, index) => {
                          const percentage = sku.volumeNeeded > 0
                            ? ((entry.awarded_volume / sku.volumeNeeded) * 100).toFixed(1)
                            : '0.0';
                          const rowCost = entry.price * entry.awarded_volume;
                          const isException = exceptionsMode && (
                            entry.supplier_response_status === 'revised' ||
                            (entry.supplier_response_status === 'pending' && entry.supplier_response_volume !== null)
                          );
                          const isCheapest = entry.price === cheapestPrice;
                          const isPreferred = entry.awarded_volume > 0 && entry.awarded_volume === sku.volumeNeeded;

                          // In exceptions mode, only show exceptions
                          if (exceptionsMode && !isException) return null;

                          return (
                            <div
                              key={entry.quote_id}
                              className={`bg-white/5 hover:bg-white/10 rounded-xl p-4 border transition-all ${
                                isCheapest ? 'border-emerald-400/50 bg-emerald-500/10' :
                                isException ? 'border-orange-400/50 bg-orange-500/10' :
                                'border-white/20'
                              }`}
                            >
                              <div className="grid grid-cols-6 gap-4 items-center">
                                {/* Supplier Name with Badges */}
                                <div className="col-span-2">
                                  <div className="flex items-center gap-2">
                                    <div className="font-bold text-white text-base">{entry.supplier_name}</div>
                                    {isCheapest && (
                                      <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-200 rounded text-xs font-bold border border-emerald-400/50">
                                        Cheapest
                                      </span>
                                    )}
                                    {isPreferred && (
                                      <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 rounded text-xs font-bold border border-blue-400/50">
                                        Preferred
                                      </span>
                                    )}
                                  </div>
                                  {entry.dlvd_price && (
                                    <div className="text-xs text-white/50 mt-0.5">
                                      {formatCurrency(entry.dlvd_price)} DLVD
                                    </div>
                                  )}
                                </div>

                                {/* Finalized Unit Cost */}
                                <div className="text-right">
                                  <div className="text-xs text-white/60 mb-1">Unit Cost</div>
                                  <div className="font-black text-white text-lg">{formatCurrency(entry.price)}</div>
                                </div>

                                {/* Proposed/Awarded Volume (Editable) */}
                                <div className="text-right">
                                  <div className="text-xs text-white/60 mb-1">Awarded</div>
                                  {sku.isLocked || exceptionsMode ? (
                                    <div className="font-black text-white text-lg">
                                      {entry.awarded_volume > 0 ? entry.awarded_volume.toLocaleString() : '-'}
                                    </div>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      value={entry.awarded_volume || ''}
                                      onChange={(e) => updateAllocation(
                                        sku.item.id,
                                        entry.supplier_id,
                                        entry.quote_id,
                                        parseInt(e.target.value) || 0
                                      )}
                                      placeholder="0"
                                      className="w-24 px-2 py-1.5 border-2 border-white/20 rounded-lg text-right font-black text-lg text-white bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                                    />
                                  )}
                                </div>

                                {/* Row Total Cost */}
                                <div className="text-right">
                                  <div className="text-xs text-white/60 mb-1">Row Cost</div>
                                  <div className="font-black text-emerald-300 text-lg">
                                    {rowCost > 0 ? formatCurrency(rowCost) : '-'}
                                  </div>
                                </div>

                                {/* Percentage */}
                                <div className="text-right">
                                  <div className="text-xs text-white/60 mb-1">Share</div>
                                  <div className="font-bold text-emerald-300 text-lg">
                                    {entry.awarded_volume > 0 ? `${percentage}%` : '-'}
                                  </div>
                                </div>

                                {/* Exception Response (if applicable) */}
                                {exceptionsMode && (
                                  <div className="col-span-6 mt-2 pt-2 border-t border-white/10">
                                    {entry.supplier_response_status === 'revised' && (
                                      <div className="flex items-center justify-between">
                                        <span className="px-2.5 py-1 bg-orange-500/30 text-orange-200 rounded-full text-xs font-bold border border-orange-400/50">
                                          Revised: {entry.supplier_response_volume?.toLocaleString()}
                                        </span>
                                        <button
                                          onClick={async () => {
                                            await updateAllocation(
                                              sku.item.id,
                                              entry.supplier_id,
                                              entry.quote_id,
                                              entry.supplier_response_volume || 0
                                            );
                                            showToast('Revised volume accepted', 'success');
                                            await loadData();
                                          }}
                                          className="flex items-center gap-1 px-3 py-1 bg-green-500/30 hover:bg-green-500/40 text-green-200 rounded-lg text-xs font-semibold border border-green-400/50 transition-all"
                                        >
                                          <Check className="w-3 h-3" />
                                          Accept
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

