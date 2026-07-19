export type Difficulty = 'easy' | 'medium' | 'hard';

export const SOLUTION_MARKDOWN_MAX_LENGTH = 20_000;

export interface Problem {
  id: string;
  leetcodeSlug: string;
  frontendQuestionId: string;
  titleZh: string;
  difficulty: Difficulty;
  url: string;
  createdAt: string;
}

export interface Practice {
  id: string;
  problemId: string;
  practicedOn: string;
  primaryAlgorithmId: string;
  secondaryAlgorithmIds: string[];
  solutionMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface Algorithm {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface ProblemMetadata {
  slug: string;
  frontendQuestionId: string;
  titleZh: string;
  difficulty: Difficulty;
  url: string;
}
