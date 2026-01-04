import { supabase } from './supabase';
import { fetchSuppliers, fetchItems, fetchWeeks } from './database';

/**
 * Seeds the database with suppliers, items, weeks, and sample quotes
 * This can be called from the browser console or added as a button in the app
 */
export async function seedDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🌱 Starting database seed...');

    // 1. Insert Suppliers
    console.log('📦 Adding suppliers...');
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .upsert([
        { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
        { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
        { name: 'Organic Growers', email: 'supplier3@organicgrowers.com' },
        { name: 'Valley Fresh', email: 'supplier4@valleyfresh.com' },
        { name: 'Premium Produce', email: 'supplier5@premiumproduce.com' }
      ], { onConflict: 'email' })
      .select();

    if (suppliersError) throw new Error(`Failed to add suppliers: ${suppliersError.message}`);
    console.log(`✅ Added ${suppliers.length} suppliers`);

    // 2. Insert Items (check if they exist first to avoid conflicts)
    console.log('📦 Adding items...');
    const itemsToInsert = [
      { name: 'Strawberry', pack_size: '4×2 lb', category: 'strawberry', organic_flag: 'CONV', display_order: 1 },
      { name: 'Strawberry', pack_size: '8×1 lb', category: 'strawberry', organic_flag: 'ORG', display_order: 2 },
      { name: 'Blueberry', pack_size: '18 oz', category: 'blueberry', organic_flag: 'CONV', display_order: 3 },
      { name: 'Blueberry', pack_size: 'Pint', category: 'blueberry', organic_flag: 'ORG', display_order: 4 },
      { name: 'Blackberry', pack_size: '12×6 oz', category: 'blackberry', organic_flag: 'CONV', display_order: 5 },
      { name: 'Blackberry', pack_size: '12×6 oz', category: 'blackberry', organic_flag: 'ORG', display_order: 6 },
      { name: 'Raspberry', pack_size: '12×6 oz', category: 'raspberry', organic_flag: 'CONV', display_order: 7 },
      { name: 'Raspberry', pack_size: '12×6 oz', category: 'raspberry', organic_flag: 'ORG', display_order: 8 }
    ];
    
    // Insert items one by one, ignoring conflicts
    const insertedItems = [];
    for (const item of itemsToInsert) {
      const { data: existing } = await supabase
        .from('items')
        .select('id')
        .eq('name', item.name)
        .eq('pack_size', item.pack_size)
        .maybeSingle();
      
      if (!existing) {
        const { data: newItem, error } = await supabase
          .from('items')
          .insert(item)
          .select()
          .single();
        
        if (error && !error.message.includes('duplicate')) {
          console.warn(`Failed to insert item ${item.name} ${item.pack_size}:`, error.message);
        } else if (newItem) {
          insertedItems.push(newItem);
        }
      } else {
        insertedItems.push(existing);
      }
    }
    
    // Fetch all items
    const { data: allItems } = await supabase
      .from('items')
      .select('*')
      .order('display_order');
    
    const items = allItems || [];
    console.log(`✅ Items ready: ${items.length} total`);

    // 3. Insert Weeks (check if they exist first)
    console.log('📅 Adding weeks...');
    const weeksToInsert = [
      { week_number: 1, start_date: '2025-01-01', end_date: '2025-01-07', status: 'closed', allocation_submitted: true, pricing_finalized: true },
      { week_number: 2, start_date: '2025-01-08', end_date: '2025-01-14', status: 'closed', allocation_submitted: true, pricing_finalized: true },
      { week_number: 3, start_date: '2025-01-15', end_date: '2025-01-21', status: 'closed', allocation_submitted: true, pricing_finalized: true },
      { week_number: 4, start_date: '2025-01-22', end_date: '2025-01-28', status: 'closed', allocation_submitted: true, pricing_finalized: true },
      { week_number: 5, start_date: '2025-01-29', end_date: '2025-02-04', status: 'closed', allocation_submitted: true, pricing_finalized: true },
      { week_number: 6, start_date: '2025-02-05', end_date: '2025-02-11', status: 'open', allocation_submitted: false, pricing_finalized: false }
    ];
    
    // Insert weeks one by one, ignoring conflicts
    for (const week of weeksToInsert) {
      const { data: existing } = await supabase
        .from('weeks')
        .select('id')
        .eq('week_number', week.week_number)
        .maybeSingle();
      
      if (!existing) {
        const { error } = await supabase
          .from('weeks')
          .insert(week);
        
        if (error && !error.message.includes('duplicate')) {
          console.warn(`Failed to insert week ${week.week_number}:`, error.message);
        }
      }
    }
    
    // Fetch all weeks
    const { data: allWeeks } = await supabase
      .from('weeks')
      .select('*')
      .order('week_number');
    
    const weeks = allWeeks || [];
    console.log(`✅ Weeks ready: ${weeks.length} total`);

    // 4. Get all data for quotes
    const allSuppliers = suppliers;
    const allItems = items;
    const closedWeeks = weeks.filter(w => w.status === 'closed');

    // 5. Insert Quotes for closed weeks
    console.log('💰 Adding sample quotes...');
    let quoteCount = 0;
    const quotePromises = [];

    for (const week of closedWeeks) {
      for (const supplier of allSuppliers) {
        for (const item of allItems) {
          const supplierFob = Math.round((15 + Math.random() * 3) * 100) / 100;
          const supplierDlvd = Math.round((18 + Math.random() * 3) * 100) / 100;
          const rfCounterFob = Math.round((14.5 + Math.random() * 2.5) * 100) / 100;
          const response = Math.random() > 0.5 ? 'accept' : 'revise';
          const revisedFob = response === 'revise' ? Math.round((14.75 + Math.random() * 2) * 100) / 100 : null;
          const rfFinalFob = Math.round((14.5 + Math.random() * 2) * 100) / 100;

          quotePromises.push(
            supabase
              .from('quotes')
              .upsert({
                week_id: week.id,
                item_id: item.id,
                supplier_id: supplier.id,
                supplier_fob: supplierFob,
                supplier_dlvd: supplierDlvd,
                rf_counter_fob: rfCounterFob,
                supplier_response: response,
                supplier_revised_fob: revisedFob,
                rf_final_fob: rfFinalFob
              }, { onConflict: 'week_id,item_id,supplier_id' })
              .then(({ error }) => {
                if (!error) quoteCount++;
                return { error };
              })
          );
        }
      }
    }

    // Wait for all quotes to be inserted
    await Promise.all(quotePromises);
    console.log(`✅ Added ${quoteCount} quotes`);

    return {
      success: true,
      message: `Successfully seeded database: ${suppliers.length} suppliers, ${items.length} items, ${weeks.length} weeks, ${quoteCount} quotes`
    };
  } catch (error: any) {
    console.error('Seed error:', error);
    return {
      success: false,
      message: `Failed to seed database: ${error.message}`
    };
  }
}

// Make it available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).seedDatabase = seedDatabase;
}

