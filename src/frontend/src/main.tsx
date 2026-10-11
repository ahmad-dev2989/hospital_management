import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Global uncaught error fallback
window.addEventListener('error', (event) => {
  console.error('Global uncaught window error:', event.error || event.message);
  const root = document.getElementById('root');
  if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
    root.innerHTML = `
      <div style="min-height:100vh;width:100vw;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;padding:2rem;font-family:system-ui,sans-serif;">
        <div style="max-width:600px;width:100%;background:#1e293b;border:1px solid #ef4444;border-radius:12px;padding:2rem;text-align:center;">
          <h2 style="color:#ef4444;margin-bottom:0.5rem;">Clinical Workstation Initialization Error</h2>
          <p style="color:#94a3b8;font-size:0.875rem;margin-bottom:1.5rem;">${event.message || 'An unhandled script error prevented workstation startup.'}</p>
          <button onclick="localStorage.clear();sessionStorage.clear();window.location.reload();" style="background:#0d9488;color:#fff;border:none;padding:0.6rem 1.2rem;border-radius:6px;cursor:pointer;font-weight:600;">
            Clear Local Storage & Reload
          </button>
        </div>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
