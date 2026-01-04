import React, { useState, useEffect } from 'react';
import { Award, TrendingUp, Clock, DollarSign, CheckCircle, XCircle, Star } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/helpers';

interface SupplierPerformanceScorecardProps {
  weekId: string;
}

interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalVolume: number;
  totalRevenue: number;
  avgPrice: number;
  responseTime: number; // hours
  acceptanceRate: number; // percentage
  quoteCount: number;
  rank: number;
  score: number; // 0-100 performance score
}

export function SupplierPerformanceScorecard({ weekId }: SupplierPerformanceScorecardProps) {
  const [performances, setPerformances] = useState<SupplierPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'volume' | 'price' | 'response'>('score');

  useEffect(() => {
    loadPerformanceData();
  }, [weekId]);

  async function loadPerformanceData() {
    try {
      setLoading(true);

      // Get all quotes with responses
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          supplier_id,
          supplier_fob,
          rf_final_fob,
          awarded_volume,
          supplier_volume_response,
          supplier_volume_accepted,
          created_at,
          updated_at
        `)
        .eq('week_id', weekId);

      if (quotesError) {
        console.error('Error loading quotes:', quotesError);
        throw quotesError;
      }

      // Get suppliers separately
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name');

      const supplierNameMap = new Map(suppliers?.map(s => [s.id, s.name]) || []);

      // Get pricing calculations
      const { data: pricing } = await supabase
        .from('item_pricing_calculations')
        .select('item_id, dlvd_price')
        .eq('week_id', weekId);

      const pricingMap = new Map(pricing?.map(p => [p.item_id, p]) || []);

      // Group by supplier
      const supplierDataMap = new Map<string, {
        name: string;
        volumes: number[];
        revenues: number[];
        prices: number[];
        responseTimes: number[];
        accepted: number;
        total: number;
        quotes: any[];
      }>();

      quotes?.forEach(quote => {
        const supplierName = supplierNameMap.get(quote.supplier_id) || 'Unknown Supplier';
        
        if (!supplierDataMap.has(quote.supplier_id)) {
          supplierDataMap.set(quote.supplier_id, {
            name: supplierName,
            volumes: [],
            revenues: [],
            prices: [],
            responseTimes: [],
            accepted: 0,
            total: 0,
            quotes: [],
          });
        }

        const supplier = supplierDataMap.get(quote.supplier_id)!;
        supplier.quotes.push(quote);

        if (quote.awarded_volume && quote.awarded_volume > 0) {
          const price = quote.rf_final_fob || quote.supplier_fob || 0;
          supplier.volumes.push(quote.awarded_volume);
          supplier.prices.push(price);
          
          // Calculate revenue (use dlvd_price if available)
          const pricingData = pricingMap.get(quote.item_id);
          const dlvdPrice = pricingData?.dlvd_price || price * 1.2; // Estimate if not available
          supplier.revenues.push(dlvdPrice * quote.awarded_volume);

          // Calculate response time (time from quote creation to response)
          if (quote.updated_at && quote.created_at) {
            const created = new Date(quote.created_at).getTime();
            const updated = new Date(quote.updated_at).getTime();
            const hours = (updated - created) / (1000 * 60 * 60);
            if (hours > 0 && hours < 168) { // Within a week
              supplier.responseTimes.push(hours);
            }
          }
        }

        if (quote.supplier_volume_response) {
          supplier.total++;
          if (quote.supplier_volume_response === 'accept') {
            supplier.accepted++;
          }
        }
      });

      // Calculate performance scores
      const performances: SupplierPerformance[] = [];
      supplierDataMap.forEach((data, supplierId) => {
        const totalVolume = data.volumes.reduce((sum, v) => sum + v, 0);
        const totalRevenue = data.revenues.reduce((sum, r) => sum + r, 0);
        const avgPrice = data.prices.length > 0 
          ? data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length 
          : 0;
        const avgResponseTime = data.responseTimes.length > 0
          ? data.responseTimes.reduce((sum, t) => sum + t, 0) / data.responseTimes.length
          : 0;
        const acceptanceRate = data.total > 0 ? (data.accepted / data.total) * 100 : 0;

        // Calculate performance score (0-100)
        // Factors: volume (40%), price competitiveness (30%), response time (20%), acceptance rate (10%)
        const volumeScore = Math.min(100, (totalVolume / 1000) * 100); // Normalize to 1000 cases
        const priceScore = 100; // All suppliers are competitive if they got volume
        const responseScore = Math.max(0, 100 - (avgResponseTime / 24) * 50); // Penalize slow responses
        const acceptanceScore = acceptanceRate;

        const score = (volumeScore * 0.4) + (priceScore * 0.3) + (responseScore * 0.2) + (acceptanceScore * 0.1);

        performances.push({
          supplierId,
          supplierName: data.name,
          totalVolume,
          totalRevenue,
          avgPrice,
          responseTime: avgResponseTime,
          acceptanceRate,
          quoteCount: data.quotes.length,
          rank: 0, // Will be set after sorting
          score,
        });
      });

      // Sort and rank
      performances.sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'volume') return b.totalVolume - a.totalVolume;
        if (sortBy === 'price') return a.avgPrice - b.avgPrice;
        return a.responseTime - b.responseTime;
      });

      performances.forEach((p, idx) => {
        p.rank = idx + 1;
      });

      setPerformances(performances);
    } catch (err) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="bg-white rounded-xl shadow-lg p-8 animate-pulse">Loading...</div>;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Supplier Performance Scorecard</h3>
          <p className="text-gray-600 text-sm mt-1">Ranked by overall performance</p>
        </div>
        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as any);
            loadPerformanceData();
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="score">Performance Score</option>
          <option value="volume">Total Volume</option>
          <option value="price">Avg Price</option>
          <option value="response">Response Time</option>
        </select>
      </div>

      <div className="space-y-4">
        {performances.map((perf) => (
          <div
            key={perf.supplierId}
            className={`border-2 rounded-xl p-5 transition-all ${
              perf.rank <= 3
                ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-amber-50 shadow-lg'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-gray-400 w-12 text-center">
                  {getRankBadge(perf.rank)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-bold text-gray-900">{perf.supplierName}</h4>
                    {perf.rank <= 3 && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {perf.totalVolume.toLocaleString()} cases
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {formatCurrency(perf.avgPrice)} avg
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {perf.responseTime.toFixed(1)}h response
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Performance Score</div>
                  <div className={`text-3xl font-bold px-4 py-2 rounded-lg ${getScoreColor(perf.score)}`}>
                    {perf.score.toFixed(0)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(perf.totalRevenue)}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bars */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24">Acceptance Rate</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${perf.acceptanceRate}%` }}
                  ></div>
                </div>
                <span className="text-xs font-semibold text-gray-700 w-12 text-right">
                  {perf.acceptanceRate.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {performances.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No supplier performance data available yet</p>
        </div>
      )}
    </div>
  );
}

