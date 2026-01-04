import React, { useEffect, useState } from 'react';
import { Calculator, TrendingDown, AlertCircle, CheckCircle, Target } from 'lucide-react';
import { supabase } from '../utils/supabase';
import type { QuoteWithDetails } from '../types';
import { formatCurrency } from '../utils/helpers';

interface PriceSuggestion {
  quoteId: string;
  itemName: string;
  currentPrice: number;
  suggestedCounter: number;
  savings: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

interface SmartPricingSuggestionsProps {
  weekId: string;
  quotes: QuoteWithDetails[];
  onApplySuggestion: (quoteId: string, price: number) => Promise<void>;
}

export function SmartPricingSuggestions({ weekId, quotes, onApplySuggestion }: SmartPricingSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    calculateSuggestions();
  }, [quotes]);

  async function calculateSuggestions() {
    const newSuggestions: PriceSuggestion[] = [];

    const { data: historicalQuotes } = await supabase
      .from('quotes')
      .select('item_id, supplier_id, supplier_fob, rf_counter_fob, supplier_response, awarded_volume')
      .neq('week_id', weekId)
      .not('supplier_fob', 'is', null);

    const quotesNeedingCounters = quotes.filter(q => q.supplier_fob !== null && q.rf_counter_fob === null);

    for (const quote of quotesNeedingCounters) {
      const itemQuotes = quotes.filter(q => q.item_id === quote.item_id && q.supplier_fob !== null);
      const prices = itemQuotes.map(q => q.supplier_fob!).sort((a, b) => a - b);

      if (prices.length === 0) continue;

      const lowestPrice = prices[0];
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const currentPrice = quote.supplier_fob!;

      const historical = historicalQuotes?.filter(
        q => q.item_id === quote.item_id && q.supplier_id === quote.supplier_id
      ) || [];

      let suggestedCounter: number;
      let confidence: 'high' | 'medium' | 'low';
      let reasoning: string;

      if (currentPrice === lowestPrice) {
        suggestedCounter = currentPrice * 0.98;
        confidence = 'high';
        reasoning = 'Already lowest price - negotiate 2% additional discount';
      } else if (currentPrice <= avgPrice * 1.05) {
        const targetPrice = (lowestPrice + avgPrice) / 2;
        suggestedCounter = Math.max(targetPrice, lowestPrice * 1.02);
        confidence = 'high';
        reasoning = 'Competitive price - counter with market midpoint';
      } else if (currentPrice <= avgPrice * 1.15) {
        suggestedCounter = avgPrice * 0.98;
        confidence = 'medium';
        reasoning = 'Above average - counter near market average';
      } else {
        suggestedCounter = avgPrice * 0.95;
        confidence = 'low';
        reasoning = 'High price - aggressive counter to match market';
      }

      if (historical.length > 0) {
        const acceptedCounters = historical.filter(h => h.rf_counter_fob && h.supplier_response === 'accept');

        if (acceptedCounters.length > 0) {
          const avgAcceptedDiscount = acceptedCounters.reduce((sum, h) => {
            const discount = ((h.supplier_fob || 0) - (h.rf_counter_fob || 0)) / (h.supplier_fob || 1);
            return sum + discount;
          }, 0) / acceptedCounters.length;

          const historicalBasedCounter = currentPrice * (1 - avgAcceptedDiscount);
          suggestedCounter = (suggestedCounter + historicalBasedCounter) / 2;
          confidence = 'high';
          reasoning += ` (Supplier historically accepts ${(avgAcceptedDiscount * 100).toFixed(1)}% reductions)`;
        }
      }

      suggestedCounter = Math.round(suggestedCounter * 100) / 100;
      const savings = currentPrice - suggestedCounter;

      if (savings > 0.01) {
        newSuggestions.push({
          quoteId: quote.id,
          itemName: quote.item?.name || 'Unknown Item',
          currentPrice,
          suggestedCounter,
          savings,
          confidence,
          reasoning,
        });
      }
    }

    newSuggestions.sort((a, b) => b.savings - a.savings);
    setSuggestions(newSuggestions);
  }

  const handleApply = async (suggestion: PriceSuggestion) => {
    setApplying(suggestion.quoteId);
    try {
      await onApplySuggestion(suggestion.quoteId, suggestion.suggestedCounter);
    } finally {
      setApplying(null);
    }
  };

  const totalPotentialSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
      case 'medium': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' };
      default: return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' };
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Smart Pricing Complete</h3>
            <p className="text-gray-600">All items have counter offers or are optimally priced</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Calculator className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Smart Pricing Recommendations</h3>
            <p className="text-gray-600">AI-powered counter offer suggestions based on market data</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-4 text-center">
          <div className="text-sm font-medium opacity-90">Potential Savings</div>
          <div className="text-3xl font-bold">{formatCurrency(totalPotentialSavings)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map(suggestion => {
          const confidenceColors = getConfidenceColor(suggestion.confidence);

          return (
            <div
              key={suggestion.quoteId}
              className="bg-gradient-to-r from-gray-50 to-white rounded-lg p-5 border-2 border-gray-200 hover:border-purple-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-lg font-bold text-gray-900">{suggestion.itemName}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${confidenceColors.bg} ${confidenceColors.text} ${confidenceColors.border}`}>
                      {suggestion.confidence.toUpperCase()} CONFIDENCE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Target className="w-4 h-4" />
                    <span>{suggestion.reasoning}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 font-medium mb-1">Current Price</div>
                      <div className="text-lg font-bold text-gray-900">{formatCurrency(suggestion.currentPrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 font-medium mb-1">Suggested Counter</div>
                      <div className="text-lg font-bold text-purple-600">{formatCurrency(suggestion.suggestedCounter)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 font-medium mb-1">Savings</div>
                      <div className="text-lg font-bold text-green-600 flex items-center gap-1">
                        <TrendingDown className="w-4 h-4" />
                        {formatCurrency(suggestion.savings)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 font-medium mb-1">Reduction</div>
                      <div className="text-lg font-bold text-green-600">
                        {((suggestion.savings / suggestion.currentPrice) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-6">
                  <button
                    onClick={() => handleApply(suggestion)}
                    disabled={applying === suggestion.quoteId}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {applying === suggestion.quoteId ? 'Applying...' : 'Apply Suggestion'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
