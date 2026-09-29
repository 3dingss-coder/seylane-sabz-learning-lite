import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { SessionProvider } from './store';
import App from './App';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root پیدا نشد');

createRoot(el).render(
  <StrictMode>
    <HashRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </HashRouter>
  </StrictMode>,
);
