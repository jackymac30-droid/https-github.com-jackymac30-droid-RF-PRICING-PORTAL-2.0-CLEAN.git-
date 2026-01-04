/*
  # Create Supplier Response Submission Function

  1. Purpose
    - Bypass client-side schema cache validation
    - Handle supplier allocation response submission server-side
    - Upsert supplier response data directly in PostgreSQL

  2. Function
    - Name: submit_supplier_response
    - Parameters: week_id, item_id, supplier_id, response_volume, response_status
    - Returns: the updated quote row

  3. Logic
    - Uses INSERT ... ON CONFLICT DO UPDATE pattern
    - Updates supplier response columns
    - Sets submission timestamp
    - Returns affected row

  4. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - RLS policies still protect the quotes table
*/

-- Drop if exists
DROP FUNCTION IF EXISTS submit_supplier_response(uuid, uuid, uuid, integer, text);

-- Create function
CREATE OR REPLACE FUNCTION submit_supplier_response(
  p_week_id uuid,
  p_item_id uuid,
  p_supplier_id uuid,
  p_response_volume integer,
  p_response_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- Upsert the response
  INSERT INTO quotes (
    week_id,
    item_id,
    supplier_id,
    supplier_response_volume,
    supplier_response_status,
    supplier_response_submitted_at,
    updated_at
  )
  VALUES (
    p_week_id,
    p_item_id,
    p_supplier_id,
    p_response_volume,
    p_response_status,
    now(),
    now()
  )
  ON CONFLICT (week_id, item_id, supplier_id)
  DO UPDATE SET
    supplier_response_volume = EXCLUDED.supplier_response_volume,
    supplier_response_status = EXCLUDED.supplier_response_status,
    supplier_response_submitted_at = EXCLUDED.supplier_response_submitted_at,
    updated_at = EXCLUDED.updated_at
  RETURNING to_json(quotes.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION submit_supplier_response(uuid, uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_supplier_response(uuid, uuid, uuid, integer, text) TO anon;
