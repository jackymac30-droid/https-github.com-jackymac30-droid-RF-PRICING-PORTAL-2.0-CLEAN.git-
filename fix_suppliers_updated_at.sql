-- Quick fix: Add updated_at column to suppliers table
-- Run this once in Supabase SQL Editor

-- Add the updated_at column
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create a trigger to automatically update updated_at on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;

-- Create the trigger
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set updated_at for existing rows
UPDATE suppliers SET updated_at = created_at WHERE updated_at IS NULL;

