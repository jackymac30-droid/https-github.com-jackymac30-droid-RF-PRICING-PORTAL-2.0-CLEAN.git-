/*
  # Create week_item_volumes table for Award Volume tracking

  1. New Tables
    - `week_item_volumes`
      - `id` (uuid, primary key)
      - `week_id` (uuid, foreign key to weeks)
      - `item_id` (uuid, foreign key to items)
      - `volume_needed` (integer, the volume needed for this item in this week)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE constraint on (week_id, item_id)

  2. Security
    - Enable RLS on `week_item_volumes` table
    - Add policy for authenticated users to read all volume needs
    - Add policy for authenticated users to insert/update volume needs

  This table stores the "Volume Needed" per item per week, which is separate from
  the "Awarded Volume" stored in quotes.awarded_volume (which tracks volume allocated
  to each supplier).
*/

-- Create the table
CREATE TABLE IF NOT EXISTS public.week_item_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  volume_needed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (week_id, item_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_week_id ON public.week_item_volumes(week_id);
CREATE INDEX IF NOT EXISTS idx_week_item_volumes_item_id ON public.week_item_volumes(item_id);

-- Enable RLS
ALTER TABLE public.week_item_volumes ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all volume needs
CREATE POLICY "Authenticated users can read volume needs"
  ON public.week_item_volumes
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert volume needs
CREATE POLICY "Authenticated users can insert volume needs"
  ON public.week_item_volumes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update volume needs
CREATE POLICY "Authenticated users can update volume needs"
  ON public.week_item_volumes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete volume needs
CREATE POLICY "Authenticated users can delete volume needs"
  ON public.week_item_volumes
  FOR DELETE
  TO authenticated
  USING (true);
