import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/newsreader';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
