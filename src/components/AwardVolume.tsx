import { useState, useEffect, useCallback, useRef } from 'react';
import { Award, Save, Check, Package, Unlock, AlertTriangle, Send, RefreshCw, Lock, Info } from 'lucide-react';
import {
  fetchItems,
  fetchQuotesWithDetails,
  fetchVolumeNeeds,
  updateVolumeNeeded,
  updateEmergencyUnlock,
  submitAllocationsToSuppliers,
  fetchLastWeekDeliveredPrices,
  fetchItemPricingCalculations,
  fetchSuppliers
} from '../utils/database';
import { sendPricingReminder } from '../utils/emailService';
import { formatCurrency } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../contexts/AppContext';
import { logger } from '../utils/logger';
import type { Week, Item } from '../types';
import { PricingCalculations } from './PricingCalculations';

interface VolumeEntry {
  quote_id: string;
  supplier_name: string;
  supplier_id: string;
  price: number;
  dlvd_price: number | null;
  awarded_volume: number;
  rank: number;
  supplier_response_status?: string | null;
  supplier_response_volume?: number | null;
}

interface SKUVolumes {
  item: Item;
  entries: VolumeEntry[];
  totalVolume: number;
  volumeNeeded: number;
}

interface AwardVolumeProps {
  selectedWeek: Week | null;
  onWeekUpdate?: (week: Week) => void;
}

export function AwardVolume({ selectedWeek, onWeekUpdate }: AwardVolumeProps) {
  const [activeTab, setActiveTab] = useState<'volume_needed' | 'allocate'>('volume_needed');
  const [items, setItems] = useState<Item[]>([]);
  const [volumeNeeds, setVolumeNeeds] = useState<Map<string, number>>(new Map());
  const [skuVolumes, setSkuVolumes] = useState<SKUVolumes[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [lastWeekDeliveredPrices, setLastWeekDeliveredPrices] = useState<Map<string, number>>(new Map());
  const [volumeNeedsSaved, setVolumeNeedsSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pricingCalculations, setPricingCalculations] = useState<Map<string, { dlvd_price: number; margin: number }>>(new Map()); // item_id -> { dlvd_price, margin }
  const { showToast } = useToast();
  const { session } = useApp();
  const draftSaveTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (selectedWeek) {
      loadData();
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (selectedWeek && activeTab === 'allocate') {
      // Allow viewing if: allocation submitted OR (finalized/closed AND volume needs saved)
      // Closed weeks are viewable but read-only unless emergency unlocked
      const canAccess = selectedWeek?.allocation_submitted || 
        ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved);
      if (!canAccess) {
        // Auto-switch back to volume_needed if conditions aren't met
        // Use setTimeout to avoid infinite loop
        setTimeout(() => {
          setActiveTab('volume_needed');
          // Quiet UI: No toasts during planning - just switch tabs
        }, 0);
        return;
      }
      loadVolumeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, activeTab, volumeNeedsSaved]);

  // Reload volume needs status when week changes
  useEffect(() => {
    if (selectedWeek) {
      fetchVolumeNeeds(selectedWeek.id).then(volumeNeedsData => {
        const hasVolumeData = volumeNeedsData.some(vn => vn.volume_needed && vn.volume_needed > 0);
        setVolumeNeedsSaved(hasVolumeData);
      });
    }
  }, [selectedWeek?.id]);


  async function loadData() {
    setLoading(true);
    if (!selectedWeek) return;

    logger.debug('Loading data for week:', selectedWeek.week_number);

    try {
      const [itemsData, volumeNeedsData, lastWeekPricesData] = await Promise.all([
        fetchItems(),
        fetchVolumeNeeds(selectedWeek.id),
        fetchLastWeekDeliveredPrices(selectedWeek.week_number)
      ]);

      logger.log('Items loaded:', itemsData.length);
      logger.log('Volume needs loaded:', volumeNeedsData.length);

      setItems(itemsData);

      const needsMap = new Map<string, number>();
      volumeNeedsData.forEach(vn => {
        needsMap.set(vn.item_id, vn.volume_needed);
      });
      setVolumeNeeds(needsMap);
      // Only mark as saved if there's actual volume data (not just empty records)
      const hasVolumeData = volumeNeedsData.some(vn => vn.volume_needed && vn.volume_needed > 0);
      setVolumeNeedsSaved(hasVolumeData);

      setLastWeekDeliveredPrices(lastWeekPricesData);
    } catch (err) {
      logger.error('Error loading data:', err);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadVolumeData() {
    if (!selectedWeek || items.length === 0) return;

    logger.debug('Loading volume data for week:', selectedWeek.id);

    try {
      const [quotes, pricingData] = await Promise.all([
        fetchQuotesWithDetails(selectedWeek.id),
        fetchItemPricingCalculations(selectedWeek.id)
      ]);
      logger.debug('Fetched quotes:', quotes.length, 'pricing calculations:', pricingData.length);

      // Create a map of item_id -> { dlvd_price, margin } from internal pricing calculations
      const pricingMap = new Map<string, { dlvd_price: number; margin: number }>();
      pricingData.forEach(p => {
        if (p.dlvd_price !== undefined && p.margin !== undefined) {
          pricingMap.set(p.item_id, {
            dlvd_price: p.dlvd_price,
            margin: p.margin
          });
        }
      });
      setPricingCalculations(pricingMap);


      const volumes: SKUVolumes[] = [];

      for (const item of items) {
        const itemQuotes = quotes.filter(q => q.item_id === item.id && q.rf_final_fob !== null);

        const entries: VolumeEntry[] = [];
        for (const quote of itemQuotes) {
          const price = quote.rf_final_fob;
          if (price !== null && price !== undefined && quote.supplier) {
            // Read awarded_volume directly from quote
            const volume = quote.awarded_volume || 0;

            entries.push({
              quote_id: quote.id,
              supplier_name: quote.supplier.name,
              supplier_id: quote.supplier_id,
              price: price,
              dlvd_price: quote.supplier_dlvd ?? null,
              awarded_volume: volume,
              rank: 0,
              supplier_response_status: quote.supplier_volume_approval || (quote.supplier_volume_response ? (quote.supplier_volume_response === 'accept' ? 'accepted' : quote.supplier_volume_response === 'update' ? 'revised' : 'pending') : null),
              supplier_response_volume: quote.supplier_volume_accepted ?? null,
            });
          }
        }

        if (entries.length > 0) {
          entries.sort((a, b) => a.price - b.price);
          entries.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          const totalVolume = entries.reduce((sum, e) => sum + e.awarded_volume, 0);
          const volumeNeeded = volumeNeeds.get(item.id) || 0;

          volumes.push({
            item,
            entries,
            totalVolume,
            volumeNeeded,
          });
        }
      }

      setSkuVolumes(volumes);
    } catch (err) {
      logger.error('Error loading volume data:', err);
      showToast('Failed to load volume data', 'error');
    }
  }

  function updateVolumeNeed(itemId: string, value: string) {
    const volume = value === '' ? 0 : parseInt(value) || 0;
    setVolumeNeeds(prev => {
      const updated = new Map(prev);
      updated.set(itemId, volume);
      return updated;
    });
  }

  // Volume Award Lifecycle:
  // 1. RF enters volume in "Award Volume" tab → saved to awarded_volume (draft)
  // 2. RF clicks "Send Allocation to Shipper" → copies awarded_volume to offered_volume
  // 3. Supplier responds → sets supplier_volume_accepted
  // 4. RF accepts response → updates awarded_volume to match supplier_volume_accepted (final)
  const saveDraftDebounced = useCallback((itemId: string, supplierId: string, _quoteId: string, volume: number) => {
    if (!selectedWeek) {
      logger.error('No selectedWeek available for save');
      return;
    }

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = setTimeout(async () => {
      try {
        const week_id = selectedWeek.id;
        const supplier_id = supplierId;
        const item_id = itemId;
        // awarded_volume: RF's draft award (before sending to supplier)
        const awarded_volume = volume > 0 ? volume : null;

        logger.debug('Saving awarded volume:', { week_id, supplier_id, item_id, awarded_volume });

        const { supabase } = await import('../utils/supabase');
        const { data, error } = await supabase
          .from('quotes')
          .upsert(
            {
              week_id,
              supplier_id,
              item_id,
              awarded_volume,
              updated_at: new Date().toISOString()
            },
            {
              onConflict: 'week_id,item_id,supplier_id'
            }
          )
          .select();

        if (error) {
          logger.error('Upsert error:', error.code, error.message);
          showToast(`Save failed: ${error.message}`, 'error');
        } else if (!data || data.length === 0) {
          logger.warn('Upsert returned no rows; proceeding as success.');
          await loadVolumeData();
        } else {
          logger.debug('Saved to DB:', data);
          await loadVolumeData();
        }
      } catch (err: unknown) {
        logger.error('Error saving awarded volume:', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        showToast(`Save error: ${message}`, 'error');
      }
    }, 500);
  }, [selectedWeek, showToast, loadVolumeData]);

  function updateVolume(itemId: string, supplierId: string, quoteId: string, value: string) {
    const volume = value === '' ? 0 : parseInt(value) || 0;

    setSkuVolumes(prev =>
      prev.map(sku => {
        if (sku.item.id !== itemId) return sku;

        const updatedEntries = sku.entries.map(entry => {
          if (entry.quote_id === quoteId) {
            return { ...entry, awarded_volume: volume };
          }
          return entry;
        });

        const totalVolume = updatedEntries.reduce((sum, e) => sum + e.awarded_volume, 0);

        return {
          ...sku,
          entries: updatedEntries,
          totalVolume,
        };
      })
    );

    saveDraftDebounced(itemId, supplierId, quoteId, volume);
  }

  async function saveVolumeNeeds() {
    if (!selectedWeek) return;

    logger.debug('Saving volume needs for week:', selectedWeek.week_number);

    setSaving(true);
    try {
      let savedCount = 0;
      for (const item of items) {
        const volumeNeeded = volumeNeeds.get(item.id) || 0;
        const success = await updateVolumeNeeded(selectedWeek.id, item.id, volumeNeeded);
        if (success) savedCount++;
      }

      logger.debug(`Saved ${savedCount}/${items.length} volume needs`);

      // Refetch from DB to confirm save - add small delay to ensure DB is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      const volumeNeedsData = await fetchVolumeNeeds(selectedWeek.id);
      // Only mark as saved if there's actual volume data (not just empty records)
      const hasVolumeData = volumeNeedsData.some(vn => vn.volume_needed && vn.volume_needed > 0);
      setVolumeNeedsSaved(hasVolumeData);

      if (hasVolumeData) {
        showToast('Volume needs saved successfully! You can now allocate volume to suppliers.', 'success');
        
        // Notify suppliers that volume requirements are ready
        try {
          const suppliers = await fetchSuppliers();
          const week = selectedWeek;
          for (const supplier of suppliers) {
            try {
              await sendPricingReminder(supplier, week, week.id);
            } catch (err) {
              logger.error(`Error notifying supplier ${supplier.name}:`, err);
            }
          }
          logger.debug(`Notified ${suppliers.length} suppliers about volume requirements`);
        } catch (err) {
          logger.error('Error notifying suppliers:', err);
          // Don't fail the save if notification fails
        }
      } else {
        showToast('Please enter at least one volume need before saving', 'error');
      }
    } catch (err) {
      logger.error('Error saving volume needs:', err);
      showToast('Failed to save volume needs', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAllDrafts() {
    if (!selectedWeek) return;

    logger.debug('Saving all drafts for week:', selectedWeek.id);

    setSaving(true);
    let totalSaved = 0;
    let totalWithVolume = 0;

    try {
      const { supabase } = await import('../utils/supabase');

      for (const sku of skuVolumes) {
        logger.debug(`Processing SKU: ${sku.item.name}`);
        for (const entry of sku.entries) {
          const week_id = selectedWeek.id;
          const supplier_id = entry.supplier_id;
          const item_id = sku.item.id;
          const awarded_volume = entry.awarded_volume > 0 ? entry.awarded_volume : null;

          if (awarded_volume !== null && awarded_volume > 0) {
            totalWithVolume++;
            logger.debug(`${entry.supplier_name}: ${awarded_volume} cases`);
          }

          const { data, error } = await supabase
            .from('quotes')
            .upsert(
              {
                week_id,
                supplier_id,
                item_id,
                awarded_volume,
                updated_at: new Date().toISOString()
              },
              {
                onConflict: 'week_id,item_id,supplier_id'
              }
            )
            .select();

          if (error) {
            logger.error('Upsert error:', error.code, error.message);
            showToast(`Save failed: ${error.message}`, 'error');
            throw error;
          }

          if (!data || data.length === 0) {
            logger.error('Save failed: No rows returned');
            showToast('Save failed: No data returned', 'error');
            throw new Error('No data returned from upsert');
          }

          totalSaved++;
          logger.debug('Saved to DB successfully');
        }
      }

      logger.debug(`\n=== SAVE SUMMARY ===`);
      logger.debug(`Total entries processed: ${totalSaved}`);
      logger.debug(`Entries with allocated volume: ${totalWithVolume}`);

      // Refetch from DB to confirm persistence
      logger.debug('=== REFETCHING FROM DB ===');
      const quotes = await fetchQuotesWithDetails(selectedWeek.id);
      logger.debug('Total quotes fetched:', quotes.length);

      const quotesWithVolume = quotes.filter(q => q.awarded_volume !== null);
      logger.debug('Quotes with awarded_volume:', quotesWithVolume.length);

      quotesWithVolume.forEach(q => {
        logger.debug(`  ${q.supplier?.name} - ${q.item_id}: ${q.awarded_volume}`);
      });

      if (quotesWithVolume.length > 0) {
        showToast(`${quotesWithVolume.length} award volume(s) saved successfully`, 'success');
        await loadVolumeData();
      } else {
        showToast('No volumes saved to database', 'error');
      }
    } catch (err: any) {
      logger.error('Error saving allocations:', err);
      showToast(`Failed to save: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleEmergencyUnlock() {
    if (!selectedWeek || !session || !unlockReason.trim()) {
      showToast('Please provide a reason for the emergency unlock', 'error');
      return;
    }

    try {
      const success = await updateEmergencyUnlock(
        selectedWeek.id,
        true,
        unlockReason,
        session.user_name
      );

      if (success) {
        showToast('Week unlocked for emergency changes. You can now make edits.', 'success');
        setShowUnlockModal(false);
        setUnlockReason('');
        // Reload data to refresh week status
        await loadData();
        if (activeTab === 'allocate') {
          await loadVolumeData();
        }
        // Update parent component with new week status
        if (selectedWeek && onWeekUpdate) {
          const { supabase } = await import('../utils/supabase');
          const { data: updatedWeek, error: weekError } = await supabase
            .from('weeks')
            .select('*')
            .eq('id', selectedWeek.id)
            .single();
          if (weekError || !updatedWeek) {
            logger.error('Failed to fetch updated week after unlock:', weekError);
          } else {
            onWeekUpdate(updatedWeek as Week);
          }
        }
      } else {
        showToast('Failed to unlock week', 'error');
      }
    } catch (err) {
      logger.error('Error unlocking week:', err);
      showToast('Failed to unlock week', 'error');
    }
  }

  async function handleSubmitAllocations() {
    if (!selectedWeek || !session) return;

    // Validation: Week must be finalized (soft copy)
    if (selectedWeek.status !== 'finalized') {
      showToast('Heads up: Please finalize pricing before sending allocations', 'error');
      return;
    }

    // Validation: Must have at least one allocation
    const hasAllocations = skuVolumes.some(sku =>
      sku.entries.some(entry => entry.awarded_volume > 0)
    );

    if (!hasAllocations) {
      showToast('Just a note: No volume allocated yet', 'error');
      return;
    }

    // Validation: Check that pricing calculations exist for items with allocations
    const itemsWithAllocations = new Set<string>();
    skuVolumes.forEach(sku => {
      if (sku.entries.some(e => e.awarded_volume > 0)) {
        itemsWithAllocations.add(sku.item.id);
      }
    });

    if (itemsWithAllocations.size > 0) {
      const { supabase } = await import('../utils/supabase');
      const { data: pricingData } = await supabase
        .from('item_pricing_calculations')
        .select('item_id')
        .eq('week_id', selectedWeek.id)
        .in('item_id', Array.from(itemsWithAllocations));

      const itemsWithPricing = new Set((pricingData || []).map((p: { item_id: string }) => p.item_id));
      const missingPricing = Array.from(itemsWithAllocations).filter(id => !itemsWithPricing.has(id));

      if (missingPricing.length > 0) {
        const missingItems = skuVolumes
          .filter(sku => missingPricing.includes(sku.item.id))
          .map(sku => sku.item.name)
          .join(', ');
        showToast(`Heads up: Set pricing calculations for ${missingItems}`, 'error');
        return;
      }
    }

    setSaving(true);
    setSubmitting(true);

    try {
      logger.debug('Submitting allocations to suppliers');

      await saveAllDrafts();
      const result = await submitAllocationsToSuppliers(selectedWeek.id, session.user_name);

      if (result.success) {
        showToast(`Volume allocations sent to ${result.count} supplier(s) successfully`, 'success');
        await loadData();
        await loadVolumeData();
      } else {
        showToast(result.error || 'Failed to submit allocations', 'error');
      }
    } catch (err: any) {
      logger.error('Error submitting allocations:', err);
      showToast(`Failed to submit allocations: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadData();
      if (activeTab === 'allocate') {
        await loadVolumeData();
      }
      showToast('Data refreshed successfully', 'success');
    } catch (err) {
      logger.error('Error refreshing data:', err);
      showToast('Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  if (!selectedWeek) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-medium">No week selected</p>
        <p className="text-gray-400 text-sm mt-2">Select a week from the Pricing tab to manage volume allocation</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-emerald-800 font-semibold text-lg">Loading volume data...</p>
      </div>
    );
  }

  if (selectedWeek.status !== 'finalized' && selectedWeek.status !== 'closed') {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-12 text-center border border-white/20">
        <Info className="w-16 h-16 text-white/40 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-white mb-3">Volume Allocation Not Available Yet</h3>
        <p className="text-white/70 mb-2 text-lg">Volume allocation will be available after pricing is finalized.</p>
        <p className="text-white/50 text-sm">Complete the pricing workflow first, then return here to allocate volumes.</p>
      </div>
    );
  }

  // Determine if week is locked (closed and not emergency unlocked)
  const isLocked = selectedWeek.status === 'closed' && !selectedWeek.emergency_unlock_enabled;
  const canEdit = selectedWeek.status === 'finalized' || (selectedWeek.status === 'closed' && selectedWeek.emergency_unlock_enabled);

  return (
    <div className="space-y-6">
      {/* Clean Header */}
      <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <Award className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Volume Allocation</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-white/70">Week {selectedWeek.week_number}</span>
                <span className="text-white/40">•</span>
                <span className="text-xs text-white/70">
                  {new Date(selectedWeek.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(selectedWeek.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                {isLocked && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-xs text-orange-300 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Locked
                    </span>
                  </>
                )}
                {selectedWeek.status === 'closed' && selectedWeek.emergency_unlock_enabled && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-xs text-orange-300 font-semibold flex items-center gap-1">
                      <Unlock className="w-3 h-3" />
                      Emergency Mode
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {isLocked && (
              <button
                onClick={() => setShowUnlockModal(true)}
                className="flex items-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                title="Emergency unlock to make changes"
              >
                <Unlock className="w-4 h-4" />
                Emergency Unlock
              </button>
            )}

            {activeTab === 'volume_needed' && selectedWeek?.status === 'finalized' && (
              <button
                onClick={saveVolumeNeeds}
                disabled={saving || !canEdit}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Volume Needs
                  </>
                )}
              </button>
            )}

            {activeTab === 'allocate' && canEdit && !selectedWeek?.allocation_submitted && volumeNeedsSaved && (
              <button
                onClick={handleSubmitAllocations}
                disabled={submitting}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Allocations to Suppliers
                  </>
                )}
              </button>
            )}

            {activeTab === 'allocate' && selectedWeek?.allocation_submitted && (
              <div className="flex items-center gap-2 bg-green-500/20 border border-green-400/30 text-green-300 px-3 py-2 rounded-lg text-sm font-medium">
                <Check className="w-4 h-4" />
                Sent
              </div>
            )}
          </div>
        </div>
      </div>

      {isLocked && (
        <div className="bg-orange-500/10 border border-orange-400/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-orange-300" />
            <div>
              <p className="text-sm text-white font-semibold">Week is locked</p>
              <p className="text-xs text-white/70 mt-0.5">View-only mode. Use Emergency Unlock to make changes.</p>
            </div>
          </div>
        </div>
      )}

      {/* Clean Tab Navigation */}
      <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('volume_needed')}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'volume_needed'
                ? 'text-white bg-white/10 border-b-2 border-emerald-400'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Volume Needed</span>
          </button>
          <button
            onClick={() => {
              // Allow viewing if: allocation submitted OR (finalized/closed AND volume needs saved)
              const canAccess = selectedWeek?.allocation_submitted || 
                ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved);
              if (!canAccess) {
                if (selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') {
                  showToast('Please save volume needs first before allocating volume', 'info');
                } else {
                  showToast('Please finalize pricing first', 'info');
                }
                return;
              }
              setActiveTab('allocate');
            }}
            className={`flex-1 px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'allocate'
                ? 'text-white bg-white/10 border-b-2 border-emerald-400'
                : !(selectedWeek?.allocation_submitted || ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved))
                ? 'text-white/30 cursor-not-allowed'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
            disabled={!(selectedWeek?.allocation_submitted || ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved))}
          >
            <Award className="w-4 h-4" />
            <span>Allocate Volume</span>
            {!(selectedWeek?.allocation_submitted || ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved)) && (
              <Lock className="w-3 h-3" />
            )}
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'volume_needed' ? (
            <div className="space-y-6">
              {selectedWeek?.status !== 'finalized' && selectedWeek?.status !== 'closed' ? (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-orange-300" />
                    <p className="text-sm text-white/80 font-medium">
                      Please finalize pricing before setting volume requirements.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-emerald-300" />
                    <div className="flex-1">
                      <p className="text-sm text-white/80 font-medium">
                        Enter the total number of cases needed for each SKU, then click "Save Volume Needs".
                      </p>
                      {volumeNeedsSaved && (
                        <p className="text-xs text-emerald-300 mt-1 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Volume needs saved! You can now allocate volume to suppliers.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                {items.map(item => {
                  const volumeNeeded = volumeNeeds.get(item.id) || 0;
                  return (
                    <div key={item.id} className="group bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:bg-white/8 hover:border-emerald-400/20 transition-all">
                      <div className="grid grid-cols-12 gap-6 items-center">
                        <div className="col-span-4">
                          <div className="font-black text-white text-xl mb-2">{item.name}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-white/80 font-medium">{item.pack_size}</span>
                            <span className="text-xs px-3 py-1 bg-white/20 rounded-lg font-bold text-white/90 border border-white/30">
                              {item.organic_flag}
                            </span>
                            <span className="text-xs text-white/60 capitalize font-medium">{item.category}</span>
                          </div>
                        </div>
                        <div className="col-span-4">
                          <div className="text-xs text-white/60 mb-2 font-semibold uppercase tracking-wider">Last Week Delivered Price</div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-blue-500/10 border border-blue-400/20 rounded-lg px-4 py-3">
                              <span className="text-2xl font-black text-blue-200">
                                {lastWeekDeliveredPrices.get(item.id) ? formatCurrency(lastWeekDeliveredPrices.get(item.id)!) : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-4">
                          <div className="text-xs text-white/60 mb-2 font-semibold uppercase tracking-wider">Cases Needed</div>
                          <input
                            type="number"
                            min="0"
                            value={volumeNeeded || ''}
                            onChange={(e) => updateVolumeNeed(item.id, e.target.value)}
                            disabled={!canEdit}
                            placeholder="Enter cases..."
                            className={`w-full px-5 py-4 border-2 rounded-xl text-right font-black text-xl focus:outline-none focus:ring-4 transition-all ${
                              canEdit
                                ? 'border-emerald-400/20 bg-emerald-500/5 text-white focus:ring-emerald-400/50 focus:border-emerald-400/40 placeholder:text-white/40 hover:border-emerald-400/30'
                                : 'border-white/10 bg-white/3 text-white/50 cursor-not-allowed'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            ) : (
            <div className="space-y-4">
              {/* Show lock message if conditions aren't met */}
              {!(selectedWeek?.allocation_submitted || ((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved)) ? (
                <>
                  {selectedWeek?.status !== 'finalized' && selectedWeek?.status !== 'closed' ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-orange-300" />
                        <p className="text-sm text-white/80 font-medium">Please finalize pricing before allocating volume to suppliers.</p>
                      </div>
                    </div>
                  ) : !volumeNeedsSaved ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-orange-300" />
                        <p className="text-sm text-white/80 font-medium">Please enter and save volume needs in the "Volume Needed" tab first.</p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="bg-gradient-to-r from-emerald-500/20 to-lime-500/20 border-2 border-emerald-400/50 rounded-2xl p-6 mb-6 backdrop-blur-sm shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Award className="w-6 h-6 text-emerald-300" />
                      <h3 className="text-xl font-black text-white">Allocate Volume to Suppliers</h3>
                    </div>
                    <p className="text-sm text-white/90 ml-9">
                      Distribute cases among suppliers based on their final pricing. Only suppliers who have completed pricing negotiations are shown below.
                    </p>
                  </div>

                  {/* Show allocation content if pricing is finalized/closed AND volume needs are saved - always show for flexibility */}
                  {((selectedWeek?.status === 'finalized' || selectedWeek?.status === 'closed') && volumeNeedsSaved) ? (
                    <>
                      {skuVolumes.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                          <Award className="w-16 h-16 text-white/30 mx-auto mb-4" />
                          <p className="text-white/80 text-lg font-bold">No suppliers with finalized pricing</p>
                          <p className="text-white/60 text-sm mt-2">Complete pricing negotiations before allocating volume</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {skuVolumes.map((sku) => {
                        const remaining = sku.volumeNeeded - sku.totalVolume;
                const isComplete = sku.totalVolume === sku.volumeNeeded && sku.volumeNeeded > 0;
                const isOver = sku.totalVolume > sku.volumeNeeded && sku.volumeNeeded > 0;

                const weightedTotal = sku.entries.reduce((sum, entry) => {
                  return sum + (entry.price * entry.awarded_volume);
                }, 0);
                const avgFOB = sku.totalVolume > 0 ? weightedTotal / sku.totalVolume : 0;

                // Get pricing data from internal pricing calculations
                const pricingData = pricingCalculations.get(sku.item.id);
                const avgDeliveredCost = pricingData?.dlvd_price || 0;
                const profitPerCase = pricingData?.margin || 0;
                // Est. Profit = Profit Per Case × Volume
                const estProfit = profitPerCase * sku.totalVolume;

                return (
                  <div key={sku.item.id} className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
                    {/* SKU Header */}
                    <div className="bg-emerald-500/15 px-6 py-6 border-b border-white/10">
                      <div className="relative flex items-center justify-between flex-wrap gap-6">
                        <div>
                          <h3 className="text-2xl font-black text-white mb-2">{sku.item.name}</h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm text-white/90 font-semibold">{sku.item.pack_size}</span>
                            <span className="text-xs px-3 py-1.5 bg-white/20 rounded-lg font-bold text-white border border-white/30">
                              {sku.item.organic_flag}
                            </span>
                            <span className="text-sm text-white/80 capitalize font-medium">
                              {sku.item.category}
                            </span>
                          </div>
                        </div>
                        
                        {/* Enhanced Volume Progress Card */}
                        <div className="bg-white/8 backdrop-blur-sm rounded-xl border border-white/15 px-6 py-5 min-w-[240px]">
                          <div className="text-xs text-white/80 font-bold mb-3 uppercase tracking-wider">Allocation Progress</div>
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className={`text-4xl font-black ${
                              isComplete ? 'text-green-300' :
                              isOver ? 'text-red-300' :
                              'text-emerald-300'
                            }`}>
                              {sku.totalVolume.toLocaleString()}
                            </span>
                            <span className="text-white/40 text-2xl">/</span>
                            <span className="text-4xl font-black text-white">
                              {sku.volumeNeeded.toLocaleString()}
                            </span>
                            <span className="text-sm text-white/70 font-semibold ml-1">cases</span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full bg-white/5 rounded-full h-2.5 mb-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                isComplete ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                isOver ? 'bg-gradient-to-r from-red-400 to-red-500' :
                                'bg-gradient-to-r from-emerald-400 to-lime-400'
                              }`}
                              style={{ width: `${Math.min((sku.totalVolume / sku.volumeNeeded) * 100, 100)}%` }}
                            ></div>
                          </div>
                          {sku.volumeNeeded > 0 && (
                            <div className="mt-2">
                              {isComplete ? (
                                <span className="text-sm text-green-300 font-bold flex items-center gap-1.5 justify-end">
                                  <Check className="w-4 h-4" />
                                  Complete
                                </span>
                              ) : isOver ? (
                                <span className="text-sm text-white/60 italic">
                                  {Math.abs(remaining).toLocaleString()} over
                                </span>
                              ) : (
                                <span className="text-sm text-white/60 italic">
                                  {remaining.toLocaleString()} remaining
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Summary Cards */}
                    <div className="p-6 grid grid-cols-2 gap-6 bg-white/0">
                      <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400/60"></div>
                            <div className="text-xs font-black text-emerald-200 uppercase tracking-wider">FOB Summary</div>
                          </div>
                          <button
                            className="text-white/40 hover:text-white/70 transition-colors"
                            title="Weighted average of allocated volumes"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-white/80 font-semibold">Avg FOB Price:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-2xl font-black text-white">
                              {sku.totalVolume > 0 ? formatCurrency(avgFOB) : (sku.entries.length > 0 ? formatCurrency(sku.entries.reduce((sum, e) => sum + e.price, 0) / sku.entries.length) : '$0.00')}
                            </span>
                            {/* Subtle signal placeholder - would compare to last week */}
                            <span className="text-xs text-white/40">weighted</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400/60"></div>
                            <div className="text-xs font-black text-blue-200 uppercase tracking-wider">Delivered Costs</div>
                          </div>
                          <button
                            className="text-white/40 hover:text-white/70 transition-colors"
                            title="From internal pricing calculations"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white/80 font-semibold">Avg Delivered:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-2xl font-black text-white">
                                {avgDeliveredCost > 0 ? formatCurrency(avgDeliveredCost) : '-'}
                              </span>
                              {avgDeliveredCost > 0 && (
                                <span className="text-xs text-white/40 italic">from pricing</span>
                              )}
                            </div>
                          </div>
                          {profitPerCase > 0 && sku.totalVolume > 0 && (
                            <>
                              <div className="pt-3 border-t border-white/5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-white/80 font-semibold">Est. Profit:</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-2xl font-black text-green-200">
                                      {formatCurrency(estProfit)}
                                    </span>
                                    {estProfit > 0 && (
                                      <div title="Positive margin">
                                        <Check className="w-4 h-4 text-green-300" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-white/50 text-right mt-1">
                                  {formatCurrency(profitPerCase)} × {sku.totalVolume.toLocaleString()} cases
                                </div>
                              </div>
                            </>
                          )}
                          {!pricingData && sku.totalVolume > 0 && (
                            <div className="text-xs text-white/50 mt-2 text-right italic">
                              Pricing not set
                            </div>
                          )}
                          {pricingData && sku.totalVolume > 0 && (
                            <div className="text-xs text-green-300/70 mt-2 text-right flex items-center justify-end gap-1">
                              <Check className="w-3 h-3" />
                              <span>Pricing set</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Supplier Allocation Table */}
                    <div className="overflow-x-auto bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-emerald-500/20 to-lime-500/20 border-b-2 border-emerald-400/30">
                          <tr>
                            <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider">#</th>
                            <th className="px-4 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Supplier</th>
                            <th className="px-4 py-4 text-right text-xs font-black text-white uppercase tracking-wider">FOB Price</th>
                            <th className="px-4 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Award Cases</th>
                            <th className="px-4 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Status</th>
                            <th className="px-4 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Confirmed</th>
                            <th className="px-4 py-4 text-right text-xs font-black text-white uppercase tracking-wider">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {sku.entries.map((entry) => {
                            const percentage = sku.volumeNeeded > 0
                              ? ((entry.awarded_volume / sku.volumeNeeded) * 100).toFixed(1)
                              : '0.0';

                            return (
                              <tr
                                key={entry.quote_id}
                                className={`hover:bg-white/8 transition-colors ${
                                  entry.rank === 1 ? 'bg-emerald-500/10 border-l-4 border-emerald-400' :
                                  entry.rank === 2 ? 'bg-emerald-500/5' :
                                  entry.rank === 3 ? 'bg-orange-500/5' :
                                  'bg-white/0'
                                }`}
                              >
                                <td className="px-4 py-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                                    entry.rank === 1 ? 'bg-emerald-500/30 text-emerald-100 border-2 border-emerald-400/50' :
                                    entry.rank === 2 ? 'bg-emerald-500/20 text-emerald-200 border-2 border-emerald-400/40' :
                                    entry.rank === 3 ? 'bg-orange-500/20 text-orange-200 border-2 border-orange-400/40' :
                                    'bg-white/10 text-white/60 border border-white/20'
                                  }`}>
                                    {entry.rank}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-base">{entry.supplier_name}</span>
                                    {entry.awarded_volume > 0 && (
                                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="font-black text-white text-base">{formatCurrency(entry.price)}</div>
                                  {entry.dlvd_price && (
                                    <div className="text-xs text-white/50 mt-0.5">
                                      {formatCurrency(entry.dlvd_price)} DLVD
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  {canEdit ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={entry.awarded_volume || ''}
                                      onChange={(e) => updateVolume(sku.item.id, entry.supplier_id, entry.quote_id, e.target.value)}
                                      placeholder="0"
                                      className="w-28 px-3 py-2.5 border-2 border-white/20 rounded-lg text-right font-black text-base text-white bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 placeholder:text-white/30 hover:border-emerald-400/30 transition-all"
                                      style={{ color: '#ffffff' }}
                                    />
                                  ) : (
                                    <div className="font-black text-white text-base">{entry.awarded_volume > 0 ? entry.awarded_volume.toLocaleString() : '-'}</div>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-center">
                                  {entry.awarded_volume > 0 ? (
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                      entry.supplier_response_status === 'accepted' ? 'bg-green-500/30 text-green-200 border border-green-400/50' :
                                      entry.supplier_response_status === 'revised' ? 'bg-orange-500/30 text-orange-200 border border-orange-400/50' :
                                      entry.supplier_response_status === 'pending' ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50' :
                                      'bg-white/10 text-white/60 border border-white/20'
                                    }`}>
                                      {entry.supplier_response_status === 'accepted' ? '✓' :
                                       entry.supplier_response_status === 'revised' ? '↻' :
                                       entry.supplier_response_status === 'pending' ? '⏳' :
                                       selectedWeek?.allocation_submitted ? '⏳' : '-'}
                                    </span>
                                  ) : (
                                    <span className="text-white/30">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  {entry.supplier_response_volume !== null && entry.supplier_response_volume !== undefined ? (
                                    <div className={`font-black text-base ${
                                      entry.supplier_response_volume !== entry.awarded_volume ? 'text-orange-300' : 'text-green-300'
                                    }`}>
                                      {entry.supplier_response_volume.toLocaleString()}
                                      {entry.supplier_response_volume !== entry.awarded_volume && (
                                        <div className="text-xs text-white/50">({entry.supplier_response_volume > entry.awarded_volume ? '+' : ''}{entry.supplier_response_volume - entry.awarded_volume})</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-white/30">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <span className={`font-bold text-base ${
                                    entry.awarded_volume > 0 ? 'text-emerald-300' : 'text-white/30'
                                  }`}>
                                    {entry.awarded_volume > 0 ? `${percentage}%` : '-'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
                          })}
                        </div>
                      )}

                      {/* Internal Pricing Calculations - Show for all items with finalized pricing */}
                      {selectedWeek?.status === 'finalized' && volumeNeedsSaved && items.length > 0 && (
                        <div className="mt-8">
                          <PricingCalculations
                            weekId={selectedWeek.id}
                            items={items}
                            onPricingUpdate={async () => {
                              // Reload pricing calculations when updated
                              if (selectedWeek) {
                                const pricingData = await fetchItemPricingCalculations(selectedWeek.id);
                                const pricingMap = new Map<string, { dlvd_price: number; margin: number }>();
                                pricingData.forEach(p => {
                                  if (p.dlvd_price !== undefined && p.margin !== undefined) {
                                    pricingMap.set(p.item_id, {
                                      dlvd_price: p.dlvd_price,
                                      margin: p.margin
                                    });
                                  }
                                });
                                setPricingCalculations(pricingMap);
                              }
                              loadVolumeData();
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                      <Package className="w-16 h-16 text-white/30 mx-auto mb-4" />
                      <p className="text-white/80 text-lg font-bold">Save volume needs first</p>
                      <p className="text-white/60 text-sm mt-2">Enter and save volume requirements in the "Volume Needed" tab</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation to Volume Acceptance - Show when allocations are submitted */}
      {selectedWeek?.allocation_submitted && (
        <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-4 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-300" />
              <div>
                <p className="text-sm text-white font-semibold">Allocations sent to suppliers</p>
                <p className="text-xs text-white/70 mt-0.5">Review supplier responses in Volume Acceptance</p>
              </div>
            </div>
            <button
              onClick={() => {
                // Trigger navigation to Volume Acceptance
                window.dispatchEvent(new CustomEvent('navigate-to-volume-acceptance', { 
                  detail: { weekId: selectedWeek.id } 
                }));
              }}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            >
              <Award className="w-4 h-4" />
              View Responses
            </button>
          </div>
        </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Emergency Unlock Required
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                This week is locked. Please provide a reason for the emergency unlock:
              </p>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Enter reason for unlock (e.g., 'Supplier requested volume change', 'Pricing correction needed')"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div className="p-6 border-t bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyUnlock}
                disabled={!unlockReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Unlock Week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
