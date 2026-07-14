
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { StudioProvider } from './contexts/StudioContext';

// Global error interceptor to gracefully capture and suppress any Supabase unhandled refresh token errors
if (typeof window !== 'undefined') {
  const isRefreshTokenError = (msg: string) => {
    const m = msg.toLowerCase();
    return m.includes('refresh token') || 
           m.includes('refresh_token_not_found') || 
           m.includes('invalid_grant') || 
           m.includes('invalid-refresh-token') ||
           m.includes('invalid refresh token');
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason) {
      const msg = String(reason.message || reason || '').toLowerCase();
      if (isRefreshTokenError(msg)) {
        console.warn('[AUTH_DEBUG] Suppressed unhandled rejection for invalid refresh token:', reason);
        event.preventDefault(); // Prevents it from showing up in console as uncaught and crashing the AI Studio error tracker
        
        // Clear corrupted session so user can start fresh
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (key.includes('auth-token') || key.includes('sb-') || key.includes('supabase.auth.'))) {
              localStorage.removeItem(key);
            }
          }
          for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (key && (key.includes('auth-token') || key.includes('sb-') || key.includes('supabase.auth.'))) {
              sessionStorage.removeItem(key);
            }
          }
        } catch (e) {
          console.error('[AUTH_DEBUG] Error clearing local session storage:', e);
        }
      }
    }
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || '').toLowerCase();
    if (isRefreshTokenError(msg)) {
      console.warn('[AUTH_DEBUG] Suppressed global error for invalid refresh token:', event.error);
      event.preventDefault();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <StudioProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </StudioProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

(window as any).__react_mounted = true;
