import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DashboardRepository } from '../db/DashboardRepository';
import { App } from './App';
import { RepositoryProvider } from './RepositoryContext';

const repository: DashboardRepository = {
  async createAlgorithm() { throw new Error('not implemented'); },
  async renameAlgorithm() {},
  async replaceAndDeleteAlgorithm() {},
  async deleteUnusedAlgorithm() {},
  async deleteAlgorithmAndPractices() {},
  async recordPractice() { throw new Error('not implemented'); },
  async listAlgorithms() { return []; },
  async listProblems() { return []; },
  async listPractices() { return []; },
  async deletePractice() {},
  async deleteProblem() {},
  async getDataCounts() { return { problems: 0, practices: 0, algorithms: 0 }; },
  async exportBackup() { return { schemaVersion: 1, exportedAt: new Date().toISOString(), problems: [], practices: [], algorithms: [] }; },
  async importBackup() { return { addedProblems: 0, addedPractices: 0, addedAlgorithms: 0, skippedIds: [] }; },
  async clearAll() {},
};

it('navigates among the three first-release pages', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter><App /></MemoryRouter></RepositoryProvider>);
  expect(screen.getByRole('heading', { name: '算法看板' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '题目记录' }));
  expect(screen.getByRole('heading', { name: '题目记录' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '数据管理' }));
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeInTheDocument();
  expect(screen.getByTestId('record-practice')).toBeInTheDocument();
});
