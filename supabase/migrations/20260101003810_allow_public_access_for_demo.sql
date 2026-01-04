/*
  # Allow public access for demo

  ## Changes
  - Allow public read/write access to all tables for demo purposes
  - This is suitable for internal demo/testing environments
  - For production, proper authentication should be implemented
*/

-- Items: allow public access
DROP POLICY IF EXISTS "Anyone authenticated can view items" ON items;
DROP POLICY IF EXISTS "Only RF users can modify items" ON items;

CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Anyone can modify items"
  ON items FOR ALL
  USING (true);

-- Weeks: allow public access
DROP POLICY IF EXISTS "Anyone authenticated can view weeks" ON weeks;
DROP POLICY IF EXISTS "Only RF users can modify weeks" ON weeks;

CREATE POLICY "Anyone can view weeks"
  ON weeks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can modify weeks"
  ON weeks FOR ALL
  USING (true);

-- Negotiations: allow public access
DROP POLICY IF EXISTS "Suppliers can view own negotiations" ON negotiations;
DROP POLICY IF EXISTS "Suppliers can update own negotiations" ON negotiations;
DROP POLICY IF EXISTS "RF users can view all negotiations" ON negotiations;
DROP POLICY IF EXISTS "RF users can update all negotiations" ON negotiations;
DROP POLICY IF EXISTS "RF users can insert negotiations" ON negotiations;

CREATE POLICY "Anyone can view negotiations"
  ON negotiations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can modify negotiations"
  ON negotiations FOR ALL
  USING (true);

-- Pricing history: allow public access
DROP POLICY IF EXISTS "Suppliers can view own history" ON pricing_history;
DROP POLICY IF EXISTS "RF users can view all history" ON pricing_history;
DROP POLICY IF EXISTS "Anyone can insert history" ON pricing_history;

CREATE POLICY "Anyone can view pricing_history"
  ON pricing_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can modify pricing_history"
  ON pricing_history FOR ALL
  USING (true);
