/*
  # Add Supplier Response Columns to Quotes Table

  1. Purpose
    - Enable suppliers to respond to allocations with accept/revise volumes
    - Single source of truth for supplier volume responses
    - RF can immediately see supplier responses

  2. New Columns Added
    - supplier_response_volume: integer - quantity supplier accepts/revises
    - supplier_response_status: text - 'pending', 'accepted', or 'revised'
    - supplier_response_submitted_at: timestamptz - when response was submitted

  3. Business Rules
    - Accept: response_volume = awarded_volume, status='accepted'
    - Revise: response_volume = entered value, status='revised'
    - Default status is 'pending' until supplier responds

  4. Security
    - RLS policies already exist on quotes table
    - Suppliers can only update their own responses
*/

-- Add supplier_response_volume column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_response_volume'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_response_volume integer;
  END IF;
END $$;

-- Add supplier_response_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_response_status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_response_status text DEFAULT 'pending';
  END IF;
END $$;

-- Add supplier_response_submitted_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_response_submitted_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_response_submitted_at timestamptz;
  END IF;
END $$;

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quotes_supplier_response_status_check'
  ) THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_supplier_response_status_check 
      CHECK (supplier_response_status IN ('pending', 'accepted', 'revised'));
  END IF;
END $$;

-- Update existing rows to have default status if NULL
UPDATE quotes 
SET supplier_response_status = 'pending' 
WHERE supplier_response_status IS NULL;
