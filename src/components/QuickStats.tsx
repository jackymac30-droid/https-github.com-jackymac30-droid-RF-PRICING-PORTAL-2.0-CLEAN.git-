import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../utils/supabase';
import { StatusWidget } from './StatusWidget';
import { LoadingSkeleton } from './LoadingSkeleton';
import { logger } from '../utils/logger';
import { Users, CheckCircle2, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';

interface QuickStatsProps {
  weekId?: string;
}

function QuickStatsComponent({ weekId }: QuickStatsProps) {
  const [stats, setStats] = useState<{
    totalSuppliers: number;
    submittedSuppliers: number;
    finalizedSuppliers: number;
    avgPrice: number;
    lowestPrice: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (weekId) {
      loadStats();
    }
  }, [weekId]);

  async function loadStats() {
    try {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('supplier_id, supplier_fob, rf_final_fob')
        .eq('week_id', weekId);

      if (!quotes) return;

      const uniqueSuppliers = new Set(quotes.map(q => q.supplier_id));
      const submittedQuotes = quotes.filter(q => q.supplier_fob !== null);
      const uniqueSubmitted = new Set(submittedQuotes.map(q => q.supplier_id));
      const finalizedQuotes = quotes.filter(q => q.rf_final_fob !== null);
      const uniqueFinalized = new Set(finalizedQuotes.map(q => q.supplier_id));

      const prices = quotes
        .map(q => q.rf_final_fob || q.supplier_fob)
        .filter((p): p is number => p !== null);

      const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
      const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;

      setStats({
        totalSuppliers: uniqueSuppliers.size,
        submittedSuppliers: uniqueSubmitted.size,
        finalizedSuppliers: uniqueFinalized.size,
        avgPrice,
        lowestPrice,
      });
    } catch (err) {
      logger.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton type="card" rows={1} />;
  }

  if (!stats) return null;

  const submissionRate = stats.totalSuppliers > 0
    ? Math.round((stats.submittedSuppliers / stats.totalSuppliers) * 100)
    : 0;

  const finalizationRate = stats.totalSuppliers > 0
    ? Math.round((stats.finalizedSuppliers / stats.totalSuppliers) * 100)
    : 0;

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-6 mb-4 relative overflow-hidden group">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-lime-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between flex-wrap gap-6">
          {/* Progress Section - Enhanced */}
          <div className="flex-1 min-w-[250px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-emerald-300" />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Pricing Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-emerald-300">{submissionRate}%</span>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              </div>
            </div>
            
            {/* Enhanced Progress Bar */}
            <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-4">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-500 rounded-full transition-all duration-700 shadow-lg shadow-emerald-500/30"
                style={{ width: `${submissionRate}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
            </div>
            
            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"></div>
                <div>
                  <div className="text-sm font-black text-white">{stats.submittedSuppliers}</div>
                  <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">Submitted</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
                <div>
                  <div className="text-sm font-black text-emerald-300">{stats.finalizedSuppliers}</div>
                  <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider">Finalized</div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider - Enhanced */}
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

          {/* Stats Grid - Enhanced with Icons */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all group/stat">
              <div className="flex items-center justify-center mb-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg group-hover/stat:bg-emerald-500/30 transition">
                  <Users className="w-4 h-4 text-emerald-300" />
                </div>
              </div>
              <div className="text-2xl font-black text-white mb-1">{stats.totalSuppliers}</div>
              <div className="text-[10px] text-emerald-300/80 uppercase tracking-wider font-semibold">Total</div>
            </div>
            
            <div className="text-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all group/stat">
              <div className="flex items-center justify-center mb-2">
                <div className="p-1.5 bg-emerald-500/20 rounded-lg group-hover/stat:bg-emerald-500/30 transition">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-300 mb-1">{stats.finalizedSuppliers}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Finalized</div>
            </div>
            
            <div className="text-center p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all group/stat">
              <div className="flex items-center justify-center mb-2">
                <div className="p-1.5 bg-lime-500/20 rounded-lg group-hover/stat:bg-lime-500/30 transition">
                  <DollarSign className="w-4 h-4 text-lime-300" />
                </div>
              </div>
              <div className="text-2xl font-black text-lime-300 mb-1">${stats.avgPrice.toFixed(2)}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Avg Price</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const QuickStats = memo(QuickStatsComponent);
