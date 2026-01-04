/*
  # Add Performance Indexes

  1. Performance Improvements
    - Add indexes on frequently queried columns in quotes table
    - Add composite indexes for common query patterns
    - Optimize supplier and week lookups

  2. Indexes Created
    - quotes(week_id) - for filtering by week
    - quotes(supplier_id) - for filtering by supplier
    - quotes(item_id) - for filtering by item
    - quotes(week_id, supplier_id) - for combined lookups
    - quotes(week_id, item_id) - for SKU status lookups
*/

CREATE INDEX IF NOT EXISTS idx_quotes_week_id ON quotes(week_id);
CREATE INDEX IF NOT EXISTS idx_quotes_supplier_id ON quotes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_item_id ON quotes(item_id);
CREATE INDEX IF NOT EXISTS idx_quotes_week_supplier ON quotes(week_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_week_item ON quotes(week_id, item_id);
