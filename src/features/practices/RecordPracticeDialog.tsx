import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import { parseLeetCodeCnUrl } from '../../domain/leetcode';
import type { ProblemMetadata } from '../../domain/models';
import { Modal } from '../../shared/ui/Modal';
import { useAlgorithms } from '../algorithms/useAlgorithms';
import { fetchProblemMetadata } from './metadataClient';
import { PracticeForm, type PracticeFormValues } from './PracticeForm';
import { sanitizeDraftAlgorithms, type AlgorithmTarget } from './practiceSession';

interface RecordPracticeDialogProps {
  open: boolean;
  initialDraft?: PracticeFormValues;
  onClose: () => void;
  onSaved: () => void;
  onAddAlgorithm: (target: AlgorithmTarget, values: PracticeFormValues) => void;
}

export function RecordPracticeDialog({ open, initialDraft, onClose, onSaved, onAddAlgorithm }: RecordPracticeDialogProps) {
  const repository = useRepository();
  const { algorithms, reload, loading, loadError } = useAlgorithms();
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<ProblemMetadata>();
  const [manual, setManual] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const sessionEpoch = useRef(0);
  const sessionOpen = useRef(open);
  const lookupSequence = useRef(0);
  const lookupController = useRef<AbortController | undefined>(undefined);
  const saveOperation = useRef<{ session: number } | undefined>(undefined);
  const urlInput = useRef<HTMLInputElement>(null);

  function invalidateLookup() {
    lookupSequence.current += 1;
    lookupController.current?.abort();
    lookupController.current = undefined;
  }

  function isCurrentSession(session: number) {
    return sessionOpen.current && session === sessionEpoch.current;
  }

  useLayoutEffect(() => {
    if (sessionOpen.current === open) return;
    sessionOpen.current = open;
    sessionEpoch.current += 1;
  }, [open]);
  useEffect(() => () => {
    sessionOpen.current = false;
    sessionEpoch.current += 1;
    lookupController.current?.abort();
    lookupSequence.current += 1;
    saveOperation.current = undefined;
  }, []);
  useEffect(() => {
    if (!open) {
      invalidateLookup();
      saveOperation.current = undefined;
      setUrl('');
      setMetadata(undefined);
      setManual(false);
      setLookupError('');
      setSaveError('');
      setLookingUp(false);
      setSaving(false);
    }
  }, [open]);
  useEffect(() => {
    if (!open || !initialDraft) return;
    setUrl(initialDraft.url);
    setMetadata(undefined);
    setManual(true);
  }, [open, initialDraft]);
  useEffect(() => { if (open) void reload(); }, [open, reload]);
  if (!open) return null;

  async function lookup() {
    invalidateLookup();
    const session = sessionEpoch.current;
    const requestId = lookupSequence.current;
    setLookupError('');
    setMetadata(undefined);
    let parsed: ReturnType<typeof parseLeetCodeCnUrl>;
    try { parsed = parseLeetCodeCnUrl(url); setUrl(parsed.url); }
    catch (error) { setLookupError(error instanceof Error ? error.message : '链接无效'); return; }
    const controller = new AbortController();
    lookupController.current = controller;
    setLookingUp(true);
    try {
      const result = await fetchProblemMetadata(parsed.slug, controller.signal);
      if (!isCurrentSession(session) || requestId !== lookupSequence.current) return;
      setMetadata(result); setManual(true);
    } catch {
      if (!isCurrentSession(session) || requestId !== lookupSequence.current) return;
      setManual(true); setLookupError('自动读取失败，可以手动填写');
    } finally {
      if (isCurrentSession(session) && requestId === lookupSequence.current) { setLookingUp(false); lookupController.current = undefined; }
    }
  }

  async function save(values: PracticeFormValues) {
    const session = sessionEpoch.current;
    if (!sessionOpen.current || saveOperation.current?.session === session) return;
    const operation = { session };
    saveOperation.current = operation;
    setSaveError(''); setSaving(true);
    try {
      const parsed = parseLeetCodeCnUrl(values.url);
      await repository.recordPractice({ metadata: { slug: parsed.slug, url: parsed.url, frontendQuestionId: values.frontendQuestionId, titleZh: values.titleZh, difficulty: values.difficulty }, practicedOn: values.practicedOn, primaryAlgorithmId: values.primaryAlgorithmId, secondaryAlgorithmIds: values.secondaryAlgorithmIds, solutionMarkdown: values.solutionMarkdown });
      if (!isCurrentSession(session)) return;
      onSaved(); onClose();
    } catch {
      if (isCurrentSession(session)) setSaveError('保存失败，请重试');
    } finally {
      if (saveOperation.current === operation) saveOperation.current = undefined;
      if (isCurrentSession(session)) setSaving(false);
    }
  }

  const restoredValues = initialDraft
    ? sanitizeDraftAlgorithms(initialDraft, algorithms)
    : {
        frontendQuestionId: metadata?.frontendQuestionId ?? '',
        titleZh: metadata?.titleZh ?? '',
        difficulty: metadata?.difficulty ?? 'easy',
      };
  const formValues = {
    ...restoredValues,
    url,
    frontendQuestionId: metadata?.frontendQuestionId ?? restoredValues.frontendQuestionId,
    titleZh: metadata?.titleZh ?? restoredValues.titleZh,
    difficulty: metadata?.difficulty ?? restoredValues.difficulty,
  };

  return <Modal ariaLabelledBy="record-practice-title" initialFocusRef={urlInput} onClose={onClose}>
    <h2 id="record-practice-title">记录练习</h2>
    <button type="button" aria-label="关闭" onClick={onClose}>×</button>
    <label>LeetCode 题目链接<input ref={urlInput} value={url} onChange={event => { invalidateLookup(); setLookingUp(false); setUrl(event.target.value); setMetadata(undefined); }} /></label>
    <button type="button" disabled={lookingUp} onClick={() => void lookup()}>{lookingUp ? '读取中…' : '读取题目信息'}</button>
    <button type="button" onClick={() => { invalidateLookup(); setLookingUp(false); try { const parsed = parseLeetCodeCnUrl(url); setUrl(parsed.url); setMetadata(undefined); setLookupError(''); setManual(true); } catch (error) { setLookupError(error instanceof Error ? error.message : '链接无效'); } }}>手动填写</button>
    {lookupError && <p role="alert">{lookupError}</p>}
    {loadError && <p role="alert">{loadError}</p>}
    {!loading && !loadError && manual && <PracticeForm algorithms={algorithms} values={formValues} saving={saving} saveError={saveError} onSubmit={save} onAddAlgorithm={onAddAlgorithm} />}
  </Modal>;
}
