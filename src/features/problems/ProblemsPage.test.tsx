import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
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
  { id: 'old', problemId: 'p2', practicedOn: '2026-07-11', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], solutionMarkdown: '## 旧思路\n- 枚举', createdAt: '2026-07-11T09:00:00Z', updatedAt: '' },
  { id: 'new', problemId: 'p2', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: ['binary-search'], solutionMarkdown: '## 新思路\n- 二分查找', createdAt: '2026-07-12T09:00:00Z', updatedAt: '' },
  { id: 'other', problemId: 'p1', practicedOn: '2026-07-12', primaryAlgorithmId: 'binary-search', secondaryAlgorithmIds: [], solutionMarkdown: '', createdAt: '2026-07-12T10:00:00Z', updatedAt: '' },
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

it('navigates from an active calendar date to an exact URL-backed date filter', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/problems" element={<Location />} />
  </Routes></MemoryRouter></RepositoryProvider>);
  await userEvent.click(await screen.findByRole('link', { name: '2026-07-12：2 次练习' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/problems?from=2026-07-12&to=2026-07-12');
});

it('reads combined filters from the URL and expands newest-first labeled history', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems?query=21&difficulty=medium&primaryAlgorithmId=dp&from=2026-07-11&to=2026-07-12']}>
    <ProblemsPage />
  </MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('heading', { name: '寻找峰值' })).toBeInTheDocument();
  expect(screen.queryByText('两数之和')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /查看练习记录/ }));
  const history = screen.getByRole('list', { name: '寻找峰值的练习记录' });
  const entries = Array.from(history.children);
  expect(entries[0]).toHaveTextContent('2026-07-12');
  expect(entries[0]).toHaveTextContent('主：动态规划');
  expect(entries[0]).toHaveTextContent('辅：二分查找');
  expect(entries[1]).toHaveTextContent('2026-07-11');
});

it('renders each practice solution under its date and an empty-solution placeholder', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems']}>
    <ProblemsPage />
  </MemoryRouter></RepositoryProvider>);
  const secondProblem = (await screen.findByRole('heading', { name: '寻找峰值' })).closest('tr')!;
  await userEvent.click(within(secondProblem).getByRole('button', { name: '查看练习记录' }));
  const secondHistory = screen.getByRole('list', { name: '寻找峰值的练习记录' });
  const newPractice = within(secondHistory).getAllByRole('listitem').find(entry => within(entry).queryByText('2026-07-12'))!;
  const oldPractice = within(secondHistory).getAllByRole('listitem').find(entry => within(entry).queryByText('2026-07-11'))!;
  expect(within(newPractice).getByRole('heading', { name: '新思路' })).toBeInTheDocument();
  expect(within(oldPractice).getByRole('heading', { name: '旧思路' })).toBeInTheDocument();

  const firstProblem = screen.getByRole('heading', { name: '两数之和' }).closest('tr')!;
  await userEvent.click(within(firstProblem).getByRole('button', { name: '查看练习记录' }));
  expect(within(screen.getByRole('list', { name: '两数之和的练习记录' })).getByText('尚未记录解题思路')).toBeInTheDocument();
});

it('opens the solution editor with only the selected practice Markdown', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems/p2']}>
    <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>
  </MemoryRouter></RepositoryProvider>);
  const history = await screen.findByRole('list', { name: '寻找峰值的练习记录' });
  const selectedPractice = Array.from(history.querySelectorAll<HTMLLIElement>(':scope > li')).find(entry => within(entry).queryByText('2026-07-12'))!;
  await userEvent.click(within(selectedPractice).getByRole('button', { name: '编辑思路' }));

  expect(screen.getByRole('dialog', { name: '编辑解题思路' })).toBeInTheDocument();
  expect(screen.getByLabelText('解题思路')).toHaveValue('## 新思路\n- 二分查找');
  expect(screen.getByLabelText('解题思路')).not.toHaveValue('## 旧思路\n- 枚举');
});

it('reloads history after saving an edited practice solution', async () => {
  let currentPractices = [...practices];
  const updatePracticeSolution = vi.fn(async (id: string, solutionMarkdown: string) => {
    currentPractices = currentPractices.map(item => item.id === id ? { ...item, solutionMarkdown } : item);
    return currentPractices.find(item => item.id === id)!;
  });
  const repo = { ...repository, listPractices: vi.fn(async () => currentPractices), updatePracticeSolution } as DashboardRepository;
  render(<RepositoryProvider repository={repo}><MemoryRouter initialEntries={['/problems/p2']}>
    <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>
  </MemoryRouter></RepositoryProvider>);
  const history = await screen.findByRole('list', { name: '寻找峰值的练习记录' });
  const selectedPractice = Array.from(history.querySelectorAll<HTMLLIElement>(':scope > li')).find(entry => within(entry).queryByText('2026-07-12'))!;
  await userEvent.click(within(selectedPractice).getByRole('button', { name: '编辑思路' }));
  const editor = screen.getByLabelText('解题思路');
  await userEvent.clear(editor);
  await userEvent.type(editor, '## 保存后的思路');
  await userEvent.click(screen.getByRole('button', { name: '保存思路' }));

  expect(await screen.findByRole('heading', { name: '保存后的思路' })).toBeInTheDocument();
  await waitFor(() => expect(repo.listPractices).toHaveBeenCalledTimes(2));
});

it('shows only the requested problem on the detail route', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter initialEntries={['/problems/p2']}>
    <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>
  </MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('heading', { name: '寻找峰值' })).toBeInTheDocument();
  expect(screen.queryByText('两数之和')).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: '寻找峰值的练习记录' })).toBeInTheDocument();
});

it('confirms individual practice deletion and reloads history after success', async () => {
  let currentPractices = [...practices];
  const deletePractice = vi.fn(async (id: string) => { currentPractices = currentPractices.filter(item => item.id !== id); });
  const repo = { ...repository, listPractices: vi.fn(async () => currentPractices), deletePractice } as DashboardRepository;
  render(<RepositoryProvider repository={repo}><MemoryRouter initialEntries={['/problems/p2']}>
    <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>
  </MemoryRouter></RepositoryProvider>);
  const history = await screen.findByRole('list', { name: '寻找峰值的练习记录' });
  await userEvent.click(within(history).getByRole('button', { name: '删除 2026-07-12 的练习' }));
  const dialog = screen.getByRole('dialog', { name: '删除练习' });
  expect(within(dialog).getByText(/2026-07-12/)).toBeInTheDocument();
  const remove = within(dialog).getByRole('button', { name: '确认删除练习' });
  expect(remove).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: '我确认删除这条练习' }));
  await userEvent.click(remove);
  expect(deletePractice).toHaveBeenCalledWith('new');
  expect(await screen.findByRole('list', { name: '寻找峰值的练习记录' })).not.toHaveTextContent('2026-07-12');
  expect(repo.listPractices).toHaveBeenCalledTimes(2);
});

it('confirms problem cascade with the exact affected practice count and reloads after success', async () => {
  let currentProblems = [...problems];
  let currentPractices = [...practices];
  const deleteProblem = vi.fn(async (id: string) => {
    currentProblems = currentProblems.filter(item => item.id !== id);
    currentPractices = currentPractices.filter(item => item.problemId !== id);
  });
  const repo = {
    ...repository,
    listProblems: vi.fn(async () => currentProblems),
    listPractices: vi.fn(async () => currentPractices),
    deleteProblem,
  } as DashboardRepository;
  render(<RepositoryProvider repository={repo}><MemoryRouter initialEntries={['/problems']}><ProblemsPage /></MemoryRouter></RepositoryProvider>);
  const row = (await screen.findByRole('heading', { name: '寻找峰值' })).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: '删除题目寻找峰值' }));
  const dialog = screen.getByRole('dialog', { name: '删除题目寻找峰值' });
  expect(within(dialog).getByText('将同时永久删除 2 条练习')).toBeInTheDocument();
  const remove = within(dialog).getByRole('button', { name: '确认删除题目及 2 条练习' });
  expect(remove).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: '我确认删除寻找峰值及 2 条练习' }));
  await userEvent.click(remove);
  expect(deleteProblem).toHaveBeenCalledWith('p2', 2);
  expect(await screen.findByRole('heading', { name: '两数之和' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '寻找峰值' })).not.toBeInTheDocument();
  expect(repo.listProblems).toHaveBeenCalledTimes(2);
});

it('keeps deletion failures accessible inside the confirmation modal', async () => {
  const repo = { ...repository, deleteProblem: vi.fn().mockRejectedValue(new Error('数据已变化，请重新确认')) } as DashboardRepository;
  render(<RepositoryProvider repository={repo}><MemoryRouter initialEntries={['/problems']}><ProblemsPage /></MemoryRouter></RepositoryProvider>);
  const row = (await screen.findByRole('heading', { name: '寻找峰值' })).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: '删除题目寻找峰值' }));
  const dialog = screen.getByRole('dialog', { name: '删除题目寻找峰值' });
  await userEvent.click(within(dialog).getByRole('checkbox', { name: '我确认删除寻找峰值及 2 条练习' }));
  await userEvent.click(within(dialog).getByRole('button', { name: '确认删除题目及 2 条练习' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('数据已变化，请重新确认');
});

it.each([
  ['/problems', <ProblemsPage />],
  ['/problems/p2', <Routes><Route path="/problems/:problemId" element={<ProblemsPage />} /></Routes>],
])('replaces loading with an actionable alert when loading %s fails', async (entry, page) => {
  const failingRepository = { ...repository, listPractices: async () => { throw new Error('storage unavailable'); } };
  render(<RepositoryProvider repository={failingRepository}><MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('题目记录加载失败');
  expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  expect(screen.queryByText('正在加载…')).not.toBeInTheDocument();
});

it('replaces dashboard loading with an actionable alert when loading fails', async () => {
  const failingRepository = { ...repository, listAlgorithms: async () => { throw new Error('storage unavailable'); } };
  render(<RepositoryProvider repository={failingRepository}><MemoryRouter><DashboardPage /></MemoryRouter></RepositoryProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('算法看板加载失败');
  expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  expect(screen.queryByText('正在加载…')).not.toBeInTheDocument();
});
