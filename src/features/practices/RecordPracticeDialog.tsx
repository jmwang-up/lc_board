import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../../app/RepositoryContext';
import { parseLeetCodeCnUrl } from '../../domain/leetcode';
import type { ProblemMetadata } from '../../domain/models';
import { useAlgorithms } from '../algorithms/useAlgorithms';
import { fetchProblemMetadata } from './metadataClient';
import { PracticeForm, type PracticeFormValues } from './PracticeForm';

export function RecordPracticeDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const repository = useRepository();
  const { algorithms, loading } = useAlgorithms();
  const [url, setUrl] = useState('');
  const [metadata, setMetadata] = useState<ProblemMetadata>();
  const [manual, setManual] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const lookupSequence = useRef(0);
  const lookupController = useRef<AbortController | undefined>(undefined);

  function invalidateLookup() {
    lookupSequence.current += 1;
    lookupController.current?.abort();
    lookupController.current = undefined;
  }

  useEffect(() => () => { lookupController.current?.abort(); lookupSequence.current += 1; }, []);
  useEffect(() => { if (!open) { invalidateLookup(); setUrl(''); setMetadata(undefined); setManual(false); setLookupError(''); setSaveError(''); } }, [open]);
  if (!open) return null;

  async function lookup() {
    invalidateLookup();
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
      if (requestId !== lookupSequence.current) return;
      setMetadata(result); setManual(true);
    } catch {
      if (requestId !== lookupSequence.current) return;
      setManual(true); setLookupError('自动读取失败，可以手动填写');
    } finally {
      if (requestId === lookupSequence.current) { setLookingUp(false); lookupController.current = undefined; }
    }
  }

  async function save(values: PracticeFormValues) {
    setSaveError(''); setSaving(true);
    try {
      const parsed = parseLeetCodeCnUrl(values.url);
      await repository.recordPractice({ metadata: { slug: parsed.slug, url: parsed.url, frontendQuestionId: values.frontendQuestionId, titleZh: values.titleZh, difficulty: values.difficulty }, practicedOn: values.practicedOn, primaryAlgorithmId: values.primaryAlgorithmId, secondaryAlgorithmIds: values.secondaryAlgorithmIds });
      onSaved(); onClose();
    } catch { setSaveError('保存失败，请重试'); }
    finally { setSaving(false); }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="record-practice-title">
    <h2 id="record-practice-title">记录练习</h2>
    <button type="button" aria-label="关闭" onClick={onClose}>×</button>
    <label>LeetCode 题目链接<input value={url} onChange={event => { invalidateLookup(); setLookingUp(false); setUrl(event.target.value); setMetadata(undefined); }} /></label>
    <button type="button" disabled={lookingUp} onClick={() => void lookup()}>{lookingUp ? '读取中…' : '读取题目信息'}</button>
    <button type="button" onClick={() => { invalidateLookup(); setLookingUp(false); try { const parsed = parseLeetCodeCnUrl(url); setUrl(parsed.url); setMetadata(undefined); setLookupError(''); setManual(true); } catch (error) { setLookupError(error instanceof Error ? error.message : '链接无效'); } }}>手动填写</button>
    {lookupError && <p role="alert">{lookupError}</p>}
    {!loading && algorithms.length === 0 && <p>还没有算法分类，<Link to="/data" onClick={onClose}>前往数据管理创建算法分类</Link></p>}
    {manual && algorithms.length > 0 && <PracticeForm algorithms={algorithms} values={{ url, frontendQuestionId: metadata?.frontendQuestionId ?? '', titleZh: metadata?.titleZh ?? '', difficulty: metadata?.difficulty ?? 'easy' }} saving={saving} saveError={saveError} onSubmit={save} />}
  </div>;
}
