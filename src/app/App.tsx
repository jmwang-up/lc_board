import { useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Algorithm } from '../domain/models';
import { DataManagementPage } from '../features/data-management/DataManagementPage';
import { RecordPracticeDialog } from '../features/practices/RecordPracticeDialog';
import type { PracticeFormValues } from '../features/practices/PracticeForm';
import { applyCreatedAlgorithm, type AddAlgorithmRequest, type AlgorithmTarget } from '../features/practices/practiceSession';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProblemsPage } from '../features/problems/ProblemsPage';

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [recording, setRecording] = useState(false);
  const [revision, setRevision] = useState(0);
  const [practiceDraft, setPracticeDraft] = useState<PracticeFormValues>();
  const [algorithmRequest, setAlgorithmRequest] = useState<AddAlgorithmRequest>();
  const recordButton = useRef<HTMLButtonElement>(null);

  function clearPracticeSession() {
    setRecording(false);
    setPracticeDraft(undefined);
    setAlgorithmRequest(undefined);
  }

  function requestAlgorithm(target: AlgorithmTarget, values: PracticeFormValues) {
    const returnLocation = `${location.pathname}${location.search}${location.hash}`;
    const request: AddAlgorithmRequest = { target, draft: { values }, returnLocation };
    setPracticeDraft(values);
    setAlgorithmRequest(request);
    setRecording(false);
    navigate('/data?createAlgorithm=1');
  }

  function returnToPractice(algorithm?: Algorithm) {
    if (!algorithmRequest) return;
    setPracticeDraft(current => {
      const values = current ?? algorithmRequest.draft.values;
      return algorithm
        ? applyCreatedAlgorithm(values, algorithmRequest.target, algorithm.id)
        : values;
    });
    const returnLocation = algorithmRequest.returnLocation;
    setAlgorithmRequest(undefined);
    navigate(returnLocation);
    setRecording(true);
  }

  return <div className="app-shell">
    <header>
      <strong>LC Board</strong>
      <nav aria-label="主导航">
        <NavLink to="/">算法看板</NavLink>
        <NavLink to="/problems">题目记录</NavLink>
        <NavLink to="/data">数据管理</NavLink>
      </nav>
      <button ref={recordButton} data-testid="record-practice" type="button" onClick={() => {
        setPracticeDraft(undefined);
        setAlgorithmRequest(undefined);
        setRecording(true);
      }}>＋ 记录练习</button>
    </header>
    <Routes key={revision}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/problems" element={<ProblemsPage />} />
      <Route path="/problems/:problemId" element={<ProblemsPage />} />
      <Route path="/data" element={<DataManagementPage
        creationTarget={algorithmRequest?.target}
        onAlgorithmCreated={algorithm => returnToPractice(algorithm)}
        onReturnToPractice={() => returnToPractice()}
      />} />
    </Routes>
    <RecordPracticeDialog
      open={recording}
      initialDraft={practiceDraft}
      onAddAlgorithm={requestAlgorithm}
      onClose={clearPracticeSession}
      onSaved={() => {
        setRevision(value => value + 1);
        setPracticeDraft(undefined);
        setAlgorithmRequest(undefined);
      }}
    />
  </div>;
}
