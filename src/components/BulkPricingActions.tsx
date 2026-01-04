import React, { useState } from 'react';
import { CheckSquare, Percent, DollarSign, TrendingDown } from 'lucide-react';
import type { QuoteWithDetails } from '../types';
import { formatCurrency } from '../utils/helpers';

interface BulkPricingActionsProps {
  quotes: QuoteWithDetails[];
  onApplyBulk: (quoteIds: string[], value: number, type: 'amount' | 'percent') => Promise<void>;
}

export function BulkPricingActions({ quotes, onApplyBulk }: BulkPricingActionsProps) {
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState<'amount' | 'percent'>('percent');
  const [bulkValue, setBulkValue] = useState('');
  const [applying, setApplying] = useState(false);

  const quotesWithPrices = quotes.filter(q => q.supplier_fob !== null && q.rf_counter_fob === null);

  const toggleQuote = (quoteId: string) => {
    setSelectedQuotes(prev => {
      const next = new Set(prev);
      if (next.has(quoteId)) {
        next.delete(quoteId);
      } else {
        next.add(quoteId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedQuotes(new Set(quotesWithPrices.map(q => q.id)));
  };

  const clearSelection = () => {
    setSelectedQuotes(new Set());
  };

  const handleApply = async () => {
    if (selectedQuotes.size === 0 || !bulkValue) return;

    setApplying(true);
    try {
      await onApplyBulk(Array.from(selectedQuotes), parseFloat(bulkValue), bulkType);
      clearSelection();
      setBulkValue('');
    } finally {
      setApplying(false);
    }
  };

  const calculatePreview = (quote: QuoteWithDetails) => {
    if (!bulkValue || !quote.supplier_fob) return null;

    const value = parseFloat(bulkValue);
    if (bulkType === 'percent') {
      return quote.supplier_fob * (1 - value / 100);
    } else {
      return quote.supplier_fob - value;
    }
  };

  const totalSavings = Array.from(selectedQuotes).reduce((sum, quoteId) => {
    const quote = quotesWithPrices.find(q => q.id === quoteId);
    if (!quote || !bulkValue) return sum;

    const preview = calculatePreview(quote);
    if (preview === null) return sum;

    return sum + (quote.supplier_fob! - preview);
  }, 0);

  if (quotesWithPrices.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            Bulk Counter Offers
          </h3>
          <p className="text-sm text-gray-600 mt-1">Apply counter offers to multiple items at once</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
          >
            Select All ({quotesWithPrices.length})
          </button>
          {selectedQuotes.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium text-sm"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Counter Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkType('percent')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                bulkType === 'percent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400'
              }`}
            >
              <Percent className="w-4 h-4 inline mr-1" />
              Percentage
            </button>
            <button
              onClick={() => setBulkType('amount')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                bulkType === 'amount'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              Fixed Amount
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reduction {bulkType === 'percent' ? '(%)' : '($)'}
          </label>
          <input
            type="number"
            step="0.01"
            value={bulkValue}
            onChange={e => setBulkValue(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
            placeholder={bulkType === 'percent' ? '5' : '0.50'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Actions</label>
          <button
            onClick={handleApply}
            disabled={applying || selectedQuotes.size === 0 || !bulkValue}
            className="w-full px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? 'Applying...' : `Apply to ${selectedQuotes.size} items`}
          </button>
        </div>
      </div>

      {selectedQuotes.size > 0 && bulkValue && (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-sm font-medium text-gray-700">Estimated Savings</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalSavings)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto space-y-2">
        {quotesWithPrices.map(quote => {
          const isSelected = selectedQuotes.has(quote.id);
          const preview = calculatePreview(quote);

          return (
            <div
              key={quote.id}
              onClick={() => toggleQuote(quote.id)}
              className={`p-4 rounded-lg cursor-pointer transition border-2 ${
                isSelected
                  ? 'bg-blue-100 border-blue-400'
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{quote.item?.name || 'Unknown Item'}</div>
                    <div className="text-sm text-gray-600">{quote.item?.pack_size || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-gray-600">Current Price</div>
                    <div className="font-bold text-gray-900">{formatCurrency(quote.supplier_fob!)}</div>
                  </div>
                  {isSelected && preview !== null && (
                    <>
                      <div className="text-2xl text-gray-400">→</div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">Counter Offer</div>
                        <div className="font-bold text-green-600">{formatCurrency(preview)}</div>
                        <div className="text-xs text-green-600 font-medium">
                          Save {formatCurrency(quote.supplier_fob! - preview)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
