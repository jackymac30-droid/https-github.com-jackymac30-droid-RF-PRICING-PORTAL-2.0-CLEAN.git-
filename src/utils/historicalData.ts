import { fetchWeeks, fetchItems, fetchQuotesWithDetails, fetchSuppliers } from './database';
import { logger } from './logger';
import type { Week, Item, QuoteWithDetails, Supplier } from '../types';

export interface CompleteHistoricalData {
  item_id: string;
  item_name: string;
  category: string;
  organic_flag: string | null;
  weeks: number[];
  prices: number[]; // Final prices used (rf_final_fob > supplier_revised_fob > supplier_fob)
  supplier_prices: number[]; // Initial supplier submissions
  counter_prices: number[]; // RF counter prices
  revised_prices: number[]; // Supplier revised prices
  final_prices: number[]; // RF final prices
  avgPrice: number;
  trend: 'up' | 'down' | 'stable';
  volatility: number;
  priceChanges: Array<{
    week: number;
    change: number;
    changePercent: number;
  }>;
  supplierData: Array<{
    supplier_id: string;
    supplier_name: string;
    prices: number[];
    weeks: number[];
    avgPrice: number;
    winRate: number; // How often they had the best price
  }>;
}

/**
 * Fetch complete historical data for all closed/finalized weeks
 * This ensures AI and analytics have access to all pricing data including:
 * - Initial quotes
 * - RF counters
 * - Supplier revisions
 * - Final prices
 * - All SKUs across all weeks
 */
export async function fetchCompleteHistoricalData(): Promise<CompleteHistoricalData[]> {
  try {
    const [weeks, items, suppliers] = await Promise.all([
      fetchWeeks(),
      fetchItems(),
      fetchSuppliers(),
    ]);

    // Only use closed or finalized weeks (complete data)
    const validWeeks = weeks
      .filter(w => w.status === 'closed' || w.status === 'finalized')
      .sort((a, b) => a.week_number - b.week_number);

    if (validWeeks.length === 0) {
      logger.debug('No closed/finalized weeks found for historical data');
      return [];
    }

    logger.debug(`Fetching historical data for ${validWeeks.length} weeks, ${items.length} items`);

    const historicalData: CompleteHistoricalData[] = [];

    // Process each item
    for (const item of items) {
      const itemData: CompleteHistoricalData = {
        item_id: item.id,
        item_name: item.name,
        category: item.category,
        organic_flag: item.organic_flag,
        weeks: [],
        prices: [],
        supplier_prices: [],
        counter_prices: [],
        revised_prices: [],
        final_prices: [],
        avgPrice: 0,
        trend: 'stable',
        volatility: 0,
        priceChanges: [],
        supplierData: [],
      };

      const supplierMap = new Map<string, {
        supplier_id: string;
        supplier_name: string;
        prices: number[];
        weeks: number[];
        bestPriceWins: number;
      }>();

      const weekPrices: number[] = [];
      const weekNumbers: number[] = [];

      // Process each week - collect data from ALL suppliers
      for (const week of validWeeks) {
        const quotes = await fetchQuotesWithDetails(week.id);
        // Filter for this item and ensure supplier data exists
        const itemQuotes = quotes.filter(q => q.item_id === item.id && q.supplier && q.supplier_id);

        if (itemQuotes.length === 0) {
          logger.debug(`No quotes found for item ${item.name} in week ${week.week_number}`);
          continue;
        }

        const weekFinalPrices: number[] = [];
        const weekSupplierPrices: number[] = [];
        const weekCounterPrices: number[] = [];
        const weekRevisedPrices: number[] = [];

        // Process ALL quotes from ALL suppliers for this item in this week
        for (const quote of itemQuotes) {
          // Collect all price types for complete historical record per supplier
          if (quote.supplier_fob !== null && quote.supplier_fob !== undefined && quote.supplier_fob > 0) {
            weekSupplierPrices.push(quote.supplier_fob);
          }
          if (quote.rf_counter_fob !== null && quote.rf_counter_fob !== undefined && quote.rf_counter_fob > 0) {
            weekCounterPrices.push(quote.rf_counter_fob);
          }
          if (quote.supplier_revised_fob !== null && quote.supplier_revised_fob !== undefined && quote.supplier_revised_fob > 0) {
            weekRevisedPrices.push(quote.supplier_revised_fob);
          }

          // Final price priority: rf_final_fob > supplier_revised_fob > supplier_fob
          // This is the price used in analytics and AI predictions
          const finalPrice = quote.rf_final_fob ?? quote.supplier_revised_fob ?? quote.supplier_fob;
          
          if (finalPrice !== null && finalPrice !== undefined && finalPrice > 0) {
            weekFinalPrices.push(finalPrice);
            weekPrices.push(finalPrice);
            weekNumbers.push(week.week_number);

            // Track supplier-specific data for supplier performance analysis
            const supplierId = quote.supplier_id;
            const supplierName = quote.supplier?.name || 'Unknown';
            
            if (!supplierMap.has(supplierId)) {
              supplierMap.set(supplierId, {
                supplier_id: supplierId,
                supplier_name: supplierName,
                prices: [],
                weeks: [],
                bestPriceWins: 0,
              });
            }

            const supplierData = supplierMap.get(supplierId)!;
            supplierData.prices.push(finalPrice);
            supplierData.weeks.push(week.week_number);

            // Track if this supplier had the best price this week (for win rate calculation)
            const allWeekPrices = itemQuotes
              .map(q => {
                const price = q.rf_final_fob ?? q.supplier_revised_fob ?? q.supplier_fob;
                return price !== null && price !== undefined && price > 0 ? price : null;
              })
              .filter((p): p is number => p !== null);
            
            if (allWeekPrices.length > 0) {
              const bestPrice = Math.min(...allWeekPrices);
              if (finalPrice === bestPrice) {
                supplierData.bestPriceWins += 1;
              }
            }
          }
        }

        if (weekFinalPrices.length > 0) {
          weekNumbers.push(week.week_number);
          itemData.weeks.push(week.week_number);
          itemData.prices.push(weekFinalPrices.reduce((a, b) => a + b, 0) / weekFinalPrices.length);
          itemData.final_prices.push(...weekFinalPrices);
          itemData.supplier_prices.push(...weekSupplierPrices);
          itemData.counter_prices.push(...weekCounterPrices);
          itemData.revised_prices.push(...weekRevisedPrices);
        }
      }

      // Calculate statistics
      if (itemData.prices.length > 0) {
        itemData.avgPrice = itemData.prices.reduce((a, b) => a + b, 0) / itemData.prices.length;

        // Calculate trend
        if (itemData.prices.length >= 2) {
          const firstPrice = itemData.prices[0];
          const lastPrice = itemData.prices[itemData.prices.length - 1];
          const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
          
          if (changePercent > 2) itemData.trend = 'up';
          else if (changePercent < -2) itemData.trend = 'down';
          else itemData.trend = 'stable';

          // Calculate price changes
          for (let i = 1; i < itemData.prices.length; i++) {
            const prevPrice = itemData.prices[i - 1];
            const currPrice = itemData.prices[i];
            const change = currPrice - prevPrice;
            const changePercent = (change / prevPrice) * 100;
            
            itemData.priceChanges.push({
              week: itemData.weeks[i],
              change,
              changePercent,
            });
          }
        }

        // Calculate volatility (standard deviation)
        if (itemData.prices.length > 1) {
          const variance = itemData.prices.reduce((sum, p) => sum + Math.pow(p - itemData.avgPrice, 2), 0) / (itemData.prices.length - 1);
          itemData.volatility = Math.sqrt(variance);
        }

        // Process supplier data
        itemData.supplierData = Array.from(supplierMap.values()).map(supplier => {
          const avgPrice = supplier.prices.length > 0
            ? supplier.prices.reduce((a, b) => a + b, 0) / supplier.prices.length
            : 0;
          
          const winRate = itemData.weeks.length > 0
            ? (supplier.bestPriceWins / itemData.weeks.length) * 100
            : 0;

          return {
            supplier_id: supplier.supplier_id,
            supplier_name: supplier.supplier_name,
            prices: supplier.prices,
            weeks: supplier.weeks,
            avgPrice,
            winRate,
          };
        });
      }

      if (itemData.weeks.length > 0) {
        historicalData.push(itemData);
      }
    }

    logger.debug(`Fetched complete historical data for ${historicalData.length} items`);
    return historicalData;
  } catch (err) {
    logger.error('Error fetching complete historical data:', err);
    return [];
  }
}

/**
 * Get historical data for a specific item
 */
export function getItemHistoricalData(
  historicalData: CompleteHistoricalData[],
  itemId: string
): CompleteHistoricalData | undefined {
  return historicalData.find(d => d.item_id === itemId);
}

/**
 * Get historical data formatted for PricingIntelligence component
 */
export function formatForPricingIntelligence(
  historicalData: CompleteHistoricalData[]
): Array<{
  item_id: string;
  avgPrice: number;
  trend: 'up' | 'down' | 'stable';
  volatility: number;
}> {
  return historicalData.map(d => ({
    item_id: d.item_id,
    avgPrice: d.avgPrice,
    trend: d.trend,
    volatility: d.volatility,
  }));
}

/**
 * Get historical data formatted for PredictiveAnalytics component
 */
export function formatForPredictiveAnalytics(
  historicalData: CompleteHistoricalData[]
): Array<{
  item_id: string;
  weeks: number[];
  prices: number[];
  trend: 'up' | 'down' | 'stable';
  volatility: number;
}> {
  return historicalData.map(d => ({
    item_id: d.item_id,
    weeks: d.weeks,
    prices: d.prices,
    trend: d.trend,
    volatility: d.volatility,
  }));
}

