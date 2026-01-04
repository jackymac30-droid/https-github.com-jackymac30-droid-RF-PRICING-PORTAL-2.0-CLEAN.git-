/*
  # Fix Security and Performance Issues
  
  This migration addresses multiple security and performance concerns identified in the database audit:
  
  ## 1. Add Missing Indexes for Foreign Keys
  
  Creates indexes for foreign key columns that were previously unindexed, improving query performance:
  - `audit_log.item_id`
  - `audit_log.supplier_id`
  - `customer_volume_history.item_id`
  - `customer_volume_history.week_id`
  - `draft_allocations.item_id`
  - `draft_allocations.supplier_id`
  
  ## 2. Remove Unused Indexes
  
  Drops indexes that have not been used, reducing maintenance overhead:
  - `idx_pricing_history_negotiation`
  - `idx_pricing_history_created`
  
  ## 3. Consolidate Duplicate RLS Policies
  
  Removes redundant RLS policies that cause multiple permissive policy warnings. Each table will have a single comprehensive policy instead of overlapping read/write policies for:
  - `audit_log`
  - `item_volume_history`
  - `items`
  - `pricing_history`
  - `quotes`
  - `suppliers`
  - `weeks`
  
  ## 4. Fix Function Security
  
  Updates the `update_updated_at_column` function to use an immutable search path, preventing potential security vulnerabilities.
  
  ## Important Notes
  
  - All changes are backward compatible
  - Query performance should improve due to new indexes
  - RLS security remains unchanged, just consolidated
  - The Auth DB connection strategy issue requires manual configuration in Supabase dashboard settings
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Add index for audit_log.item_id
CREATE INDEX IF NOT EXISTS idx_audit_log_item_id ON audit_log(item_id);

-- Add index for audit_log.supplier_id
CREATE INDEX IF NOT EXISTS idx_audit_log_supplier_id ON audit_log(supplier_id);

-- Add index for customer_volume_history.item_id
CREATE INDEX IF NOT EXISTS idx_customer_volume_history_item_id ON customer_volume_history(item_id);

-- Add index for customer_volume_history.week_id
CREATE INDEX IF NOT EXISTS idx_customer_volume_history_week_id ON customer_volume_history(week_id);

-- Add index for draft_allocations.item_id
CREATE INDEX IF NOT EXISTS idx_draft_allocations_item_id ON draft_allocations(item_id);

-- Add index for draft_allocations.supplier_id
CREATE INDEX IF NOT EXISTS idx_draft_allocations_supplier_id ON draft_allocations(supplier_id);

-- =====================================================
-- 2. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_pricing_history_negotiation;
DROP INDEX IF EXISTS idx_pricing_history_created;

-- =====================================================
-- 3. CONSOLIDATE DUPLICATE RLS POLICIES
-- =====================================================

-- Drop existing overlapping policies and create consolidated ones

-- audit_log table
DROP POLICY IF EXISTS "Allow public read access to audit_log" ON audit_log;
DROP POLICY IF EXISTS "Allow public write access to audit_log" ON audit_log;
CREATE POLICY "Public access to audit_log"
  ON audit_log
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- item_volume_history table
DROP POLICY IF EXISTS "Allow public read access to item_volume_history" ON item_volume_history;
DROP POLICY IF EXISTS "Allow public write access to item_volume_history" ON item_volume_history;
CREATE POLICY "Public access to item_volume_history"
  ON item_volume_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- items table
DROP POLICY IF EXISTS "Allow public read access to items" ON items;
DROP POLICY IF EXISTS "Allow public write access to items" ON items;
CREATE POLICY "Public access to items"
  ON items
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- pricing_history table
DROP POLICY IF EXISTS "Anyone can view pricing_history" ON pricing_history;
DROP POLICY IF EXISTS "Anyone can modify pricing_history" ON pricing_history;
CREATE POLICY "Public access to pricing_history"
  ON pricing_history
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- quotes table
DROP POLICY IF EXISTS "Allow public read access to quotes" ON quotes;
DROP POLICY IF EXISTS "Allow public write access to quotes" ON quotes;
CREATE POLICY "Public access to quotes"
  ON quotes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- suppliers table
DROP POLICY IF EXISTS "Allow public read access to suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow public write access to suppliers" ON suppliers;
CREATE POLICY "Public access to suppliers"
  ON suppliers
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- weeks table
DROP POLICY IF EXISTS "Allow public read access to weeks" ON weeks;
DROP POLICY IF EXISTS "Allow public write access to weeks" ON weeks;
CREATE POLICY "Public access to weeks"
  ON weeks
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. FIX FUNCTION SECURITY - IMMUTABLE SEARCH PATH
-- =====================================================

-- Recreate the update_updated_at_column function with immutable search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
