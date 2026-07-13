import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RepositoryProvider } from '../../app/RepositoryContext';
import type { DashboardRepository } from '../../db/DashboardRepository';
import type { Algorithm, Practice } from '../../domain/models';
import { AlgorithmManager } from './AlgorithmManager';

function fakeRepository(initialAlgorithms: Algorithm[] = [], practices: Practice[] = []): DashboardRepository {
  let algorithms = [...initialAlgorithms];
  return {
    async createAlgorithm({ name, color }) {
      const normalized = name.trim();
      if (algorithms.some(item => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error('算法名称已存在');
      const algorithm = { id: `algorithm-${algorithms.length + 1}`, name: normalized, color, createdAt: '2026-07-12T00:00:00.000Z' };
      algorithms.push(algorithm);
      return algorithm;
    },
    async renameAlgorithm(id, name) {
      const normalized = name.trim();
      if (algorithms.some(item => item.id !== id && item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) throw new Error('算法名称已存在');
      algorithms = algorithms.map(item => item.id === id ? { ...item, name: normalized } : item);
    },
    async replaceAndDeleteAlgorithm(id, replacementId) {
      if (id === replacementId) throw new Error('替代算法不能相同');
      algorithms = algorithms.filter(item => item.id !== id);
    },
    async listAlgorithms() { return [...algorithms]; },
    async listPractices() { return practices; },
    async recordPractice() { throw new Error('not implemented'); },
    async listProblems() { return []; },
    async deletePractice() {},
    async deleteProblem() {},
    async exportBackup() { return { schemaVersion: 1, exportedAt: new Date().toISOString(), problems: [], practices: [], algorithms: [] }; },
    async importBackup() { return { addedProblems: 0, addedPractices: 0, addedAlgorithms: 0, skippedIds: [] }; },
    async clearAll() {},
  };
}

function renderManagerWithRepository(repository: DashboardRepository) {
  return render(<RepositoryProvider repository={repository}><AlgorithmManager /></RepositoryProvider>);
}

const algorithm = (id: string, name: string): Algorithm => ({ id, name, color: '#2563eb', createdAt: '2026-07-12T00:00:00.000Z' });

it('creates a category and rejects a duplicate normalized name', async () => {
  renderManagerWithRepository(fakeRepository());
  await userEvent.type(screen.getByLabelText('算法名称'), '动态规划');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  expect(await screen.findByText('动态规划')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('算法名称'), ' 动态规划 ');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('算法名称已存在');
});

it('shows a localized actionable error when algorithms cannot be loaded', async () => {
  const repo = fakeRepository();
  repo.listAlgorithms = async () => { throw new Error('storage unavailable'); };
  renderManagerWithRepository(repo);
  expect(await screen.findByRole('alert')).toHaveTextContent('算法分类加载失败，请重试');
  expect(screen.queryByText('还没有算法分类，请先创建一个。')).not.toBeInTheDocument();
});

it('renames a category inline', async () => {
  renderManagerWithRepository(fakeRepository([algorithm('dp', '动态规划')]));
  expect(await screen.findByText('动态规划')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '重命名动态规划' }));
  const input = screen.getByLabelText('重命名动态规划');
  await userEvent.clear(input);
  await userEvent.type(input, '图论');
  await userEvent.click(screen.getByRole('button', { name: '保存图论' }));
  expect(await screen.findByText('图论')).toBeInTheDocument();
});

it('requires a distinct replacement and confirmation with the affected practice count before deletion', async () => {
  const algorithms = [algorithm('dp', '动态规划'), algorithm('graph', '图论')];
  const practices = [
    { id: 'p1', problemId: 'one', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], createdAt: '', updatedAt: '' },
    { id: 'p2', problemId: 'two', practicedOn: '2026-07-12', primaryAlgorithmId: 'graph', secondaryAlgorithmIds: ['dp'], createdAt: '', updatedAt: '' },
  ];
  const repo = fakeRepository(algorithms, practices);
  renderManagerWithRepository(repo);
  expect(await screen.findByText('动态规划')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '删除动态规划' }));
  const dialog = screen.getByRole('dialog', { name: '删除动态规划' });
  expect(within(dialog).getByText('2 条练习将被更新')).toBeInTheDocument();
  const remove = within(dialog).getByRole('button', { name: '替换并删除' });
  expect(remove).toBeDisabled();
  await userEvent.selectOptions(within(dialog).getByLabelText('替代算法'), 'graph');
  expect(remove).toBeDisabled();
  await userEvent.click(within(dialog).getByRole('checkbox', { name: '我确认更新 2 条练习并删除动态规划' }));
  expect(remove).toBeEnabled();
  await userEvent.click(remove);
  expect(await screen.findByText('图论')).toBeInTheDocument();
  expect(screen.queryByText('动态规划')).not.toBeInTheDocument();
  expect((await repo.listAlgorithms()).map(item => item.id)).not.toContain('dp');
});

it('closes the deletion dialog with Escape and restores focus', async () => {
  renderManagerWithRepository(fakeRepository([algorithm('dp', '动态规划'), algorithm('graph', '图论')]));
  const trigger = await screen.findByRole('button', { name: '删除动态规划' });
  await userEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: '删除动态规划' })).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog', { name: '删除动态规划' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
