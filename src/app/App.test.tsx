import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

function createAppRepository() {
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
      const algorithm = { id: `created-${algorithms.length}`, ...input, createdAt: '' };
      algorithms = [...algorithms, algorithm];
      return algorithm;
    },
  };
  return { repo, recordPractice };
}

function renderApp(initialEntry = '/') {
  const state = createAppRepository();
  render(<RepositoryProvider repository={state.repo}>
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
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
