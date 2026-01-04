/*
  # Add display order to items

  1. Changes
    - Add `display_order` column to items table
    - Update existing items with correct display order (straws, blues, blacks, rasp)
    - Set display order for varieties (conventional before organic)
  
  2. Notes
    - Lower numbers appear first
    - Strawberries = 1, Blueberries = 2, Blackberries = 3, Raspberries = 4
*/

-- Add display_order column
ALTER TABLE items ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 999;

-- Update display order for existing items
UPDATE items SET display_order = 1 WHERE name = 'Strawberries' AND variety = 'Conventional';
UPDATE items SET display_order = 2 WHERE name = 'Strawberries' AND variety = 'Organic';
UPDATE items SET display_order = 3 WHERE name = 'Blueberries' AND variety = 'Conventional';
UPDATE items SET display_order = 4 WHERE name = 'Blueberries' AND variety = 'Organic';
UPDATE items SET display_order = 5 WHERE name = 'Blackberries' AND variety = 'Conventional';
UPDATE items SET display_order = 6 WHERE name = 'Blackberries' AND variety = 'Organic';
UPDATE items SET display_order = 7 WHERE name = 'Raspberries' AND variety = 'Conventional';
UPDATE items SET display_order = 8 WHERE name = 'Raspberries' AND variety = 'Organic';
