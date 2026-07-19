import { z } from 'zod';
import { SOLUTION_MARKDOWN_MAX_LENGTH, type Algorithm, type Problem } from './models';

const isoDateTime = z.string().datetime();
const id = z.string().trim().min(1);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
});

export const problemSchema = z.object({
  id, leetcodeSlug: z.string().trim().min(1), frontendQuestionId: z.string(), titleZh: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']), url: z.string().url(), createdAt: isoDateTime,
}).strict().superRefine((problem, context) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(problem.leetcodeSlug) || problem.url !== `https://leetcode.cn/problems/${problem.leetcodeSlug}/`) {
    context.addIssue({ code: 'custom', path: ['url'], message: '题目链接必须是与别名一致的规范 leetcode.cn 链接' });
  }
});
export const algorithmSchema = z.object({ id, name: z.string().trim().min(1), color: z.string().min(1), createdAt: isoDateTime }).strict();
export const practiceSchema = z.object({
  id, problemId: id, practicedOn: localDate, primaryAlgorithmId: id,
  secondaryAlgorithmIds: z.array(id), solutionMarkdown: z.string().max(SOLUTION_MARKDOWN_MAX_LENGTH).default(''), createdAt: isoDateTime, updatedAt: isoDateTime,
}).strict();

export const backupV1Schema = z.object({
  schemaVersion: z.literal(1), exportedAt: isoDateTime,
  problems: z.array(problemSchema), practices: z.array(practiceSchema), algorithms: z.array(algorithmSchema),
}).strict();
export type BackupV1 = z.infer<typeof backupV1Schema>;
export interface MergeResult extends BackupV1 {
  summary: { addedProblems: number; addedPractices: number; addedAlgorithms: number; skippedIds: string[] };
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

function assertUnique<T>(items: T[], key: (item: T) => string, message: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) throw new Error(message);
    seen.add(value);
  }
}

export function parseBackup(input: unknown): BackupV1 {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && (input as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error('备份版本不受支持');
  }
  const result = backupV1Schema.safeParse(input);
  if (!result.success) throw new Error('备份数据格式无效');
  const value = result.data;
  assertUnique(value.problems, item => item.id, '题目 ID 重复');
  assertUnique(value.problems, item => normalize(item.leetcodeSlug), '题目别名重复');
  assertUnique(value.algorithms, item => item.id, '算法 ID 重复');
  assertUnique(value.algorithms, item => normalize(item.name), '算法名称重复');
  assertUnique(value.practices, item => item.id, '练习 ID 重复');
  const problemIds = new Set(value.problems.map(item => item.id));
  const algorithmIds = new Set(value.algorithms.map(item => item.id));
  for (const practice of value.practices) {
    if (!problemIds.has(practice.problemId)) throw new Error('练习引用了不存在的题目');
    if (!algorithmIds.has(practice.primaryAlgorithmId) || practice.secondaryAlgorithmIds.some(item => !algorithmIds.has(item))) {
      throw new Error('练习引用了不存在的算法');
    }
    if (new Set(practice.secondaryAlgorithmIds).size !== practice.secondaryAlgorithmIds.length || practice.secondaryAlgorithmIds.includes(practice.primaryAlgorithmId)) {
      throw new Error('练习算法引用无效');
    }
  }
  return value;
}

function sameProblem(left: Problem, right: Problem): boolean { return normalize(left.leetcodeSlug) === normalize(right.leetcodeSlug); }
function sameAlgorithm(left: Algorithm, right: Algorithm): boolean { return normalize(left.name) === normalize(right.name); }

export function mergeBackup(localInput: BackupV1, importedInput: BackupV1): MergeResult {
  const local = parseBackup(localInput);
  const imported = parseBackup(importedInput);
  const problems = [...local.problems];
  const algorithms = [...local.algorithms];
  const practices = [...local.practices];
  const problemMap = new Map<string, string>();
  const algorithmMap = new Map<string, string>();
  const unsafeProblemIds = new Set<string>();
  const unsafeAlgorithmIds = new Set<string>();
  const skippedIds: string[] = [];

  for (const item of imported.problems) {
    const byId = local.problems.find(localItem => localItem.id === item.id);
    const semanticMatch = local.problems.find(localItem => sameProblem(localItem, item));
    if (byId && !semanticMatch) unsafeProblemIds.add(item.id);
    const match = semanticMatch ?? byId;
    if (match) { problemMap.set(item.id, match.id); skippedIds.push(item.id); }
    else { problems.push(item); problemMap.set(item.id, item.id); }
  }
  for (const item of imported.algorithms) {
    const byId = local.algorithms.find(localItem => localItem.id === item.id);
    const semanticMatch = local.algorithms.find(localItem => sameAlgorithm(localItem, item));
    if (byId && !semanticMatch) unsafeAlgorithmIds.add(item.id);
    const match = semanticMatch ?? byId;
    if (match) { algorithmMap.set(item.id, match.id); skippedIds.push(item.id); }
    else { algorithms.push(item); algorithmMap.set(item.id, item.id); }
  }
  let addedPractices = 0;
  for (const item of imported.practices) {
    if (local.practices.some(localItem => localItem.id === item.id)) { skippedIds.push(item.id); continue; }
    if (unsafeProblemIds.has(item.problemId) || unsafeAlgorithmIds.has(item.primaryAlgorithmId) || item.secondaryAlgorithmIds.some(itemId => unsafeAlgorithmIds.has(itemId))) {
      throw new Error('导入引用无法安全重映射');
    }
    const problemId = problemMap.get(item.problemId);
    const primaryAlgorithmId = algorithmMap.get(item.primaryAlgorithmId);
    const secondaryAlgorithmIds = item.secondaryAlgorithmIds.map(itemId => algorithmMap.get(itemId));
    if (!problemId || !primaryAlgorithmId || secondaryAlgorithmIds.some(itemId => !itemId)) throw new Error('导入引用无法安全重映射');
    const remappedSecondary = [...new Set(secondaryAlgorithmIds as string[])].filter(itemId => itemId !== primaryAlgorithmId);
    practices.push({ ...item, problemId, primaryAlgorithmId, secondaryAlgorithmIds: remappedSecondary });
    addedPractices += 1;
  }
  return {
    schemaVersion: 1, exportedAt: local.exportedAt, problems, algorithms, practices,
    summary: {
      addedProblems: problems.length - local.problems.length,
      addedPractices,
      addedAlgorithms: algorithms.length - local.algorithms.length,
      skippedIds,
    },
  };
}
