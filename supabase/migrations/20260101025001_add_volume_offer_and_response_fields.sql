/*
  # Add Volume Offer and Response Fields

  1. Changes to quotes table
    - Add `offered_volume` (numeric) - Volume RF offers to supplier
    - Add `supplier_volume_response` (text) - Supplier response: accept/update/decline
    - Add `supplier_volume_accepted` (numeric) - Volume supplier accepts or counter-offers
    - Add `supplier_volume_response_notes` (text) - Optional notes from supplier
    - Rename conceptually: `awarded_volume` becomes "rewarded volume" after finalization

  2. Workflow
    - RF enters offered_volume in Award Volume section
    - RF submits to suppliers (allocation_submitted = true)
    - Suppliers see offered_volume and can accept/update/decline
    - If accept: supplier_volume_accepted = offered_volume
    - If update: supplier_volume_accepted = new value
    - If decline: supplier_volume_accepted = 0
    - When RF finalizes week: supplier_volume_accepted → awarded_volume (rewarded)

  3. Notes
    - offered_volume: What RF initially offers
    - supplier_volume_accepted: What supplier agrees to
    - awarded_volume: Final rewarded volume after finalization (locked)
*/

-- Add new columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'offered_volume'
  ) THEN
    ALTER TABLE quotes ADD COLUMN offered_volume numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_volume_response'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_volume_response text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_volume_accepted'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_volume_accepted numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_volume_response_notes'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_volume_response_notes text;
  END IF;
END $$;

COMMENT ON COLUMN quotes.offered_volume IS 'Volume RF offers to supplier during allocation phase';
COMMENT ON COLUMN quotes.supplier_volume_response IS 'Supplier response: accept, update, or decline';
COMMENT ON COLUMN quotes.supplier_volume_accepted IS 'Volume supplier accepts or counter-offers with';
COMMENT ON COLUMN quotes.supplier_volume_response_notes IS 'Optional notes from supplier about volume response';
COMMENT ON COLUMN quotes.awarded_volume IS 'Final rewarded volume after week finalization (locked)';

-- Add check constraint for supplier_volume_response
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quotes_supplier_volume_response_check'
  ) THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_supplier_volume_response_check
      CHECK (supplier_volume_response IS NULL OR supplier_volume_response IN ('accept', 'update', 'decline'));
  END IF;
END $$;