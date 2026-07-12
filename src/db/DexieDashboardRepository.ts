import type { Algorithm, Practice, Problem } from '../domain/models';
import { DashboardDatabase } from './DashboardDatabase';
import type { DashboardRepository, RecordPracticeInput } from './DashboardRepository';

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

  async replaceAndDeleteAlgorithm(id: string, replacementId: string): Promise<void> {
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
      for (const practice of practices) {
        const primaryAlgorithmId = practice.primaryAlgorithmId === id ? replacementId : practice.primaryAlgorithmId;
        const secondaryAlgorithmIds = [...new Set(practice.secondaryAlgorithmIds.map(item => item === id ? replacementId : item))]
          .filter(item => item !== primaryAlgorithmId);
        await this.database.practices.update(practice.id, { primaryAlgorithmId, secondaryAlgorithmIds, updatedAt: new Date().toISOString() });
      }
      await this.database.algorithms.delete(id);
    });
  }

  async recordPractice(input: RecordPracticeInput): Promise<{ problem: Problem; practice: Practice }> {
    assertLocalDate(input.practicedOn);
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
  deletePractice(id: string): Promise<void> { return this.database.practices.delete(id); }

  async deleteProblem(id: string): Promise<void> {
    await this.database.transaction('rw', this.database.problems, this.database.practices, async () => {
      await this.database.practices.where('problemId').equals(id).delete();
      await this.database.problems.delete(id);
    });
  }

  async clearAll(): Promise<void> {
    await this.database.transaction('rw', this.database.problems, this.database.practices, this.database.algorithms, async () => {
      await Promise.all([this.database.practices.clear(), this.database.problems.clear(), this.database.algorithms.clear()]);
    });
  }

  private async assertUniqueAlgorithmName(name: string, ignoredId?: string): Promise<void> {
    const normalized = normalizedName(name);
    if (!normalized) throw new Error('算法名称不能为空');
    const duplicate = await this.database.algorithms.filter(item => item.id !== ignoredId && normalizedName(item.name) === normalized).first();
    if (duplicate) throw new Error('算法名称已存在');
  }
}
