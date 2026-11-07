import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/Toast';
import { I18nProvider } from './i18n';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><I18nProvider><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></I18nProvider></BrowserRouter>
  </React.StrictMode>,
);
