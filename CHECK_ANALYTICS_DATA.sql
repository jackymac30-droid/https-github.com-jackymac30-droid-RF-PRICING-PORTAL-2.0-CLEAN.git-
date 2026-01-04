-- ============================================
-- VERIFY DATA FOR ANALYTICS
-- Run this in Supabase SQL Editor to check if data exists
-- ============================================

-- 1. Check weeks
SELECT 
  'Weeks' as check_type,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
  COUNT(*) FILTER (WHERE status = 'finalized') as finalized_count,
  COUNT(*) FILTER (WHERE status = 'open') as open_count
FROM weeks;

-- 2. Check quotes with pricing data
SELECT 
  'Quotes' as check_type,
  COUNT(*) as total_quotes,
  COUNT(*) FILTER (WHERE supplier_fob IS NOT NULL) as with_supplier_fob,
  COUNT(*) FILTER (WHERE rf_counter_fob IS NOT NULL) as with_counter,
  COUNT(*) FILTER (WHERE rf_final_fob IS NOT NULL) as with_final_price,
  COUNT(*) FILTER (WHERE supplier_revised_fob IS NOT NULL) as with_revised
FROM quotes;

-- 3. Check quotes per week (closed/finalized only)
SELECT 
  w.week_number,
  w.status,
  COUNT(q.id) as quote_count,
  COUNT(q.id) FILTER (WHERE q.rf_final_fob IS NOT NULL) as with_final_price,
  COUNT(q.id) FILTER (WHERE q.supplier_revised_fob IS NOT NULL) as with_revised,
  COUNT(q.id) FILTER (WHERE q.supplier_fob IS NOT NULL) as with_supplier_price
FROM weeks w
LEFT JOIN quotes q ON q.week_id = w.id
WHERE w.status IN ('closed', 'finalized')
GROUP BY w.week_number, w.status
ORDER BY w.week_number;

-- 4. Check quotes per item (for closed weeks)
SELECT 
  i.name || ' ' || i.pack_size as item_name,
  COUNT(DISTINCT q.week_id) as weeks_with_quotes,
  COUNT(q.id) as total_quotes,
  COUNT(q.id) FILTER (WHERE q.rf_final_fob IS NOT NULL) as with_final_price
FROM items i
LEFT JOIN quotes q ON q.item_id = i.id
LEFT JOIN weeks w ON w.id = q.week_id AND w.status IN ('closed', 'finalized')
GROUP BY i.id, i.name, i.pack_size
ORDER BY i.display_order;

-- 5. Sample quotes with complete workflow data
SELECT 
  w.week_number,
  s.name as supplier,
  i.name || ' ' || i.pack_size as item,
  q.supplier_fob,
  q.rf_counter_fob,
  q.supplier_response,
  q.supplier_revised_fob,
  q.rf_final_fob,
  CASE 
    WHEN q.rf_final_fob IS NOT NULL THEN q.rf_final_fob
    WHEN q.supplier_revised_fob IS NOT NULL THEN q.supplier_revised_fob
    WHEN q.supplier_fob IS NOT NULL THEN q.supplier_fob
    ELSE NULL
  END as effective_price
FROM quotes q
JOIN weeks w ON q.week_id = w.id
JOIN suppliers s ON q.supplier_id = s.id
JOIN items i ON q.item_id = i.id
WHERE w.status IN ('closed', 'finalized')
ORDER BY w.week_number, i.display_order, s.name
LIMIT 20;

