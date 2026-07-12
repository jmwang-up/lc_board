import type { Algorithm, Difficulty, Practice, Problem } from './models';

export interface DashboardDataset {
  algorithms: Algorithm[];
  problems: Problem[];
  practices: Practice[];
}

export interface ProblemListItem {
  problem: Problem;
  practices: Practice[];
}

export interface ProblemFilters {
  query?: string;
  primaryAlgorithmId?: string;
  secondaryAlgorithmId?: string;
  difficulty?: Difficulty;
  from?: string;
  to?: string;
}

export interface DashboardSnapshot {
  algorithmCards: Array<{ algorithm: Algorithm; problemCount: number; practiceCount: number }>;
  activityByDate: Record<string, number>;
  recentPractices: Practice[];
}

export const comparePracticeNewestFirst = (left: Practice, right: Practice) =>
  right.practicedOn.localeCompare(left.practicedOn)
  || right.createdAt.localeCompare(left.createdAt)
  || right.id.localeCompare(left.id);

export function filterProblems(dataset: DashboardDataset, filters: ProblemFilters): ProblemListItem[] {
  const query = filters.query?.trim().toLocaleLowerCase('zh-CN');
  return dataset.problems.flatMap(problem => {
    const visiblePractices = dataset.practices.filter(practice =>
      practice.problemId === problem.id
      && (!filters.primaryAlgorithmId || practice.primaryAlgorithmId === filters.primaryAlgorithmId)
      && (!filters.secondaryAlgorithmId || practice.secondaryAlgorithmIds.includes(filters.secondaryAlgorithmId))
      && (!filters.from || practice.practicedOn >= filters.from)
      && (!filters.to || practice.practicedOn <= filters.to));
    const textMatch = !query
      || problem.titleZh.toLocaleLowerCase('zh-CN').includes(query)
      || problem.frontendQuestionId.toLocaleLowerCase('zh-CN').startsWith(query);
    return textMatch && (!filters.difficulty || problem.difficulty === filters.difficulty) && visiblePractices.length
      ? [{ problem, practices: visiblePractices.sort(comparePracticeNewestFirst) }]
      : [];
  });
}

export function buildDashboardSnapshot(dataset: DashboardDataset): DashboardSnapshot {
  const algorithmCards = dataset.algorithms.map(algorithm => {
    const practices = dataset.practices.filter(practice => practice.primaryAlgorithmId === algorithm.id);
    return {
      algorithm,
      practiceCount: practices.length,
      problemCount: new Set(practices.map(practice => practice.problemId)).size,
    };
  });
  const activityByDate = dataset.practices.reduce<Record<string, number>>((result, practice) => {
    result[practice.practicedOn] = (result[practice.practicedOn] ?? 0) + 1;
    return result;
  }, {});
  const recentPractices = [...dataset.practices].sort(comparePracticeNewestFirst).slice(0, 10);
  return { algorithmCards, activityByDate, recentPractices };
}
