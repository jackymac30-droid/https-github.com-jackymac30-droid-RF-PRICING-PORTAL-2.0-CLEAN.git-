/*
  # Robinson Fresh Pricing Portal - Complete Schema Rebuild

  1. New Tables
    - `weeks`
      - `id` (uuid, primary key)
      - `week_number` (integer, unique)
      - `start_date` (date)
      - `end_date` (date)
      - `status` (text: 'open', 'finalized', 'closed')
      - `emergency_unlock_enabled` (boolean, default false)
      - `emergency_unlock_reason` (text, nullable)
      - `emergency_unlock_by_user` (text, nullable)
      - `emergency_unlock_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

    - `items` (SKUs)
      - `id` (uuid, primary key)
      - `name` (text)
      - `pack_size` (text)
      - `category` (text: strawberry, blueberry, blackberry, raspberry)
      - `organic_flag` (text: 'CONV', 'ORG')
      - `display_order` (integer)
      - `created_at` (timestamptz)

    - `suppliers`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `email` (text, unique)
      - `created_at` (timestamptz)

    - `quotes`
      - `id` (uuid, primary key)
      - `week_id` (uuid, foreign key)
      - `item_id` (uuid, foreign key)
      - `supplier_id` (uuid, foreign key)
      - `supplier_fob` (decimal, nullable)
      - `supplier_dlvd` (decimal, nullable)
      - `rf_counter_fob` (decimal, nullable)
      - `supplier_response` (text: 'accept', 'revise', null)
      - `supplier_revised_fob` (decimal, nullable)
      - `rf_final_fob` (decimal, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE(week_id, item_id, supplier_id)

    - `audit_log`
      - `id` (uuid, primary key)
      - `week_id` (uuid)
      - `item_id` (uuid)
      - `supplier_id` (uuid, nullable)
      - `field_changed` (text)
      - `old_value` (text)
      - `new_value` (text)
      - `user_id` (text)
      - `reason` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Public read access for demo (as per current setup)
    - Policies for authenticated users

  3. Important Notes
    - This migration drops and recreates all tables
    - Demo data will be seeded separately
    - All weeks start CLOSED unless explicitly opened
*/

-- Drop existing tables
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS negotiations CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS weeks CASCADE;

-- Create weeks table
CREATE TABLE weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer UNIQUE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'finalized', 'closed')),
  emergency_unlock_enabled boolean DEFAULT false,
  emergency_unlock_reason text,
  emergency_unlock_by_user text,
  emergency_unlock_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to weeks"
  ON weeks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to weeks"
  ON weeks FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create items table
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pack_size text NOT NULL,
  category text NOT NULL CHECK (category IN ('strawberry', 'blueberry', 'blackberry', 'raspberry')),
  organic_flag text NOT NULL CHECK (organic_flag IN ('CONV', 'ORG')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to items"
  ON items FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to items"
  ON items FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create suppliers table
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to suppliers"
  ON suppliers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to suppliers"
  ON suppliers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create quotes table
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_fob decimal(10, 2),
  supplier_dlvd decimal(10, 2),
  rf_counter_fob decimal(10, 2),
  supplier_response text CHECK (supplier_response IN ('accept', 'revise')),
  supplier_revised_fob decimal(10, 2),
  rf_final_fob decimal(10, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id, supplier_id)
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to quotes"
  ON quotes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to quotes"
  ON quotes FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create audit log table
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  user_id text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to audit_log"
  ON audit_log FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public write access to audit_log"
  ON audit_log FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_quotes_week_id ON quotes(week_id);
CREATE INDEX idx_quotes_supplier_id ON quotes(supplier_id);
CREATE INDEX idx_quotes_item_id ON quotes(item_id);
CREATE INDEX idx_audit_log_week_id ON audit_log(week_id);
CREATE INDEX idx_weeks_status ON weeks(status);
