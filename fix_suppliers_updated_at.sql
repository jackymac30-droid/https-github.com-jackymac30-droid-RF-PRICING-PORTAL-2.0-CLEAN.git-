-- ============================================
-- FIX: Suppliers updated_at Column Missing
-- ============================================
-- Error: "record 'new' has no field 'updated_at'"
-- 
-- This happens because a trigger expects updated_at but the column doesn't exist.
-- Run this ENTIRE script in Supabase SQL Editor (one time only).
-- ============================================

-- Step 1: Add the updated_at column
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: Set updated_at for any existing rows
UPDATE suppliers 
SET updated_at = COALESCE(created_at, now()) 
WHERE updated_at IS NULL;

-- Step 3: Check if there's a trigger (optional - just for info)
-- SELECT trigger_name, event_manipulation 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'suppliers';

-- Step 4: If a trigger exists but is broken, recreate it properly
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Done! Now try the seed database button again.
