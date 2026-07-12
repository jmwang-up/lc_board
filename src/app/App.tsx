import { NavLink, Route, Routes } from 'react-router-dom';
import { AlgorithmManager } from '../features/algorithms/AlgorithmManager';

const Page = ({ title }: { title: string }) => <main><h1>{title}</h1></main>;

export function App() {
  return <div className="app-shell">
    <header>
      <strong>LC Board</strong>
      <nav aria-label="主导航">
        <NavLink to="/">算法看板</NavLink>
        <NavLink to="/problems">题目记录</NavLink>
        <NavLink to="/data">数据管理</NavLink>
      </nav>
      <button data-testid="record-practice" type="button">＋ 记录练习</button>
    </header>
    <Routes>
      <Route path="/" element={<Page title="算法看板" />} />
      <Route path="/problems" element={<Page title="题目记录" />} />
      <Route path="/data" element={<AlgorithmManager />} />
    </Routes>
  </div>;
}
