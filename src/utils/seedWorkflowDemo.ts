import { supabase } from './supabase';
import { fetchSuppliers, fetchItems, fetchWeeks } from './database';

/**
 * Seeds a complete workflow demo with 5 shippers who have already submitted pricing
 * This allows testing the award volume and acceptance workflow immediately
 */
export async function seedWorkflowDemo(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🌱 Seeding workflow demo with 5 shippers and completed pricing...');

    // Step 1: Clear existing data
    await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('item_pricing_calculations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('week_item_volumes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
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
    if (!suppliers || suppliers.length < 5) {
      await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('suppliers').insert([
        { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
        { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
        { name: 'Organic Growers', email: 'supplier3@organicgrowers.com' },
        { name: 'Valley Fresh', email: 'supplier4@valleyfresh.com' },
        { name: 'Premium Produce', email: 'supplier5@premiumproduce.com' },
      ]);
      suppliers = (await supabase.from('suppliers').select('*')).data || [];
    }

    // Step 3: Find or create an open week
    let { data: openWeek } = await supabase
      .from('weeks')
      .select('*')
      .eq('status', 'open')
      .order('week_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openWeek) {
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
      openWeek = newWeek;
    }

    // Step 4: Use Strawberry 4×2 lb as the main item
    const strawberryItem = items.find(i => i.name === 'Strawberry' && i.pack_size === '4×2 lb') || items[0];
    if (!strawberryItem) {
      return { success: false, message: 'No items found' };
    }

    // Step 5: Create quotes with pricing already completed for all 5 suppliers
    // Each supplier has gone through the pricing negotiation loop
    const pricingData = [
      {
        supplier: suppliers[0], // Fresh Farms Inc
        supplier_fob: 12.00,
        supplier_dlvd: 15.50,
        rf_counter_fob: 11.75,
        supplier_response: 'accept' as const,
        supplier_revised_fob: null,
        rf_final_fob: 11.75,
      },
      {
        supplier: suppliers[1], // Berry Best Co
        supplier_fob: 12.50,
        supplier_dlvd: 16.00,
        rf_counter_fob: 12.25,
        supplier_response: 'revise' as const,
        supplier_revised_fob: 12.30,
        rf_final_fob: 12.30,
      },
      {
        supplier: suppliers[2], // Organic Growers
        supplier_fob: 13.00,
        supplier_dlvd: 16.50,
        rf_counter_fob: null,
        supplier_response: 'accept' as const,
        supplier_revised_fob: null,
        rf_final_fob: 13.00,
      },
      {
        supplier: suppliers[3], // Valley Fresh
        supplier_fob: 11.75,
        supplier_dlvd: 15.25,
        rf_counter_fob: 11.50,
        supplier_response: 'accept' as const,
        supplier_revised_fob: null,
        rf_final_fob: 11.50,
      },
      {
        supplier: suppliers[4], // Premium Produce
        supplier_fob: 12.75,
        supplier_dlvd: 16.25,
        rf_counter_fob: 12.50,
        supplier_response: 'revise' as const,
        supplier_revised_fob: 12.60,
        rf_final_fob: 12.60,
      },
    ];

    // Insert quotes with completed pricing
    for (const quoteData of pricingData) {
      const { error } = await supabase
        .from('quotes')
        .upsert({
          week_id: openWeek.id,
          item_id: strawberryItem.id,
          supplier_id: quoteData.supplier.id,
          supplier_fob: quoteData.supplier_fob,
          supplier_dlvd: quoteData.supplier_dlvd,
          rf_counter_fob: quoteData.rf_counter_fob,
          supplier_response: quoteData.supplier_response,
          supplier_revised_fob: quoteData.supplier_revised_fob,
          rf_final_fob: quoteData.rf_final_fob,
          // No volume allocation yet - ready for award volume step
          awarded_volume: null,
          offered_volume: null,
          supplier_volume_response: null,
          supplier_volume_accepted: null,
        }, {
          onConflict: 'week_id,item_id,supplier_id',
        });

      if (error) {
        console.error(`Error creating quote for ${quoteData.supplier.name}:`, error);
      }
    }

    // Step 6: Set volume needed
    await supabase.from('week_item_volumes').upsert({
      week_id: openWeek.id,
      item_id: strawberryItem.id,
      volume_needed: 1000,
    }, {
      onConflict: 'week_id,item_id',
    });

    // Step 7: Create internal pricing calculations
    // Calculate weighted average FOB from finalized prices
    const finalizedPrices = pricingData.map(p => p.rf_final_fob).filter(p => p !== null) as number[];
    const avgFOB = finalizedPrices.reduce((sum, p) => sum + p, 0) / finalizedPrices.length;

    await supabase.from('item_pricing_calculations').upsert({
      week_id: openWeek.id,
      item_id: strawberryItem.id,
      avg_price: avgFOB,
      rebate: 0.80,
      freight: 1.75,
      margin: 1.50, // Profit per case
      dlvd_price: avgFOB + 0.80 + 1.75 + 1.50, // Our Avg Cost + Profit Per Case
    }, {
      onConflict: 'week_id,item_id',
    });

    console.log('✅ Workflow demo seeded successfully!');
    console.log(`  - Week ${openWeek.week_number} is open`);
    console.log(`  - 5 suppliers with completed pricing`);
    console.log(`  - Ready for award volume and acceptance testing`);

    return {
      success: true,
      message: `Workflow demo ready! Week ${openWeek.week_number} has 5 shippers with completed pricing. You can now finalize pricing and proceed to award volume.`,
    };
  } catch (error: any) {
    console.error('❌ Error seeding workflow demo:', error);
    return {
      success: false,
      message: `Failed to create workflow demo: ${error?.message || 'Unknown error'}`,
    };
  }
}

