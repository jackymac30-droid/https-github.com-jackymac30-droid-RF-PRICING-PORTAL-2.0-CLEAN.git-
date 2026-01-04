/*
  # Fix RLS policies to allow login

  ## Changes
  - Allow public read access to suppliers and rf_users for login screen
  - Keep write operations restricted
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Suppliers can view own profile" ON suppliers;
DROP POLICY IF EXISTS "RF users can view all suppliers" ON suppliers;
DROP POLICY IF EXISTS "RF users can view own profile" ON rf_users;

-- Allow anyone to read suppliers and rf_users for login screen
CREATE POLICY "Anyone can view suppliers"
  ON suppliers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view rf_users"
  ON rf_users FOR SELECT
  USING (true);
