import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Robinson Fresh - Pricing Portal Demo</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .card-elevated { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .hover\\:shadow-strong:hover { box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
    .btn-primary { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; border: none; cursor: pointer; transition: all 0.3s; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }
    .btn-secondary { background: white; color: #374151; padding: 10px 20px; border-radius: 8px; font-weight: 600; border: 1px solid #d1d5db; cursor: pointer; transition: all 0.3s; }
    .btn-secondary:hover { background: #f9fafb; }
  </style>
  <script>
    tailwind.config = { theme: { extend: { colors: { primary: { 500: '#22c55e', 600: '#16a34a' }, accent: { 500: '#d97706' } } } } }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;
    const mockData = {
      users: [
        { id: '1', name: 'RF Manager', email: 'rf@robinsonfresh.com', role: 'rf' },
        { id: '2', name: 'Berry Best', email: 'berrybest@example.com', role: 'supplier', supplier_id: 's1' }
      ],
      weeks: [{ id: 'w1', week_number: 6, start_date: '2026-01-05', end_date: '2026-01-11', status: 'open' }],
      items: [
        { id: 'i1', name: 'Strawberries', pack_size: '8x1lb', category: 'strawberry', organic_flag: 'CONV' },
        { id: 'i2', name: 'Blueberries', pack_size: '12x6oz', category: 'blueberry', organic_flag: 'CONV' }
      ],
      suppliers: [{ id: 's1', name: 'Berry Best', email: 'berrybest@example.com' }]
    };

    const initialQuotes = [
      { id: 'q1', week_id: 'w1', item_id: 'i1', supplier_id: 's1', supplier_fob: 24.50, supplier_dlvd: 26.00 },
      { id: 'q2', week_id: 'w1', item_id: 'i2', supplier_id: 's1', supplier_fob: 18.75, supplier_dlvd: 20.25 }
    ];

    function App() {
      const [session, setSession] = useState(null);
      const [quotes] = useState(initialQuotes);

      if (!session) {
        return (
          <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-lime-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Robinson Fresh</h1>
                <p className="text-gray-600">Pricing Portal Demo</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Demo Accounts:</p>
                <div className="space-y-2">
                  <button onClick={() => setSession(mockData.users[0])} className="w-full text-left px-4 py-2 bg-white rounded border hover:bg-blue-50">
                    RF Manager: rf@robinsonfresh.com
                  </button>
                  <button onClick={() => setSession(mockData.users[1])} className="w-full text-left px-4 py-2 bg-white rounded border hover:bg-blue-50">
                    Berry Best: berrybest@example.com
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-md border-b-2 border-green-500">
            <div className="max-w-7xl mx-auto px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
                  <p className="text-sm text-gray-600">{session.role === 'rf' ? 'RF Manager Portal' : 'Supplier Portal'}</p>
                </div>
                <button onClick={() => setSession(null)} className="btn-secondary">Logout</button>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-6 py-8">
            <div className="card-elevated">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Week 6 Pricing</h2>
                <p className="text-sm text-gray-600">2026-01-05 to 2026-01-11</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pack Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">FOB Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DLVD Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockData.items.map((item, idx) => {
                      const quote = quotes[idx];
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-600">{item.organic_flag}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-900">{item.pack_size}</td>
                          <td className="px-6 py-4"><span className="text-green-600 font-medium">${quote.supplier_fob.toFixed(2)}</span></td>
                          <td className="px-6 py-4"><span className="text-gray-600">${quote.supplier_dlvd.toFixed(2)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(htmlContent, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html",
    },
  });
});