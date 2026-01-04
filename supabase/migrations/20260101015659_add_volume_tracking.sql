/*
  # Add Volume Tracking to Quotes

  1. Changes
    - Add `awarded_volume` column to quotes table to track pallets/cases awarded to each supplier
    - Add `unit_type` column to items table to specify if volume is measured in pallets or cases
    
  2. Notes
    - awarded_volume can be null (not yet awarded)
    - Only RF managers can set awarded volume after week is finalized
    - Volume is tracked per quote (supplier + item + week combination)
*/

-- Add volume tracking to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'awarded_volume'
  ) THEN
    ALTER TABLE quotes ADD COLUMN awarded_volume integer;
  END IF;
END $$;

-- Add unit type to items (pallets vs cases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'unit_type'
  ) THEN
    ALTER TABLE items ADD COLUMN unit_type text DEFAULT 'pallets' CHECK (unit_type IN ('pallets', 'cases'));
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN quotes.awarded_volume IS 'Number of pallets or cases awarded to this supplier for this item in this week';
COMMENT ON COLUMN items.unit_type IS 'Unit of measurement for volume: pallets or cases';