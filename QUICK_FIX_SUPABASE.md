# Quick Fix for Seed Database Error

## The Problem
Error: `Failed to add suppliers: record "new" has no field "updated_at"`

This happens because there's a database trigger expecting an `updated_at` column that doesn't exist.

## The Solution

**Run this SQL in Supabase SQL Editor (one time only):**

```sql
-- Add updated_at column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update existing rows
UPDATE suppliers SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL;
```

**That's it!** Just those 2 lines. After running this, the seed database button should work.

## Alternative: Remove the Trigger (if you don't need updated_at)

If you don't need the `updated_at` column, you can remove the trigger instead:

```sql
-- Find and drop the trigger
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
```

But adding the column is the safer option.

