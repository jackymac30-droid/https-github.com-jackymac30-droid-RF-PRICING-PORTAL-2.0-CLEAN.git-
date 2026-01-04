import { useState } from 'react';
import { Check, Edit2, Save, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useToast } from '../contexts/ToastContext';
import { updateSupplierVolumeResponse } from '../utils/database';

interface AllocationResponseProps {
  quotes: any[];
  items: any[];
  weekId: string;
  weekNumber: number;
  supplierId: string;
  onRefresh: () => void;
}

export default function AllocationResponse({ quotes, items, weekId, weekNumber, supplierId, onRefresh }: AllocationResponseProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [responses, setResponses] = useState<Record<string, { action: 'accept' | 'revise'; volume: number }>>({});

  const quotesWithAllocation = quotes.filter(q => q.awarded_volume && q.awarded_volume > 0);

  console.log('=== ALLOCATION RESPONSE COMPONENT ===', {
    weekId,
    weekNumber,
    supplierId,
    quotesWithAllocationCount: quotesWithAllocation.length
  });

  if (quotesWithAllocation.length === 0) {
    return null;
  }

  const handleResponse = (itemId: string, action: 'accept' | 'revise', volume: number) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { action, volume }
    }));
  };

  const submitAllResponses = async () => {
    setSubmitting(true);
    console.log('=== SUBMIT ALLOCATION RESPONSES START ===');
    console.log('weekId:', weekId);
    console.log('supplierId:', supplierId);
    console.log('quotesWithAllocation.length:', quotesWithAllocation.length);

    try {
let successCount = 0;
const errors: any[] = [];

for (const quote of quotesWithAllocation) {
  const response = responses[quote.item_id];
  const action = response?.action || 'accept';

  const confirmedVolume =
    action === 'accept'
      ? quote.awarded_volume
      : (response?.volume || quote.awarded_volume);

  const ok = await updateSupplierVolumeResponse(
    quote.id,
    action === 'accept' ? 'accept' : 'update',
    confirmedVolume
  );

  if (!ok) {
    errors.push({ quoteId: quote.id, itemId: quote.item_id });
  } else {
    successCount++;
  }
}

if (errors.length > 0) {
        console.error('=== SUBMISSION ERRORS ===');
        console.error('Errors:', errors);
        throw new Error(`Failed to submit ${errors.length} response(s)`);
      }

      console.log('✓ All responses submitted successfully:', successCount);
      showToast(`Successfully submitted ${successCount} allocation response(s)`, 'success');
      setResponses({});
      onRefresh();
    } catch (error: any) {
      console.error('=== ERROR SUBMITTING ALLOCATION RESPONSES ===');
      console.error('Error:', error);
      showToast(error.message || 'Failed to submit responses', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingResponses = quotesWithAllocation.filter(q =>
    q.supplier_response_status === 'pending' || !q.supplier_response_status
  );

  if (pendingResponses.length === 0) {
    return (
      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Check className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-lg font-bold text-green-900">All Allocations Confirmed</h3>
            <p className="text-sm text-green-700 mt-1">You have responded to all volume allocations for Week {weekNumber}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-orange-300 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-6 py-5">
        <h2 className="text-2xl font-bold text-white">Allocation Response Required</h2>
        <p className="text-orange-50 text-sm mt-1">Review and confirm your allocated volumes for Week {weekNumber}</p>
      </div>

      <div className="p-6 space-y-4">
        {quotesWithAllocation.map(quote => {
          const item = items.find(i => i.id === quote.item_id);
          if (!item) return null;

          const isConfirmed = quote.supplier_response_status && quote.supplier_response_status !== 'pending';
          const currentResponse = responses[quote.item_id] || { action: 'accept', volume: quote.awarded_volume };

          return (
            <div key={quote.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-orange-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.pack_size} {item.organic_flag && '• Organic'}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Allocated</div>
                    <div className="text-lg font-bold text-gray-900">{quote.awarded_volume?.toLocaleString()} cases</div>
                  </div>

                  {isConfirmed ? (
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Confirmed</div>
                        <div className="text-lg font-bold text-green-700">{quote.supplier_response_volume?.toLocaleString()} cases</div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                        quote.supplier_response_status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {quote.supplier_response_status === 'accepted' ? 'Accepted' : 'Revised'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <select
                        value={currentResponse.action}
                        onChange={(e) => handleResponse(quote.item_id, e.target.value as 'accept' | 'revise', currentResponse.volume)}
                        className="border-2 border-gray-300 rounded-lg px-3 py-2 font-medium focus:border-orange-500 focus:outline-none"
                      >
                        <option value="accept">Accept</option>
                        <option value="revise">Revise</option>
                      </select>

                      {currentResponse.action === 'revise' && (
                        <input
                          type="number"
                          value={currentResponse.volume}
                          onChange={(e) => handleResponse(quote.item_id, 'revise', parseInt(e.target.value) || 0)}
                          className="w-32 border-2 border-gray-300 rounded-lg px-3 py-2 text-center font-bold focus:border-orange-500 focus:outline-none"
                          placeholder="Cases"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {pendingResponses.length > 0 && (
          <button
            onClick={submitAllResponses}
            disabled={submitting}
            className="w-full mt-4 bg-gradient-to-r from-orange-600 to-amber-500 text-white px-6 py-4 rounded-lg font-bold text-lg hover:from-orange-700 hover:to-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>Processing...</>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Submit All Responses
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
