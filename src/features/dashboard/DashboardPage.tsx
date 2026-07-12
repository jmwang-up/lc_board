import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../../app/RepositoryContext';
import { buildDashboardSnapshot, type DashboardDataset } from '../../domain/dashboard';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ActivityCalendar } from './ActivityCalendar';

const emptyDataset: DashboardDataset = { algorithms: [], problems: [], practices: [] };

export function DashboardPage() {
  const repository = useRepository();
  const [dataset, setDataset] = useState<DashboardDataset | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([repository.listAlgorithms(), repository.listProblems(), repository.listPractices()])
      .then(([algorithms, problems, practices]) => active && setDataset({ algorithms, problems, practices }));
    return () => { active = false; };
  }, [repository]);
  if (!dataset) return <main><h1>算法看板</h1><p>正在加载…</p></main>;
  const snapshot = buildDashboardSnapshot(dataset ?? emptyDataset);
  const problemsById = new Map(dataset.problems.map(problem => [problem.id, problem]));
  const algorithmsById = new Map(dataset.algorithms.map(algorithm => [algorithm.id, algorithm]));
  return <main>
    <h1>算法看板</h1>
    {!dataset.practices.length ? <EmptyState title="开始记录第一次练习" description="记录题目后，这里会展示算法分布与练习活动。" action={<Link className="button-link" to="/problems">查看题目记录</Link>} /> : null}
    <section aria-labelledby="algorithm-title">
      <h2 id="algorithm-title">按主算法浏览</h2>
      <div className="algorithm-grid">{snapshot.algorithmCards.map(card => <Link className="algorithm-card" key={card.algorithm.id} to={`/problems?primaryAlgorithmId=${encodeURIComponent(card.algorithm.id)}`} style={{ borderColor: card.algorithm.color }}>
        <strong>{card.algorithm.name}</strong><span>{card.problemCount} 道题</span><span>{card.practiceCount} 次练习</span>
      </Link>)}</div>
    </section>
    <ActivityCalendar activityByDate={snapshot.activityByDate} />
    <section aria-labelledby="recent-title"><h2 id="recent-title">最近练习</h2>
      {snapshot.recentPractices.length ? <ol className="recent-list">{snapshot.recentPractices.map(practice => <li key={practice.id}>
        <Link to={`/problems/${practice.problemId}`}>{problemsById.get(practice.problemId)?.titleZh ?? '未知题目'}</Link>
        <span>{practice.practicedOn}</span><span>{algorithmsById.get(practice.primaryAlgorithmId)?.name ?? '未知算法'}</span>
      </li>)}</ol> : <p>暂无练习。</p>}
    </section>
  </main>;
}
