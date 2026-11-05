import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import App from './App.jsx';
import { PrefsProvider } from './context/PrefsContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PrefsProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </PrefsProvider>
    </BrowserRouter>
  </StrictMode>,
);
