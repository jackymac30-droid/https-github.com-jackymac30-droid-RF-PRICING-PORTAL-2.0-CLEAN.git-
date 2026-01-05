/**
 * AI Allocation Optimizer
 * 
 * Calculates optimal volume allocation across suppliers to hit a target average price
 * while respecting historical fairness constraints.
 */

export interface SupplierQuote {
  supplierId: string;
  supplierName: string;
  price: number;
  maxVolume?: number; // Optional: supplier's available/offered volume
  minVolume?: number; // Optional: minimum volume per supplier
}

export interface HistoricalShare {
  supplierId: string;
  sharePercent: number; // 0-100, historical allocation percentage
  averageVolume: number; // Average volume allocated historically
}

export interface AllocationResult {
  allocations: Map<string, number>; // supplierId -> volume
  achievedPrice: number;
  targetPrice: number;
  isAchievable: boolean;
  reason?: string; // Explanation if target not achievable
}

export interface OptimizationParams {
  quotes: SupplierQuote[];
  totalVolumeNeeded: number;
  targetAvgPrice: number;
  historicalShares: HistoricalShare[];
  fairnessWeight: number; // 0-100, 0 = pure cheapest, 100 = pure historical fairness
}

/**
 * Calculate historical supplier shares from past allocations
 */
export function calculateHistoricalShares(
  historicalData: Array<{
    supplierId: string;
    volume: number;
  }>,
  totalHistoricalVolume: number
): HistoricalShare[] {
  if (totalHistoricalVolume === 0) {
    return [];
  }

  const supplierTotals = new Map<string, number>();
  const supplierCounts = new Map<string, number>();

  historicalData.forEach(({ supplierId, volume }) => {
    supplierTotals.set(supplierId, (supplierTotals.get(supplierId) || 0) + volume);
    supplierCounts.set(supplierId, (supplierCounts.get(supplierId) || 0) + 1);
  });

  const shares: HistoricalShare[] = [];
  supplierTotals.forEach((totalVolume, supplierId) => {
    const count = supplierCounts.get(supplierId) || 1;
    shares.push({
      supplierId,
      sharePercent: (totalVolume / totalHistoricalVolume) * 100,
      averageVolume: totalVolume / count,
    });
  });

  return shares;
}

/**
 * Optimize allocation to hit target price while respecting fairness
 */
export function optimizeAllocation(params: OptimizationParams): AllocationResult {
  const { quotes, totalVolumeNeeded, targetAvgPrice, historicalShares, fairnessWeight } = params;

  if (quotes.length === 0 || totalVolumeNeeded <= 0) {
    return {
      allocations: new Map(),
      achievedPrice: 0,
      targetPrice: targetAvgPrice,
      isAchievable: false,
      reason: 'No quotes available or volume needed is zero',
    };
  }

  // Sort quotes by price (cheapest first)
  const sortedQuotes = [...quotes].sort((a, b) => a.price - b.price);

  // Calculate historical share map for quick lookup
  const historicalShareMap = new Map<string, number>();
  historicalShares.forEach(share => {
    historicalShareMap.set(share.supplierId, share.sharePercent);
  });

  // Calculate baseline allocation (pure historical fairness)
  const baselineAllocation = new Map<string, number>();
  let baselineTotal = 0;
  historicalShares.forEach(share => {
    const volume = Math.round((totalVolumeNeeded * share.sharePercent) / 100);
    baselineAllocation.set(share.supplierId, volume);
    baselineTotal += volume;
  });

  // Distribute remaining volume proportionally if baseline doesn't sum to total
  if (baselineTotal < totalVolumeNeeded) {
    const remaining = totalVolumeNeeded - baselineTotal;
    if (historicalShares.length > 0) {
      historicalShares.forEach(share => {
        const additional = Math.round((remaining * share.sharePercent) / 100);
        baselineAllocation.set(
          share.supplierId,
          (baselineAllocation.get(share.supplierId) || 0) + additional
        );
      });
    } else {
      // No historical data - distribute evenly
      const perSupplier = Math.floor(remaining / quotes.length);
      quotes.forEach(q => {
        baselineAllocation.set(q.supplierId, (baselineAllocation.get(q.supplierId) || 0) + perSupplier);
      });
    }
  }

  // Calculate cheapest allocation (pure cost optimization)
  const cheapestAllocation = new Map<string, number>();
  let remainingVolume = totalVolumeNeeded;
  for (const quote of sortedQuotes) {
    const maxAvailable = quote.maxVolume || remainingVolume;
    const allocated = Math.min(maxAvailable, remainingVolume);
    if (allocated > 0) {
      cheapestAllocation.set(quote.supplierId, allocated);
      remainingVolume -= allocated;
    }
    if (remainingVolume <= 0) break;
  }

  // Blend baseline and cheapest based on fairness weight
  const fairnessRatio = fairnessWeight / 100;
  const finalAllocation = new Map<string, number>();

  // Start with baseline
  baselineAllocation.forEach((volume, supplierId) => {
    finalAllocation.set(supplierId, volume);
  });

  // Adjust towards cheapest allocation based on fairness weight
  // Lower fairness weight = more towards cheapest
  if (fairnessWeight < 100) {
    const cheapestRatio = 1 - fairnessRatio;
    
    // Calculate how much to shift from baseline towards cheapest
    sortedQuotes.forEach(quote => {
      const baselineVol = finalAllocation.get(quote.supplierId) || 0;
      const cheapestVol = cheapestAllocation.get(quote.supplierId) || 0;
      
      // Interpolate between baseline and cheapest
      const blendedVol = Math.round(baselineVol * fairnessRatio + cheapestVol * cheapestRatio);
      
      // Respect max volume constraint
      const maxAvailable = quote.maxVolume || blendedVol;
      finalAllocation.set(quote.supplierId, Math.min(blendedVol, maxAvailable));
    });
  }

  // Normalize to ensure total equals totalVolumeNeeded
  let currentTotal = Array.from(finalAllocation.values()).reduce((sum, vol) => sum + vol, 0);
  if (currentTotal !== totalVolumeNeeded) {
    const adjustment = totalVolumeNeeded - currentTotal;
    
    // Adjust cheapest suppliers first (if increasing) or most expensive (if decreasing)
    if (adjustment > 0) {
      // Increase allocation starting with cheapest
      for (const quote of sortedQuotes) {
        if (adjustment <= 0) break;
        const current = finalAllocation.get(quote.supplierId) || 0;
        const maxAvailable = quote.maxVolume || Infinity;
        const canAdd = Math.min(adjustment, maxAvailable - current);
        if (canAdd > 0) {
          finalAllocation.set(quote.supplierId, current + canAdd);
          currentTotal += canAdd;
        }
      }
    } else {
      // Decrease allocation starting with most expensive
      for (let i = sortedQuotes.length - 1; i >= 0; i--) {
        const quote = sortedQuotes[i];
        const current = finalAllocation.get(quote.supplierId) || 0;
        const canReduce = Math.min(Math.abs(adjustment), current);
        if (canReduce > 0) {
          finalAllocation.set(quote.supplierId, current - canReduce);
          currentTotal -= canReduce;
        }
        if (currentTotal === totalVolumeNeeded) break;
      }
    }
  }

  // Calculate achieved price
  let totalCost = 0;
  let allocatedVolume = 0;
  finalAllocation.forEach((volume, supplierId) => {
    const quote = quotes.find(q => q.supplierId === supplierId);
    if (quote && volume > 0) {
      totalCost += quote.price * volume;
      allocatedVolume += volume;
    }
  });

  const achievedPrice = allocatedVolume > 0 ? totalCost / allocatedVolume : 0;

  // Check if target is achievable
  const priceDifference = Math.abs(achievedPrice - targetAvgPrice);
  const isAchievable = priceDifference <= 0.01; // Allow 1 cent tolerance

  let reason: string | undefined;
  if (!isAchievable) {
    if (achievedPrice < targetAvgPrice) {
      reason = `Target price too high. Closest achievable: ${achievedPrice.toFixed(2)} (cheapest suppliers already allocated)`;
    } else {
      reason = `Target price too low. Closest achievable: ${achievedPrice.toFixed(2)} (fairness constraints prevent lower cost)`;
    }
  }

  return {
    allocations: finalAllocation,
    achievedPrice,
    targetPrice: targetAvgPrice,
    isAchievable,
    reason,
  };
}

