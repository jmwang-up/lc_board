import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot, filterProblems, type DashboardDataset } from './dashboard';

const dataset: DashboardDataset = {
  algorithms: [
    { id: 'dp', name: '动态规划', color: '#123456', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'binary-search', name: '二分查找', color: '#654321', createdAt: '2026-01-01T00:00:00Z' },
  ],
  problems: [
    { id: 'p1', leetcodeSlug: 'one', frontendQuestionId: '1', titleZh: '第一题', difficulty: 'easy', url: 'https://leetcode.cn/problems/one', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'p2', leetcodeSlug: 'two', frontendQuestionId: '21', titleZh: '寻找峰值', difficulty: 'medium', url: 'https://leetcode.cn/problems/two', createdAt: '2026-01-01T00:00:00Z' },
  ],
  practices: [
    { id: 'a', problemId: 'p1', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], solutionMarkdown: '', createdAt: '2026-07-12T09:00:00Z', updatedAt: '2026-07-12T09:00:00Z' },
    { id: 'b', problemId: 'p2', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: ['binary-search'], solutionMarkdown: '', createdAt: '2026-07-12T10:00:00Z', updatedAt: '2026-07-12T10:00:00Z' },
    { id: 'c', problemId: 'p2', practicedOn: '2026-07-11', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], solutionMarkdown: '', createdAt: '2026-07-11T10:00:00Z', updatedAt: '2026-07-11T10:00:00Z' },
  ],
};

describe('dashboard selectors', () => {
  it('counts dashboard cards by primary algorithm and calendar by practice date', () => {
    const snapshot = buildDashboardSnapshot(dataset);
    expect(snapshot.algorithmCards.find(card => card.algorithm.id === 'dp')).toMatchObject({ problemCount: 2, practiceCount: 3 });
    expect(snapshot.activityByDate['2026-07-12']).toBe(2);
  });

  it('matches secondary algorithms without changing primary dashboard counts', () => {
    expect(filterProblems(dataset, { secondaryAlgorithmId: 'binary-search' }).map(item => item.problem.id)).toEqual(['p2']);
    expect(buildDashboardSnapshot(dataset).algorithmCards.find(card => card.algorithm.id === 'binary-search')?.practiceCount).toBe(0);
  });

  it('combines filters with AND and sorts results and practices deterministically', () => {
    const result = filterProblems(dataset, { query: '2', difficulty: 'medium', primaryAlgorithmId: 'dp', from: '2026-07-12', to: '2026-07-12' });
    expect(result.map(item => item.problem.id)).toEqual(['p2']);
    expect(result[0].practices.map(practice => practice.id)).toEqual(['b']);
    expect(filterProblems(dataset, { query: ' 寻找 ' })[0].problem.id).toBe('p2');
  });
});
