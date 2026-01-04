import React, { useEffect, useState, memo } from 'react';
import { supabase } from '../utils/supabase';
import { formatCurrency } from '../utils/helpers';
import { logger } from '../utils/logger';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceTickerProps {
  weekId: string;
}

interface TickerItem {
  itemId: string;
  itemName: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  submissionCount: number;
  cheapestSupplier: string;
}

function PriceTickerComponent({ weekId }: PriceTickerProps) {
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);

  useEffect(() => {
    loadTickerData();
  }, [weekId]);

  async function loadTickerData() {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          item_id,
          supplier_fob,
          item:items!inner(name),
          supplier:suppliers!inner(name)
        `)
        .eq('week_id', weekId)
        .not('supplier_fob', 'is', null);

      if (error) throw error;

      const itemMap = new Map<string, { name: string; quotes: Array<{ price: number; supplier: string }> }>();

      data?.forEach(quote => {
        const itemId = quote.item_id;
        const itemName = quote.item.name;
        const price = quote.supplier_fob;
        const supplierName = quote.supplier.name;

        if (!itemMap.has(itemId)) {
          itemMap.set(itemId, { name: itemName, quotes: [] });
        }
        itemMap.get(itemId)!.quotes.push({ price, supplier: supplierName });
      });

      const ticker: TickerItem[] = [];
      itemMap.forEach((value, key) => {
        const quotes = value.quotes;
        if (quotes.length > 0) {
          const prices = quotes.map(q => q.price);
          const minPrice = Math.min(...prices);
          const cheapestQuote = quotes.find(q => q.price === minPrice);

          ticker.push({
            itemId: key,
            itemName: value.name,
            minPrice,
            maxPrice: Math.max(...prices),
            avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
            submissionCount: prices.length,
            cheapestSupplier: cheapestQuote?.supplier || '',
          });
        }
      });

      setTickerData(ticker);
    } catch (err) {
      logger.error('Error loading ticker data:', err);
    }
  }

  if (tickerData.length === 0) {
    return (
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
        <div className="px-6 py-6 text-center">
          <div className="w-3 h-3 bg-slate-500 rounded-full mx-auto mb-3 animate-pulse"></div>
          <p className="text-slate-400 text-sm font-medium">Awaiting supplier pricing submissions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700">
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Market Prices</span>
        </div>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-ticker-scroll whitespace-nowrap py-4">
          {[...tickerData, ...tickerData].map((item, idx) => {
            const spread = item.maxPrice - item.minPrice;
            const spreadPercent = ((spread / item.minPrice) * 100).toFixed(1);
            const hasSpread = spread > 0.01;

            return (
              <div
                key={`${item.itemId}-${idx}`}
                className="inline-flex items-center gap-4 px-6 border-r border-slate-700 mx-2"
              >
                <div className="flex flex-col">
                  <span className="text-slate-300 font-bold text-sm">{item.itemName}</span>
                  <span className="text-slate-500 text-xs">{item.submissionCount} quotes</span>
                </div>
                <div className="flex items-center gap-3">
                  {hasSpread ? (
                    <>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold text-lg flex items-center gap-1">
                          <TrendingDown className="w-4 h-4" />
                          {formatCurrency(item.minPrice)}
                        </div>
                        <div className="text-xs text-emerald-400 font-medium">{item.cheapestSupplier}</div>
                      </div>
                      <div className="text-slate-600 text-lg">—</div>
                      <div className="text-right">
                        <div className="text-red-400 font-bold text-lg flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          {formatCurrency(item.maxPrice)}
                        </div>
                        <div className="text-xs text-slate-500">High</div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-orange-400 font-bold text-sm">
                          {spreadPercent}%
                        </div>
                        <div className="text-xs text-slate-500">Spread</div>
                      </div>
                    </>
                  ) : (
                    <div className="text-right">
                      <div className="text-slate-300 font-bold text-lg">
                        {formatCurrency(item.minPrice)}
                      </div>
                      <div className="text-xs text-emerald-400 font-medium">{item.cheapestSupplier}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const PriceTicker = memo(PriceTickerComponent);
