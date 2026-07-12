import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { DashboardRepository } from '../../db/DashboardRepository';
import { RepositoryProvider } from '../../app/RepositoryContext';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ProblemsPage } from './ProblemsPage';

const algorithms = [
  { id: 'dp', name: '动态规划', color: '#2563eb', createdAt: '' },
  { id: 'binary-search', name: '二分查找', color: '#16a34a', createdAt: '' },
];
const problems = [
  { id: 'p1', leetcodeSlug: 'one', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy' as const, url: '#', createdAt: '' },
  { id: 'p2', leetcodeSlug: 'two', frontendQuestionId: '21', titleZh: '寻找峰值', difficulty: 'medium' as const, url: '#', createdAt: '' },
];
const practices = [
  { id: 'old', problemId: 'p2', practicedOn: '2026-07-11', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], createdAt: '2026-07-11T09:00:00Z', updatedAt: '' },
  { id: 'new', problemId: 'p2', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: ['binary-search'], createdAt: '2026-07-12T09:00:00Z', updatedAt: '' },
  { id: 'other', problemId: 'p1', practicedOn: '2026-07-12', primaryAlgorithmId: 'binary-search', secondaryAlgorithmIds: [], createdAt: '2026-07-12T10:00:00Z', updatedAt: '' },
];
const repository = {
  listAlgorithms: async () => algorithms,
  listProblems: async () => problems,
  listPractices: async () => practices,
} as DashboardRepository;

const Location = () => <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>;

it('navigates from a dashboard algorithm card to its primary filter', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter><Routes>
    <Route path="/" element={<><DashboardPage /><Location /></>} />
    <Route path="/problems" element={<Location />} />
  </Routes></MemoryRouter></RepositoryProvider>);
  await userEvent.click(await screen.findByRole('link', { name: /动态规划/ }));
  expect(screen.getByTestId('location')).toHaveTextContent('/problems?primaryAlgorithmId=dp');
});

it('reads combined filters from the URL and expands newest-first labeled history', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems?query=21&difficulty=medium&primaryAlgorithmId=dp&from=2026-07-11&to=2026-07-12']}>
    <ProblemsPage />
  </MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('heading', { name: '寻找峰值' })).toBeInTheDocument();
  expect(screen.queryByText('两数之和')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /查看练习记录/ }));
  const history = screen.getByRole('list', { name: '寻找峰值的练习记录' });
  const entries = within(history).getAllByRole('listitem');
  expect(entries[0]).toHaveTextContent('2026-07-12');
  expect(entries[0]).toHaveTextContent('主：动态规划');
  expect(entries[0]).toHaveTextContent('辅：二分查找');
  expect(entries[1]).toHaveTextContent('2026-07-11');
});

it('shows only the requested problem on the detail route', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems/p2']}>
    <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>
  </MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('heading', { name: '寻找峰值' })).toBeInTheDocument();
  expect(screen.queryByText('两数之和')).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: '寻找峰值的练习记录' })).toBeInTheDocument();
});
