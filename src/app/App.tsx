import { useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { DataManagementPage } from '../features/data-management/DataManagementPage';
import { RecordPracticeDialog } from '../features/practices/RecordPracticeDialog';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProblemsPage } from '../features/problems/ProblemsPage';

export function App() {
  const [recording, setRecording] = useState(false);
  const [revision, setRevision] = useState(0);
  const recordButton = useRef<HTMLButtonElement>(null);
  const closeRecording = () => setRecording(false);
  return <div className="app-shell">
    <header>
      <strong>LC Board</strong>
      <nav aria-label="主导航">
        <NavLink to="/">算法看板</NavLink>
        <NavLink to="/problems">题目记录</NavLink>
        <NavLink to="/data">数据管理</NavLink>
      </nav>
      <button ref={recordButton} data-testid="record-practice" type="button" onClick={() => setRecording(true)}>＋ 记录练习</button>
    </header>
    <Routes key={revision}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/problems" element={<ProblemsPage />} />
      <Route path="/problems/:problemId" element={<ProblemsPage />} />
      <Route path="/data" element={<DataManagementPage />} />
    </Routes>
    <RecordPracticeDialog open={recording} onClose={closeRecording} onSaved={() => setRevision(value => value + 1)} />
  </div>;
}
