/*
  # Fix RLS Policies for week_item_volumes
  
  1. Changes
    - Drop existing authenticated-only policies on week_item_volumes
    - Add public access policies for demo mode
  
  2. Security
    - Allow public read, insert, update, and delete access to week_item_volumes
    - This matches the public access pattern used in other tables for demo mode
*/

-- Drop existing authenticated-only policies
DROP POLICY IF EXISTS "Authenticated users can read volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can insert volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can update volume needs" ON week_item_volumes;
DROP POLICY IF EXISTS "Authenticated users can delete volume needs" ON week_item_volumes;

-- Create public access policies
CREATE POLICY "Allow public read access to week_item_volumes"
  ON week_item_volumes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to week_item_volumes"
  ON week_item_volumes
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to week_item_volumes"
  ON week_item_volumes
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from week_item_volumes"
  ON week_item_volumes
  FOR DELETE
  TO public
  USING (true);
