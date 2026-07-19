import { useEffect, useRef, useState } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import { SOLUTION_MARKDOWN_MAX_LENGTH, type Practice } from '../../domain/models';
import { MarkdownEditor } from '../../shared/markdown/MarkdownEditor';
import { Modal } from '../../shared/ui/Modal';

export function EditPracticeSolutionDialog({ practice, open, onClose, onSaved }: {
  practice?: Practice;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repository = useRepository();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && practice) {
      setValue(practice.solutionMarkdown);
      setError('');
      setSaving(false);
    }
  }, [open, practice]);

  if (!open || !practice) return null;
  const selectedPractice = practice;
  const solutionTooLong = value.length > SOLUTION_MARKDOWN_MAX_LENGTH;

  async function save() {
    if (saving) return;
    if (value.length > SOLUTION_MARKDOWN_MAX_LENGTH) {
      setError('解题思路不能超过 20000 个字符');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await repository.updatePracticeSolution(selectedPractice.id, value);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error && cause.message === '练习已不存在'
        ? cause.message
        : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return <Modal
    ariaLabelledBy="edit-practice-solution-title"
    initialFocusRef={closeButton}
    onClose={() => { if (!saving) onClose(); }}
  >
    <h2 id="edit-practice-solution-title">编辑解题思路</h2>
    <button ref={closeButton} type="button" disabled={saving} onClick={onClose}>关闭</button>
    <MarkdownEditor value={value} onChange={setValue} disabled={saving} error={solutionTooLong ? '解题思路不能超过 20000 个字符' : error} />
    <button type="button" disabled={saving || solutionTooLong} onClick={() => void save()}>
      {saving ? '保存中…' : '保存思路'}
    </button>
  </Modal>;
}
