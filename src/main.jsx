import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { applyPalette, DEFAULT_PALETTE_ID } from './theme/palettes';

// Aplica a paleta padrão imediatamente (a da empresa é aplicada assim que o config carrega).
applyPalette(DEFAULT_PALETTE_ID);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
