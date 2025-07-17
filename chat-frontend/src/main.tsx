import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

// A basic CSS file is also usually needed.
// We can create a placeholder for now.
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
