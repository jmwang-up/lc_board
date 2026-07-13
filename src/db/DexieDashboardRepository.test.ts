import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardDatabase } from './DashboardDatabase';
import { DexieDashboardRepository } from './DexieDashboardRepository';

const metadata = {
  slug: 'two-sum',
  frontendQuestionId: '1',
  titleZh: '两数之和',
  difficulty: 'easy' as const,
  url: 'https://leetcode.cn/problems/two-sum/',
};

let database: DashboardDatabase;
let repo: DexieDashboardRepository;

beforeEach(() => {
  database = new DashboardDatabase(crypto.randomUUID());
  repo = new DexieDashboardRepository(database);
});

afterEach(async () => {
  await database.delete();
});

describe('practice invariants', () => {
  it('reuses a problem and creates a new practice every time', async () => {
    const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
    const input = { metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] };

    await repo.recordPractice(input);
    await repo.recordPractice(input);

    expect(await repo.listProblems()).toHaveLength(1);
    expect(await repo.listPractices()).toHaveLength(2);
  });

  it('rejects a secondary algorithm equal to the primary algorithm', async () => {
    const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#16a34a' });

    await expect(repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [algorithm.id] }))
      .rejects.toThrow('辅助算法不能与主要算法重复');
  });

  it('rejects an invalid local date and duplicate or missing algorithms without partial writes', async () => {
    const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#16a34a' });

    await expect(repo.recordPractice({ metadata, practicedOn: '2026-02-30', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] }))
      .rejects.toThrow('练习日期无效');
    await expect(repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: ['missing'] }))
      .rejects.toThrow('算法不存在');
    await expect(repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: ['missing', 'missing'] }))
      .rejects.toThrow('辅助算法不能重复');
    expect(await repo.listProblems()).toEqual([]);
    expect(await repo.listPractices()).toEqual([]);
  });
});

describe('algorithm invariants', () => {
  it('enforces trimmed case-insensitive algorithm name uniqueness on create and rename', async () => {
    const first = await repo.createAlgorithm({ name: '  DP  ', color: '#2563eb' });
    const second = await repo.createAlgorithm({ name: 'Graph', color: '#16a34a' });

    expect(first.name).toBe('DP');
    await expect(repo.createAlgorithm({ name: 'dp', color: '#000000' })).rejects.toThrow('算法名称已存在');
    await expect(repo.renameAlgorithm(second.id, ' dP ')).rejects.toThrow('算法名称已存在');
  });

  it('replaces primary and secondary references, deduplicates them, then deletes the old algorithm', async () => {
    const oldAlgorithm = await repo.createAlgorithm({ name: '旧算法', color: '#111111' });
    const replacement = await repo.createAlgorithm({ name: '新算法', color: '#222222' });
    const other = await repo.createAlgorithm({ name: '其他', color: '#333333' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: oldAlgorithm.id, secondaryAlgorithmIds: [replacement.id, other.id] });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-13', primaryAlgorithmId: other.id, secondaryAlgorithmIds: [oldAlgorithm.id, replacement.id] });

    await repo.replaceAndDeleteAlgorithm(oldAlgorithm.id, replacement.id, 2);

    expect((await repo.listAlgorithms()).map(({ id }) => id)).not.toContain(oldAlgorithm.id);
    const practices = await repo.listPractices();
    expect(practices.find(({ practicedOn }) => practicedOn === '2026-07-12'))
      .toMatchObject({ primaryAlgorithmId: replacement.id, secondaryAlgorithmIds: [other.id] });
    expect(practices.find(({ practicedOn }) => practicedOn === '2026-07-13'))
      .toMatchObject({ primaryAlgorithmId: other.id, secondaryAlgorithmIds: [replacement.id] });
  });

  it('rejects self-replacement without changing algorithms or practices', async () => {
    const algorithm = await repo.createAlgorithm({ name: '动态规划', color: '#111111' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });
    const beforeAlgorithms = await repo.listAlgorithms();
    const beforePractices = await repo.listPractices();

    await expect(repo.replaceAndDeleteAlgorithm(algorithm.id, algorithm.id, 1))
      .rejects.toThrow('替代算法不能与待删除算法相同');

    expect(await repo.listAlgorithms()).toEqual(beforeAlgorithms);
    expect(await repo.listPractices()).toEqual(beforePractices);
  });

  it('deletes an unused algorithm, including the last category', async () => {
    const algorithm = await repo.createAlgorithm({ name: '未使用', color: '#111111' });

    await repo.deleteUnusedAlgorithm(algorithm.id, 0);

    expect(await repo.listAlgorithms()).toEqual([]);
  });

  it('refuses unused deletion when practices reference the algorithm and leaves data unchanged', async () => {
    const algorithm = await repo.createAlgorithm({ name: '使用中', color: '#111111' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });

    await expect(repo.deleteUnusedAlgorithm(algorithm.id, 0)).rejects.toThrow('数据已变化，请重新确认');

    expect(await repo.listAlgorithms()).toHaveLength(1);
    expect(await repo.listPractices()).toHaveLength(1);
  });

  it('deletes every affected practice and the algorithm in one cascade', async () => {
    const doomed = await repo.createAlgorithm({ name: '待删除', color: '#111111' });
    const retained = await repo.createAlgorithm({ name: '保留', color: '#222222' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: doomed.id, secondaryAlgorithmIds: [] });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-13', primaryAlgorithmId: retained.id, secondaryAlgorithmIds: [doomed.id] });

    await repo.deleteAlgorithmAndPractices(doomed.id, 2);

    expect((await repo.listAlgorithms()).map(item => item.id)).toEqual([retained.id]);
    expect(await repo.listPractices()).toEqual([]);
    expect(await repo.listProblems()).toHaveLength(1);
  });

  it('rejects an algorithm deletion when the confirmed affected count is stale', async () => {
    const doomed = await repo.createAlgorithm({ name: '待删除', color: '#111111' });
    const replacement = await repo.createAlgorithm({ name: '替代', color: '#222222' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: doomed.id, secondaryAlgorithmIds: [] });

    await expect(repo.replaceAndDeleteAlgorithm(doomed.id, replacement.id, 0)).rejects.toThrow('数据已变化，请重新确认');

    expect(await repo.listAlgorithms()).toHaveLength(2);
    expect(await repo.listPractices()).toHaveLength(1);
  });
});

describe('deletion invariants', () => {
  it('clears problems, practices, and algorithms together', async () => {
    const timestamp = '2026-07-12T00:00:00.000Z';
    await database.problems.add({ id: 'problem', leetcodeSlug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: metadata.url, createdAt: timestamp });
    await database.algorithms.add({ id: 'algorithm', name: '双指针', color: '#2563eb', createdAt: timestamp });
    await database.practices.add({ id: 'practice', problemId: 'problem', practicedOn: '2026-07-12', primaryAlgorithmId: 'algorithm', secondaryAlgorithmIds: [], createdAt: timestamp, updatedAt: timestamp });

    await repo.clearAll({ problems: 1, practices: 1, algorithms: 1 });

    expect(await repo.listProblems()).toEqual([]);
    expect(await repo.listPractices()).toEqual([]);
    expect(await repo.listAlgorithms()).toEqual([]);
  });

  it('reads one transactional count snapshot and rejects stale clear confirmation', async () => {
    const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });
    expect(await repo.getDataCounts()).toEqual({ problems: 1, practices: 1, algorithms: 1 });

    await expect(repo.clearAll({ problems: 0, practices: 0, algorithms: 0 })).rejects.toThrow('数据已变化，请重新确认');

    expect(await repo.listProblems()).toHaveLength(1);
    expect(await repo.listPractices()).toHaveLength(1);
    expect(await repo.listAlgorithms()).toHaveLength(1);
  });

  it('rolls back every clear when one table clear fails', async () => {
    const timestamp = '2026-07-12T00:00:00.000Z';
    await database.problems.add({ id: 'problem', leetcodeSlug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: metadata.url, createdAt: timestamp });
    await database.algorithms.add({ id: 'algorithm', name: '双指针', color: '#2563eb', createdAt: timestamp });
    await database.practices.add({ id: 'practice', problemId: 'problem', practicedOn: '2026-07-12', primaryAlgorithmId: 'algorithm', secondaryAlgorithmIds: [], createdAt: timestamp, updatedAt: timestamp });
    vi.spyOn(database.algorithms, 'clear').mockRejectedValueOnce(new Error('clear failed'));

    await expect(repo.clearAll({ problems: 1, practices: 1, algorithms: 1 })).rejects.toThrow('clear failed');

    expect(await repo.listProblems()).toHaveLength(1);
    expect(await repo.listPractices()).toHaveLength(1);
    expect(await repo.listAlgorithms()).toHaveLength(1);
  });
  it('deleting one practice preserves its problem', async () => {
    const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
    const { practice } = await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });

    await repo.deletePractice(practice.id);

    expect(await repo.listPractices()).toEqual([]);
    expect(await repo.listProblems()).toHaveLength(1);
  });

  it('deleting a problem cascades to all its practices', async () => {
    const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
    const { problem } = await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-13', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });

    await repo.deleteProblem(problem.id, 2);

    expect(await repo.listProblems()).toEqual([]);
    expect(await repo.listPractices()).toEqual([]);
  });

  it('rejects problem cascade when the confirmed practice count is stale', async () => {
    const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
    const { problem } = await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });

    await expect(repo.deleteProblem(problem.id, 0)).rejects.toThrow('数据已变化，请重新确认');

    expect(await repo.listProblems()).toHaveLength(1);
    expect(await repo.listPractices()).toHaveLength(1);
  });
});

describe('backup invariants', () => {
  it('exports a schema-versioned consistent snapshot', async () => {
    const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#16a34a' });
    await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });

    const result = await repo.exportBackup();

    expect(result).toMatchObject({ schemaVersion: 1, problems: [expect.any(Object)], practices: [expect.any(Object)], algorithms: [expect.any(Object)] });
    expect(() => new Date(result.exportedAt).toISOString()).not.toThrow();
  });

  it('imports remapped additions and returns a summary', async () => {
    const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#16a34a' });
    const { problem } = await repo.recordPractice({ metadata, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] });
    const timestamp = '2026-07-13T00:00:00.000Z';

    const summary = await repo.importBackup({
      schemaVersion: 1, exportedAt: timestamp,
      problems: [{ ...problem, id: 'import-problem' }],
      algorithms: [{ ...algorithm, id: 'import-algorithm' }],
      practices: [{ id: 'import-practice', problemId: 'import-problem', practicedOn: '2026-07-13', primaryAlgorithmId: 'import-algorithm', secondaryAlgorithmIds: [], createdAt: timestamp, updatedAt: timestamp }],
    });

    expect(summary).toMatchObject({ addedProblems: 0, addedAlgorithms: 0, addedPractices: 1 });
    expect((await repo.listPractices()).at(-1)).toMatchObject({ problemId: problem.id, primaryAlgorithmId: algorithm.id });
  });

  it('does not write anything when an import is invalid', async () => {
    await expect(repo.importBackup({ schemaVersion: 1, exportedAt: '2026-07-12T00:00:00.000Z', problems: [], algorithms: [], practices: [{ id: 'p', problemId: 'missing' }] } as never))
      .rejects.toThrow();
    expect(await repo.listProblems()).toEqual([]);
    expect(await repo.listPractices()).toEqual([]);
    expect(await repo.listAlgorithms()).toEqual([]);
  });
});
