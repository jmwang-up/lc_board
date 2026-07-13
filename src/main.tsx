import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { RepositoryProvider } from './app/RepositoryContext';
import './app/styles.css';
import { DashboardDatabase } from './db/DashboardDatabase';
import { DexieDashboardRepository } from './db/DexieDashboardRepository';

const repository = new DexieDashboardRepository(new DashboardDatabase());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RepositoryProvider repository={repository}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RepositoryProvider>
  </StrictMode>,
);
