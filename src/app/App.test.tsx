import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { DashboardRepository } from '../db/DashboardRepository';
import type { Algorithm } from '../domain/models';
import { App } from './App';
import { RepositoryProvider } from './RepositoryContext';

const repository: DashboardRepository = {
  async createAlgorithm() { throw new Error('not implemented'); },
  async renameAlgorithm() {},
  async replaceAndDeleteAlgorithm() {},
  async deleteUnusedAlgorithm() {},
  async deleteAlgorithmAndPractices() {},
  async recordPractice() { throw new Error('not implemented'); },
  async updatePracticeSolution() { throw new Error('not implemented'); },
  async listAlgorithms() { return []; },
  async listProblems() { return []; },
  async listPractices() { return []; },
  async deletePractice() {},
  async deleteProblem() {},
  async getDataCounts() { return { problems: 0, practices: 0, algorithms: 0 }; },
  async exportBackup() { return { schemaVersion: 2, exportedAt: new Date().toISOString(), problems: [], practices: [], algorithms: [] }; },
  async importBackup() { return { addedProblems: 0, addedPractices: 0, addedAlgorithms: 0, skippedIds: [] }; },
  async clearAll() {},
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(count = 10) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}

function createAppRepository(createAlgorithmOverride?: DashboardRepository['createAlgorithm']) {
  let algorithms: Algorithm[] = [
    { id: 'hash', name: '哈希表', color: '#2563eb', createdAt: '' },
    { id: 'binary', name: '二分查找', color: '#16a34a', createdAt: '' },
  ];
  const recordPractice = vi.fn().mockResolvedValue({ problem: {}, practice: {} });
  const repo: DashboardRepository = {
    ...repository,
    recordPractice,
    async listAlgorithms() { return [...algorithms]; },
    async createAlgorithm(input) {
      const algorithm = createAlgorithmOverride
        ? await createAlgorithmOverride(input)
        : { id: `created-${algorithms.length}`, ...input, createdAt: '' };
      algorithms = [...algorithms, algorithm];
      return algorithm;
    },
  };
  return { repo, recordPractice };
}

function renderApp(
  initialEntry = '/',
  createAlgorithmOverride?: DashboardRepository['createAlgorithm'],
) {
  const state = createAppRepository(createAlgorithmOverride);
  render(<RepositoryProvider repository={state.repo}>
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  </RepositoryProvider>);
  return state;
}

function renderBrowserApp(
  initialEntry = '/',
  createAlgorithmOverride?: DashboardRepository['createAlgorithm'],
) {
  window.history.replaceState({}, '', initialEntry);
  const state = createAppRepository(createAlgorithmOverride);
  render(<RepositoryProvider repository={state.repo}>
    <BrowserRouter>
      <App />
      <LocationProbe />
    </BrowserRouter>
  </RepositoryProvider>);
  return state;
}

async function fillManualDraft(markdown = '## 草稿') {
  const dialog = within(screen.getByRole('dialog', { name: '记录练习' }));
  await userEvent.type(dialog.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
  await userEvent.click(dialog.getByRole('button', { name: '手动填写' }));
  await userEvent.type(dialog.getByLabelText('题号'), '1');
  await userEvent.type(dialog.getByLabelText('中文题名'), '两数之和');
  await userEvent.selectOptions(dialog.getByLabelText('难度'), 'medium');
  await userEvent.clear(dialog.getByLabelText('练习日期'));
  await userEvent.type(dialog.getByLabelText('练习日期'), '2026-07-23');
  await userEvent.selectOptions(dialog.getByLabelText('主要算法'), 'hash');
  await userEvent.click(dialog.getByRole('checkbox', { name: '二分查找' }));
  fireEvent.change(dialog.getByRole('textbox', { name: '解题思路' }), { target: { value: markdown } });
}

it('navigates among the three first-release pages', async () => {
  render(<RepositoryProvider repository={repository}><MemoryRouter><App /></MemoryRouter></RepositoryProvider>);
  expect(screen.getByRole('heading', { name: '算法看板' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '题目记录' }));
  expect(screen.getByRole('heading', { name: '题目记录' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '数据管理' }));
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeInTheDocument();
  expect(screen.getByTestId('record-practice')).toBeInTheDocument();
});

it('returns from primary creation to the original filtered URL with the draft restored', async () => {
  renderApp('/problems?from=2026-07-01&to=2026-07-23#history');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));

  expect(screen.getByText('正在为本次练习添加主要算法')).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent('/data?createAlgorithm=1');
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));

  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/problems?from=2026-07-01&to=2026-07-23#history'));
  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByLabelText('主要算法')).toHaveDisplayValue('图论');
  expect(screen.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 草稿');
});

it('adds a created secondary algorithm and manual return changes nothing', async () => {
  renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));
  await userEvent.click(screen.getByRole('button', { name: '返回记录练习' }));

  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByLabelText('主要算法')).toHaveValue('hash');
  expect(screen.getByRole('checkbox', { name: '二分查找' })).toBeChecked();
  expect(screen.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 草稿');

  await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));

  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByLabelText('主要算法')).toHaveValue('hash');
  expect(screen.getByRole('checkbox', { name: '二分查找' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '图论' })).toBeChecked();
  expect(screen.getAllByRole('checkbox', { name: '图论' })).toHaveLength(1);
});

it('clears the pending draft after explicit dialog close', async () => {
  renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.click(screen.getByRole('button', { name: '返回记录练习' }));
  await userEvent.click(await screen.findByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByTestId('record-practice'));

  expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');
  expect(screen.queryByRole('textbox', { name: '解题思路' })).not.toBeInTheDocument();
});

it('clears the pending draft after a restored practice is saved', async () => {
  const { recordPractice } = renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await userEvent.click(await screen.findByRole('button', { name: '保存练习' }));

  await waitFor(() => expect(recordPractice).toHaveBeenCalledOnce());
  await userEvent.click(screen.getByTestId('record-practice'));
  expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');
});

it('treats a refreshed creation URL without memory state as ordinary data management', () => {
  renderApp('/data?createAlgorithm=1');
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '返回记录练习' })).not.toBeInTheDocument();
  expect(screen.queryByText(/正在为本次练习添加/)).not.toBeInTheDocument();
});

it('invalidates creation mode after navigating from the exact creation URL to ordinary data management', async () => {
  renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/data?createAlgorithm=1');

  await userEvent.click(screen.getByRole('link', { name: '数据管理' }));

  expect(screen.getByTestId('location')).toHaveTextContent('/data');
  expect(screen.queryByRole('button', { name: '返回记录练习' })).not.toBeInTheDocument();
  expect(screen.queryByText(/正在为本次练习添加/)).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));

  expect(await screen.findByText('图论')).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent('/data');
  expect(screen.queryByRole('dialog', { name: '记录练习' })).not.toBeInTheDocument();
});

it('ignores a pending create completion after starting a fresh practice session', async () => {
  const create = deferred<Algorithm>();
  const createAlgorithm = vi.fn().mockReturnValue(create.promise);
  renderApp('/', createAlgorithm);
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft('旧草稿');
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await waitFor(() => expect(createAlgorithm).toHaveBeenCalledOnce());

  await userEvent.click(screen.getByTestId('record-practice'));
  const freshDialog = within(screen.getByRole('dialog', { name: '记录练习' }));
  expect(freshDialog.getByLabelText('LeetCode 题目链接')).toHaveValue('');

  create.resolve({ id: 'graph', name: '图论', color: '#2563eb', createdAt: '' });
  await waitFor(() => expect(screen.queryByText('创建中…')).not.toBeInTheDocument());

  expect(screen.getByTestId('location')).toHaveTextContent('/data?createAlgorithm=1');
  expect(screen.getByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(freshDialog.getByLabelText('LeetCode 题目链接')).toHaveValue('');
  expect(freshDialog.queryByRole('textbox', { name: '解题思路' })).not.toBeInTheDocument();
});

it('revokes a pending BrowserRouter callback synchronously with main navigation intent', async () => {
  const create = deferred<Algorithm>();
  const createAlgorithm = vi.fn().mockReturnValue(create.promise);
  renderBrowserApp('/', createAlgorithm);
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft('旧草稿');
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '旧算法');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await waitFor(() => expect(createAlgorithm).toHaveBeenCalledOnce());

  await act(async () => {
    screen.getByRole('link', { name: '数据管理' }).click();
    expect(`${window.location.pathname}${window.location.search}`).toBe('/data');
    create.resolve({ id: 'old', name: '旧算法', color: '#2563eb', createdAt: '' });
    await flushMicrotasks();
    expect(`${window.location.pathname}${window.location.search}`).toBe('/data');
  });

  expect(`${window.location.pathname}${window.location.search}`).toBe('/data');
  expect(screen.queryByRole('dialog', { name: '记录练习' })).not.toBeInTheDocument();
  expect(screen.queryByText(/正在为本次练习添加/)).not.toBeInTheDocument();
});

it('isolates a new algorithm request from the pending manager state of the previous request', async () => {
  const firstCreate = deferred<Algorithm>();
  const secondAlgorithm = { id: 'new', name: '新算法', color: '#2563eb', createdAt: '' };
  const createAlgorithm = vi.fn()
    .mockReturnValueOnce(firstCreate.promise)
    .mockResolvedValueOnce(secondAlgorithm);
  renderApp('/', createAlgorithm);

  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft('旧草稿');
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '旧算法');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await waitFor(() => expect(createAlgorithm).toHaveBeenCalledOnce());

  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft('新草稿');
  await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));

  const secondNameInput = screen.getByLabelText('算法名称');
  expect(secondNameInput).toHaveValue('');
  await userEvent.type(secondNameInput, '新算法');
  await waitFor(() => expect(screen.getByRole('button', { name: '创建分类' })).toBeEnabled());

  await act(async () => {
    firstCreate.resolve({ id: 'old', name: '旧算法', color: '#dc2626', createdAt: '' });
    await flushMicrotasks();
  });
  expect(secondNameInput).toHaveValue('新算法');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '创建分类' })).toBeEnabled();

  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await waitFor(() => expect(createAlgorithm).toHaveBeenCalledTimes(2));
  const restored = within(await screen.findByRole('dialog', { name: '记录练习' }));
  expect(restored.getByRole('textbox', { name: '解题思路' })).toHaveValue('新草稿');
  expect(restored.getByRole('checkbox', { name: '新算法' })).toBeChecked();
});
