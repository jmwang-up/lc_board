import type { Algorithm, Practice, Problem, ProblemMetadata } from '../domain/models';
import type { BackupV1, MergeResult } from '../domain/backup';

export interface RecordPracticeInput {
  metadata: ProblemMetadata;
  practicedOn: string;
  primaryAlgorithmId: string;
  secondaryAlgorithmIds: string[];
}

export interface DashboardRepository {
  createAlgorithm(input: { name: string; color: string }): Promise<Algorithm>;
  renameAlgorithm(id: string, name: string): Promise<void>;
  replaceAndDeleteAlgorithm(id: string, replacementId: string): Promise<void>;
  recordPractice(input: RecordPracticeInput): Promise<{ problem: Problem; practice: Practice }>;
  listAlgorithms(): Promise<Algorithm[]>;
  listProblems(): Promise<Problem[]>;
  listPractices(): Promise<Practice[]>;
  deletePractice(id: string): Promise<void>;
  deleteProblem(id: string): Promise<void>;
  exportBackup(): Promise<BackupV1>;
  importBackup(backup: BackupV1): Promise<MergeResult['summary']>;
  clearAll(): Promise<void>;
}
