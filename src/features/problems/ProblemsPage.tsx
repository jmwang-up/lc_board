import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useRepository } from '../../app/RepositoryContext';
import { filterProblems, type DashboardDataset, type ProblemFilters } from '../../domain/dashboard';
import type { Difficulty } from '../../domain/models';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ProblemDetails } from './ProblemDetails';

const difficultyNames = { easy: '简单', medium: '中等', hard: '困难' };
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'data'; dataset: DashboardDataset };

export function ProblemsPage() {
  const repository = useRepository();
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [params, setParams] = useSearchParams();
  const { problemId } = useParams();
  useEffect(() => {
    let active = true;
    setLoadState({ status: 'loading' });
    Promise.all([repository.listAlgorithms(), repository.listProblems(), repository.listPractices()])
      .then(([algorithms, problems, practices]) => {
        if (active) setLoadState({ status: 'data', dataset: { algorithms, problems, practices } });
      })
      .catch(() => {
        if (active) setLoadState({ status: 'error' });
      });
    return () => { active = false; };
  }, [repository, loadAttempt]);
  if (loadState.status === 'loading') return <main><h1>题目记录</h1><p>正在加载…</p></main>;
  if (loadState.status === 'error') return <main><h1>题目记录</h1><section role="alert" className="load-error"><h2>题目记录加载失败</h2><p>暂时无法读取本地数据，请重试。</p><button type="button" onClick={() => setLoadAttempt(value => value + 1)}>重新加载</button></section></main>;
  const { dataset } = loadState;
  const filters: ProblemFilters = {
    query: params.get('query') || undefined,
    primaryAlgorithmId: params.get('primaryAlgorithmId') || undefined,
    secondaryAlgorithmId: params.get('secondaryAlgorithmId') || undefined,
    difficulty: (params.get('difficulty') || undefined) as Difficulty | undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
  };
  const filteredItems = filterProblems(dataset, filters);
  const items = problemId ? filteredItems.filter(item => item.problem.id === problemId) : filteredItems;
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(name, value) : next.delete(name);
    setParams(next);
  };
  const isExpanded = (id: string) => problemId === id || expanded.includes(id);
  return <main>
    <h1>题目记录</h1>
    <form className="problem-filters" onSubmit={event => event.preventDefault()}>
      <label>搜索<input name="query" value={params.get('query') ?? ''} onChange={event => update('query', event.target.value)} placeholder="题号或中文标题" /></label>
      <label>难度<select name="difficulty" value={params.get('difficulty') ?? ''} onChange={event => update('difficulty', event.target.value)}><option value="">全部</option><option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
      <label>主算法<select name="primaryAlgorithmId" value={params.get('primaryAlgorithmId') ?? ''} onChange={event => update('primaryAlgorithmId', event.target.value)}><option value="">全部</option>{dataset.algorithms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>辅助算法<select name="secondaryAlgorithmId" value={params.get('secondaryAlgorithmId') ?? ''} onChange={event => update('secondaryAlgorithmId', event.target.value)}><option value="">全部</option>{dataset.algorithms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>开始日期<input type="date" name="from" value={params.get('from') ?? ''} onChange={event => update('from', event.target.value)} /></label>
      <label>结束日期<input type="date" name="to" value={params.get('to') ?? ''} onChange={event => update('to', event.target.value)} /></label>
    </form>
    {!items.length ? <EmptyState title="没有匹配的题目" description="试试清除筛选条件，或记录一次新的练习。" action={<button type="button" onClick={() => setParams({})}>清除筛选</button>} />
      : <table className="problem-table"><thead><tr><th>题号</th><th>题目</th><th>难度</th><th>练习</th><th>操作</th></tr></thead><tbody>{items.map(item => <tr key={item.problem.id}><td data-label="题号">{item.problem.frontendQuestionId}</td><td data-label="题目"><h2><Link to={`/problems/${item.problem.id}`}>{item.problem.titleZh}</Link></h2></td><td data-label="难度">{difficultyNames[item.problem.difficulty]}</td><td data-label="练习">{item.practices.length}</td><td data-label="操作"><button type="button" aria-expanded={isExpanded(item.problem.id)} onClick={() => setExpanded(value => value.includes(item.problem.id) ? value.filter(id => id !== item.problem.id) : [...value, item.problem.id])}>查看练习记录</button>{isExpanded(item.problem.id) ? <ProblemDetails item={item} algorithms={dataset.algorithms} /> : null}</td></tr>)}</tbody></table>}
  </main>;
}
