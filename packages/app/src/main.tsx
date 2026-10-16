import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@agentry/design/styles.css';
import '@agentry/canvas/styles.css';
import './app.css';
import { initTheme, initScrollbars } from '@agentry/design';
import { App } from './App';

initTheme();
initScrollbars();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
