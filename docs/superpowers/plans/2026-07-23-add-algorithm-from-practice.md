# Add Algorithm From Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users leave an in-progress practice form to create a missing primary or secondary algorithm, then automatically return with the complete draft restored and the new algorithm selected in the correct context.

**Architecture:** Keep the cross-route practice draft in `App` memory only. The practice form emits an unvalidated snapshot and target type, the data-management route reports either a created `Algorithm` or a manual return, and pure session helpers apply/sanitize algorithm IDs before the record dialog restores the form.

**Tech Stack:** React, TypeScript, React Router, React Hook Form, Zod, Vitest, Testing Library, Playwright

## Global Constraints

- Provide separate “＋ 添加新算法” actions for primary and secondary algorithm selection.
- Navigate to the full `/data?createAlgorithm=1` page, focus the algorithm-name input, and preserve all existing data-management capabilities.
- A successful create automatically returns to the exact originating path/query/hash and reopens the practice dialog.
- A manual “返回记录练习” returns without changing algorithm selections.
- Restore URL, metadata, difficulty, date, primary/secondary algorithms, and Markdown exactly, except references to algorithms deleted while away.
- A created primary algorithm replaces the draft primary ID; a created secondary algorithm is appended once and never duplicates the primary ID.
- Draft data lives only in React memory; do not write it to IndexedDB, Web Storage, or URL parameters.
- Refreshing or closing the page may discard the draft.
- Normal `/data` navigation must not show creation-flow UI or trigger an automatic return.
- Empty algorithm lists must still render the practice form and both creation actions.
- Failed or duplicate algorithm creation stays on the data page and preserves the return flow.
- Preserve the user-owned untracked `1.md` and `CLAUDE.md`.

---

## Planned File Structure

```text
src/features/practices/practiceSession.ts           pure session types and algorithm application/sanitization
src/features/practices/practiceSession.test.ts      draft invariants
src/features/practices/PracticeForm.tsx             snapshot buttons beside primary/secondary controls
src/features/practices/RecordPracticeDialog.tsx     initial-draft restoration and add request forwarding
src/features/practices/RecordPracticeDialog.test.tsx form snapshot, empty-list, and restoration coverage
src/app/styles.css                                  contextual algorithm-action layout
src/features/algorithms/AlgorithmManager.tsx        focused creation mode and created-algorithm callback
src/features/algorithms/AlgorithmManager.test.tsx   focused create/return/failure/dedup coverage
src/features/data-management/DataManagementPage.tsx creation-mode pass-through
src/features/data-management/DataManagementPage.test.tsx mode isolation coverage
src/app/App.tsx                                     cross-route session owner and navigation orchestration
src/app/App.test.tsx                                primary/secondary/manual-return integration
tests/e2e/dashboard.spec.ts                         real draft → create → return → save acceptance
```

No component writes the draft to persistent storage, and no feature component bypasses `DashboardRepository`.

---

### Task 1: Practice Session Rules

**Files:**
- Create: `src/features/practices/practiceSession.ts`
- Create: `src/features/practices/practiceSession.test.ts`

**Interfaces:**
- Consumes: `Algorithm` and `PracticeFormValues`.
- Produces: `AlgorithmTarget`, `PracticeDraft`, `AddAlgorithmRequest`, `applyCreatedAlgorithm`, and `sanitizeDraftAlgorithms`.

- [ ] **Step 1: Write failing pure-session tests**

Create `src/features/practices/practiceSession.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Algorithm } from '../../domain/models';
import type { PracticeFormValues } from './PracticeForm';
import { applyCreatedAlgorithm, sanitizeDraftAlgorithms } from './practiceSession';

const draft: PracticeFormValues = {
  url: 'https://leetcode.cn/problems/two-sum/',
  frontendQuestionId: '1',
  titleZh: '两数之和',
  difficulty: 'easy',
  practicedOn: '2026-07-23',
  primaryAlgorithmId: 'hash',
  secondaryAlgorithmIds: ['binary'],
  solutionMarkdown: '## 思路\n保留草稿',
};

const algorithms: Algorithm[] = [
  { id: 'hash', name: '哈希表', color: '#2563eb', createdAt: '' },
  { id: 'binary', name: '二分查找', color: '#16a34a', createdAt: '' },
];

describe('practice session draft rules', () => {
  it('replaces only the primary algorithm for a primary create', () => {
    expect(applyCreatedAlgorithm(draft, 'primary', 'graph')).toEqual({
      ...draft,
      primaryAlgorithmId: 'graph',
      secondaryAlgorithmIds: ['binary'],
    });
  });

  it('appends a secondary algorithm once without duplicating the primary', () => {
    expect(applyCreatedAlgorithm(draft, 'secondary', 'graph').secondaryAlgorithmIds)
      .toEqual(['binary', 'graph']);
    expect(applyCreatedAlgorithm(draft, 'secondary', 'binary').secondaryAlgorithmIds)
      .toEqual(['binary']);
    expect(applyCreatedAlgorithm(draft, 'secondary', 'hash').secondaryAlgorithmIds)
      .toEqual(['binary']);
  });

  it('removes references deleted while the user was on data management', () => {
    expect(sanitizeDraftAlgorithms(draft, algorithms)).toEqual(draft);
    expect(sanitizeDraftAlgorithms(draft, algorithms.slice(1))).toEqual({
      ...draft,
      primaryAlgorithmId: '',
      secondaryAlgorithmIds: ['binary'],
    });
    expect(sanitizeDraftAlgorithms(draft, [])).toEqual({
      ...draft,
      primaryAlgorithmId: '',
      secondaryAlgorithmIds: [],
    });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npm test -- src/features/practices/practiceSession.test.ts
```

Expected: FAIL because `./practiceSession` does not exist.

- [ ] **Step 3: Implement the pure session model**

Create `src/features/practices/practiceSession.ts`:

```ts
import type { Algorithm } from '../../domain/models';
import type { PracticeFormValues } from './PracticeForm';

export type AlgorithmTarget = 'primary' | 'secondary';

export interface PracticeDraft {
  values: PracticeFormValues;
}

export interface AddAlgorithmRequest {
  target: AlgorithmTarget;
  draft: PracticeDraft;
  returnLocation: string;
}

export function applyCreatedAlgorithm(
  values: PracticeFormValues,
  target: AlgorithmTarget,
  algorithmId: string,
): PracticeFormValues {
  if (target === 'primary') return { ...values, primaryAlgorithmId: algorithmId };
  if (algorithmId === values.primaryAlgorithmId || values.secondaryAlgorithmIds.includes(algorithmId)) return values;
  return { ...values, secondaryAlgorithmIds: [...values.secondaryAlgorithmIds, algorithmId] };
}

export function sanitizeDraftAlgorithms(
  values: PracticeFormValues,
  algorithms: Algorithm[],
): PracticeFormValues {
  const ids = new Set(algorithms.map(algorithm => algorithm.id));
  return {
    ...values,
    primaryAlgorithmId: ids.has(values.primaryAlgorithmId) ? values.primaryAlgorithmId : '',
    secondaryAlgorithmIds: values.secondaryAlgorithmIds
      .filter(id => ids.has(id) && id !== values.primaryAlgorithmId),
  };
}
```

- [ ] **Step 4: Verify GREEN and type safety**

Run:

```bash
npm test -- src/features/practices/practiceSession.test.ts
npm run build
```

Expected: 3 tests pass; SPA and API TypeScript builds exit 0.

- [ ] **Step 5: Commit session rules**

```bash
git add src/features/practices/practiceSession.ts src/features/practices/practiceSession.test.ts
git commit -m "feat: define practice algorithm session rules"
```

---

### Task 2: Draft-Aware Practice Form and Dialog

**Files:**
- Modify: `src/features/practices/PracticeForm.tsx`
- Modify: `src/features/practices/RecordPracticeDialog.tsx`
- Modify: `src/features/practices/RecordPracticeDialog.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `AlgorithmTarget`, `sanitizeDraftAlgorithms`, and the existing `useAlgorithms`.
- Produces: `PracticeForm.onAddAlgorithm(target, values)` and `RecordPracticeDialog.initialDraft/onAddAlgorithm`.

- [ ] **Step 1: Write failing snapshot and restoration tests**

Add to `src/features/practices/RecordPracticeDialog.test.tsx`:

```tsx
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

it('renders both add actions with no registered algorithms', async () => {
  const repo = repository(false);
  render(<RepositoryProvider repository={repo}><MemoryRouter>
    <RecordPracticeDialog open initialDraft={{ ...fullDraft, primaryAlgorithmId: '', secondaryAlgorithmIds: [] }}
      onAddAlgorithm={vi.fn()} onClose={vi.fn()} onSaved={vi.fn()} />
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
```

Update the test helper to pass `onAddAlgorithm={vi.fn()}` to every `RecordPracticeDialog`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/features/practices/RecordPracticeDialog.test.tsx
```

Expected: FAIL because the new props/buttons do not exist and an empty algorithm list still suppresses `PracticeForm`.

- [ ] **Step 3: Make `PracticeForm` produce an unvalidated snapshot**

Change the props and form destructuring in `PracticeForm.tsx`:

```tsx
import type { AlgorithmTarget } from './practiceSession';

interface PracticeFormProps {
  algorithms: Algorithm[];
  values: Partial<PracticeFormValues>;
  saving: boolean;
  saveError?: string;
  onSubmit: (values: PracticeFormValues) => Promise<void>;
  onAddAlgorithm: (target: AlgorithmTarget, values: PracticeFormValues) => void;
}

export function PracticeForm({
  algorithms, values, saving, saveError, onSubmit, onAddAlgorithm,
}: PracticeFormProps) {
  const {
    register, handleSubmit, reset, control, watch, getValues,
    formState: { errors },
  } = useForm<PracticeFormValues>({
    resolver: zodResolver(practiceFormSchema),
    defaultValues: {
      difficulty: 'easy',
      practicedOn: localToday(),
      secondaryAlgorithmIds: [],
      solutionMarkdown: '',
      primaryAlgorithmId: '',
      ...values,
    },
  });
```

Replace the algorithm controls with:

```tsx
<div className="algorithm-field-heading">
  <label>主要算法
    <select {...register('primaryAlgorithmId')}>
      <option value="">请选择</option>
      {algorithms.map(algorithm => <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>)}
    </select>
  </label>
  <button type="button" aria-label="添加主要算法" disabled={saving}
    onClick={() => onAddAlgorithm('primary', getValues())}>
    ＋ 添加新算法
  </button>
</div>
<fieldset>
  <legend className="algorithm-legend">
    辅助算法
    <button type="button" aria-label="添加辅助算法" disabled={saving}
      onClick={() => onAddAlgorithm('secondary', getValues())}>
      ＋ 添加新算法
    </button>
  </legend>
  {algorithms.map(algorithm => <label key={algorithm.id}>
    <input type="checkbox" value={algorithm.id} {...register('secondaryAlgorithmIds')} />
    {algorithm.name}
  </label>)}
</fieldset>
```

The buttons intentionally call `getValues()` directly instead of `handleSubmit`, because incomplete题号/题名 is a valid draft even though it is not a valid saved Practice.

- [ ] **Step 4: Restore drafts in `RecordPracticeDialog`**

Replace the props declaration with:

```tsx
// Remove Link from the react-router-dom import; the old empty-list link is deleted.
import type { PracticeFormValues } from './PracticeForm';
import {
  sanitizeDraftAlgorithms,
  type AlgorithmTarget,
} from './practiceSession';

interface RecordPracticeDialogProps {
  open: boolean;
  initialDraft?: PracticeFormValues;
  onClose: () => void;
  onSaved: () => void;
  onAddAlgorithm: (target: AlgorithmTarget, values: PracticeFormValues) => void;
}
```

On each newly opened restored session, initialize dialog state:

```tsx
useEffect(() => {
  if (!open || !initialDraft) return;
  setUrl(initialDraft.url);
  setMetadata({
    ...parseLeetCodeCnUrl(initialDraft.url),
    frontendQuestionId: initialDraft.frontendQuestionId,
    titleZh: initialDraft.titleZh,
    difficulty: initialDraft.difficulty,
  });
  setManual(true);
}, [open, initialDraft]);
```

After algorithms finish loading, derive form values:

```tsx
const restoredValues = initialDraft
  ? sanitizeDraftAlgorithms(initialDraft, algorithms)
  : {
      url,
      frontendQuestionId: metadata?.frontendQuestionId ?? '',
      titleZh: metadata?.titleZh ?? '',
      difficulty: metadata?.difficulty ?? 'easy',
    };
```

Replace the zero-algorithm link and conditional form with:

```tsx
{!loading && !loadError && manual && <PracticeForm
  algorithms={algorithms}
  values={restoredValues}
  saving={saving}
  saveError={saveError}
  onSubmit={save}
  onAddAlgorithm={onAddAlgorithm}
/>}
```

Do not retain the old “前往数据管理创建算法分类” link; both contextual buttons now cover empty and non-empty lists consistently.

- [ ] **Step 5: Add the contextual-action layout**

Append only these scoped rules to `src/app/styles.css`:

```css
.algorithm-field-heading,
.algorithm-legend {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.algorithm-field-heading > label {
  flex: 1;
}

.algorithm-field-heading button,
.algorithm-legend button {
  white-space: nowrap;
}
```

- [ ] **Step 6: Run focused and full component tests**

Run:

```bash
npm test -- src/features/practices/RecordPracticeDialog.test.tsx
npm test
```

Expected: all record-dialog tests and all existing unit/component tests pass. The full suite may require sandbox permission because Supertest opens a local listener.

- [ ] **Step 7: Commit the draft-aware form**

```bash
git add src/features/practices/PracticeForm.tsx src/features/practices/RecordPracticeDialog.tsx src/features/practices/RecordPracticeDialog.test.tsx src/app/styles.css
git commit -m "feat: preserve practice drafts for algorithm creation"
```

---

### Task 3: Focused Algorithm Creation Mode

**Files:**
- Modify: `src/features/algorithms/AlgorithmManager.tsx`
- Modify: `src/features/algorithms/AlgorithmManager.test.tsx`
- Modify: `src/features/data-management/DataManagementPage.tsx`
- Modify: `src/features/data-management/DataManagementPage.test.tsx`

**Interfaces:**
- Consumes: `AlgorithmTarget` and `DashboardRepository.createAlgorithm(): Promise<Algorithm>`.
- Produces: `DataManagementPage.creationTarget`, `onAlgorithmCreated`, and `onReturnToPractice`.

- [ ] **Step 1: Write failing creation-mode tests**

Add `fireEvent` and `ComponentProps` imports, replace the existing `renderManagerWithRepository` helper with the prop-aware version below, then add the tests:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';

function renderManagerWithRepository(
  repository: DashboardRepository,
  props: ComponentProps<typeof AlgorithmManager> = {},
) {
  return render(<RepositoryProvider repository={repository}>
    <AlgorithmManager {...props} />
  </RepositoryProvider>);
}

it('focuses contextual creation and reports the exact created algorithm once', async () => {
  const created = { id: 'graph', name: '图论', color: '#2563eb', createdAt: '' };
  const createAlgorithm = vi.fn().mockResolvedValue(created);
  const onAlgorithmCreated = vi.fn();
  const repo = fakeRepository([]);
  repo.createAlgorithm = createAlgorithm;
  renderManagerWithRepository(repo, {
    creationTarget: 'secondary',
    onAlgorithmCreated,
    onReturnToPractice: vi.fn(),
  });

  expect(screen.getByRole('status')).toHaveTextContent('正在为本次练习添加辅助算法');
  expect(screen.getByLabelText('算法名称')).toHaveFocus();
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  const form = screen.getByRole('button', { name: '创建分类' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);

  await waitFor(() => expect(createAlgorithm).toHaveBeenCalledTimes(1));
  expect(onAlgorithmCreated).toHaveBeenCalledWith(created);
});

it('stays in creation mode on duplicate or repository failure', async () => {
  const onAlgorithmCreated = vi.fn();
  const repo = fakeRepository([]);
  repo.createAlgorithm = vi.fn().mockRejectedValue(new Error('算法名称已存在'));
  renderManagerWithRepository(repo, {
    creationTarget: 'primary',
    onAlgorithmCreated,
    onReturnToPractice: vi.fn(),
  });
  await userEvent.type(screen.getByLabelText('算法名称'), '哈希表');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('算法名称已存在');
  expect(onAlgorithmCreated).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '返回记录练习' })).toBeVisible();
});
```

Add to `DataManagementPage.test.tsx`:

```tsx
it('shows practice creation mode only when explicitly requested', async () => {
  const { rerender } = render(<RepositoryProvider repository={repository()}>
    <DataManagementPage />
  </RepositoryProvider>);
  expect(screen.queryByRole('button', { name: '返回记录练习' })).not.toBeInTheDocument();

  rerender(<RepositoryProvider repository={repository()}>
    <DataManagementPage creationTarget="primary" onAlgorithmCreated={vi.fn()} onReturnToPractice={vi.fn()} />
  </RepositoryProvider>);
  expect(await screen.findByRole('button', { name: '返回记录练习' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('正在为本次练习添加主要算法');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/features/algorithms/AlgorithmManager.test.tsx src/features/data-management/DataManagementPage.test.tsx
```

Expected: FAIL because creation-mode props, focus behavior, return UI, and created-algorithm callbacks do not exist.

- [ ] **Step 3: Extend `AlgorithmManager` with a guarded creation flow**

Add props, refs, and focus:

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AlgorithmTarget } from '../practices/practiceSession';

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
  const nameInput = useRef<HTMLInputElement>(null);
  const createOperation = useRef<object | undefined>(undefined);
  const [createPending, setCreatePending] = useState(false);

  useEffect(() => {
    if (creationTarget) nameInput.current?.focus();
  }, [creationTarget]);
```

Replace `create()` with a synchronous re-entry guard:

```tsx
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
```

Add the contextual UI immediately before the create form:

```tsx
{creationTarget && <section className="practice-return-banner" aria-label="练习算法创建流程">
  <p role="status">
    正在为本次练习添加{creationTarget === 'primary' ? '主要算法' : '辅助算法'}
  </p>
  <button type="button" onClick={onReturnToPractice}>返回记录练习</button>
</section>}
<form onSubmit={create}>
  <label>算法名称
    <input ref={nameInput} value={name} onChange={event => setName(event.target.value)} />
  </label>
  <label>分类颜色
    <input aria-label="分类颜色" type="color" value={color} onChange={event => setColor(event.target.value)} />
  </label>
  <button disabled={loading || createPending || !name.trim()}>
    {createPending ? '创建中…' : '创建分类'}
  </button>
</form>
```

- [ ] **Step 4: Pass creation mode through `DataManagementPage`**

Add:

```tsx
import type { Algorithm } from '../../domain/models';
import type { AlgorithmTarget } from '../practices/practiceSession';

interface DataManagementPageProps {
  creationTarget?: AlgorithmTarget;
  onAlgorithmCreated?: (algorithm: Algorithm) => void;
  onReturnToPractice?: () => void;
}

export function DataManagementPage({
  creationTarget,
  onAlgorithmCreated,
  onReturnToPractice,
}: DataManagementPageProps = {}) {
```

Pass the values to the existing manager:

```tsx
<AlgorithmManager
  reloadVersion={algorithmReloadVersion}
  creationTarget={creationTarget}
  onAlgorithmCreated={onAlgorithmCreated}
  onReturnToPractice={onReturnToPractice}
/>
```

- [ ] **Step 5: Verify focused tests, lint, and build**

Run:

```bash
npm test -- src/features/algorithms/AlgorithmManager.test.tsx src/features/data-management/DataManagementPage.test.tsx
npm run lint
npm run build
```

Expected: creation-mode tests pass, ordinary data-management tests remain green, lint exits 0, and both builds succeed.

- [ ] **Step 6: Commit creation mode**

```bash
git add src/features/algorithms/AlgorithmManager.tsx src/features/algorithms/AlgorithmManager.test.tsx src/features/data-management/DataManagementPage.tsx src/features/data-management/DataManagementPage.test.tsx
git commit -m "feat: add focused algorithm creation mode"
```

---

### Task 4: App-Level Navigation Orchestration and Browser Acceptance

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `AddAlgorithmRequest`, `applyCreatedAlgorithm`, draft-aware `RecordPracticeDialog`, and creation-aware `DataManagementPage`.
- Produces: complete cross-route primary/secondary/manual-return workflow.

- [ ] **Step 1: Write failing App integration tests**

Extend `src/app/App.test.tsx` with a stateful repository double and a router location probe:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { Algorithm } from '../domain/models';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

function createAppRepository() {
  let algorithms: Algorithm[] = [
    { id: 'hash', name: '哈希表', color: '#2563eb', createdAt: '' },
    { id: 'binary', name: '二分查找', color: '#16a34a', createdAt: '' },
  ];
  const recordPractice = vi.fn().mockResolvedValue({ problem: {}, practice: {} });
  const repo: DashboardRepository = {
    ...repository,
    recordPractice,
    async listAlgorithms() { return [...algorithms]; },
    async createAlgorithm(input) {
      const algorithm = { id: `created-${algorithms.length}`, ...input, createdAt: '' };
      algorithms = [...algorithms, algorithm];
      return algorithm;
    },
  };
  return { repo, recordPractice };
}

function renderApp(initialEntry = '/') {
  const state = createAppRepository();
  render(<RepositoryProvider repository={state.repo}>
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
      <LocationProbe />
    </MemoryRouter>
  </RepositoryProvider>);
  return state;
}

async function fillManualDraft(markdown = '## 草稿') {
  await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
  await userEvent.click(screen.getByRole('button', { name: '手动填写' }));
  await userEvent.type(screen.getByLabelText('题号'), '1');
  await userEvent.type(screen.getByLabelText('中文题名'), '两数之和');
  await userEvent.selectOptions(screen.getByLabelText('难度'), 'medium');
  await userEvent.clear(screen.getByLabelText('练习日期'));
  await userEvent.type(screen.getByLabelText('练习日期'), '2026-07-23');
  await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'hash');
  await userEvent.click(screen.getByRole('checkbox', { name: '二分查找' }));
  fireEvent.change(screen.getByRole('textbox', { name: '解题思路' }), { target: { value: markdown } });
}

it('returns from primary creation to the original filtered URL with the draft restored', async () => {
  renderApp('/problems?from=2026-07-01&to=2026-07-23#history');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));

  expect(screen.getByRole('status')).toHaveTextContent('正在为本次练习添加主要算法');
  expect(screen.getByTestId('location')).toHaveTextContent('/data?createAlgorithm=1');
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));

  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByTestId('location')).toHaveTextContent('/problems?from=2026-07-01&to=2026-07-23#history');
  expect(screen.getByLabelText('主要算法')).toHaveDisplayValue('图论');
  expect(screen.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 草稿');
});

it('adds a created secondary algorithm and manual return changes nothing', async () => {
  renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));
  await userEvent.click(screen.getByRole('button', { name: '返回记录练习' }));

  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByLabelText('主要算法')).toHaveValue('hash');
  expect(screen.getByRole('checkbox', { name: '二分查找' })).toBeChecked();
  expect(screen.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 草稿');

  await userEvent.click(screen.getByRole('button', { name: '添加辅助算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));

  expect(await screen.findByRole('dialog', { name: '记录练习' })).toBeVisible();
  expect(screen.getByLabelText('主要算法')).toHaveValue('hash');
  expect(screen.getByRole('checkbox', { name: '二分查找' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: '图论' })).toBeChecked();
  expect(screen.getAllByRole('checkbox', { name: '图论' })).toHaveLength(1);
});

it('clears the pending draft after explicit dialog close', async () => {
  renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.click(screen.getByRole('button', { name: '返回记录练习' }));
  await userEvent.click(await screen.findByRole('button', { name: '关闭' }));
  await userEvent.click(screen.getByTestId('record-practice'));

  expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');
  expect(screen.queryByRole('textbox', { name: '解题思路' })).not.toBeInTheDocument();
});

it('clears the pending draft after a restored practice is saved', async () => {
  const { recordPractice } = renderApp('/');
  await userEvent.click(screen.getByTestId('record-practice'));
  await fillManualDraft();
  await userEvent.click(screen.getByRole('button', { name: '添加主要算法' }));
  await userEvent.type(screen.getByLabelText('算法名称'), '图论');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  await userEvent.click(await screen.findByRole('button', { name: '保存练习' }));

  await waitFor(() => expect(recordPractice).toHaveBeenCalledOnce());
  await userEvent.click(screen.getByTestId('record-practice'));
  expect(screen.getByLabelText('LeetCode 题目链接')).toHaveValue('');
});

it('treats a refreshed creation URL without memory state as ordinary data management', () => {
  renderApp('/data?createAlgorithm=1');
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '返回记录练习' })).not.toBeInTheDocument();
  expect(screen.queryByText(/正在为本次练习添加/)).not.toBeInTheDocument();
});
```

The test helper must use `MemoryRouter initialEntries`, render `App`, and expose `useLocation()` as `data-testid="location"`. Repository `createAlgorithm` must mutate the same algorithm list returned by `listAlgorithms`, so the restored select contains the actual new ID rather than a test-only phantom option.

- [ ] **Step 2: Run App tests and verify RED**

Run:

```bash
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `App` does not store drafts, navigate to creation mode, restore locations, or apply returned algorithms.

- [ ] **Step 3: Implement App-owned session orchestration**

Update imports:

```tsx
import { useLocation, useNavigate, NavLink, Route, Routes } from 'react-router-dom';
import type { Algorithm } from '../domain/models';
import type { PracticeFormValues } from '../features/practices/PracticeForm';
import {
  applyCreatedAlgorithm,
  type AddAlgorithmRequest,
  type AlgorithmTarget,
} from '../features/practices/practiceSession';
```

Add state and handlers:

```tsx
const navigate = useNavigate();
const location = useLocation();
const [practiceDraft, setPracticeDraft] = useState<PracticeFormValues>();
const [algorithmRequest, setAlgorithmRequest] = useState<AddAlgorithmRequest>();

function clearPracticeSession() {
  setRecording(false);
  setPracticeDraft(undefined);
  setAlgorithmRequest(undefined);
}

function requestAlgorithm(target: AlgorithmTarget, values: PracticeFormValues) {
  const returnLocation = `${location.pathname}${location.search}${location.hash}`;
  const request: AddAlgorithmRequest = {
    target,
    draft: { values },
    returnLocation,
  };
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
```

Change the data route:

```tsx
<Route path="/data" element={<DataManagementPage
  creationTarget={algorithmRequest?.target}
  onAlgorithmCreated={algorithm => returnToPractice(algorithm)}
  onReturnToPractice={() => returnToPractice()}
/>} />
```

Change the record dialog:

```tsx
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
```

The global “＋ 记录练习” button must start fresh:

```tsx
onClick={() => {
  setPracticeDraft(undefined);
  setAlgorithmRequest(undefined);
  setRecording(true);
}}
```

Do not derive creation mode from the query string alone. After a hard refresh the in-memory request is gone, so `/data?createAlgorithm=1` behaves as ordinary data management and cannot resurrect an empty session.

- [ ] **Step 4: Verify App integration**

Run:

```bash
npm test -- src/app/App.test.tsx src/features/practices/RecordPracticeDialog.test.tsx src/features/data-management/DataManagementPage.test.tsx
```

Expected: primary, secondary, manual return, cleanup, and existing app routing tests pass.

- [ ] **Step 5: Add the browser acceptance flow**

Append to `tests/e2e/dashboard.spec.ts`:

```ts
test('creates a missing primary algorithm from an in-progress practice', async ({ page }) => {
  await page.goto('/problems?query=two-sum');
  await page.getByTestId('record-practice').click();
  let dialog = page.getByRole('dialog', { name: '记录练习' });
  await dialog.getByLabel('LeetCode 题目链接').fill('https://leetcode.cn/problems/two-sum/');
  await dialog.getByRole('button', { name: '读取题目信息' }).click();
  await expect(dialog.getByLabel('中文题名')).toHaveValue('两数之和');
  await dialog.getByLabel('练习日期').fill('2026-07-23');
  await dialog.getByRole('textbox', { name: '解题思路' }).fill('## 草稿\n\n使用图论');
  await dialog.getByRole('button', { name: '添加主要算法' }).click();

  await expect(page).toHaveURL(/\/data\?createAlgorithm=1$/);
  await expect(page.getByRole('status')).toHaveText('正在为本次练习添加主要算法');
  await expect(page.getByLabel('算法名称')).toBeFocused();
  await page.getByLabel('算法名称').fill('图论');
  await page.getByRole('button', { name: '创建分类' }).click();

  await expect(page).toHaveURL(/\/problems\?query=two-sum$/);
  dialog = page.getByRole('dialog', { name: '记录练习' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('主要算法')).toHaveDisplayValue('图论');
  await expect(dialog.getByLabel('练习日期')).toHaveValue('2026-07-23');
  await expect(dialog.getByRole('textbox', { name: '解题思路' })).toHaveValue('## 草稿\n\n使用图论');
  await dialog.getByRole('button', { name: '保存练习' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) });
  await row.getByRole('button', { name: '查看练习记录' }).click();
  const practice = row.getByTestId('practice-history').getByRole('listitem').filter({ hasText: '2026-07-23' });
  await expect(practice.getByText('主：图论', { exact: true })).toBeVisible();
  await expect(practice.getByRole('heading', { name: '草稿' })).toBeVisible();
});
```

- [ ] **Step 6: Run the fresh release gate**

Run:

```bash
npm test
npm run lint
npm run build
NO_PROXY=* no_proxy=* npm run test:e2e
git diff --check
git status --short
```

Expected:

- all unit/component tests pass;
- lint exits 0;
- SPA and API builds succeed;
- all Chromium E2E tests, including the new draft/create/return/save flow, pass;
- diff check is clean;
- only intentional Task 4 source/test changes remain before commit;
- `1.md` and `CLAUDE.md` remain untracked and untouched.

- [ ] **Step 7: Commit the completed workflow**

```bash
git add src/app/App.tsx src/app/App.test.tsx tests/e2e/dashboard.spec.ts
git commit -m "feat: create algorithms from practice drafts"
```

---

## Final Verification Checklist

- [ ] Both primary and secondary controls expose contextual add actions with zero or many algorithms.
- [ ] Draft capture does not require the Practice to be valid for final save.
- [ ] Draft data never enters IndexedDB, Web Storage, or URL parameters.
- [ ] Creation mode uses the full data-management page and focuses the algorithm-name input.
- [ ] Failed/duplicate creation does not return or lose the session.
- [ ] Successful creation returns to the exact path/query/hash and reopens the dialog.
- [ ] Primary creation replaces primary; secondary creation appends once and never duplicates primary.
- [ ] Manual return preserves selections unchanged.
- [ ] All editable Practice fields and Markdown survive the round trip.
- [ ] Deleted algorithm references are sanitized after algorithms reload.
- [ ] Save or explicit close clears the draft; hard refresh does not restore it.
- [ ] Ordinary `/data` navigation remains unchanged.
- [ ] Unit/component tests, lint, SPA/API build, Chromium E2E, and diff checks all pass.
- [ ] `1.md` and `CLAUDE.md` remain untouched and untracked.
