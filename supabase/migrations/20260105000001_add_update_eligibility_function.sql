/*
  # Function to Update Supplier Eligibility Status
  
  Allows RF to update supplier eligibility status for quotes.
  This is the core function that implements the business rule:
  "Pricing submission ≠ allocation eligibility"
*/

CREATE OR REPLACE FUNCTION update_supplier_eligibility(
  quote_id_param uuid,
  new_status text,
  updated_by_user text DEFAULT 'RF Manager'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate status
  IF new_status NOT IN ('submitted', 'reviewed', 'feedback_sent', 'eligible_for_award', 'not_used') THEN
    RAISE EXCEPTION 'Invalid eligibility status: %', new_status;
  END IF;

  -- Update the quote
  UPDATE quotes
  SET 
    supplier_eligibility_status = new_status,
    updated_at = now()
  WHERE id = quote_id_param;

  -- Log the change
  INSERT INTO audit_log (
    week_id,
    item_id,
    supplier_id,
    field_changed,
    old_value,
    new_value,
    user_id,
    reason
  )
  SELECT 
    week_id,
    item_id,
    supplier_id,
    'supplier_eligibility_status',
    (SELECT supplier_eligibility_status FROM quotes WHERE id = quote_id_param),
    new_status,
    updated_by_user,
    'RF eligibility decision'
  FROM quotes
  WHERE id = quote_id_param;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION update_supplier_eligibility IS 
'Updates supplier eligibility status. Only eligible_for_award suppliers appear in allocation interface.';

