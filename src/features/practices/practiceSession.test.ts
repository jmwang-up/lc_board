import { describe, expect, it } from 'vitest';
import type { Algorithm } from '../../domain/models';
import type { PracticeFormValues } from './PracticeForm';
import { applyCreatedAlgorithm, sanitizeDraftAlgorithms } from './practiceSession';

const draft: PracticeFormValues = {
  url: 'https://leetcode.cn/problems/two-sum/',
  frontendQuestionId: '1',
  titleZh: '两数之和',
  difficulty: 'easy',
  practicedOn: '2026-07-23',
  primaryAlgorithmId: 'hash',
  secondaryAlgorithmIds: ['binary'],
  solutionMarkdown: '## 思路\n保留草稿',
};

const algorithms: Algorithm[] = [
  { id: 'hash', name: '哈希表', color: '#2563eb', createdAt: '' },
  { id: 'binary', name: '二分查找', color: '#16a34a', createdAt: '' },
];

describe('practice session draft rules', () => {
  it('replaces only the primary algorithm for a primary create', () => {
    expect(applyCreatedAlgorithm(draft, 'primary', 'graph')).toEqual({
      ...draft,
      primaryAlgorithmId: 'graph',
      secondaryAlgorithmIds: ['binary'],
    });
  });

  it('appends a secondary algorithm once without duplicating the primary', () => {
    expect(applyCreatedAlgorithm(draft, 'secondary', 'graph').secondaryAlgorithmIds)
      .toEqual(['binary', 'graph']);
    expect(applyCreatedAlgorithm(draft, 'secondary', 'binary').secondaryAlgorithmIds)
      .toEqual(['binary']);
    expect(applyCreatedAlgorithm(draft, 'secondary', 'hash').secondaryAlgorithmIds)
      .toEqual(['binary']);
  });

  it('removes references deleted while the user was on data management', () => {
    expect(sanitizeDraftAlgorithms(draft, algorithms)).toEqual(draft);
    expect(sanitizeDraftAlgorithms(draft, algorithms.slice(1))).toEqual({
      ...draft,
      primaryAlgorithmId: '',
      secondaryAlgorithmIds: ['binary'],
    });
    expect(sanitizeDraftAlgorithms(draft, [])).toEqual({
      ...draft,
      primaryAlgorithmId: '',
      secondaryAlgorithmIds: [],
    });
  });
});
