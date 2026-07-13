import { z } from 'zod';
import type { Difficulty, ProblemMetadata } from '../src/domain/models.js';

const ENDPOINT = 'https://leetcode.cn/graphql/';
const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      translatedTitle
      difficulty
      titleSlug
    }
  }
`;

const responseSchema = z.object({
  data: z.object({
    question: z.object({
      questionFrontendId: z.string(),
      translatedTitle: z.string(),
      difficulty: z.enum(['Easy', 'Medium', 'Hard']),
      titleSlug: z.string(),
    }).nullable(),
  }),
});

export class LeetCodeLookupError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'UPSTREAM_CHANGED') {
    super(code);
    this.name = 'LeetCodeLookupError';
  }
}

export async function lookupProblemMetadata(
  slug: string,
  signal: AbortSignal,
): Promise<ProblemMetadata> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        referer: `https://leetcode.cn/problems/${slug}/`,
      },
      body: JSON.stringify({
        operationName: 'questionData',
        query: QUESTION_QUERY,
        variables: { titleSlug: slug },
      }),
      signal,
    });

    if (!response.ok) throw new LeetCodeLookupError('UPSTREAM_CHANGED');

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new LeetCodeLookupError('UPSTREAM_CHANGED');

    const question = parsed.data.data.question;
    if (!question) throw new LeetCodeLookupError('NOT_FOUND');
    if (question.titleSlug !== slug) throw new LeetCodeLookupError('UPSTREAM_CHANGED');

    return {
      slug,
      frontendQuestionId: question.questionFrontendId,
      titleZh: question.translatedTitle,
      difficulty: question.difficulty.toLowerCase() as Difficulty,
      url: `https://leetcode.cn/problems/${slug}/`,
    };
  } catch (error) {
    if (error instanceof LeetCodeLookupError || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new LeetCodeLookupError('UPSTREAM_CHANGED');
  }
}
