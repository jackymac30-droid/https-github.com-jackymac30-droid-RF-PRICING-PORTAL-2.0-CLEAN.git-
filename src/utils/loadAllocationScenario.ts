import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Loads a realistic test scenario for Allocation AI testing
 * Creates: 1 SKU (2 lb Strawberries) with 5 finalized shipper quotes
 * 
 * This is a DEV/TEST utility - does not affect production logic
 * To remove: Call removeAllocationScenario() or delete the test week manually
 */
export async function loadAllocationScenario(): Promise<{ success: boolean; message: string; weekId?: string }> {
  try {
    logger.debug('🎯 Loading Allocation AI test scenario...');

    // 1. Ensure 5 suppliers exist
    // Note: Do NOT include updated_at - let the database trigger handle it
    const suppliersData = [
      { name: 'Fresh Farms Inc', email: 'supplier1@freshfarms.com' },
      { name: 'Berry Best Co', email: 'supplier2@berrybest.com' },
      { name: 'Organic Growers', email: 'supplier3@organicgrowers.com' },
      { name: 'Valley Fresh', email: 'supplier4@valleyfresh.com' },
      { name: 'Premium Produce', email: 'supplier5@premiumproduce.com' }
    ];

    // Upsert suppliers one by one to handle conflicts gracefully
    const suppliers = [];
    for (const supplierData of suppliersData) {
      const { data: existing } = await supabase
        .from('suppliers')
        .select('*')
        .eq('email', supplierData.email)
        .maybeSingle();

      if (existing) {
        suppliers.push(existing);
      } else {
        const { data: newSupplier, error: insertError } = await supabase
          .from('suppliers')
          .insert(supplierData)
          .select()
          .single();

        if (insertError) {
          // If insert fails, try to fetch existing
          const { data: fetched } = await supabase
            .from('suppliers')
            .select('*')
            .eq('email', supplierData.email)
            .maybeSingle();
          if (fetched) {
            suppliers.push(fetched);
          } else {
            throw new Error(`Failed to ensure supplier ${supplierData.name}: ${insertError.message}`);
          }
        } else if (newSupplier) {
          suppliers.push(newSupplier);
        }
      }
    }

    if (suppliers.length < 5) {
      throw new Error(`Failed to ensure 5 suppliers exist. Only found ${suppliers.length}`);
    }
    logger.debug(`✅ Ensured ${suppliers.length} suppliers exist`);

    // 2. Fetch all items (all SKUs)
    const { data: allItems, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .order('display_order', { ascending: true });

    if (itemsError) throw new Error(`Failed to fetch items: ${itemsError.message}`);
    if (!allItems || allItems.length === 0) {
      throw new Error('No items found in database. Please seed items first.');
    }
    logger.debug(`✅ Found ${allItems.length} items to price`);

    // 3. Create or find test week (status: finalized)
    const testWeekNumber = 999; // Use high number to avoid conflicts
    const { data: existingWeek } = await supabase
      .from('weeks')
      .select('*')
      .eq('week_number', testWeekNumber)
      .maybeSingle();

    let testWeek;
    if (existingWeek) {
      // Update to finalized status if not already
      const { data: updatedWeek, error: updateError } = await supabase
        .from('weeks')
        .update({ status: 'finalized' })
        .eq('id', existingWeek.id)
        .select()
        .single();

      if (updateError) throw new Error(`Failed to update week status: ${updateError.message}`);
      testWeek = updatedWeek;
      logger.debug('✅ Found existing test week, updated to finalized');
    } else {
      const { data: newWeek, error: weekError } = await supabase
        .from('weeks')
        .insert({
          week_number: testWeekNumber,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'finalized'
        })
        .select()
        .single();

      if (weekError) throw new Error(`Failed to create test week: ${weekError.message}`);
      testWeek = newWeek;
      logger.debug('✅ Created test week (finalized)');
    }

    // 4. Create pricing for ALL suppliers × ALL items
    // Each supplier has different pricing strategies to make allocation decisions meaningful
    // Pricing varies by supplier and item to create realistic scenarios
    
    // Base pricing patterns per supplier (applied to all items with variation)
    const supplierPricingPatterns = [
      { baseMultiplier: 1.0, freight: 1.75, rebate: 0.80, name: 'Competitive' }, // Fresh Farms - competitive
      { baseMultiplier: 1.03, freight: 1.80, rebate: 0.85, name: 'Mid-range' }, // Berry Best - mid-range
      { baseMultiplier: 1.06, freight: 1.70, rebate: 0.90, name: 'Quality' }, // Organic Growers - higher quality
      { baseMultiplier: 0.97, freight: 1.85, rebate: 0.75, name: 'Cheapest' }, // Valley Fresh - cheapest
      { baseMultiplier: 1.08, freight: 1.65, rebate: 0.95, name: 'Premium' }  // Premium Produce - premium
    ];

    logger.debug(`💰 Creating pricing for ${suppliers.length} suppliers × ${allItems.length} items...`);
    
    let quotesCreated = 0;
    let quotesUpdated = 0;
    let quotesErrors = 0;
    
    for (const item of allItems) {
      // Base price varies by item (strawberries ~$16, blueberries ~$18, etc.)
      // Use item name to determine base price
      let basePrice = 16.00; // Default
      if (item.name.toLowerCase().includes('strawberry')) basePrice = 16.00;
      else if (item.name.toLowerCase().includes('blueberry')) basePrice = 18.00;
      else if (item.name.toLowerCase().includes('raspberry')) basePrice = 20.00;
      else if (item.name.toLowerCase().includes('blackberry')) basePrice = 19.00;
      else basePrice = 17.00; // Generic fruit
      
      // Add small random variation per item to make it realistic
      const itemVariation = (Math.random() * 0.5 - 0.25); // ±$0.25 variation
      const itemBasePrice = basePrice + itemVariation;
      
      for (let supplierIndex = 0; supplierIndex < suppliers.length; supplierIndex++) {
        const supplier = suppliers[supplierIndex];
        const pattern = supplierPricingPatterns[supplierIndex];
        
        // Calculate final FOB price with supplier pattern
        const rfFinalFob = itemBasePrice * pattern.baseMultiplier;
        const freight = pattern.freight;
        const rebate = pattern.rebate;
        
        // Check if quote exists
        const { data: existingQuote } = await supabase
          .from('quotes')
          .select('id')
          .eq('week_id', testWeek.id)
          .eq('item_id', item.id)
          .eq('supplier_id', supplier.id)
          .maybeSingle();

        const quotePayload = {
          week_id: testWeek.id,
          item_id: item.id,
          supplier_id: supplier.id,
          supplier_fob: rfFinalFob + 1.50, // Initial was higher
          rf_counter_fob: rfFinalFob + 0.30, // RF countered
          supplier_response: 'accept', // All accepted
          supplier_revised_fob: null,
          rf_final_fob: rfFinalFob, // Finalized price
          supplier_dlvd: (rfFinalFob + freight) * 1.10 // Estimated delivered
        };

        if (existingQuote) {
          const { error: updateError } = await supabase
            .from('quotes')
            .update(quotePayload)
            .eq('id', existingQuote.id);
          if (updateError) {
            logger.warn(`Failed to update quote for ${supplier.name} - ${item.name}: ${updateError.message}`);
            quotesErrors++;
          } else {
            quotesUpdated++;
            logger.debug(`✅ Updated quote: ${supplier.name} - ${item.name} @ $${rfFinalFob.toFixed(2)}`);
          }
        } else {
          const { error: insertError } = await supabase
            .from('quotes')
            .insert(quotePayload);
          if (insertError) {
            logger.warn(`Failed to insert quote for ${supplier.name} - ${item.name}: ${insertError.message}`);
            quotesErrors++;
          } else {
            quotesCreated++;
            logger.debug(`✅ Created quote: ${supplier.name} - ${item.name} @ $${rfFinalFob.toFixed(2)}`);
          }
        }
      }
    }

    // All quotes are created/updated in the loop above (awaiting each one)
    logger.debug(`✅ Quote creation complete: ${quotesCreated} created, ${quotesUpdated} updated, ${quotesErrors} errors`);
    logger.debug(`✅ Total: ${quotesCreated + quotesUpdated} quotes for ${suppliers.length} suppliers × ${allItems.length} items`);

    // 5. Set up pricing calculations (rebate, freight, dlvd_price) for ALL items
    // Calculate averages per item across all suppliers
    logger.debug('💰 Setting up pricing calculations for all items...');
    
    const pricingPromises = allItems.map(async (item) => {
      // Get all quotes for this item to calculate averages
      const { data: itemQuotes } = await supabase
        .from('quotes')
        .select('rf_final_fob')
        .eq('week_id', testWeek.id)
        .eq('item_id', item.id)
        .not('rf_final_fob', 'is', null);

      if (!itemQuotes || itemQuotes.length === 0) return;

      const avgFob = itemQuotes.reduce((sum, q) => sum + (q.rf_final_fob || 0), 0) / itemQuotes.length;
      const avgFreight = supplierPricingPatterns.reduce((sum, p) => sum + p.freight, 0) / supplierPricingPatterns.length;
      const avgRebate = supplierPricingPatterns.reduce((sum, p) => sum + p.rebate, 0) / supplierPricingPatterns.length;
      const dlvdPrice = avgFob + avgFreight - avgRebate + 2.50; // Add margin

      const { data: existingPricing } = await supabase
        .from('item_pricing_calculations')
        .select('id')
        .eq('week_id', testWeek.id)
        .eq('item_id', item.id)
        .maybeSingle();

      const pricingPayload = {
        week_id: testWeek.id,
        item_id: item.id,
        avg_price: avgFob,
        rebate: avgRebate,
        freight: avgFreight,
        margin: 2.50,
        dlvd_price: dlvdPrice
      };

      if (existingPricing) {
        await supabase
          .from('item_pricing_calculations')
          .update(pricingPayload)
          .eq('id', existingPricing.id);
      } else {
        await supabase
          .from('item_pricing_calculations')
          .insert(pricingPayload);
      }
    });

    await Promise.all(pricingPromises);
    logger.debug(`✅ Set up pricing calculations for ${allItems.length} items`);

    // 6. Set initial volume needs for ALL items (user can change these)
    logger.debug('📦 Setting initial volume needs for all items...');
    
    const volumePromises = allItems.map(async (item) => {
      const { data: existingVolume } = await supabase
        .from('week_item_volumes')
        .select('id')
        .eq('week_id', testWeek.id)
        .eq('item_id', item.id)
        .maybeSingle();

      // Vary volume needs by item type
      let volumeNeeded = 2000; // Default
      if (item.name.toLowerCase().includes('strawberry')) volumeNeeded = 2000;
      else if (item.name.toLowerCase().includes('blueberry')) volumeNeeded = 1500;
      else if (item.name.toLowerCase().includes('raspberry')) volumeNeeded = 1200;
      else if (item.name.toLowerCase().includes('blackberry')) volumeNeeded = 1000;
      else volumeNeeded = 1800;

      const volumePayload = {
        week_id: testWeek.id,
        item_id: item.id,
        volume_needed: volumeNeeded
      };

      if (existingVolume) {
        await supabase
          .from('week_item_volumes')
          .update(volumePayload)
          .eq('id', existingVolume.id);
      } else {
        await supabase
          .from('week_item_volumes')
          .insert(volumePayload);
      }
    });

    await Promise.all(volumePromises);
    logger.debug(`✅ Set initial volume needs for ${allItems.length} items`);

    return {
      success: true,
      message: `✅ Allocation AI scenario loaded! Week #${testWeekNumber} (ID: ${testWeek.id}) is ready for testing. All ${suppliers.length} suppliers have priced all ${allItems.length} SKUs. Select this week in the dashboard to test allocation and "Send to Shippers" functionality.`,
      weekId: testWeek.id
    };
  } catch (error: any) {
    logger.error('Scenario load error:', error);
    return {
      success: false,
      message: `Failed to load scenario: ${error.message}`
    };
  }
}

/**
 * Removes the test scenario (deletes test week and associated data)
 * This is safe to call - it only removes week #999
 */
export async function removeAllocationScenario(): Promise<{ success: boolean; message: string }> {
  try {
    const { data: testWeek } = await supabase
      .from('weeks')
      .select('id')
      .eq('week_number', 999)
      .maybeSingle();

    if (!testWeek) {
      return {
        success: true,
        message: 'No test scenario found (week #999 does not exist)'
      };
    }

    // Delete in order (respecting foreign key constraints)
    await supabase.from('week_item_volumes').delete().eq('week_id', testWeek.id);
    await supabase.from('item_pricing_calculations').delete().eq('week_id', testWeek.id);
    await supabase.from('quotes').delete().eq('week_id', testWeek.id);
    await supabase.from('weeks').delete().eq('id', testWeek.id);

    return {
      success: true,
      message: '✅ Test scenario removed (week #999 and all associated data deleted)'
    };
  } catch (error: any) {
    logger.error('Scenario removal error:', error);
    return {
      success: false,
      message: `Failed to remove scenario: ${error.message}`
    };
  }
}

// Make available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).loadAllocationScenario = loadAllocationScenario;
  (window as any).removeAllocationScenario = removeAllocationScenario;
}

