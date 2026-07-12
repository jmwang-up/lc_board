import { createContext, useContext, type ReactNode } from 'react';
import type { DashboardRepository } from '../db/DashboardRepository';

const RepositoryContext = createContext<DashboardRepository | null>(null);

export function RepositoryProvider({ repository, children }: { repository: DashboardRepository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): DashboardRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('RepositoryProvider is missing');
  return repository;
}
