import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from '../../app/RepositoryContext';
import type { DashboardRepository } from '../../db/DashboardRepository';
import type { Practice } from '../../domain/models';
import { EditPracticeSolutionDialog } from './EditPracticeSolutionDialog';

const practice: Practice = {
  id: 'practice-1', problemId: 'problem-1', practicedOn: '2026-07-12', primaryAlgorithmId: 'dp', secondaryAlgorithmIds: [], solutionMarkdown: '初始思路', createdAt: '', updatedAt: '',
};

function repository(): DashboardRepository {
  return {
    createAlgorithm: vi.fn(), renameAlgorithm: vi.fn(), replaceAndDeleteAlgorithm: vi.fn(), deleteUnusedAlgorithm: vi.fn(), deleteAlgorithmAndPractices: vi.fn(),
    recordPractice: vi.fn(), updatePracticeSolution: vi.fn().mockResolvedValue(practice),
    listAlgorithms: vi.fn(), listProblems: vi.fn(), listPractices: vi.fn(),
    deletePractice: vi.fn(), deleteProblem: vi.fn(), clearAll: vi.fn(),
    getDataCounts: vi.fn(), exportBackup: vi.fn(), importBackup: vi.fn(),
  } as DashboardRepository;
}

function renderDialog(repo: DashboardRepository) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const result = render(<>
    <button type="button" autoFocus>背景操作</button>
    <RepositoryProvider repository={repo}>
      <DialogHarness onClose={onClose} onSaved={onSaved} />
    </RepositoryProvider>
  </>);
  return { ...result, onClose, onSaved };
}

function DialogHarness({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [open, setOpen] = useState(true);
  return <EditPracticeSolutionDialog practice={practice} open={open} onClose={() => { onClose(); setOpen(false); }} onSaved={onSaved} />;
}

describe('EditPracticeSolutionDialog', () => {
  it('saves the selected practice solution, closes, and notifies its owner', async () => {
    const repo = repository();
    const { onClose, onSaved } = renderDialog(repo);
    const editor = screen.getByLabelText('解题思路');
    await userEvent.clear(editor);
    await userEvent.type(editor, '更新后的思路');
    await userEvent.click(screen.getByRole('button', { name: '保存思路' }));

    await waitFor(() => expect(repo.updatePracticeSolution).toHaveBeenCalledWith('practice-1', '更新后的思路'));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '编辑解题思路' })).not.toBeInTheDocument();
  });

  it('closes without writing when cancelled', async () => {
    const repo = repository();
    renderDialog(repo);
    await userEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(repo.updatePracticeSolution).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: '编辑解题思路' })).not.toBeInTheDocument();
  });

  it('keeps a missing-practice error and its edited text inside the modal', async () => {
    const repo = repository();
    vi.mocked(repo.updatePracticeSolution).mockRejectedValue(new Error('练习已不存在'));
    renderDialog(repo);
    const editor = screen.getByLabelText('解题思路');
    await userEvent.clear(editor);
    await userEvent.type(editor, '保留的修改');
    await userEvent.click(screen.getByRole('button', { name: '保存思路' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('练习已不存在');
    expect(screen.getByLabelText('解题思路')).toHaveValue('保留的修改');
    expect(screen.getByRole('dialog', { name: '编辑解题思路' })).toBeInTheDocument();
  });

  it('maps an unknown save failure to a retry message and preserves text', async () => {
    const repo = repository();
    vi.mocked(repo.updatePracticeSolution).mockRejectedValue(new Error('database unavailable'));
    renderDialog(repo);
    const editor = screen.getByLabelText('解题思路');
    await userEvent.clear(editor);
    await userEvent.type(editor, '保留的修改');
    await userEvent.click(screen.getByRole('button', { name: '保存思路' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败，请重试');
    expect(screen.getByLabelText('解题思路')).toHaveValue('保留的修改');
  });

  it('prevents a second submission while the solution is saving', async () => {
    const repo = repository();
    let resolveSave!: (value: Practice) => void;
    vi.mocked(repo.updatePracticeSolution).mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    renderDialog(repo);
    const save = screen.getByRole('button', { name: '保存思路' });
    await userEvent.click(save);

    expect(screen.getByRole('button', { name: '保存中…' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '保存中…' }));
    expect(repo.updatePracticeSolution).toHaveBeenCalledTimes(1);
    resolveSave(practice);
  });

  it('focuses the close control and restores focus after Escape closes the modal', async () => {
    const repo = repository();
    const { onClose } = renderDialog(repo);
    const background = screen.getByRole('button', { name: '背景操作' });
    const close = screen.getByRole('button', { name: '关闭' });

    await waitFor(() => expect(close).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(background).toHaveFocus());
  });
});
