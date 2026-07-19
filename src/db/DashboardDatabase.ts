import Dexie, { type EntityTable } from 'dexie';
import type { Algorithm, Practice, Problem } from '../domain/models';

export class DashboardDatabase extends Dexie {
  problems!: EntityTable<Problem, 'id'>;
  practices!: EntityTable<Practice, 'id'>;
  algorithms!: EntityTable<Algorithm, 'id'>;

  constructor(name = 'lc-board') {
    super(name);
    this.version(1).stores({
      problems: 'id, &leetcodeSlug, frontendQuestionId, titleZh, difficulty',
      practices: 'id, problemId, practicedOn, primaryAlgorithmId, *secondaryAlgorithmIds',
      algorithms: 'id, name, createdAt',
    });
    this.version(2).stores({
      problems: 'id, &leetcodeSlug, frontendQuestionId, titleZh, difficulty',
      practices: 'id, problemId, practicedOn, primaryAlgorithmId, *secondaryAlgorithmIds',
      algorithms: 'id, name, createdAt',
    }).upgrade(async transaction => {
      await transaction.table<Practice>('practices').toCollection().modify(practice => {
        if (typeof practice.solutionMarkdown !== 'string') practice.solutionMarkdown = '';
      });
    });
  }
}
