import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from '../../app/RepositoryContext';
import type { DashboardRepository } from '../../db/DashboardRepository';
import { RecordPracticeDialog } from './RecordPracticeDialog';

function repository(algorithm = true): DashboardRepository {
  return {
    createAlgorithm: vi.fn(), renameAlgorithm: vi.fn(), replaceAndDeleteAlgorithm: vi.fn(),
    recordPractice: vi.fn().mockResolvedValue({ problem: {}, practice: {} }),
    listAlgorithms: vi.fn().mockResolvedValue(algorithm ? [{ id: 'alg-1', name: '哈希表', color: '#fff', createdAt: '' }] : []),
    listProblems: vi.fn().mockResolvedValue([]), listPractices: vi.fn().mockResolvedValue([]),
    deletePractice: vi.fn(), deleteProblem: vi.fn(), clearAll: vi.fn(),
  } as DashboardRepository;
}

function renderDialog(repo: DashboardRepository) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<RepositoryProvider repository={repo}><MemoryRouter><RecordPracticeDialog open onClose={onClose} onSaved={onSaved} /></MemoryRouter></RepositoryProvider>);
  return { onClose, onSaved };
}

afterEach(() => vi.unstubAllGlobals());

describe('RecordPracticeDialog', () => {
  it('looks up a link and records a practice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const repo = repository();
    const { onClose, onSaved } = renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/description/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByDisplayValue('两数之和')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ slug: 'two-sum', url: 'https://leetcode.cn/problems/two-sum/' }), practicedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), primaryAlgorithmId: 'alg-1' })));
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the link and opens manual fields after an upstream failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'UPSTREAM_TIMEOUT' }), { status: 502 })));
    renderDialog(repository());
    const link = screen.getByLabelText('LeetCode 题目链接');
    await userEvent.type(link, 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByText('自动读取失败，可以手动填写')).toBeInTheDocument();
    expect(link).toHaveValue('https://leetcode.cn/problems/two-sum/');
    expect(screen.getByLabelText('中文题名')).toBeEnabled();
  });

  it('rejects non-leetcode.cn links without requesting metadata', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    renderDialog(repository());
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.com/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByText('请输入 leetcode.cn 题目链接')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves fields and stays open when saving fails', async () => {
    const repo = repository();
    vi.mocked(repo.recordPractice).mockRejectedValue(new Error('db failed'));
    renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
    expect(await screen.findByText('保存失败，请重试')).toBeInTheDocument();
    expect(screen.getByLabelText('中文题名')).toHaveValue('两数之和');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('links to data management when no algorithms exist', async () => {
    renderDialog(repository(false));
    expect(await screen.findByRole('link', { name: '前往数据管理创建算法分类' })).toHaveAttribute('href', '/data');
    expect(screen.queryByLabelText('主要算法')).not.toBeInTheDocument();
  });
});
