import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import type { Algorithm } from '../../domain/models';
import { Modal } from '../../shared/ui/Modal';
import type { AlgorithmTarget } from '../practices/practiceSession';
import { useAlgorithms } from './useAlgorithms';

const messageFor = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

interface AlgorithmManagerProps {
  reloadVersion?: number;
  creationTarget?: AlgorithmTarget;
  onAlgorithmCreated?: (algorithm: Algorithm) => void;
  onReturnToPractice?: () => void;
}

export function AlgorithmManager({
  reloadVersion = 0,
  creationTarget,
  onAlgorithmCreated,
  onReturnToPractice,
}: AlgorithmManagerProps = {}) {
  const repository = useRepository();
  const { algorithms, reload, loading, loadError } = useAlgorithms(reloadVersion);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [error, setError] = useState('');
  const [createPending, setCreatePending] = useState(false);
  const [renaming, setRenaming] = useState<Algorithm | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleting, setDeleting] = useState<Algorithm | null>(null);
  const [replacementId, setReplacementId] = useState('');
  const [affectedCount, setAffectedCount] = useState(0);
  const [deleteMode, setDeleteMode] = useState<'replace' | 'cascade' | 'unused'>('unused');
  const [confirmed, setConfirmed] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletePending, setDeletePending] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const replacementSelect = useRef<HTMLSelectElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const createOperation = useRef<object | undefined>(undefined);

  useEffect(() => {
    if (creationTarget) nameInput.current?.focus();
  }, [creationTarget]);

  function closeDelete() {
    setDeleting(null);
  }

  function create(event: FormEvent) {
    event.preventDefault();
    if (createOperation.current) return;
    const operation = {};
    createOperation.current = operation;
    void (async () => {
      setError('');
      setCreatePending(true);
      try {
        const algorithm = await repository.createAlgorithm({ name, color });
        setName('');
        await reload();
        onAlgorithmCreated?.(algorithm);
      } catch (cause) {
        setError(messageFor(cause, '创建算法失败'));
      } finally {
        setCreatePending(false);
        if (createOperation.current === operation) createOperation.current = undefined;
      }
    })();
  }

  function beginRename(algorithm: Algorithm) {
    setError('');
    setRenaming(algorithm);
    setRenameName(algorithm.name);
  }

  async function rename(event: FormEvent) {
    event.preventDefault();
    if (!renaming) return;
    setError('');
    try {
      await repository.renameAlgorithm(renaming.id, renameName);
      setRenaming(null);
      await reload();
    } catch (cause) {
      setError(messageFor(cause, '重命名算法失败'));
    }
  }

  async function beginDelete(algorithm: Algorithm) {
    deleteTrigger.current = document.activeElement as HTMLButtonElement;
    setError('');
    try {
      const practices = await repository.listPractices();
      setAffectedCount(practices.filter(practice => practice.primaryAlgorithmId === algorithm.id || practice.secondaryAlgorithmIds.includes(algorithm.id)).length);
      setDeleting(algorithm);
      setReplacementId('');
      setDeleteMode(practices.some(practice => practice.primaryAlgorithmId === algorithm.id || practice.secondaryAlgorithmIds.includes(algorithm.id)) ? 'replace' : 'unused');
      setConfirmed(false);
      setDeleteError('');
    } catch (cause) {
      setError(messageFor(cause, '读取练习数量失败'));
    }
  }

  async function replaceAndDelete() {
    if (!deleting || deleteMode !== 'replace' || !replacementId || replacementId === deleting.id || !confirmed) return;
    setError('');
    try {
      setDeletePending(true);
      await repository.replaceAndDeleteAlgorithm(deleting.id, replacementId, affectedCount);
      closeDelete();
      await reload();
    } catch (cause) {
      setDeleteError(messageFor(cause, '删除算法失败'));
    } finally {
      setDeletePending(false);
    }
  }

  async function deleteAlgorithm() {
    if (!deleting || !confirmed) return;
    setError('');
    try {
      setDeletePending(true);
      if (deleteMode === 'cascade') await repository.deleteAlgorithmAndPractices(deleting.id, affectedCount);
      else if (deleteMode === 'unused') await repository.deleteUnusedAlgorithm(deleting.id, affectedCount);
      else return;
      closeDelete();
      await reload();
    } catch (cause) {
      setDeleteError(messageFor(cause, '删除算法失败'));
    } finally {
      setDeletePending(false);
    }
  }

  return <main>
    <section aria-labelledby="algorithm-heading">
      <h1 id="algorithm-heading">数据管理</h1>
      <h2>算法分类</h2>
      {creationTarget && <section className="practice-return-banner" aria-label="练习算法创建流程">
        <p role="status">正在为本次练习添加{creationTarget === 'primary' ? '主要算法' : '辅助算法'}</p>
        <button type="button" onClick={onReturnToPractice}>返回记录练习</button>
      </section>}
      <form onSubmit={create}>
        <label>算法名称<input ref={nameInput} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>分类颜色<input aria-label="分类颜色" type="color" value={color} onChange={event => setColor(event.target.value)} /></label>
        <button disabled={loading || createPending || !name.trim()}>{createPending ? '创建中…' : '创建分类'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loadError && <p role="alert">{loadError}</p>}
      {!loading && !loadError && algorithms.length === 0 && <p>还没有算法分类，请先创建一个。</p>}
      <ul>{algorithms.map(algorithm => <li key={algorithm.id}>
        {renaming?.id === algorithm.id ? <form onSubmit={rename}>
          <label>重命名{algorithm.name}<input value={renameName} onChange={event => setRenameName(event.target.value)} /></label>
          <button disabled={!renameName.trim()} aria-label={`保存${renameName}`}>保存</button>
          <button type="button" onClick={() => setRenaming(null)}>取消</button>
        </form> : <>
          <span className="algorithm-name"><span className="algorithm-swatch" aria-hidden="true" style={{ backgroundColor: algorithm.color }} />{algorithm.name}</span>
          <button type="button" aria-label={`重命名${algorithm.name}`} onClick={() => beginRename(algorithm)}>重命名</button>
          <button type="button" aria-label={`删除${algorithm.name}`} onClick={() => void beginDelete(algorithm)}>删除</button>
        </>}
      </li>)}</ul>
    </section>
    {deleting && <Modal ariaLabelledBy="delete-heading" initialFocusRef={replacementSelect} onClose={closeDelete} returnFocusRef={deleteTrigger}>
      <h2 id="delete-heading">删除{deleting.name}</h2>
      {affectedCount === 0 ? <>
        <p>此算法没有关联练习</p>
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我确认删除{deleting.name}</label>
        <button type="button" disabled={!confirmed} onClick={() => void deleteAlgorithm()}>确认删除算法</button>
      </> : <>
        <p>此算法影响 {affectedCount} 条练习</p>
        <fieldset>
          <legend>选择删除方式</legend>
          <label><input disabled={deletePending} type="radio" name="delete-mode" checked={deleteMode === 'replace'} onChange={() => { setDeleteMode('replace'); setConfirmed(false); setDeleteError(''); }} />替换算法并保留 {affectedCount} 条练习</label>
          <label><input disabled={deletePending} type="radio" name="delete-mode" checked={deleteMode === 'cascade'} onChange={() => { setDeleteMode('cascade'); setConfirmed(false); setDeleteError(''); }} />删除算法及 {affectedCount} 条关联练习</label>
        </fieldset>
        {deleteMode === 'replace' ? <>
          <label>替代算法<select disabled={deletePending} ref={replacementSelect} value={replacementId} onChange={event => setReplacementId(event.target.value)}>
            <option value="">请选择</option>
            {algorithms.filter(item => item.id !== deleting.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label><input disabled={deletePending} type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我确认更新 {affectedCount} 条练习并删除{deleting.name}</label>
          <button type="button" disabled={deletePending || !replacementId || replacementId === deleting.id || !confirmed} onClick={() => void replaceAndDelete()}>替换并删除</button>
        </> : <>
          <label><input disabled={deletePending} type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />我确认永久删除 {affectedCount} 条练习和{deleting.name}</label>
          <button type="button" disabled={deletePending || !confirmed} onClick={() => void deleteAlgorithm()}>删除算法及 {affectedCount} 条练习</button>
        </>}
      </>}
      {deleteError && <p role="alert">{deleteError}</p>}
      <button type="button" disabled={deletePending} onClick={closeDelete}>取消</button>
    </Modal>}
  </main>;
}
