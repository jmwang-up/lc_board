import { describe, expect, it, vi } from 'vitest';
import type { Algorithm, Practice, Problem } from './models';
import { mergeBackup, parseBackup, type BackupV2 } from './backup';

const timestamp = '2026-07-12T00:00:00.000Z';
const problem: Problem = { id: 'problem-local', leetcodeSlug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/', createdAt: timestamp };
const algorithm: Algorithm = { id: 'algorithm-local', name: '哈希表', color: '#16a34a', createdAt: timestamp };
const practice: Practice = { id: 'practice-imported', problemId: problem.id, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [], solutionMarkdown: '', createdAt: timestamp, updatedAt: timestamp };
const backup = (values: Partial<BackupV2> = {}): BackupV2 => ({ schemaVersion: 2, exportedAt: timestamp, problems: [], algorithms: [], practices: [], ...values });

describe('parseBackup', () => {
  it('normalizes a version-1 backup solution to empty text', () => {
    const legacyPractice = { ...practice } as Record<string, unknown>;
    delete legacyPractice.solutionMarkdown;

    const parsed = parseBackup({
      schemaVersion: 1, exportedAt: timestamp,
      problems: [problem], algorithms: [algorithm], practices: [legacyPractice],
    });

    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.practices[0].solutionMarkdown).toBe('');
  });

  it('accepts 20,000 characters and atomically rejects 20,001', () => {
    expect(parseBackup(backup({
      problems: [problem], algorithms: [algorithm],
      practices: [{ ...practice, solutionMarkdown: 'x'.repeat(20_000) }],
    }))).toMatchObject({ schemaVersion: 2 });
    expect(() => parseBackup(backup({
      problems: [problem], algorithms: [algorithm],
      practices: [{ ...practice, solutionMarkdown: 'x'.repeat(20_001) }],
    }))).toThrow('备份数据格式无效');
  });

  it('rejects solution Markdown longer than 20,000 characters', () => {
    expect(() => parseBackup(backup({
      problems: [problem], algorithms: [algorithm],
      practices: [{ ...practice, solutionMarkdown: 'x'.repeat(20_001) }],
    }))).toThrow('备份数据格式无效');
  });

  it('rejects a backup with a dangling practice reference', () => {
    expect(() => parseBackup(backup({ practices: [{ ...practice, problemId: 'missing' }] }))).toThrow('练习引用了不存在的题目');
  });

  it.each([
    'http://leetcode.cn/problems/two-sum/',
    'https://example.com/problems/two-sum/',
    'https://leetcode.cn.evil.example/problems/two-sum/',
    'https://leetcode.cn/problemset/two-sum/',
    'https://leetcode.cn/problems/two-sum/description/',
    'https://leetcode.cn/problems/two-sum/?envType=daily-question',
    'https://leetcode.cn/problems/two-sum/#description',
    'https://leetcode.cn/problems/three-sum/',
  ])('rejects a non-canonical or slug-mismatched stored problem URL: %s', url => {
    expect(() => parseBackup(backup({ problems: [{ ...problem, url }] }))).toThrow('备份数据格式无效');
  });

  it.each([
    [{ schemaVersion: 3 }, '备份版本不受支持'],
    [{ problems: [problem, { ...problem }] }, '题目 ID 重复'],
    [{ problems: [problem, { ...problem, id: 'other' }] }, '题目别名重复'],
    [{ algorithms: [algorithm, { ...algorithm, id: 'other', name: ' 哈希表 ' }] }, '算法名称重复'],
    [{ problems: [{ ...problem, createdAt: 'not-a-date' }] }, '备份数据格式无效'],
  ])('rejects invalid backup data', (change, message) => {
    expect(() => parseBackup({ ...backup(), ...change })).toThrow(message);
  });
});

describe('mergeBackup', () => {
  it('maps imported problem and algorithm conflicts to local records', () => {
    const local = backup({ problems: [problem], algorithms: [algorithm] });
    const imported = backup({
      problems: [{ ...problem, id: 'problem-imported' }],
      algorithms: [{ ...algorithm, id: 'algorithm-imported', name: ' 哈希表 ' }],
      practices: [{ ...practice, problemId: 'problem-imported', primaryAlgorithmId: 'algorithm-imported' }],
    });
    const result = mergeBackup(local, imported);
    expect(result.problems).toHaveLength(1);
    expect(result.algorithms).toHaveLength(1);
    expect(result.practices.at(-1)).toMatchObject({ problemId: problem.id, primaryAlgorithmId: algorithm.id });
    expect(result.summary).toMatchObject({ addedProblems: 0, addedPractices: 1, addedAlgorithms: 0 });
  });

  it('rejects an ID collision that would silently remap a different entity', () => {
    const importedProblem = { ...problem, leetcodeSlug: 'three-sum', titleZh: '三数之和', url: 'https://leetcode.cn/problems/three-sum/' };
    expect(() => mergeBackup(
      backup({ problems: [problem], algorithms: [algorithm] }),
      backup({ problems: [importedProblem], algorithms: [algorithm], practices: [practice] }),
    )).toThrow('导入引用无法安全重映射');
  });

  it('skips an unreferenced imported entity whose ID already exists locally', () => {
    const importedProblem = { ...problem, leetcodeSlug: 'three-sum', titleZh: '三数之和', url: 'https://leetcode.cn/problems/three-sum/' };
    const result = mergeBackup(backup({ problems: [problem] }), backup({ problems: [importedProblem] }));
    expect(result.problems).toEqual([problem]);
    expect(result.summary.skippedIds).toContain(problem.id);
  });

  it('maps a colliding problem ID to a different local record with the same slug', () => {
    const collidingLocal = { ...problem, leetcodeSlug: 'three-sum', titleZh: '三数之和', url: 'https://leetcode.cn/problems/three-sum/' };
    const semanticLocal = { ...problem, id: 'problem-semantic' };
    const imported = { ...problem, titleZh: 'imported title' };
    const result = mergeBackup(
      backup({ problems: [collidingLocal, semanticLocal], algorithms: [algorithm] }),
      backup({ problems: [imported], algorithms: [algorithm], practices: [practice] }),
    );
    expect(result.practices.at(-1)?.problemId).toBe(semanticLocal.id);
    expect(result.summary).toMatchObject({ addedProblems: 0, addedPractices: 1, skippedIds: [problem.id, algorithm.id] });
  });

  it('maps a colliding algorithm ID to a different local record with the same normalized name', () => {
    const collidingLocal = { ...algorithm, name: '动态规划' };
    const semanticLocal = { ...algorithm, id: 'algorithm-semantic' };
    const imported = { ...algorithm, name: ' 哈希表 ' };
    const result = mergeBackup(
      backup({ problems: [problem], algorithms: [collidingLocal, semanticLocal] }),
      backup({ problems: [problem], algorithms: [imported], practices: [practice] }),
    );
    expect(result.practices.at(-1)?.primaryAlgorithmId).toBe(semanticLocal.id);
    expect(result.summary).toMatchObject({ addedAlgorithms: 0, addedPractices: 1, skippedIds: [problem.id, algorithm.id] });
  });

  it('plans a moderate remapping without rescanning local entity arrays', () => {
    const size = 64;
    const localProblems = Array.from({ length: size }, (_, index): Problem => ({
      id: `local-problem-${index}`, leetcodeSlug: `problem-${index}`, frontendQuestionId: String(index),
      titleZh: `题目 ${index}`, difficulty: 'medium', url: `https://leetcode.cn/problems/problem-${index}/`, createdAt: timestamp,
    }));
    const localAlgorithms = Array.from({ length: size }, (_, index): Algorithm => ({
      id: `local-algorithm-${index}`, name: `算法 ${index}`, color: '#2563eb', createdAt: timestamp,
    }));
    const localPractices = Array.from({ length: size }, (_, index): Practice => ({
      id: `local-practice-${index}`, problemId: `local-problem-${index}`, practicedOn: '2026-07-12',
      primaryAlgorithmId: `local-algorithm-${index}`, secondaryAlgorithmIds: [], solutionMarkdown: '', createdAt: timestamp, updatedAt: timestamp,
    }));
    const importedProblems = localProblems.map((item, index) => ({ ...item, id: `import-problem-${index}` }));
    const importedAlgorithms = localAlgorithms.map((item, index) => ({ ...item, id: `import-algorithm-${index}` }));
    const importedPractices = localPractices.map((item, index) => ({
      ...item, id: `import-practice-${index}`, problemId: `import-problem-${index}`, primaryAlgorithmId: `import-algorithm-${index}`,
    }));
    const findSpy = vi.spyOn(Array.prototype, 'find');
    const someSpy = vi.spyOn(Array.prototype, 'some');
    let result: ReturnType<typeof mergeBackup>;
    let entityFindScans: number;
    let practiceSomeScans: number;

    try {
      result = mergeBackup(
        backup({ problems: localProblems, algorithms: localAlgorithms, practices: localPractices }),
        backup({ problems: importedProblems, algorithms: importedAlgorithms, practices: importedPractices }),
      );
      entityFindScans = findSpy.mock.contexts.filter(value => {
        if (!Array.isArray(value)) return false;
        const item = value[0];
        return item && typeof item === 'object' && ('leetcodeSlug' in item || ('name' in item && 'color' in item));
      }).length;
      practiceSomeScans = someSpy.mock.contexts.filter(value => {
        if (!Array.isArray(value)) return false;
        const item = value[0];
        return item && typeof item === 'object' && 'practicedOn' in item;
      }).length;
    } finally {
      findSpy.mockRestore();
      someSpy.mockRestore();
    }

    expect({ entityFindScans, practiceSomeScans }).toEqual({ entityFindScans: 0, practiceSomeScans: 0 });
    expect(result!.summary).toEqual({
      addedProblems: 0, addedPractices: size, addedAlgorithms: 0,
      skippedIds: [...importedProblems.map(item => item.id), ...importedAlgorithms.map(item => item.id)],
    });
    expect(result!.practices.slice(size).map(item => [item.id, item.problemId, item.primaryAlgorithmId])).toEqual(
      importedPractices.map((item, index) => [item.id, localProblems[index].id, localAlgorithms[index].id]),
    );
  });
});
