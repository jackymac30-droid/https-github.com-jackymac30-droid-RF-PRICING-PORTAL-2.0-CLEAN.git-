/*
  # Add Supplier Volume Approval Field

  1. Changes
    - Add `supplier_volume_approval` field to quotes table
      - Values: 'pending', 'accepted', 'revised'
      - Default: 'pending'
      - Only applicable when awarded_volume > 0
    - Add `supplier_volume_notes` field for supplier comments

  2. Notes
    - Suppliers can accept awarded volume or request revision
    - This helps RF finalize volume allocations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_volume_approval'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_volume_approval text DEFAULT 'pending' CHECK (supplier_volume_approval IN ('pending', 'accepted', 'revised'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_volume_notes'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_volume_notes text;
  END IF;
END $$;

COMMENT ON COLUMN quotes.supplier_volume_approval IS 'Supplier approval status for awarded volume: pending, accepted, or revised';
COMMENT ON COLUMN quotes.supplier_volume_notes IS 'Supplier comments about awarded volume';