import { describe, expect, it } from 'vitest';
import type { Algorithm, Practice, Problem } from './models';
import { mergeBackup, parseBackup, type BackupV1 } from './backup';

const timestamp = '2026-07-12T00:00:00.000Z';
const problem: Problem = { id: 'problem-local', leetcodeSlug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/', createdAt: timestamp };
const algorithm: Algorithm = { id: 'algorithm-local', name: '哈希表', color: '#16a34a', createdAt: timestamp };
const practice: Practice = { id: 'practice-imported', problemId: problem.id, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [], createdAt: timestamp, updatedAt: timestamp };
const backup = (values: Partial<BackupV1> = {}): BackupV1 => ({ schemaVersion: 1, exportedAt: timestamp, problems: [], algorithms: [], practices: [], ...values });

describe('parseBackup', () => {
  it('rejects a backup with a dangling practice reference', () => {
    expect(() => parseBackup(backup({ practices: [{ ...practice, problemId: 'missing' }] }))).toThrow('练习引用了不存在的题目');
  });

  it.each([
    [{ schemaVersion: 2 }, '备份版本不受支持'],
    [{ problems: [problem, { ...problem }] }, '题目 ID 重复'],
    [{ problems: [problem, { ...problem, id: 'other', leetcodeSlug: ' TWO-SUM ' }] }, '题目别名重复'],
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
      problems: [{ ...problem, id: 'problem-imported', leetcodeSlug: ' TWO-SUM ' }],
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
    const importedProblem = { ...problem, leetcodeSlug: 'three-sum', titleZh: '三数之和' };
    expect(() => mergeBackup(
      backup({ problems: [problem], algorithms: [algorithm] }),
      backup({ problems: [importedProblem], algorithms: [algorithm], practices: [practice] }),
    )).toThrow('导入引用无法安全重映射');
  });

  it('skips an unreferenced imported entity whose ID already exists locally', () => {
    const importedProblem = { ...problem, leetcodeSlug: 'three-sum', titleZh: '三数之和' };
    const result = mergeBackup(backup({ problems: [problem] }), backup({ problems: [importedProblem] }));
    expect(result.problems).toEqual([problem]);
    expect(result.summary.skippedIds).toContain(problem.id);
  });
});
