-- ============================================
-- COMPLETE FIX: Suppliers updated_at Column
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
  -- Only set updated_at if the column exists
  IF TG_TABLE_NAME = 'suppliers' THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Step 2: Add the updated_at column to suppliers table (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE suppliers 
    ADD COLUMN updated_at timestamptz DEFAULT now();
    
    -- Set updated_at for any existing rows
    UPDATE suppliers 
    SET updated_at = COALESCE(created_at, now()) 
    WHERE updated_at IS NULL;
  END IF;
END $$;

-- Step 3: Drop existing trigger if it exists (to recreate it properly)
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;

-- Step 4: Create the trigger (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' 
    AND column_name = 'updated_at'
  ) THEN
    CREATE TRIGGER update_suppliers_updated_at
        BEFORE UPDATE ON suppliers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Step 5: Verify the fix
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'suppliers' 
  AND column_name = 'updated_at';

-- If the above query returns a row, the fix worked!
-- Now try the seed database button again.

