import React, { useState } from 'react';
import { Download, FileText, Table, Calendar, Mail } from 'lucide-react';
import { exportToExcel, exportToPDF, scheduleReport, getScheduledReports, deleteScheduledReport, type ReportData } from '../utils/exportService';

interface ExportDataProps {
  data: any[];
  filename: string;
  headers?: string[];
  title?: string;
  summary?: Record<string, any>;
}

export function ExportData({ data, filename, headers, title = 'Report', summary }: ExportDataProps) {
  const [exporting, setExporting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleEmail, setScheduleEmail] = useState('');
  const scheduledReports = getScheduledReports();

  const exportToCSV = () => {
    setExporting(true);
    try {
      if (data.length === 0) return;

      const keys = headers || Object.keys(data[0]);
      const csvHeaders = keys.join(',');
      const csvRows = data.map(row =>
        keys.map(key => {
          const value = row[key];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      );

      const csv = [csvHeaders, ...csvRows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const reportData: ReportData = {
        title: title,
        generatedAt: new Date(),
        data: data,
        summary: summary,
      };
      await exportToPDF(reportData, filename);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const reportData: ReportData = {
        title: title,
        generatedAt: new Date(),
        data: data,
        summary: summary,
      };
      await exportToExcel(reportData, filename);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  const handleScheduleReport = () => {
    scheduleReport(title, scheduleType, scheduleEmail || undefined);
    setShowScheduleModal(false);
    setScheduleEmail('');
  };

  const exportToJSON = () => {
    setExporting(true);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={exportToCSV}
          disabled={exporting || data.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Table className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'CSV'}
        </button>
        <button
          onClick={handleExportExcel}
          disabled={exporting || data.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Table className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'Excel'}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting || data.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <FileText className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'PDF'}
        </button>
        <button
          onClick={() => setShowScheduleModal(true)}
          disabled={data.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Calendar className="w-4 h-4" />
          Schedule
        </button>
      </div>

      {scheduledReports.length > 0 && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-4">
          <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Scheduled Reports
          </h4>
          <div className="space-y-2">
            {scheduledReports.map((report: any) => (
              <div key={report.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white/80">{report.name}</span>
                  <span className="text-white/50 ml-2">({report.schedule})</span>
                </div>
                <button
                  onClick={() => deleteScheduledReport(report.id)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-slate-900 rounded-xl border border-white/20 p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">Schedule Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">Frequency</label>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleScheduleReport}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg"
                >
                  Schedule
                </button>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
