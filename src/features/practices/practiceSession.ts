import type { Algorithm } from '../../domain/models';
import type { PracticeFormValues } from './PracticeForm';

export type AlgorithmTarget = 'primary' | 'secondary';

export interface PracticeDraft {
  values: PracticeFormValues;
}

export interface AddAlgorithmRequest {
  target: AlgorithmTarget;
  draft: PracticeDraft;
  returnLocation: string;
}

export function applyCreatedAlgorithm(
  values: PracticeFormValues,
  target: AlgorithmTarget,
  algorithmId: string,
): PracticeFormValues {
  if (target === 'primary') return { ...values, primaryAlgorithmId: algorithmId };
  if (algorithmId === values.primaryAlgorithmId || values.secondaryAlgorithmIds.includes(algorithmId)) return values;
  return { ...values, secondaryAlgorithmIds: [...values.secondaryAlgorithmIds, algorithmId] };
}

export function sanitizeDraftAlgorithms(
  values: PracticeFormValues,
  algorithms: Algorithm[],
): PracticeFormValues {
  const ids = new Set(algorithms.map(algorithm => algorithm.id));
  return {
    ...values,
    primaryAlgorithmId: ids.has(values.primaryAlgorithmId) ? values.primaryAlgorithmId : '',
    secondaryAlgorithmIds: values.secondaryAlgorithmIds
      .filter(id => ids.has(id) && id !== values.primaryAlgorithmId),
  };
}
