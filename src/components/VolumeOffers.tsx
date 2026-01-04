import React, { useState } from 'react';
import { Check, X, Edit3, Send, RotateCcw, Shield } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { updateSupplierVolumeResponse } from '../utils/database';
import { useToast } from '../contexts/ToastContext';
import type { Item, Quote } from '../types';

interface VolumeOffersProps {
  items: Item[];
  quotes: Quote[];
  weekNumber: number;
  onRefresh: () => void;
}

export function VolumeOffers({ items, quotes, weekNumber, onRefresh }: VolumeOffersProps) {
  const { showToast } = useToast();
  const [responses, setResponses] = useState<Record<string, { action: 'accept' | 'update' | 'decline'; volume: string; notes: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const itemsWithOffers = items
    .map(item => {
      const quote = quotes.find(q => q.item_id === item.id);
      return { item, quote };
    })
    .filter(({ quote }) => quote && quote.offered_volume && quote.offered_volume > 0);

  const handleResponse = (itemId: string, action: 'accept' | 'update' | 'decline', quote: Quote) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        action,
        volume: action === 'accept' ? (quote.offered_volume?.toString() || '0') : (prev[itemId]?.volume || '0'),
        notes: prev[itemId]?.notes || ''
      }
    }));
  };

  const handleClearResponse = (itemId: string) => {
    setResponses(prev => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
  };

  const handleVolumeChange = (itemId: string, volume: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        volume
      }
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes
      }
    }));
  };

  const handleSubmitAll = async () => {
    const pendingResponses = itemsWithOffers.filter(({ item, quote }) =>
      !quote?.supplier_volume_response && responses[item.id]
    );

    if (pendingResponses.length === 0) {
      showToast('No responses to submit', 'error');
      return;
    }

    setSubmitting(true);
    let successCount = 0;

    for (const { item, quote } of pendingResponses) {
      const response = responses[item.id];
      if (!response || !quote) continue;

      let acceptedVolume = 0;
      if (response.action === 'accept') {
        acceptedVolume = quote.offered_volume || 0;
      } else if (response.action === 'update') {
        acceptedVolume = parseInt(response.volume) || 0;
      }

      const success = await updateSupplierVolumeResponse(
        quote.id,
        response.action,
        acceptedVolume,
        response.notes
      );

      if (success) successCount++;
    }

    setSubmitting(false);

    if (successCount > 0) {
      showToast(`${successCount} volume response(s) submitted successfully`, 'success');
      setResponses({});
      onRefresh();
    } else {
      showToast('Failed to submit volume responses', 'error');
    }
  };

  if (itemsWithOffers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-xl border-2 border-emerald-500 overflow-hidden">
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-lime-700 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Volume Offers - Week {weekNumber}</h2>
            <p className="text-lime-200 text-lg">Review and respond to volume allocations</p>
          </div>
          <div className="flex items-center gap-4">
            <img
              src="/image.png"
              alt="Robinson Fresh"
              className="h-14 w-auto brightness-0 invert opacity-80"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <button
              onClick={handleSubmitAll}
              disabled={submitting || Object.keys(responses).length === 0}
              className="flex items-center gap-2 bg-white text-emerald-700 px-6 py-3 rounded-xl font-bold hover:bg-lime-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {submitting ? (
                <>
                  <div className="animate-spin w-5 h-5 border-3 border-emerald-700 border-t-transparent rounded-full"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">SKU</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wide">Pack Size</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Price</th>
              <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 uppercase tracking-wide">Offered Volume</th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wide">Your Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {itemsWithOffers.map(({ item, quote }) => {
              if (!quote) return null;

              const offeredVolume = quote.offered_volume || 0;
              const finalPrice = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;
              const hasResponded = !!quote.supplier_volume_response;
              const currentResponse = responses[item.id];

              return (
                <tr key={item.id} className="hover:bg-emerald-50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-semibold text-gray-900 text-base">{item.name}</div>
                    <div className="text-sm text-gray-600 mt-1">{item.organic_flag}</div>
                  </td>
                  <td className="px-6 py-5 text-gray-800 font-medium">{item.pack_size}</td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(finalPrice || 0)}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="inline-flex items-center px-4 py-2 rounded-lg text-base font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {offeredVolume} cases
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {hasResponded ? (
                      <div className="text-center">
                        {quote.supplier_volume_response === 'accept' && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg border border-green-300">
                            <Check className="w-5 h-5" />
                            <span className="font-semibold">Accepted: {quote.supplier_volume_accepted} cases</span>
                          </div>
                        )}
                        {quote.supplier_volume_response === 'update' && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-800 rounded-lg border border-orange-300">
                            <Edit3 className="w-5 h-5" />
                            <span className="font-semibold">Counter: {quote.supplier_volume_accepted} cases</span>
                          </div>
                        )}
                        {quote.supplier_volume_response === 'decline' && (
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg border border-red-300">
                            <X className="w-5 h-5" />
                            <span className="font-semibold">Declined</span>
                          </div>
                        )}
                        {quote.supplier_volume_response_notes && (
                          <div className="mt-2 text-sm text-gray-600 italic text-left">
                            Note: {quote.supplier_volume_response_notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleResponse(item.id, 'accept', quote)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                              currentResponse?.action === 'accept'
                                ? 'bg-green-600 text-white shadow-lg scale-105'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleResponse(item.id, 'update', quote)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                              currentResponse?.action === 'update'
                                ? 'bg-orange-600 text-white shadow-lg scale-105'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                            }`}
                          >
                            <Edit3 className="w-4 h-4" />
                            Update
                          </button>
                          <button
                            onClick={() => handleResponse(item.id, 'decline', quote)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                              currentResponse?.action === 'decline'
                                ? 'bg-red-600 text-white shadow-lg scale-105'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            <X className="w-4 h-4" />
                            Decline
                          </button>
                          {currentResponse && (
                            <button
                              onClick={() => handleClearResponse(item.id)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                              title="Clear selection"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Clear
                            </button>
                          )}
                        </div>

                        {currentResponse?.action === 'update' && (
                          <div className="flex items-center gap-2 justify-center">
                            <label className="text-sm font-medium text-gray-700">Counter Volume:</label>
                            <input
                              type="number"
                              min="0"
                              value={currentResponse.volume}
                              onChange={(e) => handleVolumeChange(item.id, e.target.value)}
                              className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-right font-semibold focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600">cases</span>
                          </div>
                        )}

                        {currentResponse && (
                          <div className="px-2">
                            <input
                              type="text"
                              value={currentResponse.notes}
                              onChange={(e) => handleNotesChange(item.id, e.target.value)}
                              placeholder="Add optional notes..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
