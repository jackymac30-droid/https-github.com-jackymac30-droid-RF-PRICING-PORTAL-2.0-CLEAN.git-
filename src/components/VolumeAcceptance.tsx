import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Edit3, AlertCircle, TrendingUp, DollarSign, Package, BarChart3, Lock, Unlock } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import { closeVolumeLoop, updateEmergencyUnlock } from '../utils/database';
import { useApp } from '../contexts/AppContext';
import { logger } from '../utils/logger';
import { useRealtime } from '../hooks/useRealtime';

interface VolumeAcceptanceProps {
  weekId: string;
}

interface VolumeAllocation {
  quoteId: string;
  itemId: string;
  itemName: string;
  supplierId: string;
  supplierName: string;
  supplierFob: number;
  rfFinalFob: number;
  offeredVolume: number;
  supplierResponse: string | null;
  supplierVolumeAccepted: number;
  supplierResponseNotes: string | null;
  awardedVolume: number;
  avgPrice: number;
  dlvdPrice: number;
  rebate: number;
  freight: number;
  margin: number;
}

export function VolumeAcceptance({ weekId }: VolumeAcceptanceProps) {
  const { showToast } = useToast();
  const { session } = useApp();
  const [allocations, setAllocations] = useState<VolumeAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revisedVolumes, setRevisedVolumes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [closingLoop, setClosingLoop] = useState(false);
  const [volumeFinalized, setVolumeFinalized] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Set up realtime subscription for quotes table to auto-refresh when awards are finalized
  // Only update if volume is not yet finalized
  const handleQuotesUpdate = useCallback(() => {
    if (weekId && !volumeFinalized) {
      logger.debug('Quotes updated, refreshing allocations...');
      loadAllocations();
    }
  }, [weekId, volumeFinalized]);

  // Set up realtime subscription for weeks table to check volume_finalized status
  const handleWeeksUpdate = useCallback(() => {
    if (weekId) {
      logger.debug('Week updated, checking volume finalized status...');
      checkVolumeFinalized();
      // Always reload allocations when week status changes (even if finalized, to show final state)
      loadAllocations();
    }
  }, [weekId]);

  useRealtime('quotes', handleQuotesUpdate, { column: 'week_id', value: weekId });
  useRealtime('weeks', handleWeeksUpdate, { column: 'id', value: weekId });

  useEffect(() => {
    loadAllocations();
    checkVolumeFinalized();
  }, [weekId]);

  async function checkVolumeFinalized() {
    const { data, error } = await supabase
      .from('weeks')
      .select('volume_finalized')
      .eq('id', weekId)
      .maybeSingle();

    if (data && !error) {
      setVolumeFinalized(data.volume_finalized || false);
    }
  }

  async function loadAllocations() {
    try {
      setLoading(true);
      // Volume Field Lifecycle:
      // 1. awarded_volume: RF's initial award (draft) - set in Award Volume tab
      // 2. offered_volume: Copied from awarded_volume when RF submits to suppliers
      // 3. supplier_volume_accepted: Supplier's response (accept or revise)
      // 4. awarded_volume (updated): Final volume after RF accepts supplier response
      // Show quotes that either have offered_volume OR awarded_volume (ready to be sent or already finalized)
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          item_id,
          supplier_id,
          supplier_fob,
          rf_final_fob,
          offered_volume,
          supplier_volume_response,
          supplier_volume_accepted,
          supplier_volume_response_notes,
          awarded_volume,
          item:items!inner(name),
          supplier:suppliers!inner(name)
        `)
        .eq('week_id', weekId)
        .or('offered_volume.gt.0,awarded_volume.gt.0')
        .order('item_id');

      if (error) throw error;

      const { data: pricingData, error: pricingError } = await supabase
        .from('item_pricing_calculations')
        .select('item_id, avg_price, dlvd_price, rebate, freight, margin')
        .eq('week_id', weekId);

      if (pricingError) {
        logger.error('Error loading pricing calculations:', pricingError);
        // Don't throw, continue with defaults
      }

      const pricingMap = new Map(
        (pricingData || []).map((p: { item_id: string; avg_price?: number; dlvd_price?: number; rebate?: number; freight?: number; margin?: number }) => [p.item_id, p])
      );

      const mapped: VolumeAllocation[] = data.map((q) => {
        const pricing = pricingMap.get(q.item_id) as { avg_price?: number; dlvd_price?: number; rebate?: number; freight?: number; margin?: number } | undefined;
        
        // Use defaults if pricing not found (matches PricingCalculations defaults)
        const rebate = pricing?.rebate !== undefined ? pricing.rebate : 0.80;
        const freight = pricing?.freight !== undefined ? pricing.freight : 1.75;
        const dlvdPrice = pricing?.dlvd_price || 0;
        const margin = pricing?.margin || 0;
        
        return {
          quoteId: q.id,
          itemId: q.item_id,
          itemName: Array.isArray(q.item) ? q.item[0]?.name || '' : (q.item as { name: string }).name,
          supplierId: q.supplier_id,
          supplierName: Array.isArray(q.supplier) ? q.supplier[0]?.name || '' : (q.supplier as { name: string }).name,
          supplierFob: q.supplier_fob || 0,
          rfFinalFob: q.rf_final_fob || 0,
          offeredVolume: q.offered_volume || 0,
          supplierResponse: q.supplier_volume_response,
          supplierVolumeAccepted: q.supplier_volume_accepted || 0,
          supplierResponseNotes: q.supplier_volume_response_notes,
          awardedVolume: q.awarded_volume || 0,
          avgPrice: pricing?.avg_price || 0,
          dlvdPrice: dlvdPrice,
          rebate: rebate,
          freight: freight,
          margin: margin,
        };
      });

      setAllocations(mapped);
    } catch (err) {
      logger.error('Error loading allocations:', err);
      showToast('Failed to load volume allocations', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptSupplierResponse(allocation: VolumeAllocation) {
    setProcessing({ ...processing, [allocation.quoteId]: true });
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          awarded_volume: allocation.supplierVolumeAccepted,
        })
        .eq('id', allocation.quoteId);

      if (error) throw error;

      showToast(`Accepted ${allocation.supplierVolumeAccepted} units from ${allocation.supplierName}`, 'success');
      await loadAllocations();
    } catch (err) {
      logger.error('Error accepting volume:', err);
      showToast('Failed to accept volume', 'error');
    } finally {
      setProcessing({ ...processing, [allocation.quoteId]: false });
    }
  }

  async function handleReviseOffer(allocation: VolumeAllocation) {
    const newVolume = parseFloat(revisedVolumes[allocation.quoteId] || '0');

    if (newVolume <= 0) {
      showToast('Please enter a valid volume', 'error');
      return;
    }

    setProcessing({ ...processing, [allocation.quoteId]: true });
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          offered_volume: newVolume,
          supplier_volume_response: null,
          supplier_volume_accepted: 0,
          supplier_volume_response_notes: null,
        })
        .eq('id', allocation.quoteId);

      if (error) throw error;

      showToast(`Revised offer to ${newVolume} units for ${allocation.supplierName}`, 'success');
      setRevisedVolumes({ ...revisedVolumes, [allocation.quoteId]: '' });
      await loadAllocations();
    } catch (err) {
      logger.error('Error revising offer:', err);
      showToast('Failed to revise offer', 'error');
    } finally {
      setProcessing({ ...processing, [allocation.quoteId]: false });
    }
  }

  async function handleDeclineOffer(allocation: VolumeAllocation) {
    setProcessing({ ...processing, [allocation.quoteId]: true });
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          offered_volume: 0,
          supplier_volume_response: null,
          supplier_volume_accepted: 0,
          supplier_volume_response_notes: null,
        })
        .eq('id', allocation.quoteId);

      if (error) throw error;

      showToast(`Withdrawn volume offer from ${allocation.supplierName}`, 'success');
      await loadAllocations();
    } catch (err) {
      logger.error('Error declining offer:', err);
      showToast('Failed to withdraw offer', 'error');
    } finally {
      setProcessing({ ...processing, [allocation.quoteId]: false });
    }
  }

  async function handleCloseLoop() {
    if (!session || session.role !== 'rf') {
      showToast('Only RF users can close the volume loop', 'error');
      return;
    }

    // Validation: Check that all supplier responses have been handled
    const hasPending = pendingAllocations.length > 0;
    const hasUnhandledResponses = respondedAllocations.length > 0;

    if (hasPending) {
      showToast(`Heads up: ${pendingAllocations.length} allocation(s) still pending`, 'error');
      return;
    }

    if (hasUnhandledResponses) {
      showToast(`Just a note: ${respondedAllocations.length} response(s) need review`, 'error');
      return;
    }

    if (finalizedAllocations.length === 0) {
      showToast('Heads up: No finalized allocations found', 'error');
      return;
    }

    setClosingLoop(true);
    try {
      const result = await closeVolumeLoop(weekId, session.user_name);

      if (result.success) {
        showToast('Volume allocation loop closed successfully. Week is now locked.', 'success');
        setVolumeFinalized(true);
        await loadAllocations();
        await checkVolumeFinalized();
      } else {
        if (result.pendingCount && result.pendingCount > 0) {
          showToast(`Cannot close: ${result.pendingCount} supplier response(s) still pending`, 'error');
        } else {
          showToast(result.message || 'Failed to close loop', 'error');
        }
      }
    } catch (err) {
      logger.error('Error closing loop:', err);
      showToast('Failed to close volume loop', 'error');
    } finally {
      setClosingLoop(false);
    }
  }

  async function handleEmergencyUnlock() {
    if (!session || session.role !== 'rf') {
      showToast('Only RF users can unlock weeks', 'error');
      return;
    }

    if (!unlockReason.trim()) {
      showToast('Please provide a reason for the emergency unlock', 'error');
      return;
    }

    setUnlocking(true);
    try {
      const success = await updateEmergencyUnlock(
        weekId,
        true,
        unlockReason,
        session.user_name
      );

      if (success) {
        showToast('Week unlocked for emergency changes. You can now modify volumes and pricing.', 'success');
        setShowUnlockModal(false);
        setUnlockReason('');
        await loadAllocations();
      } else {
        showToast('Failed to unlock week', 'error');
      }
    } catch (err) {
      logger.error('Error unlocking week:', err);
      showToast('Failed to unlock week', 'error');
    } finally {
      setUnlocking(false);
    }
  }

  // Allocation Status Categories:
  // - Pending: RF sent offer (offered_volume > 0) but supplier hasn't responded yet
  // - Responded: Supplier responded (accept/revise/decline) but RF hasn't finalized
  // - Finalized: RF accepted supplier response (awarded_volume > 0, matches supplier_volume_accepted)
  // - Ready to Send: RF awarded volume (awarded_volume > 0) but hasn't sent to supplier yet (offered_volume = 0)
  
  // Pending: has offered_volume but no supplier response yet
  const pendingAllocations = allocations.filter((a: VolumeAllocation) => a.offeredVolume > 0 && !a.supplierResponse && a.awardedVolume === 0);
  // Exclude declined responses from responded allocations - they should not be in financial calculations
  const respondedAllocations = allocations.filter((a: VolumeAllocation) => a.offeredVolume > 0 && a.supplierResponse && a.supplierResponse !== 'decline' && a.awardedVolume === 0);
  // Separate declined allocations for display only (not included in financials)
  const declinedAllocations = allocations.filter((a: VolumeAllocation) => a.offeredVolume > 0 && a.supplierResponse === 'decline' && a.awardedVolume === 0);
  // Finalized: has awarded_volume (RF accepted supplier response)
  const finalizedAllocations = allocations.filter((a: VolumeAllocation) => a.awardedVolume > 0);
  // Ready to send: has awarded_volume but not yet offered (not sent to suppliers)
  const readyToSendAllocations = allocations.filter((a: VolumeAllocation) => a.awardedVolume > 0 && a.offeredVolume === 0);

  // Group allocations by item for clean display
  const groupByItem = (allocs: VolumeAllocation[]) => {
    const grouped = new Map<string, VolumeAllocation[]>();
    allocs.forEach(alloc => {
      const existing = grouped.get(alloc.itemId) || [];
      existing.push(alloc);
      grouped.set(alloc.itemId, existing);
    });
    return grouped;
  };

  // Calculate weighted average FOB cost for an item
  const calculateWeightedAvgFOB = (itemAllocs: VolumeAllocation[], useAwarded: boolean = false) => {
    const validAllocs = itemAllocs.filter(a => a.supplierResponse !== 'decline');
    const totalVolume = validAllocs.reduce((sum, a) => sum + (useAwarded ? a.awardedVolume : a.supplierVolumeAccepted), 0);
    if (totalVolume === 0) return 0;
    const weightedSum = validAllocs.reduce((sum, a) => {
      const volume = useAwarded ? a.awardedVolume : a.supplierVolumeAccepted;
      return sum + (a.rfFinalFob * volume);
    }, 0);
    return weightedSum / totalVolume;
  };

  const allResponsesHandled = pendingAllocations.length === 0 && respondedAllocations.length === 0 && finalizedAllocations.length > 0;

  // Calculate cost per unit using the same formula as Allocate Volume tab
  // Formula: Our Cost = FOB + Rebate + Freight
  // For individual suppliers, use their FOB price with item-level rebate/freight
  const calculateOurCostPerUnit = (allocation: VolumeAllocation): number => {
    // Use the item's rebate and freight from pricing calculations (same for all suppliers of that item)
    // Formula: ourCost = rfFinalFob + rebate + freight
    // This matches PricingCalculations where avgPrice is weighted average, but here we use individual supplier FOB
    const rebate = allocation.rebate || 0;
    const freight = allocation.freight || 0;
    return allocation.rfFinalFob + rebate + freight;
  };

  // Calculate weighted average cost for an item (matching PricingCalculations logic)
  const calculateItemWeightedAvgCost = (itemAllocs: VolumeAllocation[], useAwarded: boolean = false): number => {
    const validAllocs = itemAllocs.filter(a => a.supplierResponse !== 'decline');
    if (validAllocs.length === 0) return 0;
    
    // Get rebate and freight from first allocation (same for all suppliers of item)
    const rebate = validAllocs[0].rebate || 0;
    const freight = validAllocs[0].freight || 0;
    
    // Calculate weighted average FOB
    const totalVolume = validAllocs.reduce((sum, a) => sum + (useAwarded ? a.awardedVolume : a.supplierVolumeAccepted), 0);
    if (totalVolume === 0) return 0;
    
    const weightedFOB = validAllocs.reduce((sum, a) => {
      const volume = useAwarded ? a.awardedVolume : a.supplierVolumeAccepted;
      return sum + (a.rfFinalFob * volume);
    }, 0) / totalVolume;
    
    // Apply same formula: Our Avg Cost = FOB + Rebate + Freight
    return weightedFOB + rebate + freight;
  };

  // Single source of truth: useAwarded=true uses awarded_volume (finalized), false uses supplier_volume_accepted (provisional)
  // Both exclude declined responses - they have zero financial impact
  // All calculations use values from internal pricing calculations (item_pricing_calculations table)
  const calculateFinancials = (allocs: VolumeAllocation[], useAwarded: boolean = false) => {
    // Filter out declined responses - they should never be in financial calculations
    const validAllocs = allocs.filter((a: VolumeAllocation) => a.supplierResponse !== 'decline');
    
    const totalVolume = validAllocs.reduce((sum, a) => sum + (useAwarded ? a.awardedVolume : a.supplierVolumeAccepted), 0);
    
    // Cost: Our Cost Per Unit × Volume (using FOB + Rebate + Freight from pricing calculations)
    const totalCost = validAllocs.reduce((sum, a) => {
      const volume = useAwarded ? a.awardedVolume : a.supplierVolumeAccepted;
      const ourCostPerUnit = calculateOurCostPerUnit(a);
      return sum + (ourCostPerUnit * volume);
    }, 0);
    
    // Revenue: Delivered Price × Volume (from pricing calculations)
    const totalRevenue = validAllocs.reduce((sum, a) => sum + (a.dlvdPrice * (useAwarded ? a.awardedVolume : a.supplierVolumeAccepted)), 0);
    
    // Est Profit: Revenue - Cost (calculated per supplier since each has different FOB/cost)
    const totalProfit = validAllocs.reduce((sum, a) => {
      const volume = useAwarded ? a.awardedVolume : a.supplierVolumeAccepted;
      const ourCostPerUnit = calculateOurCostPerUnit(a);
      const revenue = a.dlvdPrice * volume;
      const cost = ourCostPerUnit * volume;
      return sum + (revenue - cost);
    }, 0);
    
    // Margin: (Est Profit / Revenue) × 100
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return { totalCost, totalRevenue, totalProfit, profitMargin, totalVolume };
  };

  // Financial calculations only include non-declined responses
  const respondedFinancials = calculateFinancials(respondedAllocations, false);
  const finalizedFinancials = calculateFinancials(finalizedAllocations, true);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-12 text-center border-2 border-gray-100">
        <Package className="w-20 h-20 text-gray-300 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-gray-900 mb-3">No Volume Allocations</h3>
        <p className="text-gray-600 mb-6 text-lg">Volume allocations will appear here once they are sent to suppliers.</p>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 max-w-2xl mx-auto text-left shadow-sm">
          <p className="text-base text-blue-900 font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Next Steps:
          </p>
          <ol className="text-sm text-blue-800 list-decimal list-inside space-y-2 font-medium">
            <li>Navigate to <strong className="text-blue-900">"Award Volume"</strong> to allocate cases to suppliers</li>
            <li>Review and adjust volume allocations as needed</li>
            <li>Click <strong className="text-blue-900">"Send Allocation to Suppliers"</strong> to submit offers</li>
            <li>Supplier responses will appear here for review and finalization</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border px-6 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
          <h2 className="text-2xl font-bold text-gray-900">Volume Acceptance</h2>
        </div>
        <div className="flex items-center gap-3">
          {allResponsesHandled && !volumeFinalized && (
            <button
              onClick={handleCloseLoop}
              disabled={closingLoop}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-emerald-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl hover:shadow-3xl transform hover:scale-105 border-2 border-emerald-400"
            >
              {closingLoop ? (
                <>
                  <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full"></div>
                  Closing Loop...
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  Close the Loop
                </>
              )}
            </button>
          )}
          {volumeFinalized && (
            <>
              <div className="flex items-center gap-2 bg-emerald-100 text-emerald-800 px-6 py-3 rounded-lg border-2 border-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-bold">Volume Loop Closed - Week Locked</span>
              </div>
              {session?.role === 'rf' && (
                <button
                  onClick={() => setShowUnlockModal(true)}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
                >
                  <Unlock className="w-5 h-5" />
                  Emergency Unlock
                </button>
              )}
            </>
          )}
          <img
            src="/image.png"
            alt="Robinson Fresh"
            className="h-12 w-auto opacity-60"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {(respondedAllocations.length > 0 || declinedAllocations.length > 0) && (
        <>
          {respondedAllocations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Package className="w-4 h-4 text-blue-300" />
                  </div>
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Total Volume</p>
                </div>
                <p className="text-3xl font-black text-white mb-1">{respondedFinancials.totalVolume.toLocaleString()}</p>
                <p className="text-blue-300/70 text-xs">units</p>
              </div>

            <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <DollarSign className="w-4 h-4 text-red-300" />
                </div>
                <p className="text-red-200 text-xs font-semibold uppercase tracking-wider">Total Cost</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(respondedFinancials.totalCost)}</p>
              <p className="text-red-300/70 text-xs">supplier costs</p>
            </div>

            <div className="bg-green-500/10 border border-green-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-300" />
                </div>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-wider">Revenue</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(respondedFinancials.totalRevenue)}</p>
              <p className="text-green-300/70 text-xs">customer sales</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-emerald-300" />
                </div>
                <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Gross Profit</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(respondedFinancials.totalProfit)}</p>
              <p className="text-emerald-300/70 text-xs">net gain</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-amber-300" />
                </div>
                <p className="text-amber-200 text-xs font-semibold uppercase tracking-wider">Margin</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{respondedFinancials.profitMargin.toFixed(1)}%</p>
              <p className="text-amber-300/70 text-xs">profit margin</p>
            </div>
          </div>
          )}

          {respondedAllocations.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Supplier Responses - Action Required ({respondedAllocations.length})
                </h2>
              </div>
              <div className="p-6 space-y-6">
              {Array.from(groupByItem(respondedAllocations).entries()).map(([itemId, itemAllocs]) => {
                  const firstAlloc = itemAllocs[0];
                  const weightedAvgFOB = calculateWeightedAvgFOB(itemAllocs, false);
                  const weightedAvgCost = calculateItemWeightedAvgCost(itemAllocs, false);
                  const totalVolume = itemAllocs.reduce((sum, a) => sum + a.supplierVolumeAccepted, 0);
                  
                  // Calculate totals using individual supplier costs (sum of line items)
                  const totalCost = itemAllocs.reduce((sum, a) => {
                    const ourCostPerUnit = calculateOurCostPerUnit(a);
                    return sum + (ourCostPerUnit * a.supplierVolumeAccepted);
                  }, 0);
                  
                  // Revenue uses item's delivered price (same for all suppliers)
                  const totalRevenue = itemAllocs.reduce((sum, a) => sum + (a.dlvdPrice * a.supplierVolumeAccepted), 0);
                  // Est Profit: Profit Per Case × Volume (from internal pricing calculations)
                  const totalProfit = itemAllocs.reduce((sum, a) => {
                    const profitPerCase = a.margin || 0; // Profit per case from internal pricing calculations
                    return sum + (profitPerCase * a.supplierVolumeAccepted);
                  }, 0);
                  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                  return (
                    <div key={itemId} className="border-2 border-orange-200 rounded-xl overflow-hidden bg-gradient-to-br from-orange-50 to-white">
                      <div className="bg-gradient-to-r from-orange-100 to-orange-50 px-6 py-4 border-b border-orange-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-2xl text-gray-900">{firstAlloc.itemName}</h3>
                            <p className="text-sm text-gray-600 mt-1">{itemAllocs.length} supplier{itemAllocs.length > 1 ? 's' : ''} responded</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Weighted Avg FOB</p>
                            <p className="text-xl font-bold text-orange-700">{formatCurrency(weightedAvgFOB)}</p>
                            <p className="text-xs text-gray-500 mb-2 mt-1">Our Avg Cost: {formatCurrency(weightedAvgCost)}</p>
                            <p className="text-xs text-gray-500">Total Volume: {totalVolume.toLocaleString()} cases</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Supplier</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Response</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">FOB + R + F</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase bg-lime-50">Our Cost/Case</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase bg-blue-50">Dlvd Price</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase bg-green-50">Profit/Case</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Volume</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Offered</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Total Cost</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Revenue</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Profit</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {itemAllocs.map((allocation: VolumeAllocation) => {
                                // Use same calculation as Allocate Volume tab
                                const ourCostPerUnit = calculateOurCostPerUnit(allocation);
                                const cost = ourCostPerUnit * allocation.supplierVolumeAccepted;
                                const revenue = allocation.dlvdPrice * allocation.supplierVolumeAccepted;
                                // Est Profit: Profit Per Case × Volume (from internal pricing calculations)
                                const profitPerCase = allocation.margin || 0;
                                const profit = profitPerCase * allocation.supplierVolumeAccepted;
                                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                                return (
                                  <tr key={allocation.quoteId} className="hover:bg-orange-50">
                                    <td className="px-4 py-4">
                                      <div className="font-semibold text-gray-900">{allocation.supplierName}</div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                      {allocation.supplierResponse === 'accept' && (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold border border-green-300">Accepted</span>
                                      )}
                                      {allocation.supplierResponse === 'update' && (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-300">Counter</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="font-bold text-gray-900">{formatCurrency(allocation.rfFinalFob)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        + {formatCurrency(allocation.rebate)} R
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        + {formatCurrency(allocation.freight)} F
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-right bg-lime-50">
                                      <div className="font-bold text-lime-900">{formatCurrency(ourCostPerUnit)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">FOB + R + F</div>
                                    </td>
                                    <td className="px-4 py-4 text-right bg-blue-50">
                                      <div className="font-bold text-blue-900">{formatCurrency(allocation.dlvdPrice)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">from pricing</div>
                                    </td>
                                    <td className="px-4 py-4 text-right bg-green-50">
                                      <div className="font-bold text-green-900">{formatCurrency(profitPerCase)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">from pricing calc</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="font-bold text-blue-600">{allocation.supplierVolumeAccepted.toLocaleString()}</div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="text-sm text-gray-600">{allocation.offeredVolume.toLocaleString()}</div>
                                      {allocation.supplierVolumeAccepted !== allocation.offeredVolume && (
                                        <div className={`text-xs ${allocation.supplierVolumeAccepted > allocation.offeredVolume ? 'text-green-600' : 'text-red-600'}`}>
                                          {allocation.supplierVolumeAccepted > allocation.offeredVolume ? '+' : ''}
                                          {(allocation.supplierVolumeAccepted - allocation.offeredVolume).toLocaleString()}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="font-semibold text-red-600">{formatCurrency(cost)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {formatCurrency(ourCostPerUnit)} × {allocation.supplierVolumeAccepted.toLocaleString()}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className="font-semibold text-green-600">{formatCurrency(revenue)}</div>
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        {formatCurrency(allocation.dlvdPrice)} × {allocation.supplierVolumeAccepted.toLocaleString()}
                                      </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <div className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {formatCurrency(profit)}
                                      </div>
                                      <div className="text-xs text-gray-500">{margin.toFixed(1)}%</div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleAcceptSupplierResponse(allocation)}
                                          disabled={processing[allocation.quoteId]}
                                          className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
                                        >
                                          <CheckCircle className="w-3 h-3" />
                                          Accept
                                        </button>
                                        <div className="flex gap-1">
                                          <input
                                            type="number"
                                            value={revisedVolumes[allocation.quoteId] || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRevisedVolumes({ ...revisedVolumes, [allocation.quoteId]: e.target.value })}
                                            placeholder="Revise"
                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                          />
                                          <button
                                            onClick={() => handleReviseOffer(allocation)}
                                            disabled={processing[allocation.quoteId]}
                                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr className="bg-orange-100 font-bold">
                                <td colSpan={3} className="px-4 py-3 text-right">
                                  <span className="text-gray-900">Item Total:</span>
                                </td>
                                <td className="px-4 py-3 text-right text-blue-700">{totalVolume.toLocaleString()}</td>
                                <td colSpan={1}></td>
                                <td className="px-4 py-3 text-right text-red-700">{formatCurrency(totalCost)}</td>
                                <td className="px-4 py-3 text-right text-green-700">{formatCurrency(totalRevenue)}</td>
                                <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totalProfit)}</td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">{avgMargin.toFixed(1)}% margin</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {itemAllocs.some(a => a.supplierResponseNotes) && (
                          <div className="mt-4 space-y-2">
                            {itemAllocs.filter(a => a.supplierResponseNotes).map(a => (
                              <div key={a.quoteId} className="p-3 bg-white rounded-lg border-l-4 border-orange-400 text-sm">
                                <p className="font-semibold text-gray-700">{a.supplierName}:</p>
                                <p className="text-gray-600">{a.supplierResponseNotes}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {readyToSendAllocations.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-blue-300">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-6 h-6" />
                  Ready to Send to Suppliers ({readyToSendAllocations.length})
                </h2>
                <p className="text-blue-100 text-sm mt-1">These allocations are ready but haven't been sent to suppliers yet. Go to the "Award Volume" tab and click "Send Allocation to Suppliers".</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-3">
                  {readyToSendAllocations.map((allocation: VolumeAllocation) => (
                    <div key={allocation.quoteId} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{allocation.itemName}</h3>
                          <p className="text-sm text-gray-600">{allocation.supplierName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">Allocated Volume</p>
                          <p className="text-lg font-bold text-blue-600">{allocation.awardedVolume.toLocaleString()} cases</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {declinedAllocations.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <XCircle className="w-6 h-6" />
                  Declined Offers ({declinedAllocations.length})
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-3">
                  {declinedAllocations.map((allocation: VolumeAllocation) => (
                    <div key={allocation.quoteId} className="border-2 border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{allocation.itemName}</h3>
                          <p className="text-sm text-gray-600">{allocation.supplierName}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold border-2 border-red-300">Declined</span>
                          {allocation.supplierResponseNotes && (
                            <p className="text-xs text-gray-500 mt-2 max-w-xs">{allocation.supplierResponseNotes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {pendingAllocations.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Pending Supplier Response ({pendingAllocations.length})</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-3">
              {pendingAllocations.map((allocation: VolumeAllocation) => (
                <div key={allocation.quoteId} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{allocation.itemName}</h3>
                    <p className="text-sm text-gray-600">{allocation.supplierName} • {formatCurrency(allocation.supplierFob)}/unit</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Offered Volume</p>
                    <p className="text-lg font-bold text-gray-900">{allocation.offeredVolume.toLocaleString()} units</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={revisedVolumes[allocation.quoteId] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRevisedVolumes({ ...revisedVolumes, [allocation.quoteId]: e.target.value })}
                      placeholder="Revise volume"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => handleReviseOffer(allocation)}
                      disabled={processing[allocation.quoteId]}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
                    >
                      Revise
                    </button>
                    <button
                      onClick={() => handleDeclineOffer(allocation)}
                      disabled={processing[allocation.quoteId]}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {finalizedAllocations.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Package className="w-4 h-4 text-blue-300" />
                </div>
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Finalized Volume</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{finalizedFinancials.totalVolume.toLocaleString()}</p>
              <p className="text-blue-300/70 text-xs">units locked</p>
            </div>

            <div className="bg-red-500/10 border border-red-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <DollarSign className="w-4 h-4 text-red-300" />
                </div>
                <p className="text-red-200 text-xs font-semibold uppercase tracking-wider">Committed Cost</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(finalizedFinancials.totalCost)}</p>
              <p className="text-red-300/70 text-xs">supplier costs</p>
            </div>

            <div className="bg-green-500/10 border border-green-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-300" />
                </div>
                <p className="text-green-200 text-xs font-semibold uppercase tracking-wider">Revenue</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(finalizedFinancials.totalRevenue)}</p>
              <p className="text-green-300/70 text-xs">customer sales</p>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-emerald-300" />
                </div>
                <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">Est. Profit</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{formatCurrency(finalizedFinancials.totalProfit)}</p>
              <p className="text-emerald-300/70 text-xs">Profit/Case × Volume</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-400/20 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-amber-300" />
                </div>
                <p className="text-amber-200 text-xs font-semibold uppercase tracking-wider">Margin</p>
              </div>
              <p className="text-3xl font-black text-white mb-1">{finalizedFinancials.profitMargin.toFixed(1)}%</p>
              <p className="text-amber-300/70 text-xs">profit margin</p>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-emerald-500/20 px-6 py-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-300" />
                Finalized Allocations ({finalizedAllocations.length})
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {Array.from(groupByItem(finalizedAllocations).entries()).map(([itemId, itemAllocs]) => {
                const firstAlloc = itemAllocs[0];
                const weightedAvgFOB = calculateWeightedAvgFOB(itemAllocs, true);
                const weightedAvgCost = calculateItemWeightedAvgCost(itemAllocs, true);
                const totalVolume = itemAllocs.reduce((sum, a) => sum + a.awardedVolume, 0);
                
                // Calculate totals using individual supplier costs (sum of line items)
                const totalCost = itemAllocs.reduce((sum, a) => {
                  const ourCostPerUnit = calculateOurCostPerUnit(a);
                  return sum + (ourCostPerUnit * a.awardedVolume);
                }, 0);
                
                // Revenue uses item's delivered price (same for all suppliers)
                const totalRevenue = itemAllocs.reduce((sum, a) => sum + (a.dlvdPrice * a.awardedVolume), 0);
                // Est Profit: Profit Per Case × Volume (from internal pricing calculations)
                const totalProfit = itemAllocs.reduce((sum, a) => {
                  const profitPerCase = a.margin || 0; // Profit per case from internal pricing calculations
                  return sum + (profitPerCase * a.awardedVolume);
                }, 0);

                return (
                  <div key={itemId} className="border border-emerald-400/20 rounded-xl overflow-hidden bg-white/5">
                    <div className="bg-emerald-500/10 px-6 py-4 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-2xl text-white">{firstAlloc.itemName}</h3>
                          <p className="text-sm text-white/70 mt-1">{itemAllocs.length} supplier{itemAllocs.length > 1 ? 's' : ''} finalized</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/60 mb-1">Weighted Avg FOB</p>
                          <p className="text-xl font-bold text-emerald-300">{formatCurrency(weightedAvgFOB)}</p>
                          <p className="text-xs text-white/60 mb-2 mt-1">Our Avg Cost: {formatCurrency(weightedAvgCost)}</p>
                          <p className="text-xs text-white/60">Total Volume: {totalVolume.toLocaleString()} cases</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="overflow-x-auto bg-white/0">
                        <table className="w-full">
                          <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/15">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">Supplier</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">FOB + R + F</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Our Cost/Case</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Dlvd Price</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Profit/Case</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Volume</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Total Cost</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Revenue</th>
                              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Profit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {itemAllocs.map((allocation: VolumeAllocation) => {
                              // Use same calculation as Allocate Volume tab
                              const ourCostPerUnit = calculateOurCostPerUnit(allocation);
                              const cost = ourCostPerUnit * allocation.awardedVolume;
                              const revenue = allocation.dlvdPrice * allocation.awardedVolume;
                              // Est Profit: Profit Per Case × Volume (from internal pricing calculations)
                              const profitPerCase = allocation.margin || 0;
                              const profit = profitPerCase * allocation.awardedVolume;
                              const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                              return (
                                <tr key={allocation.quoteId} className="hover:bg-white/5 transition-colors">
                                  <td className="px-6 py-4">
                                    <div className="font-bold text-white">{allocation.supplierName}</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-black text-white text-lg">{formatCurrency(allocation.rfFinalFob)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">
                                      + {formatCurrency(allocation.rebate)} R
                                    </div>
                                    <div className="text-xs text-white/60">
                                      + {formatCurrency(allocation.freight)} F
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-black text-lime-300 text-lg">{formatCurrency(ourCostPerUnit)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">FOB + R + F</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-black text-blue-300 text-lg">{formatCurrency(allocation.dlvdPrice)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">from pricing</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-black text-green-300 text-lg">{formatCurrency(profitPerCase)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">from pricing calc</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-black text-blue-300 text-lg">{allocation.awardedVolume.toLocaleString()}</div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-bold text-red-300 text-lg">{formatCurrency(cost)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">
                                      {formatCurrency(ourCostPerUnit)} × {allocation.awardedVolume.toLocaleString()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="font-bold text-green-300 text-lg">{formatCurrency(revenue)}</div>
                                    <div className="text-xs text-white/60 mt-0.5">
                                      {formatCurrency(allocation.dlvdPrice)} × {allocation.awardedVolume.toLocaleString()}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className={`font-black text-lg ${profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                      {formatCurrency(profit)}
                                    </div>
                                    <div className="text-xs text-white/60">{margin.toFixed(1)}%</div>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-emerald-500/10 font-bold border-t-2 border-white/10">
                              <td colSpan={5} className="px-6 py-4 text-right">
                                <span className="text-white">Item Total:</span>
                              </td>
                              <td className="px-6 py-4 text-right text-blue-300 font-black">{totalVolume.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right text-red-300 font-black">{formatCurrency(totalCost)}</td>
                              <td className="px-6 py-4 text-right text-green-300 font-black">{formatCurrency(totalRevenue)}</td>
                              <td className="px-6 py-4 text-right text-emerald-300 font-black">{formatCurrency(totalProfit)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Emergency Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scale-in">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-orange-600" />
                <h3 className="text-xl font-bold text-gray-900">Emergency Unlock</h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                This week is locked. Unlocking will allow you to make changes to volumes and pricing.
                Please provide a reason for this emergency unlock:
              </p>
              <textarea
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Enter reason for emergency unlock (e.g., 'Supplier requested volume change', 'Pricing error correction')"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={4}
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockReason('');
                }}
                className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyUnlock}
                disabled={unlocking || !unlockReason.trim()}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {unlocking ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    Unlock Week
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
