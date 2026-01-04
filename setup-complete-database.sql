-- Complete Database Setup: Schema + Data
-- Run this in Supabase SQL Editor to set up everything from scratch

-- ============================================================
-- PART 1: CREATE SCHEMA (TABLES)
-- ============================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS week_item_volumes CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS weeks CASCADE;

-- Create weeks table
CREATE TABLE weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer UNIQUE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'finalized', 'closed', 'locked')),
  allocation_submitted boolean DEFAULT false,
  pricing_finalized boolean DEFAULT false,
  emergency_unlock_enabled boolean DEFAULT false,
  emergency_unlock_reason text,
  emergency_unlock_by_user text,
  emergency_unlock_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pack_size text NOT NULL,
  category text NOT NULL CHECK (category IN ('strawberry', 'blueberry', 'blackberry', 'raspberry')),
  organic_flag text NOT NULL CHECK (organic_flag IN ('CONV', 'ORG')),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, pack_size)
);

-- Create suppliers table
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  eligibility_status text DEFAULT 'active' CHECK (eligibility_status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz DEFAULT now()
);

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
  awarded_volume integer,
  supplier_pricing_finalized boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id, supplier_id)
);

-- Create week_item_volumes table
CREATE TABLE week_item_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  volume_needed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_id, item_id)
);

-- Create audit_log table
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

-- ============================================================
-- PART 2: ENABLE SECURITY (RLS)
-- ============================================================

ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_item_volumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Public access policies (for demo)
CREATE POLICY "Public access to weeks"
  ON weeks FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public access to items"
  ON items FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public access to suppliers"
  ON suppliers FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public access to quotes"
  ON quotes FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public access to week_item_volumes"
  ON week_item_volumes FOR ALL TO public USING (true) WITH CHECK (true);

CREATE POLICY "Public access to audit_log"
  ON audit_log FOR ALL TO public USING (true) WITH CHECK (true);

-- ============================================================
-- PART 3: SEED DATA
-- ============================================================

-- Insert Suppliers
INSERT INTO suppliers (name, email) VALUES
  ('Fresh Farms Inc', 'supplier1@freshfarms.com'),
  ('Berry Best Co', 'supplier2@berrybest.com'),
  ('Organic Growers', 'supplier3@organicgrowers.com'),
  ('Valley Fresh', 'supplier4@valleyfresh.com'),
  ('Premium Produce', 'supplier5@premiumproduce.com')
ON CONFLICT (email) DO NOTHING;

-- Insert Items
INSERT INTO items (name, pack_size, category, organic_flag, display_order) VALUES
  ('Strawberry', '4×2 lb', 'strawberry', 'CONV', 1),
  ('Strawberry', '8×1 lb', 'strawberry', 'ORG', 2),
  ('Blueberry', '18 oz', 'blueberry', 'CONV', 3),
  ('Blueberry', 'Pint', 'blueberry', 'ORG', 4),
  ('Blackberry', '12×6 oz', 'blackberry', 'CONV', 5),
  ('Blackberry', '12×6 oz', 'blackberry', 'ORG', 6),
  ('Raspberry', '12×6 oz', 'raspberry', 'CONV', 7),
  ('Raspberry', '12×6 oz', 'raspberry', 'ORG', 8)
ON CONFLICT (name, pack_size) DO NOTHING;

-- Insert Weeks
INSERT INTO weeks (week_number, start_date, end_date, status, allocation_submitted, pricing_finalized) VALUES
  (1, '2025-01-01', '2025-01-07', 'closed', true, true),
  (2, '2025-01-08', '2025-01-14', 'closed', true, true),
  (3, '2025-01-15', '2025-01-21', 'closed', true, true),
  (4, '2025-01-22', '2025-01-28', 'closed', true, true),
  (5, '2025-01-29', '2025-02-04', 'closed', true, true),
  (6, '2025-02-05', '2025-02-11', 'open', false, false)
ON CONFLICT (week_number) DO NOTHING;

-- Insert Complete Historical Data for Closed Weeks
DO $$
DECLARE
  supplier_rec RECORD;
  item_rec RECORD;
  week_rec RECORD;
  supplier_fob_val NUMERIC;
  supplier_dlvd_val NUMERIC;
  rf_counter_val NUMERIC;
  supplier_response_val TEXT;
  supplier_revised_val NUMERIC;
  rf_final_val NUMERIC;
  awarded_volume_val INTEGER;
BEGIN
  FOR week_rec IN SELECT * FROM weeks WHERE status = 'closed' ORDER BY week_number LOOP
    FOR supplier_rec IN SELECT * FROM suppliers ORDER BY name LOOP
      FOR item_rec IN SELECT * FROM items ORDER BY display_order LOOP
        -- Generate realistic pricing workflow
        supplier_fob_val := ROUND((15 + RANDOM() * 3)::numeric, 2);
        supplier_dlvd_val := ROUND((18 + RANDOM() * 3)::numeric, 2);
        rf_counter_val := ROUND((supplier_fob_val * 0.95)::numeric, 2);
        
        -- Supplier response: 70% accept, 30% revise
        IF RANDOM() > 0.3 THEN
          supplier_response_val := 'accept';
          supplier_revised_val := NULL;
          rf_final_val := rf_counter_val;
        ELSE
          supplier_response_val := 'revise';
          supplier_revised_val := ROUND((rf_counter_val * 1.02)::numeric, 2);
          rf_final_val := supplier_revised_val;
        END IF;
        
        -- Awarded volume
        awarded_volume_val := 100 + FLOOR(RANDOM() * 900)::INTEGER;
        
        INSERT INTO quotes (
          week_id, item_id, supplier_id, 
          supplier_fob, supplier_dlvd, rf_counter_fob, 
          supplier_response, supplier_revised_fob, rf_final_fob, awarded_volume,
          supplier_pricing_finalized
        ) VALUES (
          week_rec.id, item_rec.id, supplier_rec.id,
          supplier_fob_val, supplier_dlvd_val, rf_counter_val,
          supplier_response_val, supplier_revised_val, rf_final_val, awarded_volume_val,
          true
        )
        ON CONFLICT (week_id, item_id, supplier_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- PART 4: VERIFY
-- ============================================================

SELECT 
  (SELECT COUNT(*) FROM suppliers) as supplier_count,
  (SELECT COUNT(*) FROM items) as item_count,
  (SELECT COUNT(*) FROM weeks) as week_count,
  (SELECT COUNT(*) FROM quotes) as quote_count,
  (SELECT COUNT(*) FROM quotes WHERE rf_final_fob IS NOT NULL) as finalized_quotes,
  (SELECT COUNT(*) FROM quotes WHERE awarded_volume IS NOT NULL) as quotes_with_volume;

