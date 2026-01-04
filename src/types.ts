export interface Week {
  id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'finalized' | 'closed';
  emergency_unlock_enabled: boolean;
  emergency_unlock_reason?: string;
  emergency_unlock_by_user?: string;
  emergency_unlock_at?: string;
  finalized_at?: string;
  finalized_by?: string;
  allocation_submitted?: boolean;
  allocation_submitted_at?: string;
  allocation_submitted_by?: string;
  volume_finalized?: boolean;
  volume_finalized_at?: string;
  volume_finalized_by?: string;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  pack_size: string;
  category: 'strawberry' | 'blueberry' | 'blackberry' | 'raspberry';
  organic_flag: 'CONV' | 'ORG';
  display_order: number;
  unit_type: 'pallets' | 'cases';
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

// Quote: One record per (week_id, item_id, supplier_id) combination
// This allows multiple suppliers to price the same SKU independently
// RF can compare all quotes for a SKU and counter/confirm per supplier
// 
// CRITICAL BUSINESS RULE: Pricing submission ≠ allocation eligibility
// - All suppliers can submit pricing (data collection)
// - RF explicitly marks which suppliers are eligible_for_award
// - Only eligible_for_award suppliers participate in allocation
// - Weighted averages calculated only on eligible suppliers
//
// Volume fields lifecycle:
//   - awarded_volume: RF's draft award → final after accepting supplier response
//   - offered_volume: Copied from awarded_volume when sent to supplier
//   - supplier_volume_accepted: Supplier's response (accept or revise)
export interface Quote {
  id: string;
  week_id: string;
  item_id: string;
  supplier_id: string;
  supplier_fob?: number;
  supplier_dlvd?: number;
  rf_counter_fob?: number;
  supplier_response?: 'accept' | 'revise';
  supplier_revised_fob?: number;
  rf_final_fob?: number;
  // Eligibility status: RF-controlled decision layer
  // Only 'eligible_for_award' suppliers appear in allocation interface
  supplier_eligibility_status?: 'submitted' | 'reviewed' | 'feedback_sent' | 'eligible_for_award' | 'not_used';
  offered_volume?: number;
  supplier_volume_response?: 'accept' | 'update' | 'decline';
  supplier_volume_accepted?: number;
  supplier_volume_response_notes?: string;
  awarded_volume?: number;
  supplier_volume_approval?: 'pending' | 'accepted' | 'revised';
  supplier_volume_notes?: string;
  supplier_pricing_finalized?: boolean;
  supplier_pricing_finalized_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  week_id: string;
  item_id?: string;
  supplier_id?: string;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  user_id: string;
  reason?: string;
  created_at: string;
}

export interface Session {
  user_id: string;
  user_name: string;
  role: 'rf' | 'supplier';
  supplier_id?: string;
}

export interface QuoteWithDetails extends Quote {
  item?: Item;
  supplier?: Supplier;
  week?: Week;
}

export interface SupplierRanking {
  supplier_id: string;
  supplier_name: string;
  rank: number;
  price: number;
  supplier_fob?: number;
  rf_counter_fob?: number;
  supplier_revised_fob?: number;
  rf_final_fob?: number;
}

export interface SKUStatus {
  item_id: string;
  item_name: string;
  pack_size: string;
  category: string;
  organic_flag: string;
  status: 'needs_supplier' | 'needs_rf_counter' | 'needs_supplier_response' | 'needs_rf_final' | 'complete';
  rankings: SupplierRanking[];
  average_fob?: number;
}

export interface SupplierStats {
  supplier_id: string;
  supplier_name: string;
  skus_quoted: number;
  average_fob: number;
  lowest_price_count: number;
  highest_price_count: number;
}

export interface AnalyticsBySKU {
  sku_name: string;
  organic_flag: string;
  supplier_name: string;
  avg_fob: number;
  lowest_fob: number;
  lowest_week: number;
  highest_fob: number;
  highest_week: number;
}

export interface AnalyticsBySupplier {
  supplier_name: string;
  avg_fob: number;
  times_cheapest: number;
  times_expensive: number;
}

export interface WeekItemVolume {
  id: string;
  week_id: string;
  item_id: string;
  volume_needed: number;
  created_at: string;
  updated_at: string;
}
