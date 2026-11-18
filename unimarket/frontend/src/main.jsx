import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import { Toaster } from 'sonner';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={3500}
            toastOptions={{
              style: {
                borderRadius: '0.75rem',
                fontFamily: '"Inter Variable", sans-serif',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
