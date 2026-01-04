import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');

  console.error('❌ MISSING REQUIRED ENV VARS:', missing.join(', '));
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #fee;">
      <div style="max-width: 500px; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <h1 style="color: #dc2626; margin: 0 0 1rem 0;">Configuration Error</h1>
        <p style="margin: 0 0 1rem 0;">Missing required environment variables:</p>
        <ul style="margin: 0 0 1rem 0; color: #dc2626; font-weight: bold;">
          ${missing.map(v => `<li>${v}</li>`).join('')}
        </ul>
        <p style="margin: 0; color: #666; font-size: 0.9rem;">
          Contact your administrator or check deployment configuration.
        </p>
      </div>
    </div>
  `;
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const maskedUrl = supabaseUrl.replace(/^(https?:\/\/[^.]+).*$/, '$1...');
console.log('✓ Supabase env loaded:', maskedUrl);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  console.log('🚀 Starting app render...');
  console.log('📦 Environment check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseAnonKey,
    rootElement: !!rootElement
  });
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('✅ App rendered successfully');
} catch (error: any) {
  console.error('❌ Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; background: #fee; padding: 20px;">
      <div style="max-width: 600px; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <h1 style="color: #dc2626; margin: 0 0 1rem 0; font-size: 24px;">Application Error</h1>
        <p style="margin: 0 0 1rem 0; color: #333;">The application failed to load. Please check the browser console (F12) for details.</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 1rem; margin: 1rem 0;">
          <p style="margin: 0; color: #991b1b; font-family: monospace; font-size: 14px; word-break: break-all;">
            ${error?.message || error?.toString() || 'Unknown error'}
          </p>
        </div>
        <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          Reload Page
        </button>
      </div>
    </div>
  `;
}
