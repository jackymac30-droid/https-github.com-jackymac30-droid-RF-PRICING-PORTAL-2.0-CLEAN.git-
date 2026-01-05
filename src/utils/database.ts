import { supabase } from './supabase';
import type { Session, Supplier, Item, Week, Quote, QuoteWithDetails, SKUStatus, SupplierStats, SupplierRanking, AnalyticsBySKU, AnalyticsBySupplier, WeekItemVolume } from '../types';

export const DEMO_PASSWORD = '123';
const SESSION_KEY = 'rf_pricing_session';

export async function loginAsSupplier(email: string): Promise<Session | null> {
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (supplier) {
    return {
      user_id: supplier.id,
      user_name: supplier.name,
      role: 'supplier',
      supplier_id: supplier.id,
    };
  }
  return null;
}

export async function loginAsRF(): Promise<Session> {
  return {
    user_id: 'rf-user',
    user_name: 'RF Manager',
    role: 'rf',
  };
}

export function saveSession(session: Session | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function loadSession(): Session | null {
  const stored = localStorage.getItem(SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
  
  return data || [];
}

export async function fetchItems(): Promise<Item[]> {
  const { data } = await supabase
    .from('items')
    .select('*')
    .order('display_order');
  return data || [];
}

export async function fetchWeeks(): Promise<Week[]> {
  const { data } = await supabase
    .from('weeks')
    .select('*')
    .order('week_number', { ascending: false });
  return data || [];
}

export async function fetchCurrentAndRecentWeeks(): Promise<Week[]> {
  const { data } = await supabase
    .from('weeks')
    .select('*')
    .order('week_number', { ascending: false })
    .limit(6);
  return data || [];
}

export async function fetchCurrentOpenWeek(): Promise<Week | null> {
  const { data } = await supabase
    .from('weeks')
    .select('*')
    .eq('status', 'open')
    .maybeSingle();
  return data;
}

export async function fetchQuotes(weekId: string, supplierId?: string): Promise<Quote[]> {
  let query = supabase
    .from('quotes')
    .select('*')
    .eq('week_id', weekId);

  if (supplierId) {
    query = query.eq('supplier_id', supplierId);
  }

  const { data } = await query;
  return data || [];
}

export async function fetchQuotesWithDetails(weekId: string, supplierId?: string): Promise<QuoteWithDetails[]> {
  try {
    let query = supabase
      .from('quotes')
      .select(`
        *,
        item:items(*),
        supplier:suppliers(*),
        week:weeks(*)
      `)
      .eq('week_id', weekId);

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data, error } = await query;
    
    if (error) {
      logger.error('Error fetching quotes with details:', error);
      throw error;
    }
    
    return data || [];
  } catch (err) {
    logger.error('Error in fetchQuotesWithDetails:', err);
    throw err;
  }
}

export async function updateSupplierQuote(
  quoteId: string,
  fobPrice: number | null,
  dlvdPrice: number | null
): Promise<boolean> {
  logger.debug('updateSupplierQuote called:', { quoteId, fobPrice, dlvdPrice });

  const { data, error } = await supabase
    .from('quotes')
    .update({
      supplier_fob: fobPrice,
      supplier_dlvd: dlvdPrice,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .select();

  if (error) {
    logger.error('Error updating quote:', error);
    return false;
  }

  logger.debug('Quote updated successfully:', data);
  return true;
}

export async function updateSupplierResponse(
  quoteId: string,
  response: 'accept' | 'revise',
  revisedFob?: number
): Promise<boolean> {
  // First, get the current quote to check if there's a counter
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('rf_counter_fob')
    .eq('id', quoteId)
    .single();

  if (fetchError) {
    logger.error('Error fetching quote:', fetchError);
    return false;
  }

  // Auto-finalize if supplier accepts the counter
  // If supplier revises, leave rf_final_fob null for RF to review
  const updateData: any = {
    supplier_response: response,
    supplier_revised_fob: revisedFob || null,
    updated_at: new Date().toISOString(),
  };

  // Auto-lock to counter price if supplier accepts
  if (response === 'accept' && quote && quote.rf_counter_fob !== null) {
    updateData.rf_final_fob = quote.rf_counter_fob;
  }

  const { error } = await supabase
    .from('quotes')
    .update(updateData)
    .eq('id', quoteId);

  if (error) {
    logger.error('Error updating supplier response:', error);
    return false;
  }

  return true;
}

export async function updateRFCounter(
  quoteId: string,
  counterFob: number | null
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      rf_counter_fob: counterFob,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) {
    logger.error('Error updating RF counter:', error);
    return false;
  }

  return true;
}

// RF sets final confirmed price for a specific quote (one supplier, one SKU)
// This locks pricing for this quote, allowing different final prices per supplier for same SKU
export async function updateRFFinal(
  quoteId: string,
  finalFob: number | null
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      rf_final_fob: finalFob,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) {
    logger.error('Error updating RF final:', error);
    return false;
  }

  return true;
}

/**
 * Update supplier eligibility status
 * Core business rule: Pricing submission ≠ allocation eligibility
 * Only suppliers with status 'eligible_for_award' appear in allocation interface
 */
export async function updateSupplierEligibility(
  quoteId: string, 
  status: 'submitted' | 'reviewed' | 'feedback_sent' | 'eligible_for_award' | 'not_used',
  userName: string = 'RF Manager'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .rpc('update_supplier_eligibility', {
        quote_id_param: quoteId,
        new_status: status,
        updated_by_user: userName
      });

    if (error) {
      logger.error('Error updating supplier eligibility:', error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Error updating supplier eligibility:', err);
    return false;
  }
}

export async function updateQuoteVolume(
  quoteId: string,
  volume: number
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      awarded_volume: volume,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) {
    console.error('Error updating quote volume:', error);
    return false;
  }

  return true;
}

export async function updateWeekStatus(
  weekId: string,
  status: 'open' | 'finalized' | 'closed'
): Promise<boolean> {
  const { error } = await supabase
    .from('weeks')
    .update({ status })
    .eq('id', weekId);

  if (error) {
    console.error('Error updating week status:', error);
    return false;
  }

  if (status === 'closed') {
    const { error: previousError } = await supabase
      .from('weeks')
      .update({ status: 'closed' })
      .eq('status', 'finalized')
      .neq('id', weekId);

    if (previousError) {
      console.error('Error closing previous weeks:', previousError);
    }
  }

  return true;
}

export async function enforceWeekStatusHygiene(): Promise<boolean> {
  try {
    const { data: weeks, error: fetchError } = await supabase
      .from('weeks')
      .select('id, start_date, status')
      .order('start_date', { ascending: false });

    if (fetchError) {
      console.error('Error fetching weeks for hygiene check:', fetchError);
      return false;
    }

    if (!weeks || weeks.length === 0) {
      console.log('No weeks found, hygiene check skipped');
      return true;
    }

    const latestWeek = weeks[0];
    const otherWeekIds = weeks.slice(1).map(w => w.id);

    if (latestWeek.status !== 'open') {
      const { error: openError } = await supabase
        .from('weeks')
        .update({ status: 'open' })
        .eq('id', latestWeek.id);

      if (openError) {
        console.error('Error setting latest week to open:', openError);
        return false;
      }
      console.log(`✓ Set week ${latestWeek.id} to open`);
    }

    if (otherWeekIds.length > 0) {
      const { error: closeError } = await supabase
        .from('weeks')
        .update({ status: 'closed' })
        .in('id', otherWeekIds)
        .neq('status', 'closed');

      if (closeError) {
        console.error('Error closing other weeks:', closeError);
        return false;
      }
      console.log(`✓ Closed ${otherWeekIds.length} other weeks`);
    }

    console.log('✓ Week status hygiene enforced');
    return true;
  } catch (err) {
    console.error('Error enforcing week status hygiene:', err);
    return false;
  }
}

// Creates a new week and initializes quotes for all supplier × item combinations
// This ensures each supplier can submit pricing for each SKU independently
// Quote structure: one record per (week_id, item_id, supplier_id) - allows multiple suppliers per SKU
export async function createNewWeek(): Promise<Week | null> {
  // Close all existing open weeks first (only one week can be 'open' at a time)
  await supabase
    .from('weeks')
    .update({ status: 'closed' })
    .eq('status', 'open');

  const { data: weeks } = await supabase
    .from('weeks')
    .select('week_number, end_date')
    .order('week_number', { ascending: false })
    .limit(1);

  const lastWeek = weeks?.[0];
  const nextWeekNumber = lastWeek ? lastWeek.week_number + 1 : 1;

  let startDate: Date;
  if (lastWeek?.end_date) {
    const lastEndDate = new Date(lastWeek.end_date);
    startDate = new Date(lastEndDate);
    startDate.setDate(startDate.getDate() + 1);
  } else {
    startDate = new Date();
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const { data: newWeek, error } = await supabase
    .from('weeks')
    .insert({
      week_number: nextWeekNumber,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'open' // Week is now open for supplier submissions
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating new week:', error);
    return null;
  }

  const [suppliers, items] = await Promise.all([
    fetchSuppliers(),
    fetchItems()
  ]);

  // Create one quote record per supplier × item combination
  // This allows multiple suppliers to price the same SKU independently
  const quotes = [];
  for (const supplier of suppliers) {
    for (const item of items) {
      quotes.push({
        week_id: newWeek.id,
        item_id: item.id,
        supplier_id: supplier.id
        // supplier_fob, rf_counter_fob, etc. start as null - filled in during workflow
      });
    }
  }

  if (quotes.length > 0) {
    const { error: quotesError } = await supabase
      .from('quotes')
      .insert(quotes);

    if (quotesError) {
      console.error('Error creating quotes for new week:', quotesError);
    }
  }

  return newWeek;
}

export async function updateEmergencyUnlock(
  weekId: string,
  enabled: boolean,
  reason?: string,
  userName?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('weeks')
    .update({
      emergency_unlock_enabled: enabled,
      emergency_unlock_reason: reason || null,
      emergency_unlock_by_user: userName || null,
      emergency_unlock_at: enabled ? new Date().toISOString() : null,
    })
    .eq('id', weekId);

  if (error) {
    console.error('Error updating emergency unlock:', error);
    return false;
  }

  return true;
}

export async function createAuditLog(
  weekId: string,
  fieldChanged: string,
  oldValue: string | null,
  newValue: string | null,
  userId: string,
  reason: string,
  itemId?: string,
  supplierId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      week_id: weekId,
      item_id: itemId,
      supplier_id: supplierId,
      field_changed: fieldChanged,
      old_value: oldValue,
      new_value: newValue,
      user_id: userId,
      reason,
    });

  if (error) {
    console.error('Error creating audit log:', error);
    return false;
  }

  return true;
}

export async function ensureQuotesForWeek(weekId: string): Promise<void> {
  const [suppliers, items] = await Promise.all([fetchSuppliers(), fetchItems()]);

  for (const supplier of suppliers) {
    for (const item of items) {
      const { data: existing } = await supabase
        .from('quotes')
        .select('id')
        .eq('week_id', weekId)
        .eq('item_id', item.id)
        .eq('supplier_id', supplier.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('quotes').insert({
          week_id: weekId,
          item_id: item.id,
          supplier_id: supplier.id,
        });
      }
    }
  }
}

export async function getSuppliersWithSubmissions(weekId: string): Promise<{
  submitted: Supplier[];
  notSubmitted: Supplier[];
  counter: Supplier[];
  finalized: Supplier[];
}> {
  const suppliers = await fetchSuppliers();
  const quotes = await fetchQuotes(weekId);

  const notSubmitted: Supplier[] = [];
  const submitted: Supplier[] = [];
  const counter: Supplier[] = [];
  const finalized: Supplier[] = [];

  for (const supplier of suppliers) {
    const supplierQuotes = quotes.filter(q => q.supplier_id === supplier.id);

    // Supplier is "submitted" if at least ONE quote has supplier_fob OR supplier_dlvd non-null
    const hasSubmitted = supplierQuotes.some(q => q.supplier_fob !== null || q.supplier_dlvd !== null);

    if (!hasSubmitted) {
      notSubmitted.push(supplier);
      continue;
    }

    // Check if all quotes with prices have been finalized
    const quotesWithPrices = supplierQuotes.filter(q => q.supplier_fob !== null);
    const allFinalPricesSet = quotesWithPrices.length > 0 && quotesWithPrices.every(q => q.rf_final_fob !== null);
    
    // If all priced quotes are finalized, supplier is finalized (highest priority)
    if (allFinalPricesSet) {
      finalized.push(supplier);
      continue;
    }

    // Otherwise, categorize by workflow stage
    const hasCounters = supplierQuotes.some(q => q.rf_counter_fob !== null);
    const hasResponses = supplierQuotes.some(q => q.supplier_response !== null);
    const hasAnyFinalized = supplierQuotes.some(q => q.rf_final_fob !== null);

    // If there are counters and responses, or if there are counters and some finalized prices
    // (RF is in the process of finalizing), show in counter tab
    if (hasCounters && (hasResponses || hasAnyFinalized)) {
      counter.push(supplier);
    } else if (hasCounters) {
      // Counter sent but no response yet - still in counter tab
      counter.push(supplier);
    } else {
      submitted.push(supplier);
    }
  }

  return { notSubmitted, submitted, counter, finalized };
}

export async function getAllSupplierQuotes(weekId: string): Promise<Record<string, QuoteWithDetails[]>> {
  const quotes = await fetchQuotesWithDetails(weekId);
  const quotesBySupplier: Record<string, QuoteWithDetails[]> = {};

  for (const quote of quotes) {
    const supplierId = quote.supplier_id;
    if (!quotesBySupplier[supplierId]) {
      quotesBySupplier[supplierId] = [];
    }
    quotesBySupplier[supplierId].push(quote);
  }

  return quotesBySupplier;
}

export async function getSKUStatuses(weekId: string): Promise<SKUStatus[]> {
  const [items, quotes, suppliers] = await Promise.all([
    fetchItems(),
    fetchQuotes(weekId),
    fetchSuppliers(),
  ]);

  const skuStatuses: SKUStatus[] = [];

  for (const item of items) {
    const itemQuotes = quotes.filter(q => q.item_id === item.id);

    let status: SKUStatus['status'] = 'needs_supplier';
    const hasSupplierQuotes = itemQuotes.some(q => q.supplier_fob !== null);
    const hasRFCounters = itemQuotes.some(q => q.rf_counter_fob !== null);
    const hasSupplierResponses = itemQuotes.some(q => q.supplier_response !== null);
    const hasRFFinal = itemQuotes.some(q => q.rf_final_fob !== null);

    if (hasRFFinal) {
      status = 'complete';
    } else if (hasSupplierResponses) {
      status = 'needs_rf_final';
    } else if (hasRFCounters) {
      status = 'needs_supplier_response';
    } else if (hasSupplierQuotes) {
      status = 'needs_rf_counter';
    }

    const rankings: SupplierRanking[] = [];
    const prices: number[] = [];

    for (const supplier of suppliers) {
      const quote = itemQuotes.find(q => q.supplier_id === supplier.id);
      if (!quote) continue;

      const price = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;
      if (price !== null && price !== undefined) {
        prices.push(price);
        rankings.push({
          supplier_id: supplier.id,
          supplier_name: supplier.name,
          rank: 0,
          price,
          supplier_fob: quote.supplier_fob,
          rf_counter_fob: quote.rf_counter_fob,
          supplier_revised_fob: quote.supplier_revised_fob,
          rf_final_fob: quote.rf_final_fob,
        });
      }
    }

    rankings.sort((a, b) => b.price - a.price);
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    const averageFob = prices.length > 0
      ? prices.reduce((sum, p) => sum + p, 0) / prices.length
      : undefined;

    skuStatuses.push({
      item_id: item.id,
      item_name: item.name,
      pack_size: item.pack_size,
      category: item.category,
      organic_flag: item.organic_flag,
      status,
      rankings,
      average_fob: averageFob,
    });
  }

  return skuStatuses;
}

export async function getSupplierStats(weekId: string): Promise<SupplierStats[]> {
  const [suppliers, quotes, items] = await Promise.all([
    fetchSuppliers(),
    fetchQuotes(weekId),
    fetchItems(),
  ]);

  const stats: SupplierStats[] = [];

  for (const supplier of suppliers) {
    const supplierQuotes = quotes.filter(q => q.supplier_id === supplier.id);
    const quotesWithPrices = supplierQuotes.filter(q => q.supplier_fob !== null);

    const avgFob = quotesWithPrices.length > 0
      ? quotesWithPrices.reduce((sum, q) => sum + (q.supplier_fob || 0), 0) / quotesWithPrices.length
      : 0;

    let lowestCount = 0;
    let highestCount = 0;

    for (const item of items) {
      const itemQuotes = quotes.filter(q => q.item_id === item.id && q.supplier_fob !== null);
      if (itemQuotes.length === 0) continue;

      const prices = itemQuotes.map(q => q.supplier_fob!);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      const supplierQuote = itemQuotes.find(q => q.supplier_id === supplier.id);
      if (supplierQuote && supplierQuote.supplier_fob === minPrice) {
        lowestCount++;
      }
      if (supplierQuote && supplierQuote.supplier_fob === maxPrice) {
        highestCount++;
      }
    }

    stats.push({
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      skus_quoted: quotesWithPrices.length,
      average_fob: avgFob,
      lowest_price_count: lowestCount,
      highest_price_count: highestCount,
    });
  }

  return stats;
}

export async function resetAllData(): Promise<boolean> {
  try {
    // Clear all data tables
    await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('item_pricing_calculations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('week_item_volumes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase.from('items').insert([
      { name: 'Strawberry', pack_size: '4×2 lb', category: 'strawberry', organic_flag: 'CONV', display_order: 1 },
      { name: 'Strawberry', pack_size: '8×1 lb', category: 'strawberry', organic_flag: 'ORG', display_order: 2 },
      { name: 'Blueberry', pack_size: '18 oz', category: 'blueberry', organic_flag: 'CONV', display_order: 3 },
      { name: 'Blueberry', pack_size: 'Pint', category: 'blueberry', organic_flag: 'ORG', display_order: 4 },
      { name: 'Blackberry', pack_size: '12×6 oz', category: 'blackberry', organic_flag: 'CONV', display_order: 5 },
      { name: 'Blackberry', pack_size: '12×6 oz', category: 'blackberry', organic_flag: 'ORG', display_order: 6 },
      { name: 'Raspberry', pack_size: '12×6 oz', category: 'raspberry', organic_flag: 'CONV', display_order: 7 },
      { name: 'Raspberry', pack_size: '12×6 oz', category: 'raspberry', organic_flag: 'ORG', display_order: 8 },
    ]);

    await supabase.from('suppliers').insert([
      { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
      { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
      { name: 'Organic Growers', email: 'supplier3@organicgrowers.com' },
      { name: 'Valley Fresh', email: 'supplier4@valleyfresh.com' },
      { name: 'Premium Produce', email: 'supplier5@premiumproduce.com' },
    ]);

    await supabase.from('weeks').insert([
      { week_number: 1, start_date: '2025-01-01', end_date: '2025-01-07', status: 'closed' },
      { week_number: 2, start_date: '2025-01-08', end_date: '2025-01-14', status: 'closed' },
      { week_number: 3, start_date: '2025-01-15', end_date: '2025-01-21', status: 'closed' },
      { week_number: 4, start_date: '2025-01-22', end_date: '2025-01-28', status: 'closed' },
      { week_number: 5, start_date: '2025-01-29', end_date: '2025-02-04', status: 'closed' },
      { week_number: 6, start_date: '2025-02-05', end_date: '2025-02-11', status: 'open' },
    ]);

    const [suppliers, items, weeks] = await Promise.all([
      fetchSuppliers(),
      fetchItems(),
      fetchWeeks(),
    ]);

    for (const week of weeks.filter(w => w.status === 'closed')) {
      for (const supplier of suppliers) {
        for (const item of items) {
          const supplierFob = Math.round((15 + Math.random() * 3) * 100) / 100;
          const supplierDlvd = Math.round((18 + Math.random() * 3) * 100) / 100;
          const rfCounterFob = Math.round((14.5 + Math.random() * 2.5) * 100) / 100;
          const response = Math.random() > 0.5 ? 'accept' : 'revise';
          const revisedFob = response === 'revise' ? Math.round((14.75 + Math.random() * 2) * 100) / 100 : null;
          const rfFinalFob = Math.round((14.5 + Math.random() * 2) * 100) / 100;

          await supabase.from('quotes').insert({
            week_id: week.id,
            item_id: item.id,
            supplier_id: supplier.id,
            supplier_fob: supplierFob,
            supplier_dlvd: supplierDlvd,
            rf_counter_fob: rfCounterFob,
            supplier_response: response,
            supplier_revised_fob: revisedFob,
            rf_final_fob: rfFinalFob,
          });
        }
      }
    }


    return true;
  } catch (error) {
    console.error('Error resetting data:', error);
    return false;
  }
}

export async function demoResetAllocations(): Promise<boolean> {
  try {
    await supabase.from('draft_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { data: weeks } = await supabase.from('weeks').select('*');
    if (!weeks) return false;

    const openWeeks = weeks.filter(w => w.status === 'open');
    if (openWeeks.length > 1) {
      for (let i = 1; i < openWeeks.length; i++) {
        await supabase.from('weeks').update({ status: 'closed' }).eq('id', openWeeks[i].id);
      }
    }

    if (openWeeks.length === 0) {
      const latestWeek = weeks.sort((a, b) => b.week_number - a.week_number)[0];
      if (latestWeek) {
        await supabase.from('weeks').update({ status: 'open' }).eq('id', latestWeek.id);
      }
    }

    await supabase
      .from('quotes')
      .update({
        awarded_volume: null,
        offered_volume: null,
        supplier_volume_response: null,
        supplier_volume_accepted: null,
        supplier_volume_response_notes: null,
        allocation_confirmation_status: 'pending',
        allocation_confirmed_volume: null,
        allocation_confirmation_notes: null,
        allocation_confirmed_at: null,
        updated_at: new Date().toISOString(),
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('weeks')
      .update({
        allocation_submitted: false,
        allocation_submitted_at: null,
        allocation_submitted_by: null,
        updated_at: new Date().toISOString(),
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const [suppliers, items, currentWeeks] = await Promise.all([
      fetchSuppliers(),
      fetchItems(),
      fetchWeeks(),
    ]);

    const openWeek = currentWeeks.find(w => w.status === 'open');
    if (!openWeek) return true;

    for (const supplier of suppliers) {
      for (const item of items) {
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('id')
          .eq('week_id', openWeek.id)
          .eq('supplier_id', supplier.id)
          .eq('item_id', item.id)
          .maybeSingle();

        if (!existingQuote) {
          await supabase.from('quotes').insert({
            week_id: openWeek.id,
            supplier_id: supplier.id,
            item_id: item.id,
            supplier_fob: null,
            supplier_dlvd: null,
          });
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error in demo reset:', error);
    return false;
  }
}

export async function fetchAnalytics(): Promise<{
  bySKU: AnalyticsBySKU[];
  bySupplier: AnalyticsBySupplier[];
}> {
  const [weeks, items, suppliers, quotes] = await Promise.all([
    fetchWeeks(),
    fetchItems(),
    fetchSuppliers(),
    supabase.from('quotes').select('*').then(res => res.data || []),
  ]);

  const closedWeeks = weeks.filter(w => w.status === 'closed');
  const closedWeekIds = new Set(closedWeeks.map(w => w.id));
  const closedQuotes = quotes.filter(q => closedWeekIds.has(q.week_id));

  const bySKU: AnalyticsBySKU[] = [];

  for (const item of items) {
    for (const supplier of suppliers) {
      const supplierQuotes = closedQuotes.filter(
        q => q.item_id === item.id && q.supplier_id === supplier.id
      );

      if (supplierQuotes.length === 0) continue;

      const prices: { price: number; week: Week }[] = [];

      for (const quote of supplierQuotes) {
        const price = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;
        const week = closedWeeks.find(w => w.id === quote.week_id);
        if (price !== null && price !== undefined && week) {
          prices.push({ price, week });
        }
      }

      if (prices.length === 0) continue;

      const avgFob = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      const sorted = prices.sort((a, b) => a.price - b.price);
      const lowest = sorted[0];
      const highest = sorted[sorted.length - 1];

      bySKU.push({
        sku_name: item.name,
        organic_flag: item.organic_flag,
        supplier_name: supplier.name,
        avg_fob: avgFob,
        lowest_fob: lowest.price,
        lowest_week: lowest.week.week_number,
        highest_fob: highest.price,
        highest_week: highest.week.week_number,
      });
    }
  }

  const bySupplier: AnalyticsBySupplier[] = [];

  for (const supplier of suppliers) {
    const supplierQuotes = closedQuotes.filter(q => q.supplier_id === supplier.id);
    const prices: number[] = [];

    for (const quote of supplierQuotes) {
      const price = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;
      if (price !== null && price !== undefined) {
        prices.push(price);
      }
    }

    if (prices.length === 0) continue;

    const avgFob = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    let timesCheapest = 0;
    let timesExpensive = 0;

    for (const item of items) {
      for (const week of closedWeeks) {
        const itemWeekQuotes = closedQuotes.filter(
          q => q.item_id === item.id && q.week_id === week.id
        );

        const pricesForComparison: { supplier_id: string; price: number }[] = [];
        for (const quote of itemWeekQuotes) {
          const price = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;
          if (price !== null && price !== undefined) {
            pricesForComparison.push({ supplier_id: quote.supplier_id, price });
          }
        }

        if (pricesForComparison.length === 0) continue;

        const sorted = pricesForComparison.sort((a, b) => a.price - b.price);
        const cheapest = sorted[0];
        const expensive = sorted[sorted.length - 1];

        if (cheapest.supplier_id === supplier.id) timesCheapest++;
        if (expensive.supplier_id === supplier.id) timesExpensive++;
      }
    }

    bySupplier.push({
      supplier_name: supplier.name,
      avg_fob: avgFob,
      times_cheapest: timesCheapest,
      times_expensive: timesExpensive,
    });
  }

  return { bySKU, bySupplier };
}

export async function getQuotesForItem(weekId: string, itemId: string): Promise<{
  supplier_name: string;
  supplier_fob: number | null;
  rf_counter_fob: number | null;
  supplier_revised_fob: number | null;
  rf_final_fob: number | null;
  final_price: number | null;
}[]> {
  const [quotes, suppliers] = await Promise.all([
    fetchQuotes(weekId),
    fetchSuppliers(),
  ]);

  const itemQuotes = quotes.filter(q => q.item_id === itemId);
  const result = [];

  for (const quote of itemQuotes) {
    const supplier = suppliers.find(s => s.id === quote.supplier_id);
    if (!supplier) continue;

    const finalPrice = quote.rf_final_fob || quote.supplier_revised_fob || quote.supplier_fob;

    result.push({
      supplier_name: supplier.name,
      supplier_fob: quote.supplier_fob ?? null,
      rf_counter_fob: quote.rf_counter_fob ?? null,
      supplier_revised_fob: quote.supplier_revised_fob ?? null,
      rf_final_fob: quote.rf_final_fob ?? null,
      final_price: finalPrice ?? null,
    });
  }

  result.sort((a, b) => {
    const priceA = a.final_price ?? -Infinity;
    const priceB = b.final_price ?? -Infinity;
    return priceB - priceA;
  });

  return result;
}

export async function fetchVolumeNeeds(weekId: string): Promise<WeekItemVolume[]> {
  const { data, error } = await supabase
    .from('week_item_volumes')
    .select('*')
    .eq('week_id', weekId);

  if (error) {
    console.error('Error fetching volume needs:', error);
    return [];
  }

  return data || [];
}

export async function updateVolumeNeeded(
  weekId: string,
  itemId: string,
  volumeNeeded: number
): Promise<boolean> {
  const { error } = await supabase
    .from('week_item_volumes')
    .upsert({
      week_id: weekId,
      item_id: itemId,
      volume_needed: volumeNeeded,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'week_id,item_id'
    });

  if (error) {
    logger.error('Error updating volume needed:', error);
    return false;
  }

  return true;
}

export async function updateSupplierVolumeApproval(
  quoteId: string,
  approval: 'pending' | 'accepted' | 'revised',
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      supplier_volume_approval: approval,
      supplier_volume_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  if (error) {
    console.error('Error updating supplier volume approval:', error);
    return false;
  }

  return true;
}

export async function saveDraftAllocation(
  weekId: string,
  itemId: string,
  supplierId: string,
  draftedVolume: number
): Promise<boolean> {
  logger.debug('Saving draft allocation:', { weekId, itemId, supplierId, draftedVolume });

  const draftPayload = {
    week_id: weekId,
    item_id: itemId,
    supplier_id: supplierId,
    drafted_volume: draftedVolume,
    updated_at: new Date().toISOString(),
  };
  logger.debug('Draft payload:', draftPayload);

  const { data: draftData, error: draftError } = await supabase
    .from('draft_allocations')
    .upsert(draftPayload, {
      onConflict: 'week_id,item_id,supplier_id',
      ignoreDuplicates: false
    })
    .select();

  if (draftError) {
    logger.error('Error saving draft allocation:', draftError);
    return false;
  }

  if (!draftData || draftData.length === 0) {
    logger.error('Validation failed: Draft allocation upsert returned no data');
    return false;
  }

  logger.debug('Draft allocation upserted:', draftData);

  const awardedVolume = draftedVolume === 0 ? null : draftedVolume;
  const quotePayload = {
    week_id: weekId,
    item_id: itemId,
    supplier_id: supplierId,
    awarded_volume: awardedVolume,
    updated_at: new Date().toISOString(),
  };
  logger.debug('Quote payload:', quotePayload);

  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .upsert(quotePayload, {
      onConflict: 'week_id,item_id,supplier_id',
      ignoreDuplicates: false
    })
    .select();

  if (quoteError) {
    logger.error('Error upserting quote:', quoteError);
    return false;
  }

  if (!quoteData || quoteData.length === 0) {
    logger.error('Validation failed: Quote upsert returned no data');
    return false;
  }

  logger.debug('Quote upserted, save complete:', quoteData);
  return true;
}

export async function fetchDraftAllocations(weekId: string): Promise<{
  week_id: string;
  item_id: string;
  supplier_id: string;
  drafted_volume: number;
}[]> {
  const { data, error } = await supabase
    .from('draft_allocations')
    .select('*')
    .eq('week_id', weekId);

  if (error) {
    console.error('Error fetching draft allocations:', error);
    return [];
  }

  return data || [];
}

export async function finalizePricingForWeek(weekId: string, userName: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validation: Check that at least some quotes have final pricing set
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, rf_final_fob')
      .eq('week_id', weekId);

    if (quotesError) {
      logger.error('Error checking quotes:', quotesError);
      return { success: false, error: 'Failed to validate pricing data' };
    }

    const quotesWithFinalPricing = quotes?.filter(q => q.rf_final_fob !== null && q.rf_final_fob !== undefined) || [];
    
    if (quotesWithFinalPricing.length === 0) {
      return { success: false, error: 'Cannot finalize: No quotes have final pricing set. Please set rf_final_fob for at least one quote.' };
    }

    // Update week status (only use columns that exist in schema)
    const { error } = await supabase
      .from('weeks')
      .update({
        status: 'finalized',
      })
      .eq('id', weekId);

    if (error) {
      logger.error('Error finalizing pricing:', error);
      return { success: false, error: `Failed to finalize week: ${error.message}` };
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Error in finalizePricingForWeek:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function finalizeWeekAllocations(weekId: string, userName: string): Promise<boolean> {
  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, supplier_volume_accepted')
      .eq('week_id', weekId);

    if (quotes) {
      for (const quote of quotes) {
        if (quote.supplier_volume_accepted && quote.supplier_volume_accepted > 0) {
          await supabase
            .from('quotes')
            .update({
              awarded_volume: quote.supplier_volume_accepted,
              updated_at: new Date().toISOString()
            })
            .eq('id', quote.id);
        }
      }
    }

    const { error } = await supabase
      .from('weeks')
      .update({
        status: 'closed',
      })
      .eq('id', weekId);

    if (error) {
      console.error('Error finalizing week allocations:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in finalizeWeekAllocations:', error);
    return false;
  }
}

export async function submitAllocationsToSuppliers(weekId: string, userName: string): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    console.log('=== SUBMIT ALLOCATIONS TO SUPPLIERS ===');
    console.log('Week ID:', weekId);

    // Validation: Check week status
    const { data: week, error: weekError } = await supabase
      .from('weeks')
      .select('status')
      .eq('id', weekId)
      .single();

    if (weekError || !week) {
      return { success: false, error: 'Week not found' };
    }

    if (week.status !== 'finalized') {
      return { success: false, error: `Week must be finalized before submitting allocations. Current status: ${week.status}` };
    }

    // Get all quotes with awarded_volume for this week
    // Volume Lifecycle: awarded_volume (draft) → offered_volume (sent to supplier) → supplier_volume_accepted (response) → awarded_volume (final)
    const { data: quotesWithVolume, error: fetchError } = await supabase
      .from('quotes')
      .select('id, item_id, supplier_id, awarded_volume')
      .eq('week_id', weekId)
      .not('awarded_volume', 'is', null)
      .gt('awarded_volume', 0);

    console.log('Fetch Error:', fetchError);
    console.log('Quotes with volume:', quotesWithVolume?.length || 0);

    if (fetchError) {
      console.error('Error fetching quotes with awarded volume:', fetchError);
      return { success: false, error: `Database error: ${fetchError.message}` };
    }

    if (!quotesWithVolume || quotesWithVolume.length === 0) {
      console.error('No awarded volumes found for this week');
      return { success: false, error: 'No volume allocations found. Please allocate volume to at least one supplier before sending.' };
    }

    console.log(`Found ${quotesWithVolume.length} quotes with awarded volume`);

    // Copy awarded_volume to offered_volume using database function (bypasses schema cache)
    // This transitions volume from "draft award" to "offer sent to supplier"
    // RPC also resets supplier response fields to allow fresh responses
    const { error: updateError } = await supabase
      .rpc('submit_allocations_to_suppliers', { week_id_param: weekId });

    console.log('RPC error:', updateError);

    if (updateError) {
      console.error('Error calling submit_allocations_to_suppliers:', updateError);
      return { success: false, error: `Failed to update quotes: ${updateError.message}` };
    }

    console.log(`✓ Successfully called submit_allocations_to_suppliers RPC`);

    // Mark week as allocation submitted
    const { error } = await supabase
      .from('weeks')
      .update({
        allocation_submitted: true,
        allocation_submitted_at: new Date().toISOString(),
        allocation_submitted_by: userName,
      })
      .eq('id', weekId);

    if (error) {
      console.error('Error submitting allocations:', error);
      return { success: false, error: `Failed to mark week as submitted: ${error.message}` };
    }

    console.log('✓ Successfully submitted allocations');
    return { success: true, count: quotesWithVolume.length };
  } catch (error: any) {
    console.error('Error in submitAllocationsToSuppliers:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function fetchItemPricingCalculations(weekId: string): Promise<{
  id: string;
  week_id: string;
  item_id: string;
  avg_price: number;
  rebate: number;
  margin: number;
  freight: number;
  dlvd_price: number;
}[]> {
  const { data, error } = await supabase
    .from('item_pricing_calculations')
    .select('*')
    .eq('week_id', weekId);

  if (error) {
    console.error('Error fetching pricing calculations:', error);
    return [];
  }

  return data || [];
}

export async function fetchLastWeekDeliveredPrices(currentWeekNumber: number): Promise<Map<string, number>> {
  try {
    // Get the previous week (week_number - 1)
    const { data: lastWeek, error: weekError } = await supabase
      .from('weeks')
      .select('id, week_number')
      .eq('week_number', currentWeekNumber - 1)
      .eq('status', 'finalized')
      .maybeSingle();

    if (weekError || !lastWeek) {
      console.log('No previous finalized week found');
      return new Map();
    }

    // Get delivered prices from item_pricing_calculations for that week
    const { data: pricingData, error: pricingError } = await supabase
      .from('item_pricing_calculations')
      .select('item_id, dlvd_price')
      .eq('week_id', lastWeek.id)
      .not('dlvd_price', 'is', null);

    if (pricingError) {
      logger.error('Error fetching last week delivered prices:', pricingError);
      return new Map();
    }

    const priceMap = new Map<string, number>();
    pricingData?.forEach(p => {
      if (p.dlvd_price && p.dlvd_price > 0) {
        priceMap.set(p.item_id, p.dlvd_price);
      }
    });

    return priceMap;
  } catch (error) {
    logger.error('Error in fetchLastWeekDeliveredPrices:', error);
    return new Map();
  }
}

export async function updateItemPricingCalculation(
  weekId: string,
  itemId: string,
  calculations: {
    avg_price?: number;
    rebate?: number;
    margin?: number;
    freight?: number;
    dlvd_price?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('item_pricing_calculations')
    .upsert({
      week_id: weekId,
      item_id: itemId,
      ...calculations,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'week_id,item_id'
    });

  if (error) {
    console.error('Error updating pricing calculation:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }

  return { success: true };
}

export async function updateOfferedVolume(quoteId: string, offeredVolume: number): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      offered_volume: offeredVolume,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId);

  if (error) {
    console.error('Error updating offered volume:', error);
    return false;
  }

  return true;
}

export async function updateSupplierVolumeResponse(
  quoteId: string,
  response: 'accept' | 'update' | 'decline',
  acceptedVolume: number,
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('quotes')
    .update({
      supplier_volume_response: response,
      supplier_volume_accepted: acceptedVolume,
      supplier_volume_response_notes: notes,
      supplier_volume_approval: response === 'accept' ? 'accepted' : response === 'update' ? 'revised' : 'pending',
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId);

  if (error) {
    console.error('Error updating supplier volume response:', error);
    return false;
  }

  return true;
}

export async function fetchPrevious3WeekVolumeAverages(currentWeekNumber: number): Promise<Map<string, number>> {
  const { data: weeks, error: weeksError } = await supabase
    .from('weeks')
    .select('id, week_number')
    .gte('week_number', currentWeekNumber - 3)
    .lt('week_number', currentWeekNumber)
    .order('week_number', { ascending: false })
    .limit(3);

  if (weeksError || !weeks || weeks.length === 0) {
    console.error('Error fetching previous weeks:', weeksError);
    return new Map();
  }

  const weekIds = weeks.map(w => w.id);

  const { data: drafts, error: draftsError } = await supabase
    .from('draft_allocations')
    .select('item_id, drafted_volume')
    .in('week_id', weekIds);

  if (draftsError || !drafts) {
    console.error('Error fetching draft allocations:', draftsError);
    return new Map();
  }

  const volumesByItem = new Map<string, number[]>();

  drafts.forEach(draft => {
    if (!volumesByItem.has(draft.item_id)) {
      volumesByItem.set(draft.item_id, []);
    }
    if (draft.drafted_volume > 0) {
      volumesByItem.get(draft.item_id)!.push(draft.drafted_volume);
    }
  });

  const averages = new Map<string, number>();
  volumesByItem.forEach((volumes, itemId) => {
    if (volumes.length > 0) {
      const sum = volumes.reduce((acc, v) => acc + v, 0);
      const avg = Math.round(sum / volumes.length);
      averages.set(itemId, avg);
    }
  });

  return averages;
}

export async function closeVolumeLoop(weekId: string, userName: string): Promise<{ success: boolean; message: string; pendingCount?: number }> {
  try {
    const { data, error } = await supabase
      .rpc('close_volume_loop', {
        week_id_param: weekId,
        user_name: userName
      });

    if (error) {
      console.error('Error calling close_volume_loop:', error);
      return { success: false, message: `Failed to close loop: ${error.message}` };
    }

    if (!data || data.length === 0) {
      return { success: false, message: 'No response from database function' };
    }

    const result = data[0];
    return {
      success: result.success,
      message: result.message,
      pendingCount: result.pending_count
    };
  } catch (error: any) {
    console.error('Error in closeVolumeLoop:', error);
    return { success: false, message: error.message || 'Unknown error occurred' };
  }
}
