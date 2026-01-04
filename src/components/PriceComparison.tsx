import React, { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Award } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/helpers';

interface PriceComparisonProps {
  itemId: string;
  weekId: string;
  currentPrice?: number;
}

export function PriceComparison({ itemId, weekId, currentPrice }: PriceComparisonProps) {
  const [comparison, setComparison] = useState<{
    lowest: number;
    highest: number;
    average: number;
    yourRank: number;
    totalSuppliers: number;
  } | null>(null);

  useEffect(() => {
    loadComparison();
  }, [itemId, weekId]);

  async function loadComparison() {
    try {
      const { data } = await supabase
        .from('quotes')
        .select('supplier_fob')
        .eq('week_id', weekId)
        .eq('item_id', itemId)
        .not('supplier_fob', 'is', null);

      if (!data || data.length === 0) return;

      const prices = data.map(q => q.supplier_fob as number).sort((a, b) => a - b);
      const lowest = prices[0];
      const highest = prices[prices.length - 1];
      const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      let yourRank = 0;
      if (currentPrice) {
        yourRank = prices.filter(p => p < currentPrice).length + 1;
      }

      setComparison({
        lowest,
        highest,
        average,
        yourRank,
        totalSuppliers: prices.length,
      });
    } catch (err) {
      console.error('Error loading comparison:', err);
    }
  }

  if (!comparison || !currentPrice) return null;

  const percentVsLowest = ((currentPrice - comparison.lowest) / comparison.lowest) * 100;
  const percentVsAverage = ((currentPrice - comparison.average) / comparison.average) * 100;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-800 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600" />
          Market Position
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold text-blue-600">#{comparison.yourRank}</span>
          <span className="text-sm text-gray-600">of {comparison.totalSuppliers}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 border border-green-200">
          <div className="text-xs text-gray-600 font-medium mb-1">Lowest</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(comparison.lowest)}</div>
          {currentPrice > comparison.lowest && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
              <TrendingUp className="w-3 h-3" />
              +{percentVsLowest.toFixed(1)}%
            </div>
          )}
          {currentPrice === comparison.lowest && (
            <div className="text-xs text-green-600 font-bold mt-1">You're the lowest!</div>
          )}
        </div>

        <div className="bg-white rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-gray-600 font-medium mb-1">Average</div>
          <div className="text-lg font-bold text-blue-600">{formatCurrency(comparison.average)}</div>
          {Math.abs(percentVsAverage) > 0.5 && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${percentVsAverage > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {percentVsAverage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {percentVsAverage > 0 ? '+' : ''}{percentVsAverage.toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-3 border border-orange-200">
          <div className="text-xs text-gray-600 font-medium mb-1">Highest</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(comparison.highest)}</div>
        </div>
      </div>

      {comparison.yourRank === 1 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg p-3 text-center font-bold text-sm">
          🏆 Best Price - High chance of winning volume!
        </div>
      )}
      {comparison.yourRank === 2 && (
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg p-3 text-center font-bold text-sm">
          🥈 Competitive - Strong position for volume allocation
        </div>
      )}
      {comparison.yourRank > comparison.totalSuppliers / 2 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-3 text-center font-bold text-sm">
          ⚠️ Above average - Consider revising to improve competitiveness
        </div>
      )}
    </div>
  );
}
