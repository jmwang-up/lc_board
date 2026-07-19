import { SOLUTION_MARKDOWN_MAX_LENGTH, type Algorithm, type Practice, type Problem } from '../domain/models';
import { mergeBackup, parseBackup, type BackupV2, type MergeResult } from '../domain/backup';
import { DashboardDatabase } from './DashboardDatabase';
import type { DashboardRepository, DataCounts, RecordPracticeInput } from './DashboardRepository';

const normalizedName = (name: string) => name.trim().toLocaleLowerCase();

function assertLocalDate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('练习日期无效');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('练习日期无效');
  }
}

function assertSolutionMarkdown(value: string): void {
  if (value.length > SOLUTION_MARKDOWN_MAX_LENGTH) {
    throw new Error('解题思路不能超过 20000 个字符');
  }
}

export class DexieDashboardRepository implements DashboardRepository {
  constructor(private readonly database: DashboardDatabase) {}

  async createAlgorithm(input: { name: string; color: string }): Promise<Algorithm> {
    return this.database.transaction('rw', this.database.algorithms, async () => {
      const name = input.name.trim();
      await this.assertUniqueAlgorithmName(name);
      const algorithm: Algorithm = { id: crypto.randomUUID(), name, color: input.color, createdAt: new Date().toISOString() };
      await this.database.algorithms.add(algorithm);
      return algorithm;
    });
  }

  async renameAlgorithm(id: string, nameInput: string): Promise<void> {
    await this.database.transaction('rw', this.database.algorithms, async () => {
      if (!await this.database.algorithms.get(id)) throw new Error('算法不存在');
      const name = nameInput.trim();
      await this.assertUniqueAlgorithmName(name, id);
      await this.database.algorithms.update(id, { name });
    });
  }

  async replaceAndDeleteAlgorithm(id: string, replacementId: string, expectedAffectedCount: number): Promise<void> {
    if (id === replacementId) throw new Error('替代算法不能与待删除算法相同');
    await this.database.transaction('rw', this.database.algorithms, this.database.practices, async () => {
      const [oldAlgorithm, replacement] = await Promise.all([
        this.database.algorithms.get(id),
        this.database.algorithms.get(replacementId),
      ]);
      if (!oldAlgorithm || !replacement) throw new Error('算法不存在');

      const practices = await this.database.practices
        .filter(practice => practice.primaryAlgorithmId === id || practice.secondaryAlgorithmIds.includes(id))
        .toArray();
      if (practices.length !== expectedAffectedCount) throw new Error('数据已变化，请重新确认');
      for (const practice of practices) {
        const primaryAlgorithmId = practice.primaryAlgorithmId === id ? replacementId : practice.primaryAlgorithmId;
        const secondaryAlgorithmIds = [...new Set(practice.secondaryAlgorithmIds.map(item => item === id ? replacementId : item))]
          .filter(item => item !== primaryAlgorithmId);
        await this.database.practices.update(practice.id, { primaryAlgorithmId, secondaryAlgorithmIds, updatedAt: new Date().toISOString() });
      }
      await this.database.algorithms.delete(id);
    });
  }

  async deleteUnusedAlgorithm(id: string, expectedAffectedCount: number): Promise<void> {
    await this.database.transaction('rw', this.database.algorithms, this.database.practices, async () => {
      if (!await this.database.algorithms.get(id)) throw new Error('算法不存在');
      const affectedCount = await this.database.practices
        .filter(practice => practice.primaryAlgorithmId === id || practice.secondaryAlgorithmIds.includes(id))
        .count();
      if (affectedCount !== expectedAffectedCount || affectedCount !== 0) throw new Error('数据已变化，请重新确认');
      await this.database.algorithms.delete(id);
    });
  }

  async deleteAlgorithmAndPractices(id: string, expectedAffectedCount: number): Promise<void> {
    await this.database.transaction('rw', this.database.algorithms, this.database.practices, async () => {
      if (!await this.database.algorithms.get(id)) throw new Error('算法不存在');
      const affected = await this.database.practices
        .filter(practice => practice.primaryAlgorithmId === id || practice.secondaryAlgorithmIds.includes(id))
        .primaryKeys();
      if (affected.length !== expectedAffectedCount) throw new Error('数据已变化，请重新确认');
      await this.database.practices.bulkDelete(affected);
      await this.database.algorithms.delete(id);
    });
  }

  async recordPractice(input: RecordPracticeInput): Promise<{ problem: Problem; practice: Practice }> {
    assertLocalDate(input.practicedOn);
    assertSolutionMarkdown(input.solutionMarkdown ?? '');
    if (new Set(input.secondaryAlgorithmIds).size !== input.secondaryAlgorithmIds.length) throw new Error('辅助算法不能重复');
    if (input.secondaryAlgorithmIds.includes(input.primaryAlgorithmId)) throw new Error('辅助算法不能与主要算法重复');

    return this.database.transaction('rw', this.database.algorithms, this.database.problems, this.database.practices, async () => {
      const algorithmIds = [input.primaryAlgorithmId, ...input.secondaryAlgorithmIds];
      const algorithms = await this.database.algorithms.bulkGet(algorithmIds);
      if (algorithms.some(algorithm => !algorithm)) throw new Error('算法不存在');

      let problem = await this.database.problems.where('leetcodeSlug').equals(input.metadata.slug).first();
      if (!problem) {
        problem = {
          id: crypto.randomUUID(),
          leetcodeSlug: input.metadata.slug,
          frontendQuestionId: input.metadata.frontendQuestionId,
          titleZh: input.metadata.titleZh,
          difficulty: input.metadata.difficulty,
          url: input.metadata.url,
          createdAt: new Date().toISOString(),
        };
        await this.database.problems.add(problem);
      }
      const now = new Date().toISOString();
      const practice: Practice = {
        id: crypto.randomUUID(),
        problemId: problem.id,
        practicedOn: input.practicedOn,
        primaryAlgorithmId: input.primaryAlgorithmId,
        secondaryAlgorithmIds: [...input.secondaryAlgorithmIds],
        solutionMarkdown: input.solutionMarkdown ?? '',
        createdAt: now,
        updatedAt: now,
      };
      await this.database.practices.add(practice);
      return { problem, practice };
    });
  }

  listAlgorithms(): Promise<Algorithm[]> { return this.database.algorithms.toArray(); }
  listProblems(): Promise<Problem[]> { return this.database.problems.toArray(); }
  listPractices(): Promise<Practice[]> { return this.database.practices.toArray(); }
  async updatePracticeSolution(practiceId: string, solutionMarkdown: string): Promise<Practice> {
    assertSolutionMarkdown(solutionMarkdown);
    return this.database.transaction('rw', this.database.practices, async () => {
      const practice = await this.database.practices.get(practiceId);
      if (!practice) throw new Error('练习已不存在');
      const updated = { ...practice, solutionMarkdown, updatedAt: new Date().toISOString() };
      await this.database.practices.put(updated);
      return updated;
    });
  }
  deletePractice(id: string): Promise<void> { return this.database.practices.delete(id); }

  async deleteProblem(id: string, expectedPracticeCount: number): Promise<void> {
    await this.database.transaction('rw', this.database.problems, this.database.practices, async () => {
      const actualPracticeCount = await this.database.practices.where('problemId').equals(id).count();
      if (actualPracticeCount !== expectedPracticeCount) throw new Error('数据已变化，请重新确认');
      await this.database.practices.where('problemId').equals(id).delete();
      await this.database.problems.delete(id);
    });
  }

  getDataCounts(): Promise<DataCounts> {
    return this.database.transaction('r', this.database.problems, this.database.practices, this.database.algorithms, async () => ({
      problems: await this.database.problems.count(),
      practices: await this.database.practices.count(),
      algorithms: await this.database.algorithms.count(),
    }));
  }

  async clearAll(expectedCounts: DataCounts): Promise<void> {
    await this.database.transaction('rw', this.database.problems, this.database.practices, this.database.algorithms, async () => {
      const actualCounts = {
        problems: await this.database.problems.count(),
        practices: await this.database.practices.count(),
        algorithms: await this.database.algorithms.count(),
      };
      if (actualCounts.problems !== expectedCounts.problems || actualCounts.practices !== expectedCounts.practices || actualCounts.algorithms !== expectedCounts.algorithms) {
        throw new Error('数据已变化，请重新确认');
      }
      await this.database.practices.clear();
      await this.database.problems.clear();
      await this.database.algorithms.clear();
    });
  }

  async exportBackup(): Promise<BackupV2> {
    return this.database.transaction('r', this.database.problems, this.database.practices, this.database.algorithms, async () => ({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      problems: await this.database.problems.toArray(),
      practices: await this.database.practices.toArray(),
      algorithms: await this.database.algorithms.toArray(),
    }));
  }

  async importBackup(input: unknown): Promise<MergeResult['summary']> {
    const imported = parseBackup(input);
    const local = await this.exportBackup();
    const merged = mergeBackup(local, imported);
    const localProblemIds = new Set(local.problems.map(item => item.id));
    const localPracticeIds = new Set(local.practices.map(item => item.id));
    const localAlgorithmIds = new Set(local.algorithms.map(item => item.id));
    const problems = merged.problems.filter(item => !localProblemIds.has(item.id));
    const practices = merged.practices.filter(item => !localPracticeIds.has(item.id));
    const algorithms = merged.algorithms.filter(item => !localAlgorithmIds.has(item.id));
    await this.database.transaction('rw', this.database.problems, this.database.practices, this.database.algorithms, async () => {
      await this.database.problems.bulkAdd(problems);
      await this.database.algorithms.bulkAdd(algorithms);
      await this.database.practices.bulkAdd(practices);
    });
    return merged.summary;
  }

  private async assertUniqueAlgorithmName(name: string, ignoredId?: string): Promise<void> {
    const normalized = normalizedName(name);
    if (!normalized) throw new Error('算法名称不能为空');
    const duplicate = await this.database.algorithms.filter(item => item.id !== ignoredId && normalizedName(item.name) === normalized).first();
    if (duplicate) throw new Error('算法名称已存在');
  }
}
