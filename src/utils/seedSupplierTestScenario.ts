import { supabase } from './supabase';
import { fetchSuppliers, fetchItems, fetchWeeks, createNewWeek } from './database';

export async function seedSupplierTestScenario(): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Clear all existing data
    await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('weeks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('item_pricing_calculations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('week_item_volumes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('week_item_internal_costs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Clear localStorage sessions so suppliers need to log in fresh (prevents auto-selection warning)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rf_pricing_session');
    }

    // Step 2: Ensure we have items and suppliers
    let { data: items } = await supabase.from('items').select('*');
    if (!items || items.length === 0) {
      await supabase.from('items').insert([
        { name: 'Strawberry', pack_size: '4×2 lb', category: 'strawberry', organic_flag: 'CONV', display_order: 1 },
        { name: 'Strawberry', pack_size: '8×1 lb', category: 'strawberry', organic_flag: 'ORG', display_order: 2 },
        { name: 'Blueberry', pack_size: '18 oz', category: 'blueberry', organic_flag: 'CONV', display_order: 3 },
      ]);
      items = (await supabase.from('items').select('*')).data || [];
    }

    let { data: suppliers } = await supabase.from('suppliers').select('*');
    if (!suppliers || suppliers.length < 2) {
      // Clear and recreate suppliers
      await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('suppliers').insert([
        { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
        { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
      ]);
      suppliers = (await supabase.from('suppliers').select('*')).data || [];
    }

    // Use first 2 suppliers
    const supplier1 = suppliers[0];
    const supplier2 = suppliers[1];
    if (!supplier1 || !supplier2) {
      return { success: false, message: 'Need at least 2 suppliers' };
    }

    // Step 3: Create a fresh open week
    const today = new Date();
    const weekNumber = Math.floor((today.getTime() - new Date(2025, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    const { data: newWeek, error: weekError } = await supabase
      .from('weeks')
      .insert({
        week_number: weekNumber,
        start_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).toISOString().split('T')[0],
        end_date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6).toISOString().split('T')[0],
        status: 'open',
      })
      .select()
      .single();

    if (weekError || !newWeek) {
      return { success: false, message: `Failed to create week: ${weekError?.message}` };
    }

    // Step 4: Create quotes with pricing already finalized (ready for volume allocation)
    const strawberryItem = items.find(i => i.name === 'Strawberry' && i.pack_size === '4×2 lb');
    if (!strawberryItem) {
      return { success: false, message: 'Strawberry item not found' };
    }

    // Supplier 1: Fresh Farms Inc - Pricing NOT submitted yet (so they can test submitting)
    const { error: quote1Error } = await supabase.from('quotes').insert({
      week_id: newWeek.id,
      item_id: strawberryItem.id,
      supplier_id: supplier1.id,
      supplier_fob: null, // Empty so supplier can submit
      supplier_dlvd: null, // Empty so supplier can submit
      rf_counter_fob: null,
      supplier_response: null,
      supplier_revised_fob: null,
      rf_final_fob: null,
      // No volume allocation yet
      awarded_volume: null,
      offered_volume: null,
      supplier_volume_response: null,
      supplier_volume_accepted: null,
    });

    if (quote1Error) {
      console.error('Error creating quote 1:', quote1Error);
    }

    // Supplier 2: Berry Best Co - Pricing NOT submitted yet (so they can test submitting)
    const { error: quote2Error } = await supabase.from('quotes').insert({
      week_id: newWeek.id,
      item_id: strawberryItem.id,
      supplier_id: supplier2.id,
      supplier_fob: null, // Empty so supplier can submit
      supplier_dlvd: null, // Empty so supplier can submit
      rf_counter_fob: null,
      supplier_response: null,
      supplier_revised_fob: null,
      rf_final_fob: null,
      // No volume allocation yet
      awarded_volume: null,
      offered_volume: null,
      supplier_volume_response: null,
      supplier_volume_accepted: null,
    });

    if (quote2Error) {
      console.error('Error creating quote 2:', quote2Error);
    }

    // Step 5: Set volume needed
    await supabase.from('week_item_volumes').upsert({
      week_id: newWeek.id,
      item_id: strawberryItem.id,
      volume_needed: 800,
    });

    // Step 6: Create internal pricing calculations
    await supabase.from('item_pricing_calculations').upsert({
      week_id: newWeek.id,
      item_id: strawberryItem.id,
      avg_price: 12.25, // Weighted average of 12.00 and 12.50
      rebate: 0.80,
      freight: 1.75,
      margin: 1.50, // Profit per case
      dlvd_price: 14.55, // 12.25 + 0.80 + 1.75 + 1.50
    });

    return {
      success: true,
      message: `Fresh demo created! Week ${newWeek.week_number} is open with 2 suppliers (Fresh Farms Inc & Berry Best Co) ready to test. Pricing is finalized. You can now allocate volume and test the supplier response loop.`,
    };
  } catch (error: any) {
    console.error('Error seeding supplier test scenario:', error);
    return {
      success: false,
      message: `Failed to create test scenario: ${error?.message || 'Unknown error'}`,
    };
  }
}

