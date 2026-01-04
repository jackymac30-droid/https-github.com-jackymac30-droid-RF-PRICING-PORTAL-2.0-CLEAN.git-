import React, { useState, useEffect, memo } from 'react';
import { Calculator, CheckCircle2, Save } from 'lucide-react';
import { fetchItemPricingCalculations, updateItemPricingCalculation, fetchQuotesWithDetails } from '../utils/database';
import { formatCurrency } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import type { Item } from '../types';

interface PricingCalculationsProps {
  weekId: string;
  items: Item[];
  onPricingUpdate?: () => void;
}

interface ItemPricing {
  item_id: string;
  avg_price: number;
  rebate: number;
  margin: number;
  freight: number;
  dlvd_price: number;
  hasChanges?: boolean;
}

function PricingCalculationsComponent({ weekId, items, onPricingUpdate }: PricingCalculationsProps) {
  const { showToast } = useToast();
  const [pricingData, setPricingData] = useState<Record<string, ItemPricing>>({});
  const [loading, setLoading] = useState(true);
  const [volumeData, setVolumeData] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadPricingData();
  }, [weekId, items]);

  async function loadPricingData() {
    try {
      const [calculations, quotes] = await Promise.all([
        fetchItemPricingCalculations(weekId),
        fetchQuotesWithDetails(weekId)
      ]);

      // Calculate volume from awarded_volume in quotes
      // Also include volume from volume_needed if no awarded_volume exists yet
      const volumeMap = new Map<string, number>();
      for (const item of items) {
        // First try to get volume from awarded_volume
        const itemQuotes = quotes.filter(q => q.item_id === item.id);
        const awardedVolume = itemQuotes
          .filter(q => q.awarded_volume && q.awarded_volume > 0)
          .reduce((sum, q) => sum + (q.awarded_volume || 0), 0);
        
        // If no awarded volume, try to get from volume_needed (from week_item_volumes table)
        let totalVolume = awardedVolume;
        if (totalVolume === 0) {
          // Try to get from week_item_volumes
          const { supabase } = await import('../utils/supabase');
          const { data: volumeData } = await supabase
            .from('week_item_volumes')
            .select('volume_needed')
            .eq('week_id', weekId)
            .eq('item_id', item.id)
            .single();
          
          if (volumeData?.volume_needed) {
            totalVolume = volumeData.volume_needed;
          }
        }
        
        volumeMap.set(item.id, totalVolume);
      }
      setVolumeData(volumeMap);

      const newPricingData: Record<string, ItemPricing> = {};

      for (const item of items) {
        const existing = calculations.find(c => c.item_id === item.id);

        const itemQuotes = quotes.filter(q => q.item_id === item.id && q.rf_final_fob !== null);
        let avgPrice = 0;

        if (itemQuotes.length > 0) {
          const quotesWithVolume = itemQuotes.filter(q => q.awarded_volume && q.awarded_volume > 0);
          if (quotesWithVolume.length > 0) {
            const totalVolume = quotesWithVolume.reduce((sum, q) => sum + (q.awarded_volume || 0), 0);
            const weightedSum = quotesWithVolume.reduce((sum, q) => {
              const price = q.rf_final_fob || 0;
              return sum + (price * (q.awarded_volume || 0));
            }, 0);
            avgPrice = totalVolume > 0 ? weightedSum / totalVolume : 0;
          } else {
            const totalPrices = itemQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0);
            avgPrice = totalPrices / itemQuotes.length;
          }
        }

        const rebate = existing?.rebate !== undefined ? existing.rebate : 0.80;
        const freight = existing?.freight !== undefined ? existing.freight : 1.75;

        // Formula: Our Avg Cost = FOB + Rebate + Freight
        const ourAvgCost = avgPrice + rebate + freight;

        // Default profit margin: $1.50 per case
        const defaultProfit = 1.50;
        let margin = existing?.margin !== undefined && existing.margin > 0
          ? existing.margin
          : defaultProfit;
        
        // Delivered Price is always calculated: Our Avg Cost + Profit Per Case
        // If we have an existing dlvd_price but it doesn't match the formula, recalculate margin
        if (existing?.dlvd_price !== undefined && existing.dlvd_price > 0) {
          const calculatedMargin = existing.dlvd_price - ourAvgCost;
          // If the existing margin doesn't match what the dlvd_price suggests, use the calculated margin
          if (Math.abs(calculatedMargin - (existing.margin || 0)) > 0.01) {
            margin = calculatedMargin;
          }
        }
        
        // Always calculate Delivered Price from the formula
        const dlvd_price = ourAvgCost + margin;

        newPricingData[item.id] = {
          item_id: item.id,
          avg_price: avgPrice,
          rebate: rebate,
          margin: margin,
          freight: freight,
          dlvd_price: dlvd_price,
        };
      }

      setPricingData(newPricingData);
    } catch (err) {
      console.error('Error loading pricing data:', err);
    } finally {
      setLoading(false);
    }
  }

  function updatePricing(itemId: string, field: keyof ItemPricing, value: string) {
    const numValue = parseFloat(value) || 0;

    setPricingData(prev => {
      const updated = { ...prev };
      if (updated[itemId]) {
        // Update the field first
        updated[itemId] = { ...updated[itemId], [field]: numValue, hasChanges: true };

        // Get all current values (including the just-updated field)
        const { avg_price, rebate, freight, margin } = updated[itemId];
        
        // Always recalculate ourAvgCost with current values
        // Formula: Our Avg Cost = FOB + Rebate + Freight
        const ourAvgCost = avg_price + rebate + freight;

        // Delivered Price is ALWAYS calculated: Our Avg Cost + Profit Per Case
        // This ensures it's always in sync regardless of which field changed
        const newDlvdPrice = ourAvgCost + (margin || 0);
        updated[itemId].dlvd_price = parseFloat(newDlvdPrice.toFixed(2));
        
        // Force re-render by updating the state (Est. Profit will recalculate automatically)
      }
      return updated;
    });
  }

  async function savePricing(itemId: string) {
    const pricing = pricingData[itemId];
    if (!pricing) {
      showToast('No pricing data found', 'error');
      return;
    }

    if (!weekId || !itemId) {
      showToast('Missing week or item information', 'error');
      return;
    }

    try {
      // Ensure dlvd_price is calculated before saving
      const ourAvgCost = (pricing.avg_price || 0) + (pricing.rebate || 0) + (pricing.freight || 0);
      const calculatedDlvdPrice = ourAvgCost + (pricing.margin || 0);

      const result = await updateItemPricingCalculation(weekId, itemId, {
        avg_price: parseFloat((pricing.avg_price || 0).toFixed(2)),
        rebate: parseFloat((pricing.rebate || 0).toFixed(2)),
        margin: parseFloat((pricing.margin || 0).toFixed(2)),
        freight: parseFloat((pricing.freight || 0).toFixed(2)),
        dlvd_price: parseFloat(calculatedDlvdPrice.toFixed(2)),
      });

      if (!result.success) {
        const errorMsg = result.error || 'Unknown error';
        console.error('Pricing update error:', errorMsg);
        showToast(`Failed to update pricing: ${errorMsg}`, 'error');
        return;
      }

      // Update local state to reflect saved values
      setPricingData(prev => ({
        ...prev,
        [itemId]: { 
          ...prev[itemId], 
          dlvd_price: parseFloat(calculatedDlvdPrice.toFixed(2)),
          hasChanges: false 
        }
      }));

      showToast('Pricing updated successfully', 'success');

      if (onPricingUpdate) {
        onPricingUpdate();
      }
    } catch (err) {
      console.error('Error saving pricing:', err);
      showToast('Failed to update pricing', 'error');
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-white/10 rounded"></div>
              <div className="h-4 bg-white/10 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
              <Calculator className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Internal Pricing Calculations</h3>
              <p className="text-sm text-white/70">Uses volume from allocation table above • Delivered Price auto-calculated</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white/0">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-white/8 to-white/5 border-b-2 border-white/15">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-black text-white uppercase tracking-wider">SKU</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Avg FOB</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Rebate</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Freight</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Our Avg Cost</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Profit/Case</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Delivered Price</th>
              <th className="px-6 py-4 text-right text-xs font-black text-white uppercase tracking-wider">Est. Profit</th>
              <th className="px-6 py-4 text-center text-xs font-black text-white uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map(item => {
              const pricing = pricingData[item.id];
              if (!pricing) return null;

              // Formula: Our Avg Cost = FOB + Rebate + Freight
              const ourAvgCost = pricing.avg_price + pricing.rebate + pricing.freight;
              // Profit Per Case is the editable margin field
              const profitPerCase = pricing.margin || 0;
              // Delivered Price is always calculated: Our Avg Cost + Profit Per Case
              // Use calculated value to ensure it's always in sync
              const calculatedDlvdPrice = ourAvgCost + profitPerCase;
              const displayDlvdPrice = pricing.dlvd_price && Math.abs(pricing.dlvd_price - calculatedDlvdPrice) < 0.01 
                ? pricing.dlvd_price 
                : calculatedDlvdPrice;
              const volume = volumeData.get(item.id) || 0;
              // Est. Profit = Profit Per Case × Amount of Cases
              // Use the current margin value from state (which updates as user types)
              const currentMargin = pricing.margin || 0;
              const estimatedProfit = currentMargin * volume;

              return (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{item.name}</div>
                    <div className="text-sm text-white/70">{item.pack_size} - {item.organic_flag}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-white font-black text-lg">{formatCurrency(pricing.avg_price)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={pricing.rebate || ''}
                      onChange={(e) => updatePricing(item.id, 'rebate', e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-3 py-2 border border-white/20 rounded-lg text-right font-medium text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 placeholder:text-white/40"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={pricing.freight || ''}
                      onChange={(e) => updatePricing(item.id, 'freight', e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-3 py-2 border border-white/20 rounded-lg text-right font-medium text-white bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 placeholder:text-white/40"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-lime-300 font-black text-lg">{formatCurrency(ourAvgCost)}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {formatCurrency(pricing.avg_price)} + {formatCurrency(pricing.rebate)} + {formatCurrency(pricing.freight)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={pricing.margin || ''}
                      onChange={(e) => updatePricing(item.id, 'margin', e.target.value)}
                      placeholder="0.00"
                      className={`w-28 px-3 py-2 border-2 rounded-lg text-right font-black text-xl bg-white/5 focus:outline-none focus:ring-2 focus:border-transparent text-white ${
                        profitPerCase > 0 ? 'border-green-400/30 focus:ring-green-400/50' :
                        profitPerCase < 0 ? 'border-red-400/30 focus:ring-red-400/50' :
                        'border-white/20 focus:ring-white/30'
                      }`}
                    />
                    <div className="text-xs text-white/50 mt-1">Editable</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-blue-300 font-black text-lg">{formatCurrency(displayDlvdPrice)}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {formatCurrency(ourAvgCost)} + {formatCurrency(profitPerCase)}
                    </div>
                    <div className="text-xs text-blue-300/70 font-medium mt-1">🔒 Auto-calculated</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`font-black text-lg ${
                      estimatedProfit > 0 ? 'text-green-300' :
                      estimatedProfit < 0 ? 'text-red-300' :
                      'text-white/50'
                    }`}>
                      {formatCurrency(estimatedProfit)}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {volume > 0 ? (
                        <>
                          {volume} cases × {formatCurrency(currentMargin)}
                        </>
                      ) : (
                        <span className="text-orange-300">No volume allocated</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {pricing.hasChanges ? (
                      <button
                        onClick={() => savePricing(item.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-all mx-auto"
                        title="Click to save pricing changes for this item"
                      >
                        <Save className="w-4 h-4" />
                        Update
                      </button>
                    ) : (
                      <div className="text-sm text-green-300 font-medium flex items-center gap-1 justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Saved</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-white/3 border-t border-white/10 text-sm text-white/80 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-bold text-white mb-2">How It Works:</p>
            <p className="text-xs"><span className="font-medium">Our Avg Cost =</span> Avg FOB + Rebate + Freight <span className="text-white/50">(calculated)</span></p>
            <p className="text-xs"><span className="font-medium">Profit Per Case =</span> <span className="text-green-300 font-semibold">Editable</span> - set your desired profit margin</p>
            <p className="text-xs"><span className="font-medium">Delivered Price =</span> Our Avg Cost + Profit Per Case <span className="text-blue-300 font-semibold">(🔒 locked, auto-calculated)</span></p>
            <p className="text-xs mt-2 text-blue-300 font-medium">Uses volume from allocation table above</p>
          </div>
          <div>
            <p className="font-bold text-white mb-2">Editable Fields:</p>
            <p className="text-xs"><span className="font-bold">Rebate & Freight:</span> Change these to recalculate Our Avg Cost</p>
            <p className="text-xs mt-1"><span className="font-bold">Profit/Case:</span> <span className="text-green-300 font-semibold">Editable</span> - set your target margin</p>
            <p className="text-xs mt-1"><span className="font-bold">Delivered Price:</span> <span className="text-blue-300 font-semibold">🔒 Locked</span> - automatically calculated</p>
            <p className="text-xs mt-2 font-bold text-emerald-300">Click Update to save and sync with allocation table</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PricingCalculations = memo(PricingCalculationsComponent);
