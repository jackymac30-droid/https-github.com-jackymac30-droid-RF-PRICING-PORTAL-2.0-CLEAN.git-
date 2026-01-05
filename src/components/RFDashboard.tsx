import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, RefreshCw, ChevronDown, ChevronUp, TrendingUp, Award, Plus, Zap, Unlock, AlertTriangle, CheckCircle, CheckCircle2, DollarSign, BarChart3, Package, Lock, Shield, Mail, Clock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchWeeks,
  fetchItems,
  fetchSuppliers,
  fetchQuotes,
  fetchQuotesWithDetails,
  getSuppliersWithSubmissions,
  ensureQuotesForWeek,
  updateRFCounter,
  updateRFFinal,
  getQuotesForItem,
  createNewWeek,
  finalizePricingForWeek,
  updateWeekStatus,
  enforceWeekStatusHygiene,
  fetchVolumeNeeds
} from '../utils/database';
import { sendPricingReminder } from '../utils/emailService';
import type { Week, Item, Supplier, QuoteWithDetails } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Analytics } from './Analytics';
import { AwardVolume } from './AwardVolume';
import { VolumeAcceptance } from './VolumeAcceptance';
import { QuickStats } from './QuickStats';
import { NotificationCenter } from './NotificationCenter';
import { ExportData } from './ExportData';
import { PriceTicker } from './PriceTicker';
import { PricingIntelligence } from './PricingIntelligence';
import { PredictiveAnalytics } from './PredictiveAnalytics';
import { ExecutiveDashboard } from './ExecutiveDashboard';
import { SmartAlerts } from './SmartAlerts';
// Temporarily disabled to prevent errors
// import { ExecutiveDashboard } from './ExecutiveDashboard';
// import { SupplierPerformanceScorecard } from './SupplierPerformanceScorecard';
import { useRealtime } from '../hooks/useRealtime';
import { logger } from '../utils/logger';

export function RFDashboard() {
  const { session, logout } = useApp();
  const { showToast } = useToast();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [quotes, setQuotes] = useState<QuoteWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittedSuppliers, setSubmittedSuppliers] = useState<Supplier[]>([]);
  const [notSubmittedSuppliers, setNotSubmittedSuppliers] = useState<Supplier[]>([]);
  const [counterSuppliers, setCounterSuppliers] = useState<Supplier[]>([]);
  const [finalizedSuppliers, setFinalizedSuppliers] = useState<Supplier[]>([]);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [finalInputs, setFinalInputs] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'not_submitted' | 'submitted' | 'counter' | 'finalized'>('not_submitted');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [itemQuotes, setItemQuotes] = useState<Record<string, QuoteWithDetails[]>>({});
  const [mainView, setMainView] = useState<'pricing' | 'analytics' | 'award_volume' | 'volume_acceptance' | 'intelligence' | 'predictions' | 'executive' | 'alerts'>('pricing');
  const [pricingTab, setPricingTab] = useState<'manual' | 'smart' | 'bulk'>('manual');
  const [showCreateWeekModal, setShowCreateWeekModal] = useState(false);
  const [weekAverages, setWeekAverages] = useState<Record<string, number>>({});
  const [submittingCounters, setSubmittingCounters] = useState(false);
  const [submittingFinals, setSubmittingFinals] = useState(false);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [finalizingPricing, setFinalizingPricing] = useState(false);
  const [sendingReminders, setSendingReminders] = useState<Record<string, boolean>>({});
  const [finalizingItems, setFinalizingItems] = useState<Record<string, boolean>>({});
  const [volumeNeedsMap, setVolumeNeedsMap] = useState<Map<string, number>>(new Map());
  const [volumeNeeds, setVolumeNeeds] = useState<Record<string, number>>({});

  // Listen for navigation to Volume Acceptance from Award Volume
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      setMainView('volume_acceptance');
      if (event.detail?.weekId && selectedWeek?.id !== event.detail.weekId) {
        // Week is already selected, just switch view
      }
    };

    window.addEventListener('navigate-to-volume-acceptance', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('navigate-to-volume-acceptance', handleNavigate as EventListener);
    };
  }, [selectedWeek]);

  useEffect(() => {
    if (selectedWeek && selectedSupplier) {
      loadQuotes();
      setCounterInputs({});
      setFinalInputs({});
    }
  }, [selectedWeek, selectedSupplier]);

  useEffect(() => {
    if (selectedWeek?.status === 'open' && quotes.length > 0 && selectedSupplier) {
      const newCounterInputs: Record<string, string> = {};
      const newFinalInputs: Record<string, string> = {};

      quotes.forEach(quote => {
        if (quote.rf_counter_fob && quote.supplier_fob) {
          newCounterInputs[quote.item_id] = quote.rf_counter_fob.toString();
        }
        if (quote.rf_final_fob && quote.supplier_response) {
          newFinalInputs[quote.item_id] = quote.rf_final_fob.toString();
        }
      });

      if (Object.keys(newCounterInputs).length > 0) {
        setCounterInputs(newCounterInputs);
      }
      if (Object.keys(newFinalInputs).length > 0) {
        setFinalInputs(newFinalInputs);
      }
    }
  }, [selectedWeek?.status, quotes, selectedSupplier]);

  const loadData = useCallback(async () => {
    try {
      await enforceWeekStatusHygiene();

      const [weeksData, itemsData, suppliersData] = await Promise.all([
        fetchWeeks(),
        fetchItems(),
        fetchSuppliers(),
      ]);
      setWeeks(weeksData);
      setItems(itemsData);
      setSuppliers(suppliersData);
      
      if (suppliersData.length === 0) {
        logger.warn('No suppliers found in database');
        showToast('No suppliers found. Please add suppliers to the database.', 'warning');
      } else {
        // Suppliers loaded successfully
      }

      // Batch fetch all quotes at once instead of sequential loop (N+1 optimization)
      const { supabase } = await import('../utils/supabase');
      const weekIds = weeksData.map(w => w.id);
      const { data: allQuotes } = await supabase
        .from('quotes')
        .select('week_id, supplier_fob')
        .in('week_id', weekIds)
        .not('supplier_fob', 'is', null);

      // Calculate averages from batched data
      const averages: Record<string, number> = {};
      for (const week of weeksData) {
        const weekQuotes = allQuotes?.filter(q => q.week_id === week.id) || [];
        const prices = weekQuotes
          .map(q => q.supplier_fob)
          .filter((p): p is number => p !== null && p !== undefined);

        if (prices.length > 0) {
          const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          averages[week.id] = avg;
        }
      }
      setWeekAverages(averages);

      // Select OPEN week ordered by start_date DESC
      const openWeeks = weeksData
        .filter(w => w.status === 'open')
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

      const openWeek = openWeeks[0];

      if (openWeek) {
        setSelectedWeek(openWeek);
      } else {
        // If no open week, select the most recent week (closed or open) for viewing
        const allWeeksSorted = [...weeksData].sort((a, b) => 
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
        if (allWeeksSorted.length > 0) {
          setSelectedWeek(allWeeksSorted[0]);
        }
      }
    } catch (err) {
      logger.error('Error loading data:', err);
      showToast('Failed to load dashboard data. Please check your connection and try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeekData = useCallback(async () => {
    if (!selectedWeek) return;
    try {
      await ensureQuotesForWeek(selectedWeek.id);
      const supplierData = await getSuppliersWithSubmissions(selectedWeek.id);
      setSubmittedSuppliers(supplierData.submitted);
      setNotSubmittedSuppliers(supplierData.notSubmitted);
      setCounterSuppliers(supplierData.counter);
      setFinalizedSuppliers(supplierData.finalized);
    } catch (err) {
      logger.error('Error loading week data:', err);
    }
  }, [selectedWeek]);

  const loadQuotes = useCallback(async () => {
    if (!selectedWeek || !selectedSupplier) return;
    try {
      const quotesData = await fetchQuotesWithDetails(selectedWeek.id, selectedSupplier.id);
      setQuotes(quotesData);
    } catch (err) {
      logger.error('Error loading quotes:', err);
      showToast('Failed to load quotes. Please try again.', 'error');
    }
  }, [selectedWeek, selectedSupplier]);

  // Set up realtime subscriptions after functions are defined
  const handleRealtimeQuotes = useCallback(() => {
    if (selectedWeek) {
      loadWeekData().catch(err => logger.error('Error in realtime loadWeekData:', err));
    }
    if (selectedWeek && selectedSupplier) {
      loadQuotes().catch(err => logger.error('Error in realtime loadQuotes:', err));
    }
  }, [selectedWeek, selectedSupplier, loadWeekData, loadQuotes]);
  
  useRealtime('quotes', handleRealtimeQuotes);
  useRealtime('weeks', loadData);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData();
      loadVolumeNeeds();
    }
  }, [selectedWeek, loadWeekData]);

  async function loadVolumeNeeds() {
    if (!selectedWeek) return;
    try {
      const volumeData = await fetchVolumeNeeds(selectedWeek.id);
      const volumeMap = new Map<string, number>();
      volumeData.forEach(v => {
        volumeMap.set(v.item_id, v.volume_needed || 0);
      });
      setVolumeNeedsMap(volumeMap);
    } catch (err) {
      logger.error('Error loading volume needs:', err);
    }
  }

  useEffect(() => {
    if (selectedWeek && selectedSupplier) {
      loadQuotes();
      setCounterInputs({});
      setFinalInputs({});
    }
  }, [selectedWeek, selectedSupplier, loadQuotes]);

  // Multi-Supplier-Per-SKU View:
  // When RF clicks "Quotes" button, this loads ALL suppliers' quotes for that SKU
  // This allows RF to compare prices across suppliers and make informed decisions
  // Each quote is independent: (week_id, item_id, supplier_id) - one per supplier per SKU
  async function toggleItemQuotes(itemId: string) {
    if (!selectedWeek) return;

    if (expandedItem === itemId) {
      setExpandedItem(null);
      return;
    }

    setExpandedItem(itemId);

    // Always reload to get latest data
    try {
      // Load all quotes for this SKU across all suppliers
      const quotes = await getQuotesForItem(selectedWeek.id, itemId);
      setItemQuotes(prev => ({ ...prev, [itemId]: quotes }));
    } catch (err) {
      logger.error('Error loading item quotes:', err);
    }
  }

  const handleSubmitCounters = async () => {
    if (submittingCounters) return;

    const updates = Object.entries(counterInputs).filter(([_, v]) => v);

    if (updates.length === 0) {
      // Quiet UI: No warning during planning
      return;
    }

    setSubmittingCounters(true);
    try {
      let successCount = 0;
      for (const [itemId, value] of updates) {
        const quote = quotes.find(q => q.item_id === itemId);
        if (!quote) continue;

        const counter = parseFloat(parseFloat(value).toFixed(2));
        const success = await updateRFCounter(quote.id, counter);
        if (success) successCount++;
      }

      if (successCount > 0) {
        showToast(`${successCount} counter(s) submitted successfully`, 'success');
        setCounterInputs({});
        await loadWeekData();
        setSelectedSupplier(null);
      } else {
        showToast('Just a note: Counters not submitted', 'error');
      }
    } finally {
      setSubmittingCounters(false);
    }
  };

  const handleSubmitFinals = async () => {
    if (submittingFinals) return;

    const updates = Object.entries(finalInputs).filter(([_, v]) => v);

    if (updates.length === 0) {
      showToast('Please enter at least one final price', 'error');
      return;
    }

    setSubmittingFinals(true);
    try {
      let successCount = 0;

      for (const [itemId, value] of updates) {
        const quote = quotes.find(q => q.item_id === itemId);
        if (!quote) continue;

        const final = parseFloat(parseFloat(value).toFixed(2));
        const success = await updateRFFinal(quote.id, final);
        if (success) successCount++;
      }

      // Auto-finalize logic: only handle quotes that need manual finalization
      // (accepted counters are already auto-finalized when supplier responds)
      for (const quote of quotes) {
        if (!quote.rf_final_fob && !finalInputs[quote.item_id] && quote.supplier_fob !== null) {
          // Supplier revised - RF needs to review and finalize
          if (quote.supplier_revised_fob) {
            await updateRFFinal(quote.id, quote.supplier_revised_fob);
            successCount++;
          } 
          // Supplier accepted counter - already auto-finalized, skip
          // Direct accept (no counter) - finalize to supplier's price
          else if (!quote.rf_counter_fob) {
            await updateRFFinal(quote.id, quote.supplier_fob);
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        showToast(`${successCount} final price(s) set successfully`, 'success');
        setFinalInputs({});
        await loadWeekData();
        setSelectedSupplier(null);
      } else {
        showToast('Heads up: Final prices not set', 'error');
      }
    } finally {
      setSubmittingFinals(false);
    }
  };

  const handlePushToFinalize = async () => {
    if (submittingCounters || submittingFinals) return;

    const hasCounters = Object.entries(counterInputs).filter(([_, v]) => v).length > 0;
    const hasFinals = Object.entries(finalInputs).filter(([_, v]) => v).length > 0;
    const hasSupplierResponses = quotes.some(q => q.supplier_response !== null);
    const hasExistingCounters = quotes.some(q => q.rf_counter_fob !== null);
    const hasSupplierPrices = quotes.some(q => q.supplier_fob !== null);

    // Allow finalization if there are any quotes with supplier prices, even without manual inputs
    if (!hasCounters && !hasFinals && !hasSupplierResponses && !hasExistingCounters && !hasSupplierPrices) {
      showToast('No pricing data to finalize. Please enter supplier prices first.', 'error');
      return;
    }

    setSubmittingCounters(true);
    setSubmittingFinals(true);
    try {
      let counterCount = 0;
      let finalCount = 0;

      // First, send any counters that were entered
      if (hasCounters) {
        for (const [itemId, value] of Object.entries(counterInputs)) {
          if (!value) continue;
          const quote = quotes.find(q => q.item_id === itemId);
          if (!quote) continue;

          const counter = parseFloat(parseFloat(value).toFixed(2));
          const success = await updateRFCounter(quote.id, counter);
          if (success) counterCount++;
        }
      }

      // Then, set final prices for all quotes that need them
      // Process manually entered final prices first
      if (hasFinals) {
        for (const [itemId, value] of Object.entries(finalInputs)) {
          if (!value) continue;
          const quote = quotes.find(q => q.item_id === itemId);
          if (!quote || quote.rf_final_fob) continue;

          const final = parseFloat(parseFloat(value).toFixed(2));
          const success = await updateRFFinal(quote.id, final);
          if (success) finalCount++;
        }
      }

      // Auto-finalize logic: handle ALL quotes that need finalization
      for (const quote of quotes) {
        // Skip if already has final price
        if (quote.rf_final_fob) continue;
        
        // Skip if manually entered in finalInputs (already processed above)
        if (finalInputs[quote.item_id]) continue;
        
        // Only process quotes with supplier prices
        if (quote.supplier_fob === null) continue;

        // Supplier revised - RF should use revised price
        if (quote.supplier_revised_fob) {
          const success = await updateRFFinal(quote.id, quote.supplier_revised_fob);
          if (success) finalCount++;
        } 
        // Supplier accepted counter - use counter price
        else if (quote.rf_counter_fob && quote.supplier_response === 'accept') {
          const success = await updateRFFinal(quote.id, quote.rf_counter_fob);
          if (success) finalCount++;
        }
        // Counter exists but no supplier response yet - finalize to counter price
        else if (quote.rf_counter_fob && !quote.supplier_response) {
          const success = await updateRFFinal(quote.id, quote.rf_counter_fob);
          if (success) finalCount++;
        }
        // No counter, just supplier price - finalize to supplier's price
        else if (!quote.rf_counter_fob && quote.supplier_fob) {
          const success = await updateRFFinal(quote.id, quote.supplier_fob);
          if (success) finalCount++;
        }
      }

      const messages = [];
      if (counterCount > 0) messages.push(`${counterCount} counter(s) sent`);
      if (finalCount > 0) messages.push(`${finalCount} final price(s) set`);

      if (messages.length > 0) {
        showToast(messages.join(', '), 'success');
        setCounterInputs({});
        setFinalInputs({});
        // Reload quotes and week data to refresh supplier statuses
        await loadQuotes();
        await loadWeekData();
        // Don't clear selectedSupplier - let user see the results
      } else {
        showToast('No changes were made. All prices may already be finalized.', 'info');
        // Still reload to check if finalize button should appear
        await loadQuotes();
        await loadWeekData();
      }
    } catch (err) {
      logger.error('Error in handlePushToFinalize:', err);
      showToast('Failed to finalize prices. Please try again.', 'error');
    } finally {
      setSubmittingCounters(false);
      setSubmittingFinals(false);
    }
  };

  const handleSendReminder = async (supplier: Supplier) => {
    if (!selectedWeek || sendingReminders[supplier.id]) return;

    // Get test email from environment or use supplier email
    const testEmail = import.meta.env.VITE_TEST_EMAIL;
    const recipientEmail = testEmail || supplier.email;
    const isTestMode = !!testEmail;

    setSendingReminders(prev => ({ ...prev, [supplier.id]: true }));
    try {
      const result = await sendPricingReminder(supplier, selectedWeek, selectedWeek.id, testEmail);
      
      if (result.success) {
        const message = isTestMode 
          ? `Test reminder sent to ${testEmail} (would go to ${supplier.name})`
          : `Reminder sent to ${supplier.name}`;
        showToast(message, 'success');
      } else {
        showToast(`Failed to send reminder: ${result.error}`, 'error');
      }
    } catch (err: unknown) {
      logger.error('Error sending reminder:', err);
      showToast(`Failed to send reminder: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setSendingReminders(prev => ({ ...prev, [supplier.id]: false }));
    }
  };

  const handleCreateWeek = async () => {
    if (creatingWeek) return;

    setCreatingWeek(true);
    try {
      const newWeek = await createNewWeek();
      if (newWeek) {
        showToast(`Week ${newWeek.week_number} created and opened for all suppliers`, 'success');
        setShowCreateWeekModal(false);
        await loadData();
        setSelectedWeek(newWeek);
      } else {
        showToast('Failed to create new week', 'error');
      }
    } finally {
      setCreatingWeek(false);
    }
  };

  const handleFinalizeItem = async (itemId: string) => {
    if (!selectedWeek || finalizingItems[itemId]) return;

    setFinalizingItems(prev => ({ ...prev, [itemId]: true }));
    try {
      // Get all quotes for this item
      const itemQuotesList = itemQuotes[itemId] || [];
      const quotesToFinalize = itemQuotesList.filter(q => !q.rf_final_fob && q.supplier_fob !== null);
      
      if (quotesToFinalize.length === 0) {
        showToast('No quotes to finalize for this item', 'info');
        return;
      }

      let finalizedCount = 0;
      for (const quote of quotesToFinalize) {
        // Use supplier revised price if available, otherwise use counter or supplier price
        const finalPrice = quote.supplier_revised_fob || quote.rf_counter_fob || quote.supplier_fob;
        if (finalPrice) {
          const success = await updateRFFinal(quote.id, finalPrice);
          if (success) finalizedCount++;
        }
      }

      if (finalizedCount > 0) {
        showToast(`${finalizedCount} quote(s) finalized for ${items.find(i => i.id === itemId)?.name}`, 'success');
        // Reload quotes for this item
        await toggleItemQuotes(itemId);
        await loadQuotes();
      } else {
        showToast('No quotes were finalized', 'info');
      }
    } catch (err) {
      logger.error('Error finalizing item:', err);
      showToast('Failed to finalize item', 'error');
    } finally {
      setFinalizingItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleFinalizePricing = async () => {
    if (!selectedWeek || finalizingPricing) return;

    setFinalizingPricing(true);
    try {
      const result = await finalizePricingForWeek(selectedWeek.id, session?.user_name || 'RF Manager');
      if (result.success) {
        // Fetch the updated week from database to ensure we have the latest state
        const { supabase } = await import('../utils/supabase');
        const { data: updatedWeekData, error: weekError } = await supabase
          .from('weeks')
          .select('*')
          .eq('id', selectedWeek.id)
          .single();

        if (weekError || !updatedWeekData) {
          logger.error('Error fetching updated week:', weekError);
          // Fallback to local update
          const updatedWeek = { 
            ...selectedWeek, 
            status: 'finalized' as const
          };
          setSelectedWeek(updatedWeek);
          setWeeks(prev => prev.map(w => w.id === selectedWeek.id ? updatedWeek : w));
        } else {
          // Use the actual updated week from database
          const updatedWeek = updatedWeekData as Week;
          setSelectedWeek(updatedWeek);
          setWeeks(prev => prev.map(w => w.id === selectedWeek.id ? updatedWeek : w));
        }
        
        // Reload week data to refresh supplier statuses
        await loadWeekData();
        
        // If we're on the pricing tab, suggest switching to award volume
        if (mainView === 'pricing') {
          showToast('Pricing finalized! Switch to Award Volume tab to allocate volumes.', 'success');
        } else {
          showToast('Pricing finalized successfully! You can now allocate volumes.', 'success');
        }
      } else {
        showToast(result.error || 'Failed to finalize pricing', 'error');
      }
    } catch (err) {
      logger.error('Error finalizing pricing:', err);
      showToast('Failed to finalize pricing. Please try again.', 'error');
    } finally {
      setFinalizingPricing(false);
    }
  };

  const handleEmergencyReopen = async () => {
    if (!selectedWeek || finalizingPricing) return;

    setFinalizingPricing(true);
    try {
      const success = await updateWeekStatus(selectedWeek.id, 'open');
      if (success) {
        setSelectedWeek({ ...selectedWeek, status: 'open' });
        showToast('Week reopened for emergency changes. All pricing and allocations can now be edited.', 'success');
        await loadData();
      } else {
        showToast('Failed to reopen week', 'error');
      }
    } finally {
      setFinalizingPricing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-emerald-800 font-semibold text-lg">Loading RF Dashboard...</p>
      </div>
    </div>;
  }

  // Empty state: no data at all
  if (suppliers.length === 0 || items.length === 0 || weeks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Package className="w-16 h-16 text-white/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Data Available</h3>
          <p className="text-white/60 mb-4">
            The database is empty. Please seed the database to get started.
          </p>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4 text-left text-sm text-white/70">
            <p className="font-semibold mb-2">Current Status:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{suppliers.length} suppliers</li>
              <li>{items.length} items</li>
              <li>{weeks.length} weeks</li>
            </ul>
            <p className="mt-4 font-semibold">To get started:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Go to the login page</li>
              <li>Click "Seed Database" button (visible in dev mode)</li>
              <li>Or run the SQL seed script in Supabase</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnly = selectedWeek?.status !== 'open';
  const hasInitialPrices = quotes.some(q => q.supplier_fob !== null);
  const hasCountersSent = quotes.some(q => q.rf_counter_fob !== null);
  const canSendCounters = !isReadOnly && hasInitialPrices && !hasCountersSent;
  const canSetFinal = !isReadOnly && hasCountersSent;

  // Pricing Finalization Gates:
  // - Week must be 'open' status
  // - At least one quote must have finalized pricing (rf_final_fob set)
  // - finalizePricingForWeek() validates that at least one quote has rf_final_fob
  const allFinalPricesSet = quotes.length > 0 && quotes.every(q => q.rf_final_fob !== null);
  const hasAnyFinalPrices = quotes.some(q => q.rf_final_fob !== null);
  const canFinalizePricing = selectedWeek?.status === 'open' && (finalizedSuppliers.length > 0 || hasAnyFinalPrices);
  const isPricingFinalized = selectedWeek?.status === 'finalized';

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-lime-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/10 rounded-full blur-3xl"></div>

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]"
        style={{
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 70%, transparent 110%)'
        }}
      ></div>

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <header className="relative bg-white/10 backdrop-blur-2xl shadow-2xl border-b-2 border-emerald-500/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/image.png"
                alt="Robinson Fresh"
                className="h-16 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
              <div className="border-l-2 border-emerald-400/30 pl-4">
                <h1 className="text-2xl font-bold text-white">Robinson Fresh</h1>
                <p className="text-sm text-emerald-300 font-semibold">Volume & Pricing Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <button
                onClick={() => setShowCreateWeekModal(true)}
                disabled={creatingWeek}
                className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingWeek ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Week
                  </>
                )}
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Main Workflow Tabs: Pricing → Award Volume → Acceptance */}
        <div className="mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">Volume Management Workflow</h2>
            <p className="text-sm text-emerald-200">Manage the complete cycle: Pricing negotiation → Volume allocation → Supplier acceptance</p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setMainView('pricing')}
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 border-2 ${
                mainView === 'pricing'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-2xl scale-105'
                  : 'bg-white/10 backdrop-blur-md border-white/20 hover:border-emerald-400/50 hover:bg-white/15 hover:shadow-xl hover:scale-102 shadow-lg'
              }`}
            >
              <div className="p-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    mainView === 'pricing'
                      ? 'bg-white/20'
                      : 'bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors'
                  }`}>
                    <DollarSign className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  {mainView === 'pricing' && (
                    <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-1">1. Pricing</h3>
                <p className="text-sm text-white/90">
                  Negotiate pricing with suppliers
                </p>
              </div>
            </button>

            <button
              onClick={() => setMainView('award_volume')}
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 border-2 ${
                mainView === 'award_volume'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-2xl scale-105'
                  : 'bg-white/10 backdrop-blur-md border-white/20 hover:border-emerald-400/50 hover:bg-white/15 hover:shadow-xl hover:scale-102 shadow-lg'
              }`}
            >
              <div className="p-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    mainView === 'award_volume'
                      ? 'bg-white/20'
                      : 'bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors'
                  }`}>
                    <Award className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  {mainView === 'award_volume' && (
                    <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-1">2. Award Volume</h3>
                <p className="text-sm text-white/90">
                  Allocate volume to suppliers
                </p>
              </div>
            </button>

            <button
              onClick={() => setMainView('volume_acceptance')}
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 border-2 ${
                mainView === 'volume_acceptance'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-2xl scale-105'
                  : 'bg-white/10 backdrop-blur-md border-white/20 hover:border-emerald-400/50 hover:bg-white/15 hover:shadow-xl hover:scale-102 shadow-lg'
              }`}
            >
              <div className="p-6 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    mainView === 'volume_acceptance'
                      ? 'bg-white/20'
                      : 'bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors'
                  }`}>
                    <CheckCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  {mainView === 'volume_acceptance' && (
                    <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-1">3. Acceptance</h3>
                <p className="text-sm text-white/90">
                  Review and finalize supplier responses
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Analytics & Intelligence - Separate Section */}
        <div className="mb-10">
          <div className="border-t border-white/10 pt-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white mb-2">Analytics & Intelligence</h2>
              <p className="text-sm text-emerald-200">AI-powered insights, predictions, and comprehensive performance analytics</p>
            </div>
            
            {/* Intelligence Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setMainView('analytics')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  mainView === 'analytics'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Analytics
              </button>
              <button
                onClick={() => setMainView('intelligence')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  mainView === 'intelligence'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >
                <Zap className="w-4 h-4 inline mr-2" />
                AI Insights
              </button>
              <button
                onClick={() => setMainView('predictions')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  mainView === 'predictions'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Predictions
              </button>
            </div>
            <button
              onClick={() => setMainView('analytics')}
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 border-2 w-full ${
                mainView === 'analytics'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-2xl'
                  : 'bg-white/10 backdrop-blur-md border-white/20 hover:border-emerald-400/50 hover:bg-white/15 hover:shadow-xl shadow-lg'
              }`}
            >
              <div className="p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      mainView === 'analytics'
                        ? 'bg-white/20'
                        : 'bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors'
                    }`}>
                      <BarChart3 className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-bold mb-1">Analytics</h3>
                      <p className="text-sm text-white/90">
                        View insights, trends, and performance metrics across all weeks and suppliers
                      </p>
                    </div>
                  </div>
                  {mainView === 'analytics' && (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        {mainView === 'analytics' ? (
          <Analytics />
        ) : mainView === 'intelligence' ? (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <PricingIntelligence 
                quotes={selectedWeek ? quotes.filter(q => q.week_id === selectedWeek.id) : quotes}
                items={items}
                week={selectedWeek || undefined}
              />
            </div>
          </div>
        ) : mainView === 'predictions' ? (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-6">
              <PredictiveAnalytics 
                quotes={selectedWeek ? quotes.filter(q => q.week_id === selectedWeek.id) : quotes}
                items={items}
                historicalData={[]}
              />
            </div>
          </div>
        ) : mainView === 'executive' ? (
          <ExecutiveDashboard />
        ) : mainView === 'alerts' ? (
          <SmartAlerts />
        ) : mainView === 'award_volume' ? (
          <>
            {selectedWeek && selectedWeek.status === 'open' && canFinalizePricing && (
              <div className="mb-4 bg-orange-500/10 backdrop-blur-sm rounded-lg border border-orange-400/30 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-300" />
                  <div>
                    <p className="text-sm text-white/90 font-medium">Pricing must be finalized first</p>
                    <p className="text-xs text-white/60 mt-0.5">Go to the Pricing tab to finalize week pricing before allocating volume</p>
                  </div>
                </div>
              </div>
            )}
            <AwardVolume 
              selectedWeek={selectedWeek} 
              onWeekUpdate={(updatedWeek) => {
                setSelectedWeek(updatedWeek);
                // Also update in weeks list
                setWeeks(prev => prev.map(w => w.id === updatedWeek.id ? updatedWeek : w));
              }}
            />
          </>
        ) : mainView === 'volume_acceptance' ? (
          selectedWeek ? (
            <VolumeAcceptance weekId={selectedWeek.id} />
          ) : (
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-12 text-center">
              <p className="text-white/80 text-lg font-semibold mb-2">No Week Selected</p>
              <p className="text-white/60">Please select a week from the Pricing tab to view volume acceptances.</p>
            </div>
          )
        ) : (
          <div>
        {/* Week & Supplier Selection - Compact */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-2">
                <Package className="w-3.5 h-3.5" />
                Week
              </label>
              <div className="relative">
                <select
                  value={selectedWeek?.id || ''}
                  onChange={e => {
                    const week = weeks.find(w => w.id === e.target.value);
                    setSelectedWeek(week || null);
                    setSelectedSupplier(null);
                  }}
                  className="w-full px-3 py-2 pr-8 text-sm border-2 border-white/20 bg-white/10 backdrop-blur-sm rounded-lg font-medium text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg hover:border-white/30 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-white">Select week...</option>
                  {weeks.map(week => (
                    <option key={week.id} value={week.id} className="bg-slate-900 text-white">
                      Week {week.week_number} - {week.status.toUpperCase()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-emerald-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {selectedWeek && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    selectedWeek.status === 'open' ? 'bg-emerald-500/30 text-emerald-300' :
                    selectedWeek.status === 'finalized' ? 'bg-blue-500/30 text-blue-300' :
                    'bg-white/10 text-white/70'
                  }`}>
                    {selectedWeek.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-white/60">
                    {selectedWeek.start_date} - {selectedWeek.end_date}
                  </span>
                </div>
              )}
            </div>

            {selectedWeek && (
              <div>
                <label className="block text-xs font-semibold text-emerald-300 mb-1.5 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5" />
                  Supplier
                </label>
                <div className="relative">
                  <select
                    value={selectedSupplier?.id || ''}
                    onChange={e => {
                      const supplier = suppliers.find(s => s.id === e.target.value);
                      setSelectedSupplier(supplier || null);
                    }}
                    className="w-full px-3 py-2 pr-8 text-sm border-2 border-white/20 bg-white/10 backdrop-blur-sm rounded-lg font-medium text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg hover:border-white/30 appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-white">Select supplier...</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id} className="bg-slate-900 text-white">
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-emerald-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {selectedSupplier && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => setSelectedSupplier(null)}
                      className="text-xs text-emerald-300 hover:text-emerald-200 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedWeek && !selectedSupplier && (
          <>
            <QuickStats weekId={selectedWeek.id} />
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 transition-all duration-300 overflow-hidden hover:bg-white/15 hover:border-emerald-400/50 hover:shadow-xl group">
              <button
                onClick={() => setExpandedCard(expandedCard === 'not_submitted' ? null : 'not_submitted')}
                className="w-full p-3.5 text-left transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                    Not Submitted
                  </h3>
                  <span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-xs font-bold shadow-sm">{notSubmittedSuppliers.length}</span>
                </div>
                <div className="space-y-1.5">
                  {(expandedCard === 'not_submitted' ? notSubmittedSuppliers : notSubmittedSuppliers.slice(0, 2)).map(supplier => (
                    <div key={supplier.id} className="flex items-center justify-between gap-2 group">
                      <div className="text-xs text-white/80 truncate font-medium hover:text-white transition-colors flex-1">
                        {supplier.name}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendReminder(supplier);
                        }}
                        disabled={sendingReminders[supplier.id] || !selectedWeek || selectedWeek.status !== 'open'}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/20 rounded text-emerald-300 hover:text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Send pricing reminder email"
                      >
                        {sendingReminders[supplier.id] ? (
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                  {notSubmittedSuppliers.length === 0 && (
                    <p className="text-emerald-300 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      All submitted
                    </p>
                  )}
                </div>
              </button>
              {notSubmittedSuppliers.length > 2 && expandedCard !== 'not_submitted' && (
                <div className="px-3.5 pb-2.5 text-xs text-white/60 font-medium border-t border-white/5 pt-2">
                  +{notSubmittedSuppliers.length - 2} more
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border-l-2 border-emerald-500 transition-all duration-300 overflow-hidden hover:bg-white/15 hover:border-emerald-400 hover:shadow-xl group">
              <button
                onClick={() => setExpandedCard(expandedCard === 'submitted' ? null : 'submitted')}
                className="w-full p-3.5 text-left transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></div>
                    Submitted
                  </h3>
                  <span className="px-2.5 py-1 bg-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold shadow-sm">{submittedSuppliers.length}</span>
                </div>
                <div className="space-y-1.5">
                  {(expandedCard === 'submitted' ? submittedSuppliers : submittedSuppliers.slice(0, 2)).map(supplier => (
                    <button
                      key={supplier.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSupplier(supplier);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-white/80 font-medium hover:text-emerald-300 rounded transition-all truncate hover:bg-white/5"
                    >
                      {supplier.name}
                    </button>
                  ))}
                  {submittedSuppliers.length === 0 && (
                    <p className="text-white/50 text-xs">None ready</p>
                  )}
                </div>
              </button>
              {submittedSuppliers.length > 2 && expandedCard !== 'submitted' && (
                <div className="px-3.5 pb-2.5 text-xs text-emerald-300 font-medium border-t border-white/5 pt-2">
                  +{submittedSuppliers.length - 2} more
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border-l-2 border-orange-500 transition-all duration-300 overflow-hidden hover:bg-white/15 hover:border-orange-400 hover:shadow-xl group">
              <button
                onClick={() => setExpandedCard(expandedCard === 'counter' ? null : 'counter')}
                className="w-full p-3.5 text-left transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/50"></div>
                    Counter
                  </h3>
                  <span className="px-2.5 py-1 bg-orange-500/30 text-orange-300 rounded-full text-xs font-bold shadow-sm">{counterSuppliers.length}</span>
                </div>
                <div className="space-y-1.5">
                  {(expandedCard === 'counter' ? counterSuppliers : counterSuppliers.slice(0, 2)).map(supplier => (
                    <button
                      key={supplier.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSupplier(supplier);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-white/80 font-medium hover:text-orange-300 rounded transition-all truncate hover:bg-white/5"
                    >
                      {supplier.name}
                    </button>
                  ))}
                  {counterSuppliers.length === 0 && (
                    <p className="text-white/50 text-xs">No responses</p>
                  )}
                </div>
              </button>
              {counterSuppliers.length > 2 && expandedCard !== 'counter' && (
                <div className="px-3.5 pb-2.5 text-xs text-orange-300 font-medium border-t border-white/5 pt-2">
                  +{counterSuppliers.length - 2} more
                </div>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border-l-2 border-emerald-500 transition-all duration-300 overflow-hidden hover:bg-white/15 hover:border-emerald-400 hover:shadow-xl group">
              <button
                onClick={() => setExpandedCard(expandedCard === 'finalized' ? null : 'finalized')}
                className="w-full p-3.5 text-left transition-colors"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></div>
                    Finalized
                  </h3>
                  <span className="px-2.5 py-1 bg-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold shadow-sm">{finalizedSuppliers.length}</span>
                </div>
                <div className="space-y-1.5">
                  {(expandedCard === 'finalized' ? finalizedSuppliers : finalizedSuppliers.slice(0, 2)).map(supplier => (
                    <button
                      key={supplier.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSupplier(supplier);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-white/80 font-medium hover:text-emerald-300 rounded transition-all truncate hover:bg-white/5"
                    >
                      {supplier.name}
                    </button>
                  ))}
                  {finalizedSuppliers.length === 0 && (
                    <p className="text-white/50 text-xs">None finalized</p>
                  )}
                </div>
              </button>
              {finalizedSuppliers.length > 2 && expandedCard !== 'finalized' && (
                <div className="px-3.5 pb-2.5 text-xs text-emerald-300 font-medium border-t border-white/5 pt-2">
                  +{finalizedSuppliers.length - 2} more
                </div>
              )}
            </div>
          </div>
          </>
        )}

        {selectedWeek && selectedSupplier && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-emerald-500/15 via-lime-500/15 to-emerald-500/15 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">{selectedSupplier.name}</h2>
                  <p className="text-sm text-white/80 mt-1">Week {selectedWeek.week_number} • {selectedWeek.start_date} to {selectedWeek.end_date}</p>
                </div>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-white/5 backdrop-blur-sm hover:bg-white/10 border border-white/10 rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl"
                >
                  <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                  Back to Suppliers
                </button>
              </div>
            </div>

            {/* Blended Cost Summary - Show when items are finalized */}
            {(() => {
              const finalizedItems = items.filter(item => {
                const quotes = itemQuotes[item.id] || [];
                return quotes.some(q => q.rf_final_fob !== null);
              });
              
              if (finalizedItems.length > 0) {
                // Calculate blended cost for finalized items using actual volumes
                let totalBlendedCost = 0;
                let totalVolume = 0;
                
                finalizedItems.forEach(item => {
                  const quotes = itemQuotes[item.id] || [];
                  const finalizedQuotes = quotes.filter(q => q.rf_final_fob !== null && q.awarded_volume && q.awarded_volume > 0);
                  
                  // Get actual volume from awarded_volume or volume_needed
                  let itemVolume = 0;
                  if (finalizedQuotes.length > 0) {
                    // Use awarded volumes if available
                    itemVolume = finalizedQuotes.reduce((sum, q) => sum + (q.awarded_volume || 0), 0);
                  }
                  
                  // Fallback to volume_needed if no awarded volumes yet
                  if (itemVolume === 0) {
                    itemVolume = volumeNeedsMap.get(item.id) || 0;
                  }
                  
                  if (finalizedQuotes.length > 0 && itemVolume > 0) {
                    // Calculate weighted average FOB based on awarded volumes
                    // Formula matches PricingCalculations.tsx for consistency
                    const totalAwardedVolume = finalizedQuotes.reduce((sum, q) => sum + (q.awarded_volume || 0), 0);
                    const weightedFOB = totalAwardedVolume > 0 
                      ? finalizedQuotes.reduce((sum, q) => {
                          const volume = q.awarded_volume || 0;
                          return sum + ((q.rf_final_fob || 0) * volume);
                        }, 0) / totalAwardedVolume
                      : 0;
                    
                    // Blended cost = FOB + Rebate + Freight (consistent formula across all components)
                    // Rebate and freight should come from item_pricing_calculations, but default to standard values
                    const rebate = 0.80;
                    const freight = 1.75;
                    const blendedCost = weightedFOB + rebate + freight;
                    
                    totalBlendedCost += blendedCost * itemVolume;
                    totalVolume += itemVolume;
                  } else if (finalizedQuotes.length > 0) {
                    // If no volumes yet, use simple average
                    const avgFOB = finalizedQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0) / finalizedQuotes.length;
                    const rebate = 0.80;
                    const freight = 1.75;
                    const blendedCost = avgFOB + rebate + freight;
                    // Use estimated volume for display
                    const estimatedVolume = volumeNeedsMap.get(item.id) || 1000;
                    totalBlendedCost += blendedCost * estimatedVolume;
                    totalVolume += estimatedVolume;
                  }
                });
                
                const avgBlendedCost = totalVolume > 0 ? totalBlendedCost / totalVolume : 0;
                
                return (
                  <div className="mb-4 bg-gradient-to-r from-emerald-500/20 to-lime-500/20 border-2 border-emerald-400/50 rounded-xl p-4 backdrop-blur-sm shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Blended Cost Summary</h3>
                        <p className="text-xs text-white/80">{finalizedItems.length} item{finalizedItems.length !== 1 ? 's' : ''} finalized • {totalVolume.toLocaleString()} total cases</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-emerald-200">{formatCurrency(avgBlendedCost)}</div>
                        <div className="text-xs text-white/60">Weighted Avg Blended Cost</div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="overflow-x-auto bg-white/0">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Pack Size</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Supplier FOB</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Supplier DLVD</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">RF Counter</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Supplier Response</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">RF Final</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Blended Cost</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map(item => {
                    const quote = quotes.find(q => q.item_id === item.id);
                    if (!quote) return null;

                    const showCounterInput = !isReadOnly && quote.supplier_fob !== null;
                    // Show final input if: there's a counter OR supplier responded, AND no final price yet
                    const showFinalInput = !isReadOnly && !quote.rf_final_fob && (quote.rf_counter_fob !== null || quote.supplier_response !== null);
                    const isExpanded = expandedItem === item.id;
                    const allQuotes = itemQuotes[item.id] || [];

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-5">
                            <div className="font-bold text-white text-base">{item.name}</div>
                            <div className="text-sm text-white/70 mt-1">{item.organic_flag}</div>
                          </td>
                          <td className="px-6 py-5 text-white font-semibold">{item.pack_size}</td>
                          <td className="px-6 py-5 text-white font-medium">
                            {quote.supplier_fob ? formatCurrency(quote.supplier_fob) : <span className="text-white/50">-</span>}
                          </td>
                          <td className="px-6 py-5 text-white/90 font-medium">
                            {quote.supplier_dlvd ? formatCurrency(quote.supplier_dlvd) : <span className="text-white/50">-</span>}
                          </td>
                          <td className="px-6 py-5">
                            {showCounterInput ? (
                              <input
                                type="number"
                                step="0.01"
                                value={counterInputs[item.id] || ''}
                                onChange={e => setCounterInputs(prev => ({
                                  ...prev,
                                  [item.id]: e.target.value
                                }))}
                                className="w-32 px-4 py-2.5 border-2 border-orange-400/30 rounded-lg text-base font-bold focus:outline-none focus:ring-4 focus:ring-orange-400/50 focus:border-orange-400/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 shadow-lg"
                                placeholder="0.00"
                                style={{ color: '#ffffff' }}
                              />
                            ) : (
                              <span className="inline-flex items-center px-4 py-2 bg-orange-500/20 border-2 border-orange-400/40 rounded-lg text-base font-black text-orange-200 backdrop-blur-sm shadow-lg">
                                {quote.rf_counter_fob ? formatCurrency(quote.rf_counter_fob) : '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {quote.supplier_response ? (
                              <div>
                                <span className="text-sm font-bold text-white">{quote.supplier_response.toUpperCase()}</span>
                                {quote.supplier_revised_fob && (
                                  <div className="text-sm text-white/80 mt-1">
                                    Revised: {formatCurrency(quote.supplier_revised_fob)}
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-white/50">-</span>}
                          </td>
                          <td className="px-6 py-5">
                            {showFinalInput ? (
                              // Show input if there's a counter (RF can manually finalize) or supplier revised
                              <input
                                type="number"
                                step="0.01"
                                value={finalInputs[item.id] || (quote.rf_counter_fob ? quote.rf_counter_fob.toString() : '')}
                                onChange={e => setFinalInputs(prev => ({
                                  ...prev,
                                  [item.id]: e.target.value
                                }))}
                                className="w-32 px-4 py-2.5 border-2 border-green-400/30 rounded-lg text-base font-bold focus:outline-none focus:ring-4 focus:ring-green-400/50 focus:border-green-400/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 shadow-lg"
                                placeholder={quote.rf_counter_fob ? quote.rf_counter_fob.toString() : "0.00"}
                                style={{ color: '#ffffff' }}
                              />
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center px-4 py-2 bg-green-500/20 border-2 border-green-400/40 rounded-lg text-base font-black text-green-200 backdrop-blur-sm shadow-lg">
                                  {quote.rf_final_fob ? formatCurrency(quote.rf_final_fob) : '-'}
                                </span>
                                {quote.rf_final_fob && quote.rf_counter_fob && quote.supplier_response === 'accept' && (
                                  <span className="text-xs text-green-300/70 font-medium">Auto-finalized</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            {(() => {
                              // Calculate blended cost for this item using actual volumes
                              const itemQuotesList = allQuotes.length > 0 ? allQuotes : (quote ? [quote] : []);
                              const finalizedQuotes = itemQuotesList.filter(q => q.rf_final_fob !== null);
                              
                              if (finalizedQuotes.length > 0) {
                                // Get volumes from awarded_volume or volume_needed
                                const quotesWithVolume = finalizedQuotes.filter(q => q.awarded_volume && q.awarded_volume > 0);
                                const totalVolume = quotesWithVolume.reduce((sum, q) => sum + (q.awarded_volume || 0), 0) || volumeNeedsMap.get(item.id) || 0;
                                
                                let avgFOB = 0;
                                if (quotesWithVolume.length > 0 && totalVolume > 0) {
                                  // Weighted average based on awarded volumes
                                  avgFOB = quotesWithVolume.reduce((sum, q) => {
                                    const volume = q.awarded_volume || 0;
                                    return sum + ((q.rf_final_fob || 0) * volume);
                                  }, 0) / totalVolume;
                                } else {
                                  // Simple average if no volumes yet
                                  avgFOB = finalizedQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0) / finalizedQuotes.length;
                                }
                                
                                // Blended cost = FOB + Rebate + Freight
                                const rebate = 0.80;
                                const freight = 1.75;
                                const blendedCost = avgFOB + rebate + freight;
                                
                                return (
                                  <div className="text-right">
                                    <div className="font-black text-emerald-300 text-base">{formatCurrency(blendedCost)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">
                                      {quotesWithVolume.length > 0 ? 'Weighted' : 'Avg'} Blended
                                    </div>
                                  </div>
                                );
                              }
                              
                              // Calculate projected blended cost if we finalize with current prices
                              const projectedQuotes = itemQuotesList.filter(q => q.supplier_fob !== null);
                              if (projectedQuotes.length > 0 && !isReadOnly) {
                                const projectedFOB = projectedQuotes.reduce((sum, q) => {
                                  const price = q.rf_final_fob || q.supplier_revised_fob || q.rf_counter_fob || q.supplier_fob || 0;
                                  return sum + price;
                                }, 0) / projectedQuotes.length;
                                const rebate = 0.80;
                                const freight = 1.75;
                                const projectedBlended = projectedFOB + rebate + freight;
                                
                                return (
                                  <div className="text-right">
                                    <div className="font-bold text-white/60 text-sm">{formatCurrency(projectedBlended)}</div>
                                    <div className="text-xs text-white/40 mt-0.5">Projected</div>
                                  </div>
                                );
                              }
                              
                              return <span className="text-white/40">-</span>;
                            })()}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleItemQuotes(item.id)}
                                className="flex items-center gap-1 px-4 py-2 text-sm bg-white/5 backdrop-blur-sm hover:bg-white/10 border border-white/10 rounded-lg transition-all font-semibold text-white shadow-lg hover:shadow-xl"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                Quotes
                              </button>
                              {!isReadOnly && allQuotes.length > 0 && allQuotes.some(q => !q.rf_final_fob && q.supplier_fob !== null) && (
                                <button
                                  onClick={() => handleFinalizeItem(item.id)}
                                  disabled={finalizingItems[item.id]}
                                  className="flex items-center gap-1 px-3 py-2 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 rounded-lg transition-all font-semibold text-emerald-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                                >
                                  {finalizingItems[item.id] ? (
                                    <>
                                      <div className="animate-spin w-3 h-3 border-2 border-emerald-200 border-t-transparent rounded-full"></div>
                                      Finalizing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      Finalize Item
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-0 py-0">
                              <div className="bg-white/5 backdrop-blur-sm px-6 py-4 border-t border-b border-white/5">
                                <h4 className="font-bold text-base text-white mb-3">All Supplier Quotes - {item.name} {item.organic_flag}</h4>
                                <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/15">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-wider">Supplier</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-wider">Supplier FOB</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-wider">RF Counter</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-wider">Supplier Response</th>
                                        <th className="px-4 py-3 text-left text-xs font-black text-white uppercase tracking-wider">RF Final</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                      {allQuotes.map((q, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                          <td className="px-4 py-3 font-bold text-white">{q.supplier_name}</td>
                                          <td className="px-4 py-3 text-white font-medium">{q.supplier_fob ? formatCurrency(q.supplier_fob) : <span className="text-white/50">-</span>}</td>
                                          <td className="px-4 py-3">
                                            {q.rf_counter_fob ? (
                                              <span className="inline-flex items-center px-3 py-1 bg-orange-500/20 border border-orange-400/40 rounded-lg text-sm font-black text-orange-200">
                                                {formatCurrency(q.rf_counter_fob)}
                                              </span>
                                            ) : (
                                              <span className="text-white/50">-</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 text-white font-medium">{q.supplier_response ? q.supplier_response.toUpperCase() : <span className="text-white/50">-</span>}</td>
                                          <td className="px-4 py-3">
                                            {q.rf_final_fob ? (
                                              <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center px-3 py-1 bg-green-500/20 border border-green-400/40 rounded-lg text-sm font-black text-green-200">
                                                  {formatCurrency(q.rf_final_fob)}
                                                </span>
                                                {q.rf_counter_fob && q.supplier_response === 'accept' && (
                                                  <span className="text-xs text-green-300/70 font-medium">Auto-finalized</span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-white/50">-</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {allQuotes.length === 0 && (
                                    <div className="text-center py-4 text-white/60 text-sm font-medium">Loading quotes...</div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isReadOnly ? (
              <div className="p-6 border-t border-white/10 bg-gradient-to-r from-orange-600/90 to-red-600/90 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-6 h-6" />
                      <h3 className="text-xl font-black">Pricing Finalized & Locked</h3>
                    </div>
                    <p className="text-orange-100">
                      This week's pricing is finalized. Use emergency reopen if critical changes are needed.
                      Changes will cascade through pricing calculations and all volume allocations.
                    </p>
                  </div>
                  <button
                    onClick={handleEmergencyReopen}
                    disabled={finalizingPricing}
                    className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl hover:bg-white/30 transition font-bold text-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 flex items-center gap-2"
                  >
                    <Unlock className="w-5 h-5" />
                    {finalizingPricing ? 'Reopening...' : 'Emergency Reopen'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 border-t border-white/10 bg-white/3 backdrop-blur-sm">
                <div className="flex items-center gap-4 flex-wrap">
                  {canSendCounters && (
                    <button
                      onClick={handleSubmitCounters}
                      disabled={submittingCounters}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-bold text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 border-2 border-blue-400/50"
                    >
                      {submittingCounters ? 'Sending...' : 'Push to Counter'}
                    </button>
                  )}
                  {canSetFinal && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handlePushToFinalize}
                        disabled={submittingCounters || submittingFinals}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition font-bold text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 border-2 border-green-400/50"
                      >
                        {submittingCounters || submittingFinals ? 'Processing...' : 'Push to Finalize'}
                      </button>
                      <p className="text-white/60 text-xs text-center max-w-md mx-auto">
                        Automatically sets final prices based on negotiations (counters, supplier responses, etc.)
                      </p>
                    </div>
                  )}
                </div>
                {canFinalizePricing && (
                  <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                    <p className="text-white/90 text-sm font-semibold mb-1">
                      ✓ Pricing ready to finalize
                    </p>
                    <p className="text-white/70 text-xs">
                      Go to the <strong>"Award Volume"</strong> tab to finalize week pricing and unlock volume allocation.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </main>

      {showCreateWeekModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                Create New Week
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  A new week will be created automatically with:
                </p>
                <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                  <li>Next sequential week number</li>
                  <li>Start date following the last week's end date</li>
                  <li>7-day duration</li>
                  <li>Status set to "Open" for all suppliers to submit pricing</li>
                  <li>Quotes created for all items and suppliers</li>
                </ul>
              </div>
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setShowCreateWeekModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWeek}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                Create Week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
