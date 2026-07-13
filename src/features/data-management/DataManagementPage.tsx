import { useRef, useState, type ChangeEvent } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import { parseBackup } from '../../domain/backup';
import { AlgorithmManager } from '../algorithms/AlgorithmManager';
import { Modal } from '../../shared/ui/Modal';

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const CONFIRMATION = '清空全部数据';
const messageFor = (cause: unknown, fallback: string) => cause instanceof Error ? cause.message : fallback;

function localDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DataManagementPage() {
  const repository = useRepository();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [clearStage, setClearStage] = useState<0 | 1 | 2>(0);
  const [counts, setCounts] = useState({ problems: 0, practices: 0, algorithms: 0 });
  const [clearError, setClearError] = useState('');
  const [clearPending, setClearPending] = useState(false);
  const clearTrigger = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);

  async function exportData() {
    setError('');
    try {
      const backup = await repository.exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lc-board-${localDateStamp(new Date())}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(messageFor(cause, '导出数据失败'));
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError('');
    setMessage('');
    try {
      if (!file) return;
      if (file.size > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 10 MB');
      let json: unknown;
      try { json = JSON.parse(await file.text()); } catch { throw new Error('备份文件无效'); }
      let backup;
      try { backup = parseBackup(json); } catch (cause) { throw new Error(messageFor(cause, '备份文件无效'), { cause }); }
      const summary = await repository.importBackup(backup);
      setMessage(`导入成功：新增 ${summary.addedProblems} 道题目、${summary.addedPractices} 条练习、${summary.addedAlgorithms} 个算法`);
    } catch (cause) {
      setError(messageFor(cause, '导入数据失败'));
    } finally {
      input.value = '';
    }
  }

  async function clearData() {
    if (confirmation !== CONFIRMATION) return;
    setError('');
    setClearError('');
    try {
      setClearPending(true);
      await repository.clearAll(counts);
      setConfirmation('');
      setClearStage(0);
      setMessage('全部本地数据已清空');
    } catch (cause) {
      setClearError(messageFor(cause, '清空数据失败'));
    } finally {
      setClearPending(false);
    }
  }

  async function beginClear() {
    setError('');
    setMessage('');
    try {
      setCounts(await repository.getDataCounts());
      setConfirmation('');
      setClearError('');
      setClearStage(1);
    } catch (cause) {
      setError(messageFor(cause, '读取数据数量失败'));
    }
  }

  return <>
    <AlgorithmManager />
    <section aria-labelledby="backup-heading">
      <h2 id="backup-heading">备份与恢复</h2>
      <button type="button" onClick={() => void exportData()}>导出数据</button>
      <label>选择备份文件<input type="file" accept="application/json,.json" onChange={event => void importData(event)} /></label>
      <p>备份文件最大 10 MB，导入只会合并数据，不会覆盖本地记录。</p>
    </section>
    <section aria-labelledby="reset-heading">
      <h2 id="reset-heading">危险操作</h2>
      <p>永久删除当前浏览器中的全部题目、练习和算法。</p>
      <button ref={clearTrigger} type="button" onClick={() => void beginClear()}>开始清空全部数据</button>
    </section>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {clearStage !== 0 && <Modal ariaLabelledBy="clear-all-heading" initialFocusRef={continueButton} returnFocusRef={clearTrigger} onClose={() => setClearStage(0)}>
      <h2 id="clear-all-heading">确认清空全部数据</h2>
      <p>{counts.problems} 道题目、{counts.practices} 条练习、{counts.algorithms} 个算法</p>
      {clearStage === 1 ? <>
        <p>这些数据将被永久删除，操作无法撤销。</p>
        <button ref={continueButton} type="button" onClick={() => setClearStage(2)}>继续</button>
      </> : <>
        <p>请输入“{CONFIRMATION}”完成最终确认。</p>
        <label>确认文字<input disabled={clearPending} autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <button type="button" disabled={clearPending || confirmation !== CONFIRMATION} onClick={() => void clearData()}>{CONFIRMATION}</button>
      </>}
      {clearError && <p role="alert">{clearError}</p>}
      <button type="button" disabled={clearPending} onClick={() => setClearStage(0)}>取消</button>
    </Modal>}
  </>;
}
