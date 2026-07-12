import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

    await repo.replaceAndDeleteAlgorithm(oldAlgorithm.id, replacement.id);

    expect((await repo.listAlgorithms()).map(({ id }) => id)).not.toContain(oldAlgorithm.id);
    const practices = await repo.listPractices();
    expect(practices.find(({ practicedOn }) => practicedOn === '2026-07-12'))
      .toMatchObject({ primaryAlgorithmId: replacement.id, secondaryAlgorithmIds: [other.id] });
    expect(practices.find(({ practicedOn }) => practicedOn === '2026-07-13'))
      .toMatchObject({ primaryAlgorithmId: other.id, secondaryAlgorithmIds: [replacement.id] });
  });
});

describe('deletion invariants', () => {
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

    await repo.deleteProblem(problem.id);

    expect(await repo.listProblems()).toEqual([]);
    expect(await repo.listPractices()).toEqual([]);
  });
});
