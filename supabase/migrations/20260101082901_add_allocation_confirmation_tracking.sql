/*
  # Add Allocation Confirmation Tracking

  1. Changes
    - Add `allocation_confirmation_status` field to track supplier confirmation ('pending', 'confirmed', 'revised')
    - Add `allocation_confirmed_volume` field to store the volume supplier confirms or revises to
    - Add `allocation_confirmation_notes` field for supplier notes
    - Add `allocation_confirmed_at` timestamp field
    
  2. Purpose
    - Allows RF to send volume allocations to suppliers
    - Suppliers can confirm or revise the allocated volumes
    - RF can see confirmation status and make final decisions
    - Creates workflow: RF allocates → Supplier confirms/revises → RF finalizes
    
  3. Security
    - No RLS changes needed as existing policies already cover the quotes table
*/

-- Add allocation confirmation fields to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmation_status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN allocation_confirmation_status text DEFAULT 'pending' CHECK (allocation_confirmation_status IN ('pending', 'confirmed', 'revised'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmed_volume'
  ) THEN
    ALTER TABLE quotes ADD COLUMN allocation_confirmed_volume integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmation_notes'
  ) THEN
    ALTER TABLE quotes ADD COLUMN allocation_confirmation_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'allocation_confirmed_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN allocation_confirmed_at timestamptz;
  END IF;
END $$;