import { supabase } from './supabase';
import { fetchSuppliers, fetchItems, fetchWeeks } from './database';
import { logger } from './logger';

/**
 * Seeds the database with suppliers, items, weeks, and sample quotes
 * This can be called from the browser console or added as a button in the app
 */
export async function seedDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    logger.debug('🌱 Starting database seed...');
    
    // Check if database tables exist
    const { data: tablesCheck, error: tablesError } = await supabase
      .from('suppliers')
      .select('id')
      .limit(1);
    
    if (tablesError && tablesError.message.includes('does not exist')) {
      throw new Error('Database tables do not exist. Please run the database migrations first in Supabase SQL Editor.');
    }

    // 1. Insert Suppliers
    logger.debug('📦 Adding suppliers...');
    // Try to insert suppliers - if updated_at column doesn't exist, we'll handle it
    const supplierData = [
      { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
      { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
      { name: 'Organic Growers', email: 'supplier3@organicgrowers.com' },
      { name: 'Valley Fresh', email: 'supplier4@valleyfresh.com' },
      { name: 'Premium Produce', email: 'supplier5@premiumproduce.com' }
    ];
    
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .upsert(supplierData, { onConflict: 'email' })
      .select();

    if (suppliersError) throw new Error(`Failed to add suppliers: ${suppliersError.message}`);
    if (!suppliers || suppliers.length === 0) {
      throw new Error('Failed to add suppliers: No suppliers returned from database');
    }
    logger.debug(`✅ Added ${suppliers.length} suppliers`);

    // 2. Insert Items (check if they exist first to avoid conflicts)
    logger.debug('📦 Adding items...');
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
          logger.warn(`Failed to insert item ${item.name} ${item.pack_size}:`, error.message);
        } else if (newItem) {
          insertedItems.push(newItem);
        }
      } else {
        insertedItems.push(existing);
      }
    }
    
    // Fetch all items
    const { data: fetchedItems } = await supabase
      .from('items')
      .select('*')
      .order('display_order');
    
    const items = fetchedItems || [];
    logger.debug(`✅ Items ready: ${items.length} total`);

    // 3. Insert Weeks (check if they exist first)
    logger.debug('📅 Adding weeks...');
    const weeksToInsert = [
      { week_number: 1, start_date: '2025-01-01', end_date: '2025-01-07', status: 'closed' },
      { week_number: 2, start_date: '2025-01-08', end_date: '2025-01-14', status: 'closed' },
      { week_number: 3, start_date: '2025-01-15', end_date: '2025-01-21', status: 'closed' },
      { week_number: 4, start_date: '2025-01-22', end_date: '2025-01-28', status: 'closed' },
      { week_number: 5, start_date: '2025-01-29', end_date: '2025-02-04', status: 'closed' },
      { week_number: 6, start_date: '2025-02-05', end_date: '2025-02-11', status: 'open' }
    ];
    
    // Insert weeks one by one, with better error handling
    let weeksInserted = 0;
    for (const week of weeksToInsert) {
      const { data: existing } = await supabase
        .from('weeks')
        .select('id')
        .eq('week_number', week.week_number)
        .maybeSingle();
      
      if (!existing) {
        const { data: newWeek, error } = await supabase
          .from('weeks')
          .insert(week)
          .select()
          .single();
        
        if (error) {
          logger.error(`Failed to insert week ${week.week_number}:`, error.message);
          throw new Error(`Failed to insert week ${week.week_number}: ${error.message}`);
        } else if (newWeek) {
          weeksInserted++;
          logger.debug(`✅ Inserted week ${week.week_number}`);
        }
      } else {
        logger.debug(`⏭️ Week ${week.week_number} already exists`);
      }
    }
    
    // Fetch all weeks
    const { data: allWeeks, error: fetchError } = await supabase
      .from('weeks')
      .select('*')
      .order('week_number');
    
    if (fetchError) {
      logger.error('Failed to fetch weeks:', fetchError.message);
      throw new Error(`Failed to fetch weeks: ${fetchError.message}`);
    }
    
    const weeks = allWeeks || [];
    logger.debug(`✅ Weeks ready: ${weeks.length} total (inserted ${weeksInserted} new)`);
    
    if (weeks.length === 0) {
      throw new Error('No weeks found after insertion. Please check database schema.');
    }

    // 4. Get all data for quotes
    const allSuppliers = suppliers;
    const allItems = items;
    const closedWeeks = weeks.filter(w => w.status === 'closed');

    // 5. Insert Quotes for closed weeks with complete workflow data
    logger.debug('💰 Adding complete workflow quotes for ALL suppliers across ALL closed weeks...');
    let quoteCount = 0;
    const quotePromises = [];

    // Base prices vary by item category for realism
    const getBasePrice = (item: typeof allItems[0]) => {
      const categoryBase: Record<string, number> = {
        strawberry: 16.50,
        blueberry: 18.00,
        blackberry: 20.00,
        raspberry: 22.00
      };
      return categoryBase[item.category] || 17.00;
    };

    // Ensure we process ALL suppliers for ALL items in ALL closed weeks
    // This creates complete historical data for AI and analytics
    for (const week of closedWeeks) {
      // Add some week-over-week variation (trending slightly up over time)
      const weekMultiplier = 1 + (week.week_number - 1) * 0.02; // Slight price increase over weeks
      
      // Process EVERY supplier for EVERY item in this week
      for (const supplier of allSuppliers) {
        // Each supplier has a "personality" - some are more competitive
        // This creates realistic price variation between suppliers
        const supplierIndex = allSuppliers.indexOf(supplier);
        const competitiveness = 0.95 + (supplierIndex % 3) * 0.05; // 0.95, 1.00, or 1.05
        
        for (const item of allItems) {
          const basePrice = getBasePrice(item) * weekMultiplier;
          
          // Step 1: Supplier submits initial quote (supplier_fob)
          // Add realistic variation: ±$2 from base price
          const supplierFob = Math.round((basePrice * competitiveness + (Math.random() - 0.5) * 2) * 100) / 100;
          const supplierDlvd = Math.round((supplierFob * 1.15 + (Math.random() - 0.5) * 1) * 100) / 100;
          
          // Step 2: RF sends counter offer (rf_counter_fob) - typically 7-10% lower
          const counterDiscount = 0.07 + Math.random() * 0.03; // 7-10% discount
          const rfCounterFob = Math.round((supplierFob * (1 - counterDiscount)) * 100) / 100;
          
          // Step 3: Supplier responds (70% accept, 30% revise) - realistic negotiation pattern
          const response = Math.random() < 0.7 ? 'accept' : 'revise';
          
          // Step 4: If revise, supplier provides revised_fob (usually between counter and original)
          let revisedFob = null;
          if (response === 'revise') {
            const reviseRatio = 0.3 + Math.random() * 0.4; // 30-70% of the way from counter to original
            revisedFob = Math.round((rfCounterFob + (supplierFob - rfCounterFob) * reviseRatio) * 100) / 100;
          }
          
          // Step 5: RF finalizes price (rf_final_fob)
          // This is the price that gets used in analytics and AI
          let rfFinalFob: number;
          if (response === 'accept') {
            // If accepted, RF might adjust slightly from counter (usually within $0.20)
            rfFinalFob = Math.round((rfCounterFob + (Math.random() - 0.5) * 0.2) * 100) / 100;
          } else {
            // If revised, RF might accept revised or negotiate down slightly (98-100% of revised)
            const negotiation = revisedFob! * (0.98 + Math.random() * 0.02);
            rfFinalFob = Math.round(negotiation * 100) / 100;
          }

          // Create quote with complete workflow data
          // This ensures AI and analytics have access to:
          // - Initial supplier prices (for trend analysis)
          // - RF counters (for negotiation patterns)
          // - Supplier revisions (for response patterns)
          // - Final prices (for actual historical averages)
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
    // Process in batches to avoid overwhelming the database and ensure all are processed
    const batchSize = 50;
    let processed = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < quotePromises.length; i += batchSize) {
      const batch = quotePromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      const batchErrors = batchResults.filter(r => r.error).length;
      totalErrors += batchErrors;
      if (batchErrors > 0) {
        logger.warn(`⚠️ ${batchErrors} quotes failed in batch ${Math.floor(i / batchSize) + 1}`);
      }
      processed += batch.length;
      logger.debug(`Processed ${processed}/${quotePromises.length} quotes...`);
    }
    
    logger.debug(`✅ Added ${quoteCount} complete workflow quotes`);
    logger.debug(`   - ${closedWeeks.length} closed weeks`);
    logger.debug(`   - ${allSuppliers.length} suppliers`);
    logger.debug(`   - ${allItems.length} items`);
    logger.debug(`   - Expected: ${closedWeeks.length * allSuppliers.length * allItems.length} quotes`);
    logger.debug(`   - Errors: ${totalErrors}`);

    // Verify data was actually inserted
    const { data: verifySuppliers } = await supabase.from('suppliers').select('id');
    const { data: verifyItems } = await supabase.from('items').select('id');
    const { data: verifyWeeks } = await supabase.from('weeks').select('id').eq('status', 'closed');
    const { data: verifyQuotes } = await supabase.from('quotes').select('id');

    const verifyMessage = `Verification: ${verifySuppliers?.length || 0} suppliers, ${verifyItems?.length || 0} items, ${verifyWeeks?.length || 0} closed weeks, ${verifyQuotes?.length || 0} quotes in database`;

    return {
      success: true,
      message: `Successfully seeded database: ${suppliers.length} suppliers, ${items.length} items, ${weeks.length} weeks, ${quoteCount} quotes. ${verifyMessage}`
    };
  } catch (error: any) {
    logger.error('Seed error:', error);
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

