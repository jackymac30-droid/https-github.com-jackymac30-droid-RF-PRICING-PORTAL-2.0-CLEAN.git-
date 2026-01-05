-- ============================================
-- FIX: Suppliers updated_at Column Missing
-- ============================================
-- Error: "record 'new' has no field 'updated_at'"
-- 
-- This happens because a trigger expects updated_at but the column doesn't exist.
-- Run this ENTIRE script in Supabase SQL Editor (one time only).
-- ============================================

-- Step 1: Create the update_updated_at_column function (if it doesn't exist)
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

-- Step 2: Add the updated_at column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 3: Set updated_at for any existing rows
UPDATE suppliers 
SET updated_at = COALESCE(created_at, now()) 
WHERE updated_at IS NULL;

-- Step 4: Drop existing trigger if it exists (to recreate it properly)
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;

-- Step 5: Create the trigger
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Done! Now try the seed database button again.
