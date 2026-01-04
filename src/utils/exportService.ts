// Advanced Export Service for PDF and Excel

export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  includeCharts?: boolean;
  dateRange?: { start: Date; end: Date };
  filters?: Record<string, any>;
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  data: any[];
  summary?: Record<string, any>;
}

/**
 * Export data to Excel format
 */
export async function exportToExcel(data: ReportData, filename: string): Promise<void> {
  // For Excel export, we'll create a CSV that can be opened in Excel
  // In production, you'd use a library like 'xlsx' or 'exceljs'
  
  const csv = convertToCSV(data.data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to PDF format
 */
export async function exportToPDF(data: ReportData, filename: string): Promise<void> {
  // For PDF export, we'll use the browser's print functionality
  // In production, you'd use a library like 'jspdf' or 'puppeteer'
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Unable to open print window');
  }

  const html = generatePDFHTML(data);
  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
}

/**
 * Generate HTML for PDF export
 */
function generatePDFHTML(data: ReportData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          h1 {
            color: #10b981;
            border-bottom: 2px solid #10b981;
            padding-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #10b981;
            color: white;
          }
          .summary {
            margin-top: 20px;
            padding: 15px;
            background-color: #f3f4f6;
            border-radius: 5px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>${data.title}</h1>
        <p>Generated: ${data.generatedAt.toLocaleString()}</p>
        
        ${data.summary ? `
          <div class="summary">
            <h3>Summary</h3>
            ${Object.entries(data.summary).map(([key, value]) => `
              <p><strong>${key}:</strong> ${value}</p>
            `).join('')}
          </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              ${Object.keys(data.data[0] || {}).map(key => `<th>${key}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.data.map(row => `
              <tr>
                ${Object.values(row).map(val => `<td>${val}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Robinson Fresh - Volume & Pricing Management System</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Schedule a report (stores in localStorage for demo)
 * In production, this would integrate with a backend scheduler
 */
export function scheduleReport(
  reportName: string,
  schedule: 'daily' | 'weekly' | 'monthly',
  email?: string
): void {
  const scheduledReports = JSON.parse(
    localStorage.getItem('scheduledReports') || '[]'
  );
  
  scheduledReports.push({
    id: Date.now().toString(),
    name: reportName,
    schedule,
    email,
    createdAt: new Date().toISOString(),
    enabled: true,
  });
  
  localStorage.setItem('scheduledReports', JSON.stringify(scheduledReports));
}

/**
 * Get scheduled reports
 */
export function getScheduledReports(): any[] {
  return JSON.parse(localStorage.getItem('scheduledReports') || '[]');
}

/**
 * Delete a scheduled report
 */
export function deleteScheduledReport(reportId: string): void {
  const reports = getScheduledReports();
  const filtered = reports.filter((r: any) => r.id !== reportId);
  localStorage.setItem('scheduledReports', JSON.stringify(filtered));
}

