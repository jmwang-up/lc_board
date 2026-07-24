import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryProvider } from '../../app/RepositoryContext';
import type { DashboardRepository } from '../../db/DashboardRepository';
import { RecordPracticeDialog } from './RecordPracticeDialog';
import { practiceFormSchema, type PracticeFormValues } from './PracticeForm';

const fullDraft: PracticeFormValues = {
  url: 'https://leetcode.cn/problems/two-sum/',
  frontendQuestionId: '1',
  titleZh: '两数之和',
  difficulty: 'medium',
  practicedOn: '2026-07-23',
  primaryAlgorithmId: 'alg-1',
  secondaryAlgorithmIds: ['alg-2'],
  solutionMarkdown: '## 保留\n双指针',
};

function repository(algorithm = true): DashboardRepository {
  return {
    createAlgorithm: vi.fn(), renameAlgorithm: vi.fn(), replaceAndDeleteAlgorithm: vi.fn(), deleteUnusedAlgorithm: vi.fn(), deleteAlgorithmAndPractices: vi.fn(),
    recordPractice: vi.fn().mockResolvedValue({ problem: {}, practice: {} }),
    updatePracticeSolution: vi.fn(),
    listAlgorithms: vi.fn().mockResolvedValue(algorithm ? [{ id: 'alg-1', name: '哈希表', color: '#fff', createdAt: '' }] : []),
    listProblems: vi.fn().mockResolvedValue([]), listPractices: vi.fn().mockResolvedValue([]),
    deletePractice: vi.fn(), deleteProblem: vi.fn(), clearAll: vi.fn(),
    getDataCounts: vi.fn().mockResolvedValue({ problems: 0, practices: 0, algorithms: 0 }),
    exportBackup: vi.fn(), importBackup: vi.fn(),
  } as DashboardRepository;
}

function renderDialog(repo: DashboardRepository) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const result = render(<><button type="button">背景操作</button><RepositoryProvider repository={repo}><MemoryRouter><RecordPracticeDialog open onAddAlgorithm={vi.fn()} onClose={onClose} onSaved={onSaved} /></MemoryRouter></RepositoryProvider></>);
  return { ...result, onClose, onSaved };
}

function LifecycleDialog({ repo, onSaved }: { repo: DashboardRepository; onSaved: () => void }) {
  const [open, setOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setOpen(true)}>打开记录</button>
    <RepositoryProvider repository={repo}>
      <MemoryRouter>
        <RecordPracticeDialog open={open} onAddAlgorithm={vi.fn()} onClose={() => setOpen(false)} onSaved={onSaved} />
      </MemoryRouter>
    </RepositoryProvider>
  </>;
}

async function fillManualPractice() {
  await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
  await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
  await userEvent.type(screen.getByLabelText('题号'), '1');
  await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
  await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
}

afterEach(() => vi.unstubAllGlobals());

describe('RecordPracticeDialog', () => {
  it('emits the current complete draft for each contextual add action', async () => {
    const repo = repository();
    vi.mocked(repo.listAlgorithms).mockResolvedValue([
      { id: 'alg-1', name: '哈希表', color: '#fff', createdAt: '' },
      { id: 'alg-2', name: '双指针', color: '#000', createdAt: '' },
    ]);
    const onAddAlgorithm = vi.fn();
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={fullDraft} onAddAlgorithm={onAddAlgorithm} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);
    expect(await screen.findByLabelText('中文题名')).toHaveValue('两数之和');

    await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
    expect(onAddAlgorithm).toHaveBeenLastCalledWith('primary', fullDraft);
    await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));
    expect(onAddAlgorithm).toHaveBeenLastCalledWith('secondary', fullDraft);
  });

  it('emits the edited URL when adding an algorithm from a restored draft', async () => {
    const repo = repository();
    vi.mocked(repo.listAlgorithms).mockResolvedValue([
      { id: 'alg-1', name: '哈希表', color: '#fff', createdAt: '' },
      { id: 'alg-2', name: '双指针', color: '#000', createdAt: '' },
    ]);
    const onAddAlgorithm = vi.fn();
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={fullDraft} onAddAlgorithm={onAddAlgorithm} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);

    const url = await screen.findByLabelText('LeetCode 题目链接');
    await userEvent.clear(url);
    await userEvent.type(url, 'https://leetcode.cn/problems/add-two-numbers/');
    await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));

    expect(onAddAlgorithm).toHaveBeenLastCalledWith('primary', {
      ...fullDraft,
      url: 'https://leetcode.cn/problems/add-two-numbers/',
    });
  });

  it('renders both add actions with no registered algorithms', async () => {
    const repo = repository(false);
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={{ ...fullDraft, primaryAlgorithmId: '', secondaryAlgorithmIds: [] }} onAddAlgorithm={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);
    expect(await screen.findByRole('button', { name: '添加主要算法' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '添加辅助算法' })).toBeEnabled();
    expect(screen.getByLabelText('主要算法')).toHaveValue('');
  });

  it('restores every draft field and removes algorithm ids deleted while away', async () => {
    const repo = repository();
    vi.mocked(repo.listAlgorithms).mockResolvedValue([
      { id: 'alg-2', name: '双指针', color: '#000', createdAt: '' },
    ]);
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={fullDraft} onAddAlgorithm={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);

    expect(await screen.findByLabelText('LeetCode 题目链接')).toHaveValue(fullDraft.url);
    expect(screen.getByLabelText('题号')).toHaveValue('1');
    expect(screen.getByLabelText('中文题名')).toHaveValue('两数之和');
    expect(screen.getByLabelText('难度')).toHaveValue('medium');
    expect(screen.getByLabelText('练习日期')).toHaveValue('2026-07-23');
    expect(screen.getByLabelText('主要算法')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: '双指针' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 保留\n双指针');
  });

  it('restores an unvalidated draft with an invalid URL', async () => {
    const repo = repository();
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={{ ...fullDraft, url: '' }} onAddAlgorithm={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);

    expect(await screen.findByLabelText('LeetCode 题目链接')).toHaveValue('');
    expect(screen.getByLabelText('中文题名')).toHaveValue('两数之和');
    expect(screen.getByRole('button', { name: '添加主要算法' })).toBeEnabled();
  });

  it('restores an unvalidated draft with a partial URL', async () => {
    const repo = repository();
    render(<RepositoryProvider repository={repo}><MemoryRouter>
      <RecordPracticeDialog open initialDraft={{ ...fullDraft, url: 'https://leetcode.cn/problems/' }} onAddAlgorithm={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />
    </MemoryRouter></RepositoryProvider>);

    expect(await screen.findByLabelText('LeetCode 题目链接')).toHaveValue('https://leetcode.cn/problems/');
    expect(screen.getByLabelText('中文题名')).toHaveValue('两数之和');
    expect(screen.getByRole('button', { name: '添加主要算法' })).toBeEnabled();
  });

  it('reopens with idle lookup state and ignores the closed session result', async () => {
    let resolveLookup!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(resolve => { resolveLookup = resolve; })));
    render(<LifecycleDialog repo={repository()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));

    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    await userEvent.click(screen.getByRole('button', { name: '打开记录' }));

    expect(screen.getByRole('button', { name: '读取题目信息' })).toBeEnabled();
    expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');
    resolveLookup(new Response(JSON.stringify({
      slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy',
      url: 'https://leetcode.cn/problems/two-sum/',
    }), { status: 200 }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByDisplayValue('两数之和')).not.toBeInTheDocument();
  });

  it('does not let a stale save completion close a reopened session', async () => {
    const repo = repository();
    let resolveSave!: (value: Awaited<ReturnType<DashboardRepository['recordPractice']>>) => void;
    vi.mocked(repo.recordPractice).mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    const onSaved = vi.fn();
    render(<LifecycleDialog repo={repo} onSaved={onSaved} />);
    await fillManualPractice();
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole('button', { name: '关闭' }));
    await userEvent.click(screen.getByRole('button', { name: '打开记录' }));
    expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');

    await act(async () => {
      resolveSave({ problem: {} as never, practice: {} as never });
      await Promise.resolve();
    });
    expect(screen.getByRole('dialog', { name: '记录练习' })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('uses a synchronous mutex to coalesce rapid valid submissions', async () => {
    const repo = repository();
    let resolveSave!: (value: Awaited<ReturnType<DashboardRepository['recordPractice']>>) => void;
    vi.mocked(repo.recordPractice).mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));
    const { onSaved } = renderDialog(repo);
    await fillManualPractice();
    const form = screen.getByRole('button', { name: '保存练习' }).closest('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveSave({ problem: {} as never, practice: {} as never });
      await Promise.resolve();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('ignores metadata from a lookup invalidated by a URL edit', async () => {
    let resolveLookup!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(resolve => { resolveLookup = resolve; })));
    renderDialog(repository());
    const link = screen.getByLabelText('LeetCode 题目链接');
    await userEvent.type(link, 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    await userEvent.clear(link);
    await userEvent.type(link, 'https://leetcode.cn/problems/three-sum/');
    resolveLookup(new Response(JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: '读取题目信息' })).toBeEnabled());
    expect(screen.queryByDisplayValue('两数之和')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    expect(screen.getByLabelText('题号')).toHaveValue('');
    expect(screen.getByLabelText('中文题名')).toHaveValue('');
  });

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

  it('records Markdown entered in the solution editor after previewing it', async () => {
    const repo = repository();
    renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.type(screen.getByLabelText('解题思路'), '## 思路\n- 使用哈希表');
    await userEvent.click(screen.getByRole('tab', { name: '预览' }));
    expect(screen.getByRole('heading', { name: '思路' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));

    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledWith(expect.objectContaining({
      solutionMarkdown: '## 思路\n- 使用哈希表',
    })));
  });

  it('records an empty solution as an empty string', async () => {
    const repo = repository();
    renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));

    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledWith(expect.objectContaining({
      solutionMarkdown: '',
    })));
  });

  it('blocks a solution longer than 20,000 characters with an accessible error', async () => {
    const repo = repository();
    renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByLabelText('解题思路'));
    await userEvent.paste('a'.repeat(20_001));

    expect(screen.getByText('20001 / 20000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存练习' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('解题思路不能超过 20000 个字符');
    expect(repo.recordPractice).not.toHaveBeenCalled();
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

  it('preserves the Markdown solution when recording fails', async () => {
    const repo = repository();
    vi.mocked(repo.recordPractice).mockRejectedValue(new Error('db failed'));
    renderDialog(repo);
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.type(screen.getByLabelText('解题思路'), '失败后仍需保留的思路');
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));

    expect(await screen.findByText('保存失败，请重试')).toBeInTheDocument();
    expect(screen.getByLabelText('解题思路')).toHaveValue('失败后仍需保留的思路');
  });

  it('shows contextual add actions after manually opening a form with no algorithms', async () => {
    renderDialog(repository(false));
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    expect(await screen.findByRole('button', { name: '添加主要算法' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '添加辅助算法' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: '前往数据管理创建算法分类' })).not.toBeInTheDocument();
  });

  it('replaces form metadata when a second URL is looked up', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ slug: 'three-sum', frontendQuestionId: '15', titleZh: '三数之和', difficulty: 'medium', url: 'https://leetcode.cn/problems/three-sum/' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const repo = repository();
    renderDialog(repo);
    const link = screen.getByLabelText('LeetCode 题目链接');
    await userEvent.type(link, 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByDisplayValue('两数之和')).toBeInTheDocument();
    await userEvent.clear(link);
    await userEvent.type(link, 'https://leetcode.cn/problems/three-sum/description/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByDisplayValue('三数之和')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
    await waitFor(() => expect(repo.recordPractice).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ slug: 'three-sum', frontendQuestionId: '15', titleZh: '三数之和' }) })));
  });

  it('clears successful metadata when the next lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'UPSTREAM_TIMEOUT' }), { status: 502 })));
    renderDialog(repository());
    const link = screen.getByLabelText('LeetCode 题目链接');
    await userEvent.type(link, 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByDisplayValue('两数之和')).toBeInTheDocument();
    await userEvent.clear(link);
    await userEvent.type(link, 'https://leetcode.cn/problems/three-sum/');
    await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
    expect(await screen.findByText('自动读取失败，可以手动填写')).toBeInTheDocument();
    expect(screen.getByLabelText('题号')).toHaveValue('');
    expect(screen.getByLabelText('中文题名')).toHaveValue('');
    expect(screen.getByLabelText('中文题名')).toBeEnabled();
  });

  it('rejects repeated secondary algorithms in the schema', () => {
    const result = practiceFormSchema.safeParse({ url: 'https://leetcode.cn/problems/two-sum/', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', practicedOn: '2026-07-12', primaryAlgorithmId: 'alg-1', secondaryAlgorithmIds: ['alg-2', 'alg-2'], solutionMarkdown: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ['secondaryAlgorithmIds'], message: '辅助算法不能重复' })]));
  });

  it('shows validation when the primary algorithm is also secondary', async () => {
    renderDialog(repository());
    await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
    await userEvent.type(screen.getByLabelText('题号'), '1');
    await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
    await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
    await userEvent.click(screen.getByRole('checkbox', { name: '哈希表' }));
    await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
    expect(await screen.findByText('辅助算法不能与主要算法重复')).toBeInTheDocument();
  });

  it('focuses and contains keyboard navigation inside the record dialog', async () => {
    const { container } = renderDialog(repository());
    const dialog = screen.getByRole('dialog', { name: '记录练习' });
    const link = within(dialog).getByLabelText('LeetCode 题目链接');
    const close = within(dialog).getByRole('button', { name: '关闭' });
    const manual = within(dialog).getByRole('button', { name: '手动填写' });

    await waitFor(() => expect(link).toHaveFocus());
    expect(container).toHaveAttribute('inert');
    manual.focus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(manual).toHaveFocus();
  });
});
