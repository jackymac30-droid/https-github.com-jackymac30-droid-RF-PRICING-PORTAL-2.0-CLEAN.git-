import { supabase } from './supabase';

/**
 * Seeds test data for 4 suppliers submitting pricing for Strawberry 2lb
 * This creates a realistic scenario to demonstrate multi-supplier-per-SKU functionality
 */
export async function seedMultiSupplierScenario(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🌱 Seeding multi-supplier scenario for Strawberry 2lb...');

    // Step 1: Find or create Strawberry 2lb item
    // Try to find existing "Strawberry" with pack_size containing "2 lb" or "2lb"
    const { data: existingItems } = await supabase
      .from('items')
      .select('id, name, pack_size')
      .eq('name', 'Strawberry')
      .or('pack_size.ilike.%2 lb%,pack_size.ilike.%2lb%')
      .limit(1);

    let strawberryItem;
    if (existingItems && existingItems.length > 0) {
      strawberryItem = existingItems[0];
      console.log('✓ Found existing Strawberry item:', strawberryItem.name, strawberryItem.pack_size);
    } else {
      // Create new item if not found - use format matching existing items
      strawberryItem = await findOrCreateItem('Strawberry', '4×2 lb', 'strawberry', 'CONV');
      console.log('✓ Created Strawberry 2lb item:', strawberryItem.id);
    }

    // Step 2: Find or create 4 suppliers
    const suppliers = await findOrCreateSuppliers([
      { name: 'Mountain Fresh', email: 'mountain@fresh.com' },
      { name: 'Coastal Farms', email: 'coastal@farms.com' },
      { name: 'Pacific Produce', email: 'pacific@produce.com' },
      { name: 'Valley Growers', email: 'valley@growers.com' },
    ]);
    console.log('✓ Created/found 4 suppliers');

    // Step 3: Find or create an open week
    let week = await findOrCreateOpenWeek();
    console.log('✓ Week:', week.week_number, week.id);

    // Step 4: Create quotes with pricing data from scenario
    const quotes = [
      {
        supplier: suppliers[0], // Mountain Fresh
        supplier_fob: 9.75,
        rf_counter_fob: 9.50,
        supplier_response: 'accept' as const,
        supplier_revised_fob: null,
        rf_final_fob: 9.50,
      },
      {
        supplier: suppliers[1], // Coastal Farms
        supplier_fob: 10.50,
        rf_counter_fob: 10.25,
        supplier_response: 'revise' as const,
        supplier_revised_fob: 10.30,
        rf_final_fob: 10.30,
      },
      {
        supplier: suppliers[2], // Pacific Produce
        supplier_fob: 10.95,
        rf_counter_fob: null,
        supplier_response: 'accept' as const,
        supplier_revised_fob: null,
        rf_final_fob: 10.95,
      },
      {
        supplier: suppliers[3], // Valley Growers
        supplier_fob: 11.25,
        rf_counter_fob: null,
        supplier_response: null,
        supplier_revised_fob: null,
        rf_final_fob: null, // Declined - no final price
      },
    ];

    // Delete existing quotes for this item/week combination to start fresh
    const { error: deleteError } = await supabase
      .from('quotes')
      .delete()
      .eq('week_id', week.id)
      .eq('item_id', strawberryItem.id);

    if (deleteError) {
      console.warn('Warning deleting existing quotes:', deleteError);
    }

    // Insert new quotes
    for (const quoteData of quotes) {
      const { error } = await supabase
        .from('quotes')
        .upsert({
          week_id: week.id,
          item_id: strawberryItem.id,
          supplier_id: quoteData.supplier.id,
          supplier_fob: quoteData.supplier_fob,
          rf_counter_fob: quoteData.rf_counter_fob,
          supplier_response: quoteData.supplier_response,
          supplier_revised_fob: quoteData.supplier_revised_fob,
          rf_final_fob: quoteData.rf_final_fob,
        }, {
          onConflict: 'week_id,item_id,supplier_id',
        });

      if (error) {
        console.error(`Error creating quote for ${quoteData.supplier.name}:`, error);
      } else {
        console.log(`✓ Created quote for ${quoteData.supplier.name}: $${quoteData.supplier_fob}`);
      }
    }

    // Step 5: Create pricing calculations (if not exists)
    const { error: pricingError } = await supabase
      .from('item_pricing_calculations')
      .upsert({
        week_id: week.id,
        item_id: strawberryItem.id,
        avg_price: 10.25, // Will be recalculated when volumes are set
        rebate: 0.80,
        freight: 1.75,
        margin: 2.00, // Profit per case
        dlvd_price: 14.80, // (10.25 + 0.80 + 1.75) + 2.00
      }, {
        onConflict: 'week_id,item_id',
      });

    if (pricingError) {
      console.warn('Warning creating pricing calculations:', pricingError);
    } else {
      console.log('✓ Created pricing calculations');
    }

    console.log('✅ Multi-supplier scenario seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Item: Strawberry 2lb');
    console.log('  - Week:', week.week_number);
    console.log('  - Suppliers:');
    quotes.forEach(q => {
      if (q.rf_final_fob) {
        console.log(`    • ${q.supplier.name}: $${q.supplier_fob} → $${q.rf_final_fob} (${q.supplier_response || 'declined'})`);
      } else {
        console.log(`    • ${q.supplier.name}: $${q.supplier_fob} (declined)`);
      }
    });

    return {
      success: true,
      message: `Successfully seeded 4 suppliers for Strawberry 2lb in Week ${week.week_number}. Check the RF Dashboard to see all quotes!`,
    };
  } catch (error: any) {
    console.error('❌ Error seeding scenario:', error);
    return {
      success: false,
      message: `Error: ${error.message}`,
    };
  }
}

async function findOrCreateItem(
  name: string,
  packSize: string,
  category: string,
  organicFlag: string
): Promise<{ id: string; name: string }> {
  // Try to find existing item
  const { data: existing } = await supabase
    .from('items')
    .select('id, name')
    .eq('name', name)
    .eq('pack_size', packSize)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new item
  const { data: newItem, error } = await supabase
    .from('items')
    .insert({
      name,
      pack_size: packSize,
      category,
      organic_flag: organicFlag,
      display_order: 999,
    })
    .select('id, name')
    .single();

  if (error || !newItem) {
    throw new Error(`Failed to create item: ${error?.message}`);
  }

  return newItem;
}

async function findOrCreateSuppliers(
  supplierData: Array<{ name: string; email: string }>
): Promise<Array<{ id: string; name: string }>> {
  const suppliers = [];

  for (const data of supplierData) {
    // Try to find existing supplier
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('email', data.email)
      .maybeSingle();

    if (existing) {
      suppliers.push(existing);
    } else {
      // Create new supplier
      const { data: newSupplier, error } = await supabase
        .from('suppliers')
        .insert({
          name: data.name,
          email: data.email,
        })
        .select('id, name')
        .single();

      if (error || !newSupplier) {
        throw new Error(`Failed to create supplier ${data.name}: ${error?.message}`);
      }

      suppliers.push(newSupplier);
    }
  }

  return suppliers;
}

async function findOrCreateOpenWeek(): Promise<{ id: string; week_number: number }> {
  // Try to find an open week
  const { data: openWeek } = await supabase
    .from('weeks')
    .select('id, week_number')
    .eq('status', 'open')
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openWeek) {
    return openWeek;
  }

  // Find the latest week to create next one
  const { data: latestWeek } = await supabase
    .from('weeks')
    .select('week_number, end_date')
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextWeekNumber = latestWeek ? latestWeek.week_number + 1 : 1;

  let startDate: Date;
  if (latestWeek?.end_date) {
    const lastEndDate = new Date(latestWeek.end_date);
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
      status: 'open',
    })
    .select('id, week_number')
    .single();

  if (error || !newWeek) {
    throw new Error(`Failed to create week: ${error?.message}`);
  }

  // Create quotes for all suppliers × all items for this week
  const [suppliers, items] = await Promise.all([
    supabase.from('suppliers').select('id'),
    supabase.from('items').select('id'),
  ]);

  if (suppliers.data && items.data) {
    const quoteInserts = [];
    for (const supplier of suppliers.data) {
      for (const item of items.data) {
        quoteInserts.push({
          week_id: newWeek.id,
          item_id: item.id,
          supplier_id: supplier.id,
        });
      }
    }

    if (quoteInserts.length > 0) {
      await supabase.from('quotes').insert(quoteInserts);
    }
  }

  return newWeek;
}

