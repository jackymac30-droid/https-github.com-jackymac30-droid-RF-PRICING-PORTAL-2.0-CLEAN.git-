import React, { useEffect, useState } from 'react';
import { Award, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';
import { supabase } from '../utils/supabase';
import type { QuoteWithDetails, Supplier } from '../types';
import { formatCurrency } from '../utils/helpers';

interface SupplierScore {
  supplier: Supplier;
  avgPrice: number;
  lowestCount: number;
  responseRate: number;
  totalQuotes: number;
  score: number;
}

interface SupplierComparisonProps {
  weekId: string;
  suppliers: Supplier[];
  quotes: QuoteWithDetails[];
}

export function SupplierComparison({ weekId, suppliers, quotes }: SupplierComparisonProps) {
  const [scores, setScores] = useState<SupplierScore[]>([]);
  const [historicalData, setHistoricalData] = useState<Map<string, { avgPrice: number; winRate: number }>>(new Map());

  useEffect(() => {
    calculateScores();
    loadHistoricalData();
  }, [quotes, suppliers]);

  async function loadHistoricalData() {
    try {
      const { data: historicalQuotes } = await supabase
        .from('quotes')
        .select('supplier_id, supplier_fob, awarded_volume')
        .neq('week_id', weekId)
        .not('supplier_fob', 'is', null);

      if (!historicalQuotes) return;

      const supplierStats = new Map<string, { avgPrice: number; winRate: number }>();

      suppliers.forEach(supplier => {
        const supplierQuotes = historicalQuotes.filter(q => q.supplier_id === supplier.id);
        if (supplierQuotes.length === 0) return;

        const avgPrice = supplierQuotes.reduce((sum, q) => sum + (q.supplier_fob || 0), 0) / supplierQuotes.length;
        const wins = supplierQuotes.filter(q => q.awarded_volume && q.awarded_volume > 0).length;
        const winRate = (wins / supplierQuotes.length) * 100;

        supplierStats.set(supplier.id, { avgPrice, winRate });
      });

      setHistoricalData(supplierStats);
    } catch (err) {
      console.error('Error loading historical data:', err);
    }
  }

  function calculateScores() {
    const supplierScores: SupplierScore[] = [];

    suppliers.forEach(supplier => {
      const supplierQuotes = quotes.filter(q => q.supplier_id === supplier.id);
      const quotesWithPrices = supplierQuotes.filter(q => q.supplier_fob !== null);

      if (quotesWithPrices.length === 0) return;

      const avgPrice = quotesWithPrices.reduce((sum, q) => sum + (q.supplier_fob || 0), 0) / quotesWithPrices.length;
      const responseRate = (quotesWithPrices.length / supplierQuotes.length) * 100;

      let lowestCount = 0;
      quotesWithPrices.forEach(quote => {
        const itemQuotes = quotes.filter(q => q.item_id === quote.item_id && q.supplier_fob !== null);
        const prices = itemQuotes.map(q => q.supplier_fob!);
        const minPrice = Math.min(...prices);
        if (quote.supplier_fob === minPrice) {
          lowestCount++;
        }
      });

      const priceScore = lowestCount / quotesWithPrices.length;
      const responseScore = responseRate / 100;
      const score = (priceScore * 0.7 + responseScore * 0.3) * 100;

      supplierScores.push({
        supplier,
        avgPrice,
        lowestCount,
        responseRate,
        totalQuotes: quotesWithPrices.length,
        score,
      });
    });

    supplierScores.sort((a, b) => b.score - a.score);
    setScores(supplierScores);
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
    if (score >= 50) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' };
    if (score >= 30) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' };
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Target className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Supplier Performance</h3>
          <p className="text-gray-600">Competitive analysis and scoring</p>
        </div>
      </div>

      <div className="space-y-4">
        {scores.map((score, index) => {
          const scoreColors = getScoreColor(score.score);
          const historical = historicalData.get(score.supplier.id);

          return (
            <div
              key={score.supplier.id}
              className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-5 border-2 border-gray-200 hover:border-blue-300 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{score.supplier.name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${scoreColors.bg} ${scoreColors.text} ${scoreColors.border}`}>
                        Score: {score.score.toFixed(0)}
                      </span>
                      {index === 0 && (
                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-700 border-2 border-yellow-300 flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          Best Overall
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">Avg Price</div>
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(score.avgPrice)}</div>
                  {historical && (
                    <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                      score.avgPrice < historical.avgPrice ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {score.avgPrice < historical.avgPrice ? (
                        <><TrendingDown className="w-3 h-3" /> Better</>
                      ) : (
                        <><TrendingUp className="w-3 h-3" /> Higher</>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">Best Prices</div>
                  <div className="text-lg font-bold text-green-600">
                    {score.lowestCount} / {score.totalQuotes}
                  </div>
                  <div className="text-xs text-gray-600 font-medium mt-1">
                    {((score.lowestCount / score.totalQuotes) * 100).toFixed(0)}% of items
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">Response Rate</div>
                  <div className="text-lg font-bold text-blue-600">{score.responseRate.toFixed(0)}%</div>
                  <div className="text-xs text-gray-600 font-medium mt-1">
                    {Math.round((score.responseRate / 100) * score.totalQuotes)}/{score.totalQuotes} items
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-xs text-gray-600 font-medium mb-1">Historical Win Rate</div>
                  {historical ? (
                    <>
                      <div className="text-lg font-bold text-purple-600">{historical.winRate.toFixed(0)}%</div>
                      <div className="text-xs text-gray-600 font-medium mt-1">
                        Past performance
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400">No data</div>
                  )}
                </div>
              </div>

              {index === 0 && (
                <div className="mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-200">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-bold text-green-800">
                      Recommended for primary volume allocation
                    </span>
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
