/*
  # Robinson Fresh Pricing Portal Schema

  ## Overview
  This migration creates the complete schema for a pricing negotiation portal where:
  - Suppliers submit initial prices
  - RF counters with different prices
  - Suppliers can accept or revise (sending back to RF)
  - RF can accept or counter again
  - Process continues until both parties agree

  ## New Tables

  ### `suppliers`
  - `id` (uuid, primary key)
  - `name` (text) - Supplier company name
  - `email` (text) - Login email
  - `created_at` (timestamptz)

  ### `rf_users`
  - `id` (uuid, primary key)
  - `name` (text) - RF employee name
  - `email` (text) - Login email
  - `created_at` (timestamptz)

  ### `items`
  - `id` (uuid, primary key)
  - `name` (text) - Product name (e.g., "Strawberries")
  - `variety` (text) - Product variety (e.g., "Organic", "Conventional")
  - `fob_default` (numeric) - Default FOB price
  - `dlvd_default` (numeric) - Default delivered price
  - `created_at` (timestamptz)

  ### `weeks`
  - `id` (uuid, primary key)
  - `week_number` (integer) - Week number in program
  - `start_date` (date) - Monday of the week
  - `status` (text) - 'open', 'closed', 'finalized'
  - `created_at` (timestamptz)

  ### `negotiations`
  Tracks the current state of each price negotiation
  - `id` (uuid, primary key)
  - `week_id` (uuid, foreign key to weeks)
  - `item_id` (uuid, foreign key to items)
  - `supplier_id` (uuid, foreign key to suppliers)
  - `status` (text) - Current negotiation status
  - `current_fob_price` (numeric, nullable) - Current FOB price in negotiation
  - `current_dlvd_price` (numeric, nullable) - Current delivered price
  - `last_action_by` (uuid) - ID of user who took last action
  - `last_action_type` (text) - Type of last action taken
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `pricing_history`
  Complete audit trail of all pricing actions
  - `id` (uuid, primary key)
  - `negotiation_id` (uuid, foreign key to negotiations)
  - `action_type` (text) - Type of action
  - `fob_price` (numeric, nullable)
  - `dlvd_price` (numeric, nullable)
  - `submitted_by` (uuid) - User ID who submitted
  - `submitted_by_name` (text) - User name for display
  - `notes` (text, nullable) - Optional notes
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Suppliers can only view/edit their own negotiations
  - RF users can view/edit all negotiations
  - All users must be authenticated
*/

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create rf_users table
CREATE TABLE IF NOT EXISTS rf_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variety text NOT NULL,
  fob_default numeric(10,2) NOT NULL DEFAULT 0,
  dlvd_default numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create weeks table
CREATE TABLE IF NOT EXISTS weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL UNIQUE,
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized')),
  created_at timestamptz DEFAULT now()
);

-- Create negotiations table
CREATE TABLE IF NOT EXISTS negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'awaiting_supplier_quote' 
    CHECK (status IN (
      'awaiting_supplier_quote',
      'awaiting_rf_response', 
      'awaiting_supplier_response',
      'accepted',
      'finalized'
    )),
  current_fob_price numeric(10,2),
  current_dlvd_price numeric(10,2),
  last_action_by uuid,
  last_action_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id, supplier_id)
);

-- Create pricing_history table
CREATE TABLE IF NOT EXISTS pricing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id uuid NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'supplier_initial_quote',
    'rf_counter',
    'supplier_revision',
    'supplier_accept',
    'rf_accept'
  )),
  fob_price numeric(10,2),
  dlvd_price numeric(10,2),
  submitted_by uuid NOT NULL,
  submitted_by_name text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rf_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_history ENABLE ROW LEVEL SECURITY;

-- Suppliers policies
CREATE POLICY "Suppliers can view own profile"
  ON suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "RF users can view all suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

-- RF users policies
CREATE POLICY "RF users can view own profile"
  ON rf_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Items policies
CREATE POLICY "Anyone authenticated can view items"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only RF users can modify items"
  ON items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

-- Weeks policies
CREATE POLICY "Anyone authenticated can view weeks"
  ON weeks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only RF users can modify weeks"
  ON weeks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

-- Negotiations policies
CREATE POLICY "Suppliers can view own negotiations"
  ON negotiations FOR SELECT
  TO authenticated
  USING (supplier_id = auth.uid());

CREATE POLICY "Suppliers can update own negotiations"
  ON negotiations FOR UPDATE
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());

CREATE POLICY "RF users can view all negotiations"
  ON negotiations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

CREATE POLICY "RF users can update all negotiations"
  ON negotiations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

CREATE POLICY "RF users can insert negotiations"
  ON negotiations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

-- Pricing history policies
CREATE POLICY "Suppliers can view own history"
  ON pricing_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM negotiations 
      WHERE negotiations.id = pricing_history.negotiation_id 
      AND negotiations.supplier_id = auth.uid()
    )
  );

CREATE POLICY "RF users can view all history"
  ON pricing_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rf_users WHERE rf_users.id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert history"
  ON pricing_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_negotiations_week ON negotiations(week_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_supplier ON negotiations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status ON negotiations(status);
CREATE INDEX IF NOT EXISTS idx_pricing_history_negotiation ON pricing_history(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_created ON pricing_history(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for negotiations updated_at
DROP TRIGGER IF EXISTS update_negotiations_updated_at ON negotiations;
CREATE TRIGGER update_negotiations_updated_at
  BEFORE UPDATE ON negotiations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
