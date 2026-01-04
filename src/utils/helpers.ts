import type { Week } from '../types';

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekDateRange(week: Week): string {
  const start = parseDate(week.start_date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const startMonth = start.toLocaleString('en-US', { month: 'short' });
  const endMonth = end.toLocaleString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getNegotiationStatusLabel(status: string): string {
  switch (status) {
    case 'awaiting_supplier_quote':
      return 'Awaiting Your Quote';
    case 'awaiting_rf_response':
      return 'Awaiting RF Response';
    case 'awaiting_supplier_response':
      return 'Awaiting Your Response';
    case 'accepted':
      return 'Accepted';
    case 'finalized':
      return 'Finalized';
    default:
      return status;
  }
}

export function getNegotiationStatusColor(status: string): string {
  switch (status) {
    case 'awaiting_supplier_quote':
      return 'bg-yellow-100 text-yellow-800';
    case 'awaiting_rf_response':
      return 'bg-blue-100 text-blue-800';
    case 'awaiting_supplier_response':
      return 'bg-orange-100 text-orange-800';
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'finalized':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
