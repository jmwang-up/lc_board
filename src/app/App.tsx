import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Algorithm } from '../domain/models';
import { DataManagementPage } from '../features/data-management/DataManagementPage';
import { RecordPracticeDialog } from '../features/practices/RecordPracticeDialog';
import type { PracticeFormValues } from '../features/practices/PracticeForm';
import { applyCreatedAlgorithm, type AddAlgorithmRequest, type AlgorithmTarget } from '../features/practices/practiceSession';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ProblemsPage } from '../features/problems/ProblemsPage';

const ALGORITHM_CREATION_LOCATION = '/data?createAlgorithm=1';

interface ActiveAlgorithmRequest extends AddAlgorithmRequest {
  id: number;
  creationLocation: typeof ALGORITHM_CREATION_LOCATION;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentLocation = `${location.pathname}${location.search}${location.hash}`;
  const [recording, setRecording] = useState(false);
  const [revision, setRevision] = useState(0);
  const [practiceDraft, setPracticeDraft] = useState<PracticeFormValues>();
  const [algorithmRequest, setAlgorithmRequest] = useState<ActiveAlgorithmRequest>();
  const algorithmRequestRef = useRef<ActiveAlgorithmRequest | undefined>(undefined);
  const algorithmRequestSequence = useRef(0);
  const locationRef = useRef(currentLocation);
  const recordButton = useRef<HTMLButtonElement>(null);
  locationRef.current = currentLocation;

  const replaceAlgorithmRequest = useCallback((request?: ActiveAlgorithmRequest) => {
    algorithmRequestRef.current = request;
    setAlgorithmRequest(request);
  }, []);

  function isCurrentAlgorithmRequest(request: ActiveAlgorithmRequest) {
    return algorithmRequestRef.current === request
      && algorithmRequestRef.current.id === request.id
      && locationRef.current === request.creationLocation;
  }

  useEffect(() => {
    const invalidateRequest = () => replaceAlgorithmRequest(undefined);
    window.addEventListener('popstate', invalidateRequest);
    return () => window.removeEventListener('popstate', invalidateRequest);
  }, [replaceAlgorithmRequest]);

  useLayoutEffect(() => {
    if (currentLocation !== ALGORITHM_CREATION_LOCATION && algorithmRequestRef.current) {
      replaceAlgorithmRequest(undefined);
    }
  }, [currentLocation, replaceAlgorithmRequest]);

  function clearPracticeSession() {
    setRecording(false);
    setPracticeDraft(undefined);
    replaceAlgorithmRequest(undefined);
  }

  function requestAlgorithm(target: AlgorithmTarget, values: PracticeFormValues) {
    const request: ActiveAlgorithmRequest = {
      id: algorithmRequestSequence.current += 1,
      creationLocation: ALGORITHM_CREATION_LOCATION,
      target,
      draft: { values },
      returnLocation: currentLocation,
    };
    setPracticeDraft(values);
    replaceAlgorithmRequest(request);
    setRecording(false);
    navigate(request.creationLocation);
  }

  function returnToPractice(request: ActiveAlgorithmRequest, algorithm?: Algorithm) {
    if (!isCurrentAlgorithmRequest(request)) return;
    const values = algorithm
      ? applyCreatedAlgorithm(request.draft.values, request.target, algorithm.id)
      : request.draft.values;
    replaceAlgorithmRequest(undefined);
    setPracticeDraft(values);
    navigate(request.returnLocation);
    setRecording(true);
  }

  const activeAlgorithmRequest = algorithmRequest
    && algorithmRequestRef.current === algorithmRequest
    && currentLocation === algorithmRequest.creationLocation
    ? algorithmRequest
    : undefined;

  return <div className="app-shell">
    <header>
      <strong>LC Board</strong>
      <nav aria-label="主导航">
        <NavLink to="/" onClick={() => replaceAlgorithmRequest(undefined)}>算法看板</NavLink>
        <NavLink to="/problems" onClick={() => replaceAlgorithmRequest(undefined)}>题目记录</NavLink>
        <NavLink to="/data" onClick={() => replaceAlgorithmRequest(undefined)}>数据管理</NavLink>
      </nav>
      <button ref={recordButton} data-testid="record-practice" type="button" onClick={() => {
        setPracticeDraft(undefined);
        replaceAlgorithmRequest(undefined);
        setRecording(true);
      }}>＋ 记录练习</button>
    </header>
    <Routes key={revision}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/problems" element={<ProblemsPage />} />
      <Route path="/problems/:problemId" element={<ProblemsPage />} />
      <Route path="/data" element={<DataManagementPage
        creationRequestId={activeAlgorithmRequest?.id}
        creationTarget={activeAlgorithmRequest?.target}
        onAlgorithmCreated={activeAlgorithmRequest
          ? algorithm => returnToPractice(activeAlgorithmRequest, algorithm)
          : undefined}
        onReturnToPractice={activeAlgorithmRequest
          ? () => returnToPractice(activeAlgorithmRequest)
          : undefined}
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
        replaceAlgorithmRequest(undefined);
      }}
    />
  </div>;
}
