import React, { useState, useEffect } from 'react';
import { LogOut, CheckCircle2, XCircle, MessageSquare, Award, AlertCircle, Check, Sparkles, Download, Zap, ChevronDown, Lock } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchCurrentOpenWeek,
  fetchWeeks,
  fetchItems,
  updateSupplierResponse,
} from '../utils/database';
import { supabase } from '../utils/supabase';
import type { Week, Item, Quote } from '../types';
import { formatCurrency } from '../utils/helpers';
import { VolumeOffers } from './VolumeOffers';
import AllocationResponse from './AllocationResponse';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ExportData } from './ExportData';
import { NotificationCenter } from './NotificationCenter';
import { useRealtime } from '../hooks/useRealtime';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { logger } from '../utils/logger';

export function SupplierDashboard() {
  const { session, login, logout } = useApp();
  const { showToast } = useToast();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allAwardedQuotes, setAllAwardedQuotes] = useState<(Quote & { week_number: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, { fob: string; dlvd: string }>>({});
  const [responseInputs, setResponseInputs] = useState<Record<string, { response: 'accept' | 'revise'; revised: string }>>({});
  const [submittingQuotes, setSubmittingQuotes] = useState(false);
  const [submittingResponses, setSubmittingResponses] = useState(false);

  useEffect(() => {
    if (session?.supplier_id) {
      setQuoteInputs({});
      setResponseInputs({});
    }
  }, [session?.supplier_id]);

  useRealtime('quotes', () => {
    loadQuotes();
    loadAllAwardedVolumes();
  });
  useRealtime('weeks', loadData);

  useKeyboardShortcuts([
    { key: 's', ctrl: true, action: () => !submittingQuotes && handleSubmitQuotes(), description: 'Submit prices' },
    { key: 'r', ctrl: true, action: () => !submittingResponses && handleSubmitResponses(), description: 'Submit responses' },
    { key: 'e', ctrl: true, action: () => {}, description: 'Export data' },
  ]);

  useEffect(() => {
    loadData();
  }, [session]);

  useEffect(() => {
    if (currentWeek && session?.supplier_id) {
      logger.debug('Rendering table:', { itemsCount: items.length, quotesCount: quotes.length });
      loadQuotes();
    }
  }, [currentWeek, session]);

  useEffect(() => {
    if (session?.supplier_id) {
      loadAllAwardedVolumes();
    }
  }, [session]);

  useEffect(() => {
    if (quotes.length > 0) {
      const needsResponse = quotes.filter(q => q.rf_counter_fob !== null && q.supplier_response === null);
      if (needsResponse.length > 0) {
        const initialResponses: Record<string, { response: 'accept' | 'revise'; revised: string }> = {};
        needsResponse.forEach(q => {
          if (!responseInputs[q.item_id]) {
            initialResponses[q.item_id] = { response: 'accept', revised: '' };
          }
        });
        if (Object.keys(initialResponses).length > 0) {
          setResponseInputs(prev => ({ ...prev, ...initialResponses }));
        }
      }
    }
  }, [quotes]);

  async function loadData() {
    if (!session?.supplier_id) {
      logger.debug('No session or supplier_id, skipping loadData');
      return;
    }

    logger.debug('Loading supplier dashboard data');

    try {
      const [weeksData, itemsData, suppliersData] = await Promise.all([
        fetchWeeks(),
        fetchItems(),
        supabase.from('suppliers').select('id, name')
      ]);

      logger.debug('Data loaded:', { weeksCount: weeksData.length, itemsCount: itemsData.length });

      const validSupplierIds = new Set(suppliersData.data?.map(s => s.id) || []);

      if (!validSupplierIds.has(session.supplier_id)) {
        const allSuppliers = suppliersData.data || [];
        if (allSuppliers.length > 0) {
          const firstSupplier = allSuppliers[0];
          logger.warn('Stored supplier ID invalid, auto-selecting:', firstSupplier.name);
          login(session.user_id, session.user_name, 'supplier', firstSupplier.id);
          // Silently auto-select without showing toast (happens after fresh demo reset)
          return;
        } else {
          logger.error('No suppliers found in database');
          showToast('No suppliers found', 'error');
          setLoading(false);
          return;
        }
      }

      setWeeks(weeksData.sort((a, b) => b.week_number - a.week_number));
      setItems(itemsData);

      // Suppliers can view ALL weeks (open, closed, finalized)
      // Select most relevant week by default:
      // Priority 1: Open weeks (for quoting)
      // Priority 2: Weeks with allocations sent
      // Priority 3: Most recent week by start_date
      const allWeeksSorted = [...weeksData].sort((a, b) => {
        // Prioritize open weeks first
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (b.status === 'open' && a.status !== 'open') return 1;
        // Then weeks with allocations
        if (a.allocation_submitted && !b.allocation_submitted) return -1;
        if (b.allocation_submitted && !a.allocation_submitted) return 1;
        // Finally by start_date descending (newest first)
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });

      const selectedWeek = allWeeksSorted[0];

      if (!selectedWeek) {
        logger.error('No weeks found in database');
        showToast('No weeks available', 'error');
        setLoading(false);
        return;
      }

      logger.debug('Supplier dashboard loaded successfully');

      setCurrentWeek(selectedWeek);
    } catch (err: unknown) {
      logger.error('Error loading data:', err);
      showToast(`Failed to load data: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadQuotes() {
    if (!currentWeek || !session?.supplier_id) {
      logger.debug('Cannot load quotes: missing currentWeek or supplier_id');
      return;
    }
    try {
      logger.debug('Loading quotes for week:', currentWeek.id);

      const { data: quotesData, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('week_id', currentWeek.id)
        .eq('supplier_id', session.supplier_id);

      if (error) {
        logger.error('=== QUOTES FETCH ERROR ===');
        logger.error('Error code:', error.code);
        logger.error('Error message:', error.message);
        logger.error('Error details:', error.details);
        showToast(`Failed to load quotes: ${error.message}`, 'error');
        return;
      }

      logger.debug('✓ Fetched quotes count:', quotesData?.length || 0);
      logger.debug('  Items count:', items.length);
      
      // Ensure we only show quotes for this specific supplier
      const filteredQuotes = (quotesData || []).filter(q => q.supplier_id === session.supplier_id);
      logger.debug('  Filtered quotes count:', filteredQuotes.length);
      
      setQuotes(filteredQuotes);
      await loadAllAwardedVolumes();
    } catch (err: unknown) {
      logger.error('=== ERROR IN LOAD QUOTES ===');
      logger.error('Error:', err);
      showToast(`Failed to load quotes: ${err?.message || 'Unknown error'}`, 'error');
    }
  }

  async function loadAllAwardedVolumes() {
    if (!session?.supplier_id) return;
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          week:weeks!inner(week_number, status, id),
          item:items!inner(name, pack_size, organic_flag)
        `)
        .eq('supplier_id', session.supplier_id)
        .order('week(week_number)', { ascending: false });

      if (error) throw error;

      const quotesWithWeek = data?.filter(q =>
        (q.awarded_volume && q.awarded_volume > 0) ||
        (q.supplier_volume_accepted && q.supplier_volume_accepted > 0)
      ).map(q => ({
        ...q,
        week_number: q.week.week_number,
      })) || [];

      setAllAwardedQuotes(quotesWithWeek);
    } catch (err) {
      logger.error('Error loading awarded volumes:', err);
      showToast('Failed to load awarded volumes', 'error');
    }
  }

  const handleSubmitQuotes = async () => {
    if (submittingQuotes || !currentWeek || !session?.supplier_id) return;

    // Block submission if week is finalized or closed
    if (currentWeek.status !== 'open') {
      showToast('Pricing is closed for this week. RF has finalized pricing.', 'error');
      return;
    }

    // Submitting quotes for week
    console.log('items.length:', items.length);
    console.log('quotes.length:', quotes.length);
    console.log('quoteInputs:', quoteInputs);

    const updates = Object.entries(quoteInputs).filter(([_, v]) => v.fob || v.dlvd);
    console.log('updates to process:', updates.length);

    if (updates.length === 0) {
      showToast('Please enter at least one price', 'error');
      return;
    }

    setSubmittingQuotes(true);
    try {
      const payloads = updates.map(([itemId, values]) => {
        const fobValue = values.fob?.trim();
        const dlvdValue = values.dlvd?.trim();

        return {
          week_id: currentWeek.id,
          supplier_id: session.supplier_id,
          item_id: itemId,
          supplier_fob: fobValue && fobValue !== '' ? Number(fobValue) : null,
          supplier_dlvd: dlvdValue && dlvdValue !== '' ? Number(dlvdValue) : null,
          updated_at: new Date().toISOString()
        };
      });

      console.log('Upserting payloads:', payloads);

      const { data, error } = await supabase
        .from('quotes')
        .upsert(payloads, {
          onConflict: 'week_id,item_id,supplier_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Upsert error:', error);
        showToast(`Failed to submit prices: ${error.message}`, 'error');
        return;
      }

      // Upsert may succeed while returning no rows depending on PostgREST return preferences.
      // Treat empty-return as success to avoid false-negative toasts.
      if (!data || data.length === 0) {
        console.warn('Upsert returned no rows; proceeding as success.');
      }

      console.log('✓ Pricing submitted and finalized:', data.length, 'quotes');
      showToast(`${data.length} price(s) submitted successfully`, 'success');
      setQuoteInputs({});
      await loadQuotes();
    } catch (err) {
      console.error('Submit error:', err);
      showToast(`Failed to submit prices: ${err}`, 'error');
    } finally {
      setSubmittingQuotes(false);
    }
  };

  const handleSubmitResponses = async () => {
    if (submittingResponses || !currentWeek) return;

    // Block submission if week is finalized or closed
    if (currentWeek.status !== 'open') {
      showToast('Pricing is closed for this week. RF has finalized pricing.', 'error');
      return;
    }

    const quotesNeedingResponse = quotes.filter(q => q.rf_counter_fob !== null && q.supplier_response === null);

    if (quotesNeedingResponse.length === 0) {
      showToast('No responses needed', 'error');
      return;
    }

    for (const quote of quotesNeedingResponse) {
      const response = responseInputs[quote.item_id];
      if (!response || !response.response) {
        showToast('Please respond to all counters', 'error');
        return;
      }
      if (response.response === 'revise' && !response.revised) {
        showToast('Please enter revised price for all "revise" responses', 'error');
        return;
      }
    }

    setSubmittingResponses(true);
    try {
      let successCount = 0;
      for (const quote of quotesNeedingResponse) {
        const values = responseInputs[quote.item_id];
        const revised = values.response === 'revise' && values.revised ? parseFloat(parseFloat(values.revised).toFixed(2)) : undefined;
        const success = await updateSupplierResponse(quote.id, values.response, revised);
        if (success) successCount++;
      }

      if (successCount > 0) {
        showToast(`${successCount} response(s) submitted successfully`, 'success');
        setResponseInputs({});
        await loadQuotes();
      } else {
        showToast('Failed to submit responses', 'error');
      }
    } finally {
      setSubmittingResponses(false);
    }
  };


  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzg5ZTJiOCIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjA1Ii8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
      <header className="relative bg-gradient-to-r from-emerald-800 via-emerald-900 to-emerald-800 shadow-2xl border-b-4 border-lime-500">
        <div className="max-w-7xl mx-auto px-6 py-7">
          <div className="flex items-center gap-6">
            <div className="border-l-2 border-lime-400/30 pl-6">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Robinson Fresh
              </h1>
              <LoadingSkeleton type="header" rows={1} />
            </div>
          </div>
        </div>
      </header>
      <main className="relative max-w-7xl mx-auto px-6 py-8">
        <LoadingSkeleton type="card" rows={3} />
      </main>
    </div>;
  }

  if (!currentWeek && !loading) {
    return <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 relative flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl p-10 max-w-lg text-center border-2 border-gray-100">
        <Package className="w-20 h-20 text-gray-300 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 mb-3">No Active Week Available</h2>
        <p className="text-gray-600 mb-6 text-base">
          There are currently no open weeks available for pricing submission. Please check back later or contact your Robinson Fresh representative.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold shadow-md hover:shadow-lg"
          >
            Refresh
          </button>
          <button
            onClick={logout}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold border border-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>;
  }

  const isReadOnly = currentWeek?.status !== 'open';
  const hasAnyQuotedItems = quotes.some(q => q.supplier_fob !== null);
  const needsResponse = quotes.some(q => q.rf_counter_fob !== null && q.supplier_response === null);
  const hasParticipated = quotes.length > 0;
  const hasFinalPrices = quotes.some(q => q.rf_final_fob !== null);
  const hasVolumeOffers = quotes.some(q => q.offered_volume && q.offered_volume > 0 && !q.supplier_volume_response);

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
              <div className="border-l-2 border-emerald-400/30 pl-4">
                <h1 className="text-2xl font-bold text-white">Robinson Fresh</h1>
                <p className="text-sm text-emerald-300 font-semibold">Supplier Portal - {session?.user_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
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

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6">
        {currentWeek && allAwardedQuotes.filter(q => q.week.id === currentWeek.id).length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden relative">
            <div className="relative z-10 bg-gradient-to-r from-emerald-600/90 via-emerald-700/90 to-emerald-600/90 backdrop-blur-sm px-8 py-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur-sm">
                    <Award className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Your Awarded Volumes</h2>
                    <p className="text-emerald-50 text-sm mt-0.5">Week {currentWeek.week_number} awarded volumes</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ExportData
                    data={allAwardedQuotes.filter(q => q.week.id === currentWeek.id).map(q => {
                      const volume = q.awarded_volume || q.supplier_volume_accepted || 0;
                      const price = q.rf_final_fob || q.supplier_revised_fob || q.supplier_fob || 0;
                      return {
                        week: q.week_number,
                        sku: q.item.name,
                        organic: q.item.organic_flag,
                        pack_size: q.item.pack_size,
                        awarded_volume: volume,
                        final_fob_price: price,
                        your_dlvd_price: q.supplier_dlvd || '',
                        total_value: price * volume,
                        status: q.supplier_volume_response === 'accept' ? 'Accepted' :
                               q.supplier_volume_response === 'update' ? 'Updated' :
                               q.supplier_volume_approval || 'Confirmed',
                      };
                    })}
                    filename="awarded_volumes"
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10 overflow-x-auto bg-white/0">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/20">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-white/90 uppercase tracking-wider">Week</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white/90 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-white/90 uppercase tracking-wider">Pack</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-white/90 uppercase tracking-wider">Volume</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-white/90 uppercase tracking-wider">FOB Price</th>
                    {allAwardedQuotes.filter(q => q.week.id === currentWeek.id).some(q => q.supplier_dlvd) && (
                      <th className="px-6 py-4 text-right text-xs font-black text-white/90 uppercase tracking-wider">Your DLVD</th>
                    )}
                    <th className="px-6 py-4 text-right text-xs font-black text-white/90 uppercase tracking-wider">Total Value</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-white/90 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {allAwardedQuotes.filter(q => q.week.id === currentWeek.id).map((quote) => {
                    const displayVolume = quote.awarded_volume || quote.supplier_volume_accepted || 0;
                    const displayPrice = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob || 0;
                    const totalValue = displayPrice * displayVolume;
                    const hasAnyDlvdQuotes = allAwardedQuotes.filter(q => q.week.id === currentWeek.id).some(q => q.supplier_dlvd);
                    return (
                      <tr key={quote.id} className="hover:bg-white/10 transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            Week {quote.week_number}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white text-base">{quote.item.name}</div>
                          <div className="text-xs text-white/70 mt-0.5">{quote.item.organic_flag}</div>
                        </td>
                        <td className="px-6 py-4 text-white/90 text-sm font-medium">{quote.item.pack_size}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-lg font-black text-white">
                            {displayVolume.toLocaleString()}
                          </div>
                          <div className="text-xs text-white/60">cases</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-lg font-black text-white">{formatCurrency(displayPrice)}</div>
                          <div className="text-xs text-white/60">per case</div>
                        </td>
                        {hasAnyDlvdQuotes && (
                          <td className="px-6 py-4 text-right">
                            <div className="text-lg font-black text-white">
                              {quote.supplier_dlvd ? formatCurrency(quote.supplier_dlvd) : '-'}
                            </div>
                            {quote.supplier_dlvd && <div className="text-xs text-white/60">per case</div>}
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="text-xl font-black text-emerald-300">{formatCurrency(totalValue)}</div>
                          <div className="text-xs text-white/60">total</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
                            quote.supplier_volume_response === 'accept' ? 'bg-green-500/20 text-green-300 border-green-400/50' :
                            quote.supplier_volume_response === 'update' ? 'bg-orange-500/20 text-orange-300 border-orange-400/50' :
                            quote.supplier_volume_approval === 'accepted' ? 'bg-green-500/20 text-green-300 border-green-400/50' :
                            quote.supplier_volume_approval === 'revised' ? 'bg-orange-500/20 text-orange-300 border-orange-400/50' :
                            quote.supplier_volume_approval === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/50' :
                            'bg-white/10 text-white/70 border-white/20'
                          }`}>
                            {(quote.supplier_volume_response === 'accept' || quote.supplier_volume_approval === 'accepted') && <Check className="w-3.5 h-3.5" />}
                            {quote.supplier_volume_response === 'accept' ? 'Accepted' :
                             quote.supplier_volume_response === 'update' ? 'Updated' :
                             quote.supplier_volume_approval || 'Confirmed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gradient-to-r from-white/10 to-white/5 border-t-2 border-white/20">
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right">
                      <span className="text-sm font-bold text-white/90">Week {currentWeek.week_number} Total</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-lg font-black text-white">
                        {allAwardedQuotes.filter(q => q.week.id === currentWeek.id).reduce((sum, q) => sum + (q.awarded_volume || q.supplier_volume_accepted || 0), 0).toLocaleString()} cases
                      </div>
                    </td>
                    <td colSpan={allAwardedQuotes.filter(q => q.week.id === currentWeek.id).some(q => q.supplier_dlvd) ? 2 : 1} className="px-6 py-4"></td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-2xl font-black text-emerald-300">
                        {formatCurrency(allAwardedQuotes.filter(q => q.week.id === currentWeek.id).reduce((sum, q) => {
                          const volume = q.awarded_volume || q.supplier_volume_accepted || 0;
                          const price = q.rf_final_fob || q.supplier_revised_fob || q.supplier_fob || 0;
                          return sum + (price * volume);
                        }, 0))}
                      </div>
                    </td>
                    <td colSpan={2} className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {!currentWeek && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <p className="text-gray-600 text-lg">No active week available at the moment. Please check back later.</p>
          </div>
        )}

        {currentWeek && hasVolumeOffers && (
          <div className="bg-gradient-to-r from-orange-600/90 via-orange-500/90 to-amber-500/90 backdrop-blur-sm rounded-2xl shadow-2xl p-6 border-2 border-orange-400/50 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-xl shadow-lg backdrop-blur-sm">
                <AlertCircle className="w-10 h-10 text-white" />
              </div>
              <div className="text-white flex-1">
                <h3 className="text-2xl font-extrabold mb-2 drop-shadow">Volume Allocation Available</h3>
                <p className="text-orange-50 font-medium">You have volume offers pending your response. Scroll down to the Volume Offers section to accept or revise.</p>
              </div>
            </div>
          </div>
        )}

        {currentWeek && (
          <>
            {/* Show VolumeOffers when allocations have been sent (offered_volume > 0) */}
            {hasParticipated && currentWeek.allocation_submitted && hasVolumeOffers && (
              <VolumeOffers
                items={items}
                quotes={quotes}
                weekNumber={currentWeek.week_number}
                onRefresh={loadQuotes}
              />
            )}

            {/* Show AllocationResponse when awarded_volume exists but not yet sent (offered_volume is null) */}
            {hasParticipated && !currentWeek.allocation_submitted && quotes.some(q => q.awarded_volume && q.awarded_volume > 0 && !q.offered_volume) && session?.supplier_id && (
              <AllocationResponse
                items={items}
                quotes={quotes}
                weekId={currentWeek.id}
                weekNumber={currentWeek.week_number}
                supplierId={session.supplier_id}
                onRefresh={loadQuotes}
              />
            )}

            <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative">
              <div className="relative z-10 p-6 border-b border-white/10 bg-gradient-to-r from-emerald-500/15 via-lime-500/15 to-emerald-500/15 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h2 className="text-2xl font-black text-white">Week {currentWeek.week_number} Pricing</h2>
                        <p className="text-sm text-white/80 mt-1">{currentWeek.start_date} to {currentWeek.end_date}</p>
                      </div>
                      {weeks.length > 1 && (
                        <div className="relative">
                          <select
                            value={currentWeek.id}
                            onChange={(e) => {
                              const selectedWeek = weeks.find(w => w.id === e.target.value);
                              if (selectedWeek) setCurrentWeek(selectedWeek);
                            }}
                            className="appearance-none bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-lg px-4 py-2 pr-10 font-medium text-white hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent cursor-pointer shadow-lg"
                          >
                            {weeks.map(week => (
                              <option key={week.id} value={week.id} className="bg-slate-900 text-white">
                                Week {week.week_number} - {week.status}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-5 h-5 text-white/70 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg shadow-lg border border-white/20">
                        <div className={`w-3 h-3 rounded-full ${
                          currentWeek.status === 'open' ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' :
                          currentWeek.status === 'finalized' ? 'bg-blue-400' :
                          'bg-gray-400'
                        }`}></div>
                        <span className="text-sm font-bold text-white uppercase">{currentWeek.status}</span>
                      </div>
                    </div>
                  </div>
              </div>

            <div className="relative z-10 overflow-x-auto bg-white/0">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/20">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">SKU Details</th>
                      <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Pack Size</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Your FOB</th>
                      <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Your DLVD</th>
                      {hasAnyQuotedItems && <th className="px-6 py-4 text-center text-xs font-black text-orange-200 uppercase tracking-wider">RF Counter</th>}
                      {needsResponse && <th className="px-6 py-4 text-center text-xs font-black text-green-200 uppercase tracking-wider">Your Response</th>}
                      {hasFinalPrices && <th className="px-6 py-4 text-center text-xs font-black text-blue-200 uppercase tracking-wider">Final Price</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={hasFinalPrices ? 7 : needsResponse ? 6 : hasAnyQuotedItems ? 5 : 4} className="px-6 py-8 text-center text-white/80 font-medium">
                          No items available. Loading...
                        </td>
                      </tr>
                    )}
                    {items.map((item, index) => {
                      // Ensure we only get quotes for this specific supplier
                      const quote = quotes.find(q => q.item_id === item.id && q.supplier_id === session?.supplier_id);

                      const canEditInitial = !isReadOnly && (!quote || quote.supplier_fob === null);
                      const canRespond = !isReadOnly && quote?.rf_counter_fob !== null && quote?.supplier_response === null;
                      const showCounterColumn = hasAnyQuotedItems || (quote?.rf_counter_fob !== null);

                      return (
                        <React.Fragment key={item.id}>
                        <tr className={`transition-all hover:bg-white/5 ${index % 2 === 0 ? 'bg-white/3' : 'bg-white/0'}`}>
                          <td className="px-6 py-5">
                            <div>
                              <div className="font-bold text-white text-lg">{item.name}</div>
                              <div className="text-sm text-white/80 mt-1.5 flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-white/15 rounded-md text-xs font-semibold border border-white/25">{item.organic_flag}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-white font-semibold">{item.pack_size}</td>
                          <td className="px-6 py-5 text-center">
                            {canEditInitial ? (
                              <input
                                type="number"
                                step="0.01"
                                value={quoteInputs[item.id]?.fob ?? (quote?.supplier_fob || '')}
                                onChange={e => setQuoteInputs(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], fob: e.target.value }
                                }))}
                                className="w-32 px-4 py-2.5 border-2 border-emerald-400/30 rounded-lg text-lg font-bold focus:outline-none focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 shadow-lg"
                                placeholder="0.00"
                                style={{ color: '#ffffff' }}
                              />
                            ) : (
                              <span className="inline-flex items-center px-4 py-2 bg-white/8 backdrop-blur-sm rounded-lg text-base font-black text-white border border-white/20 shadow-md">{quote?.supplier_fob ? formatCurrency(quote.supplier_fob) : '-'}</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-center">
                            {canEditInitial ? (
                              <input
                                type="number"
                                step="0.01"
                                value={quoteInputs[item.id]?.dlvd ?? (quote?.supplier_dlvd || '')}
                                onChange={e => setQuoteInputs(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], dlvd: e.target.value }
                                }))}
                                className="w-32 px-4 py-2.5 border-2 border-white/30 rounded-lg font-bold focus:outline-none focus:ring-4 focus:ring-emerald-400/50 focus:border-emerald-400/50 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 shadow-lg"
                                placeholder="0.00"
                                style={{ color: '#ffffff' }}
                              />
                            ) : (
                              <span className="inline-flex items-center px-4 py-2 bg-white/8 backdrop-blur-sm rounded-lg text-base font-bold text-white border border-white/20 shadow-md">{quote?.supplier_dlvd ? formatCurrency(quote.supplier_dlvd) : '-'}</span>
                            )}
                          </td>
                          {showCounterColumn && (
                            <td className="px-6 py-5 text-center">
                              {quote?.rf_counter_fob ? (
                                <span className="inline-flex items-center px-4 py-2 bg-orange-500/20 border-2 border-orange-400/40 rounded-lg text-base font-black text-orange-200 backdrop-blur-sm shadow-lg">{formatCurrency(quote.rf_counter_fob)}</span>
                              ) : (
                                <span className="text-white/50">-</span>
                              )}
                            </td>
                          )}
                          {needsResponse && (
                            <td className="px-6 py-5 text-center">
                              {canRespond && quote?.rf_counter_fob ? (
                                <div className="flex gap-2 items-center justify-center">
                                  <select
                                    value={responseInputs[item.id]?.response || 'accept'}
                                    onChange={e => {
                                      const newResponse = e.target.value as 'accept' | 'revise';
                                      setResponseInputs(prev => ({
                                        ...prev,
                                        [item.id]: {
                                          response: newResponse,
                                          revised: newResponse === 'accept' ? '' : (prev[item.id]?.revised || '')
                                        }
                                      }));
                                    }}
                                    className="px-4 py-2.5 border-2 border-green-400/40 rounded-lg font-bold bg-green-500/20 backdrop-blur-sm text-white focus:outline-none focus:ring-4 focus:ring-green-400/50 shadow-lg"
                                  >
                                    <option value="accept" className="bg-slate-900">Accept</option>
                                    <option value="revise" className="bg-slate-900">Revise</option>
                                  </select>
                                  {(responseInputs[item.id]?.response === 'revise') && (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={responseInputs[item.id]?.revised || ''}
                                      onChange={e => setResponseInputs(prev => ({
                                        ...prev,
                                        [item.id]: { ...prev[item.id], response: 'revise', revised: e.target.value }
                                      }))}
                                      className="w-32 px-4 py-2.5 border-2 border-green-400/40 rounded-lg font-bold bg-green-500/20 backdrop-blur-sm text-white focus:outline-none focus:ring-4 focus:ring-green-400/50 placeholder:text-white/40 shadow-lg"
                                      placeholder="Revised FOB"
                                      required
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className={`inline-flex items-center px-4 py-2 rounded-lg font-bold border-2 shadow-md ${
                                  quote?.supplier_response === 'accept' ? 'bg-green-500/20 text-green-200 border-green-400/40' :
                                  quote?.supplier_response === 'revise' ? 'bg-orange-500/20 text-orange-200 border-orange-400/40' :
                                  'bg-white/8 text-white/80 border-white/20'
                                }`}>
                                  {quote?.supplier_response ? `${quote.supplier_response.toUpperCase()}${quote.supplier_revised_fob ? ': ' + formatCurrency(quote.supplier_revised_fob) : ''}` : '-'}
                                </span>
                              )}
                            </td>
                          )}
                          {hasFinalPrices && (
                            <td className="px-6 py-5 text-center">
                              {quote?.rf_final_fob ? (
                                <span className="inline-flex items-center px-4 py-2.5 bg-blue-500/20 border-2 border-blue-400/40 rounded-lg text-lg font-black text-blue-200 backdrop-blur-sm shadow-lg">{formatCurrency(quote.rf_final_fob)}</span>
                              ) : (
                                <span className="text-white/50">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isReadOnly && (
                <div className="relative z-10 p-6 border-t border-white/10 bg-white/3 backdrop-blur-sm flex gap-4">
                  {!hasAnyQuotedItems && !needsResponse && (
                    <button
                      onClick={handleSubmitQuotes}
                      disabled={submittingQuotes || currentWeek?.status !== 'open'}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      {submittingQuotes ? 'Submitting...' : 'Submit Prices'}
                    </button>
                  )}
                  {hasAnyQuotedItems && !needsResponse && (
                    <div className="flex items-center gap-2 px-6 py-3 bg-green-500/20 text-green-300 rounded-xl border border-green-400/50 backdrop-blur-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold">Pricing Submitted</span>
                    </div>
                  )}
                  {needsResponse && (
                    <button
                      onClick={handleSubmitResponses}
                      disabled={submittingResponses || currentWeek?.status !== 'open'}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                      {submittingResponses ? 'Submitting...' : 'Submit Responses'}
                    </button>
                  )}
                </div>
              )}
              {isReadOnly && currentWeek?.status === 'finalized' && (
                <div className="relative z-10 p-6 border-t border-white/10 bg-orange-500/20 backdrop-blur-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-300" />
                  <div>
                    <p className="font-bold text-white">Pricing Closed</p>
                    <p className="text-sm text-white/90">RF has finalized pricing for this week. You can no longer submit or edit prices.</p>
                  </div>
                </div>
              )}
              {isReadOnly && currentWeek?.status === 'closed' && (
                <div className="relative z-10 p-6 border-t border-white/10 bg-white/5 backdrop-blur-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-white/60" />
                  <div>
                    <p className="font-bold text-white">Week Closed</p>
                    <p className="text-sm text-white/80">This week has been closed. Pricing and volume allocation are locked.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
