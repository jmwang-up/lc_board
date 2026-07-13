import type { Algorithm, Practice, Problem, ProblemMetadata } from '../domain/models';
import type { BackupV1, MergeResult } from '../domain/backup';

export interface RecordPracticeInput {
  metadata: ProblemMetadata;
  practicedOn: string;
  primaryAlgorithmId: string;
  secondaryAlgorithmIds: string[];
}

export interface DataCounts { problems: number; practices: number; algorithms: number }

export interface DashboardRepository {
  createAlgorithm(input: { name: string; color: string }): Promise<Algorithm>;
  renameAlgorithm(id: string, name: string): Promise<void>;
  replaceAndDeleteAlgorithm(id: string, replacementId: string, expectedAffectedCount: number): Promise<void>;
  deleteUnusedAlgorithm(id: string, expectedAffectedCount: number): Promise<void>;
  deleteAlgorithmAndPractices(id: string, expectedAffectedCount: number): Promise<void>;
  recordPractice(input: RecordPracticeInput): Promise<{ problem: Problem; practice: Practice }>;
  listAlgorithms(): Promise<Algorithm[]>;
  listProblems(): Promise<Problem[]>;
  listPractices(): Promise<Practice[]>;
  deletePractice(id: string): Promise<void>;
  deleteProblem(id: string, expectedPracticeCount: number): Promise<void>;
  getDataCounts(): Promise<DataCounts>;
  exportBackup(): Promise<BackupV1>;
  importBackup(backup: BackupV1): Promise<MergeResult['summary']>;
  clearAll(expectedCounts: DataCounts): Promise<void>;
}
