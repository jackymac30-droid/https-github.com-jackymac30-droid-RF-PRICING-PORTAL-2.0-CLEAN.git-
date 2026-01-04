/*
  # Add Customer Volume Tracking

  1. New Tables
    - `customers`
      - `id` (uuid, primary key)
      - `name` (text, unique) - customer name
      - `email` (text, unique) - customer contact email
      - `created_at` (timestamptz)
    
    - `customer_volume_history`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `item_id` (uuid, references items)
      - `week_id` (uuid, references weeks)
      - `volume_ordered` (integer) - actual volume this customer ordered
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access (for demo purposes)

  3. Sample Data
    - Add BJ's Wholesale Club as a customer
    - Add BJ's historical volumes for weeks 3, 4, 5 (made-up realistic volumes)
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Public read access for demo
CREATE POLICY "Allow public read access to customers"
  ON customers
  FOR SELECT
  TO public
  USING (true);

-- Insert BJ's Wholesale Club
INSERT INTO customers (name, email)
VALUES ('BJ''s Wholesale Club', 'purchasing@bjs.com')
ON CONFLICT (email) DO NOTHING;

-- Create customer volume history table
CREATE TABLE IF NOT EXISTS customer_volume_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  week_id uuid REFERENCES weeks(id) ON DELETE CASCADE NOT NULL,
  volume_ordered integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, item_id, week_id)
);

-- Enable RLS
ALTER TABLE customer_volume_history ENABLE ROW LEVEL SECURITY;

-- Public read access for demo
CREATE POLICY "Allow public read access to customer volume history"
  ON customer_volume_history
  FOR SELECT
  TO public
  USING (true);

-- Insert BJ's historical volumes for weeks 3, 4, 5
-- Made-up realistic volumes showing typical ordering patterns
INSERT INTO customer_volume_history (customer_id, item_id, week_id, volume_ordered)
SELECT 
  (SELECT id FROM customers WHERE name = 'BJ''s Wholesale Club'),
  i.id,
  w.id,
  CASE 
    -- Week 3 volumes for BJ's
    WHEN w.week_number = 3 AND i.name = 'Strawberry' AND i.pack_size = '4×2 lb' THEN 185
    WHEN w.week_number = 3 AND i.name = 'Strawberry' AND i.pack_size = '8×1 lb' THEN 192
    WHEN w.week_number = 3 AND i.name = 'Blueberry' AND i.pack_size = '18 oz' THEN 178
    WHEN w.week_number = 3 AND i.name = 'Blueberry' AND i.pack_size = 'Pint' THEN 195
    WHEN w.week_number = 3 AND i.name = 'Blackberry' AND i.pack_size = '12×6 oz' THEN 201
    WHEN w.week_number = 3 AND i.name = 'Raspberry' AND i.pack_size = '12×6 oz' THEN 183
    -- Week 4 volumes for BJ's
    WHEN w.week_number = 4 AND i.name = 'Strawberry' AND i.pack_size = '4×2 lb' THEN 198
    WHEN w.week_number = 4 AND i.name = 'Strawberry' AND i.pack_size = '8×1 lb' THEN 205
    WHEN w.week_number = 4 AND i.name = 'Blueberry' AND i.pack_size = '18 oz' THEN 191
    WHEN w.week_number = 4 AND i.name = 'Blueberry' AND i.pack_size = 'Pint' THEN 208
    WHEN w.week_number = 4 AND i.name = 'Blackberry' AND i.pack_size = '12×6 oz' THEN 195
    WHEN w.week_number = 4 AND i.name = 'Raspberry' AND i.pack_size = '12×6 oz' THEN 189
    -- Week 5 volumes for BJ's  
    WHEN w.week_number = 5 AND i.name = 'Strawberry' AND i.pack_size = '4×2 lb' THEN 212
    WHEN w.week_number = 5 AND i.name = 'Strawberry' AND i.pack_size = '8×1 lb' THEN 218
    WHEN w.week_number = 5 AND i.name = 'Blueberry' AND i.pack_size = '18 oz' THEN 168
    WHEN w.week_number = 5 AND i.name = 'Blueberry' AND i.pack_size = 'Pint' THEN 201
    WHEN w.week_number = 5 AND i.name = 'Blackberry' AND i.pack_size = '12×6 oz' THEN 182
    WHEN w.week_number = 5 AND i.name = 'Raspberry' AND i.pack_size = '12×6 oz' THEN 181
  END as volume_ordered
FROM items i
CROSS JOIN weeks w
WHERE w.week_number IN (3, 4, 5)
AND (
  (w.week_number = 3 AND i.name IN ('Strawberry', 'Blueberry', 'Blackberry', 'Raspberry')) OR
  (w.week_number = 4 AND i.name IN ('Strawberry', 'Blueberry', 'Blackberry', 'Raspberry')) OR
  (w.week_number = 5 AND i.name IN ('Strawberry', 'Blueberry', 'Blackberry', 'Raspberry'))
)
ON CONFLICT (customer_id, item_id, week_id) DO NOTHING;
