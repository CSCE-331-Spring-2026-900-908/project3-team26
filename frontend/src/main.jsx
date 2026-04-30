// Entry point: mounts the React app into <div id="root"> in index.html and
// wraps it in BrowserRouter so the page components can use react-router routes.
// StrictMode is enabled here so React can surface unsafe render patterns during development.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
