import type { Algorithm } from '../../domain/models';
import type { ProblemListItem } from '../../domain/dashboard';

export function ProblemDetails({ item, algorithms, onDeletePractice }: { item: ProblemListItem; algorithms: Algorithm[]; onDeletePractice: (practiceId: string) => void }) {
  const names = new Map(algorithms.map(algorithm => [algorithm.id, algorithm.name]));
  return <ul data-testid="practice-history" aria-label={`${item.problem.titleZh}的练习记录`} className="practice-history">
    {item.practices.map(practice => <li key={practice.id}>
      <time dateTime={practice.practicedOn}>{practice.practicedOn}</time>
      <span>主：{names.get(practice.primaryAlgorithmId) ?? '未知算法'}</span>
      <span>辅：{practice.secondaryAlgorithmIds.map(id => names.get(id) ?? '未知算法').join('、') || '无'}</span>
      <button type="button" aria-label={`删除 ${practice.practicedOn} 的练习`} onClick={() => onDeletePractice(practice.id)}>删除练习</button>
    </li>)}
  </ul>;
}
