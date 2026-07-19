import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { RepositoryProvider } from '../../app/RepositoryContext';
import type { DashboardRepository } from '../../db/DashboardRepository';
import type { BackupV1 } from '../../domain/backup';
import { DataManagementPage } from './DataManagementPage';

const emptyBackup: BackupV1 = { schemaVersion: 1, exportedAt: '2026-07-12T00:00:00.000Z', problems: [], practices: [], algorithms: [] };

function repository(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    async createAlgorithm() { throw new Error('not implemented'); }, async renameAlgorithm() {}, async replaceAndDeleteAlgorithm() {},
    async deleteUnusedAlgorithm() {}, async deleteAlgorithmAndPractices() {},
    async recordPractice() { throw new Error('not implemented'); }, async listAlgorithms() { return []; }, async listProblems() { return []; },
    async updatePracticeSolution() { throw new Error('not implemented'); },
    async listPractices() { return []; }, async deletePractice() {}, async deleteProblem() {}, async clearAll() {},
    async getDataCounts() { return { problems: 0, practices: 0, algorithms: 0 }; },
    async exportBackup() { return emptyBackup; }, async importBackup() { return { addedProblems: 0, addedPractices: 0, addedAlgorithms: 0, skippedIds: [] }; },
    ...overrides,
  };
}

const renderPage = (repo: DashboardRepository) => render(<RepositoryProvider repository={repo}><DataManagementPage /></RepositoryProvider>);

it('downloads export using the dated JSON filename', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-12T08:00:00.000Z'));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const createObjectURL = vi.fn(() => 'blob:backup');
  const revokeObjectURL = vi.fn();
  Object.defineProperties(URL, { createObjectURL: { configurable: true, value: createObjectURL }, revokeObjectURL: { configurable: true, value: revokeObjectURL } });
  renderPage(repository());
  await screen.getByRole('button', { name: '导出数据' }).click();
  expect(click).toHaveBeenCalledOnce();
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('lc-board-2026-07-12.json');
  vi.useRealTimers();
});

it('shows invalid-file errors without repository writes and resets the input', async () => {
  const importBackup = vi.fn();
  renderPage(repository({ importBackup }));
  const input = screen.getByLabelText('选择备份文件') as HTMLInputElement;
  await userEvent.upload(input, new File(['not json'], 'bad.json', { type: 'application/json' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('备份文件无效');
  expect(importBackup).not.toHaveBeenCalled();
  expect(input.value).toBe('');
});

it('rejects files larger than 10 MB before reading', async () => {
  const importBackup = vi.fn();
  renderPage(repository({ importBackup }));
  const largeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.json');
  await userEvent.upload(screen.getByLabelText('选择备份文件'), largeFile);
  expect(await screen.findByRole('alert')).toHaveTextContent('备份文件不能超过 10 MB');
  expect(importBackup).not.toHaveBeenCalled();
});

it('shows a successful merge summary', async () => {
  renderPage(repository({ async importBackup() { return { addedProblems: 2, addedPractices: 3, addedAlgorithms: 1, skippedIds: [] }; } }));
  await userEvent.upload(screen.getByLabelText('选择备份文件'), new File([JSON.stringify(emptyBackup)], 'backup.json', { type: 'application/json' }));
  expect(await screen.findByRole('status')).toHaveTextContent('新增 2 道题目、3 条练习、1 个算法');
});

it('shows current entity counts in a two-stage modal and requires the exact clear-all phrase', async () => {
  const clearAll = vi.fn();
  renderPage(repository({
    clearAll,
    async getDataCounts() { return { problems: 1, practices: 1, algorithms: 1 }; },
    async listAlgorithms() { return [{ id: 'a', name: '算法', color: '#000000', createdAt: '' }]; },
  }));
  await userEvent.click(screen.getByRole('button', { name: '开始清空全部数据' }));
  const review = screen.getByRole('dialog', { name: '确认清空全部数据' });
  expect(within(review).getByText('1 道题目、1 条练习、1 个算法')).toBeInTheDocument();
  expect(within(review).queryByLabelText('确认文字')).not.toBeInTheDocument();
  await userEvent.click(within(review).getByRole('button', { name: '继续' }));
  const clear = within(review).getByRole('button', { name: '清空全部数据' });
  expect(clear).toBeDisabled();
  await userEvent.type(within(review).getByLabelText('确认文字'), '清空全部数据 ');
  expect(clear).toBeDisabled();
  await userEvent.clear(within(review).getByLabelText('确认文字'));
  await userEvent.type(within(review).getByLabelText('确认文字'), '清空全部数据');
  expect(clear).toBeEnabled();
  await userEvent.click(clear);
  await waitFor(() => expect(clearAll).toHaveBeenCalledOnce());
});

it('keeps clear failures accessible inside the modal', async () => {
  renderPage(repository({
    async getDataCounts() { return { problems: 1, practices: 1, algorithms: 1 }; },
    async clearAll() { throw new Error('数据已变化，请重新确认'); },
  }));
  await userEvent.click(screen.getByRole('button', { name: '开始清空全部数据' }));
  const dialog = screen.getByRole('dialog', { name: '确认清空全部数据' });
  await userEvent.click(within(dialog).getByRole('button', { name: '继续' }));
  await userEvent.type(within(dialog).getByLabelText('确认文字'), '清空全部数据');
  await userEvent.click(within(dialog).getByRole('button', { name: '清空全部数据' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('数据已变化，请重新确认');
});
