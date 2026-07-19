# Practice Solution Markdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users optionally record, safely preview, view, and later edit a Markdown solution for each individual practice while preserving existing IndexedDB data and version-1 backups.

**Architecture:** Add `solutionMarkdown` to the Practice domain and migrate Dexie from version 1 to 2. Normalize both legacy backup version 1 and current backup version 2 into one `BackupV2` model, then reuse shared `MarkdownEditor` and `MarkdownContent` components in new-practice and history-edit flows.

**Tech Stack:** React, TypeScript, React Hook Form, Dexie, Zod, react-markdown, remark-gfm, Vitest, Testing Library, Playwright

## Global Constraints

- Solution Markdown belongs to an individual Practice, never to the Problem.
- `solutionMarkdown` is optional in the UI and normalized to an empty string when absent.
- Maximum solution length is exactly 20,000 JavaScript characters; 20,000 is valid and 20,001 is rejected in UI, repository, and backup import.
- Dexie migrates from schema version 1 to version 2 without changing existing problem, date, algorithm, or timestamp fields.
- New exports use `schemaVersion: 2`; version-1 imports remain supported and normalize missing solution content to an empty string.
- Raw HTML is never rendered; unsafe URL protocols never become clickable links.
- External HTTP/HTTPS links open in a new tab with `rel="noopener noreferrer"`.
- Editing a historical solution changes only `solutionMarkdown` and `updatedAt`.
- Preserve all current destructive-operation confirmations, local-first storage, and the pre-existing untracked root `1.md`.

---

## Planned File Structure

```text
src/domain/models.ts                              Practice field and shared limit
src/domain/dashboard.test.ts                      Practice fixture compatibility
src/domain/backup.ts                              v1-to-v2 backup normalization
src/domain/backup.test.ts                         legacy/current backup coverage
src/db/DashboardDatabase.ts                       Dexie v2 migration
src/db/DashboardRepository.ts                     record/update interfaces
src/db/DexieDashboardRepository.ts                validation and transactional update
src/db/DexieDashboardRepository.test.ts           migration and persistence tests
src/features/algorithms/AlgorithmManager.test.tsx Practice fixture compatibility
src/shared/markdown/MarkdownContent.tsx            only safe rendering entry point
src/shared/markdown/MarkdownContent.test.tsx       security and GFM behavior
src/shared/markdown/MarkdownEditor.tsx             edit/preview tabs and count
src/shared/markdown/MarkdownEditor.test.tsx        interaction and boundary tests
src/features/practices/PracticeForm.tsx            new-practice solution value
src/features/practices/RecordPracticeDialog.tsx    pass solution to repository
src/features/practices/EditPracticeSolutionDialog.tsx  historical edit workflow
src/features/problems/ProblemDetails.tsx           rendered solution and edit trigger
src/features/problems/ProblemsPage.tsx             edit dialog ownership/reload
tests/e2e/dashboard.spec.ts                        persistence and backup acceptance
```

No feature component imports Dexie or implements its own Markdown parser.

---

### Task 1: Practice Domain, Dexie Migration, and Repository Update

**Files:**
- Modify: `src/domain/models.ts`
- Modify: `src/db/DashboardDatabase.ts`
- Modify: `src/db/DashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.test.ts`
- Modify: `src/domain/dashboard.test.ts`
- Modify: `src/features/algorithms/AlgorithmManager.test.tsx`
- Modify: `src/features/problems/ProblemsPage.test.tsx`

**Interfaces:**
- Consumes: existing `Practice`, `RecordPracticeInput`, and `DashboardRepository` contracts.
- Produces: `SOLUTION_MARKDOWN_MAX_LENGTH`; `Practice.solutionMarkdown`; `RecordPracticeInput.solutionMarkdown`; `updatePracticeSolution(practiceId, solutionMarkdown): Promise<Practice>`.

- [ ] **Step 1: Write failing repository and migration tests**

Add these cases to `src/db/DexieDashboardRepository.test.ts`:

```ts
it('stores an optional solution and defaults missing content to empty text', async () => {
  const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#2563eb' });
  const withSolution = await repo.recordPractice({
    metadata, practicedOn: '2026-07-19', primaryAlgorithmId: algorithm.id,
    secondaryAlgorithmIds: [], solutionMarkdown: '## 思路\n使用哈希表。',
  });
  const withoutSolution = await repo.recordPractice({
    metadata, practicedOn: '2026-07-20', primaryAlgorithmId: algorithm.id,
    secondaryAlgorithmIds: [],
  });
  expect(withSolution.practice.solutionMarkdown).toBe('## 思路\n使用哈希表。');
  expect(withoutSolution.practice.solutionMarkdown).toBe('');
});

it('updates only one practice solution and its updated time', async () => {
  const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#16a34a' });
  const { practice } = await repo.recordPractice({
    metadata, practicedOn: '2026-07-19', primaryAlgorithmId: algorithm.id,
    secondaryAlgorithmIds: [], solutionMarkdown: '旧思路',
  });
  const updated = await repo.updatePracticeSolution(practice.id, '新思路');
  expect(updated).toMatchObject({
    id: practice.id, problemId: practice.problemId, practicedOn: practice.practicedOn,
    primaryAlgorithmId: practice.primaryAlgorithmId, secondaryAlgorithmIds: [], solutionMarkdown: '新思路',
  });
  expect(updated.updatedAt >= practice.updatedAt).toBe(true);
});

it('rejects a missing practice and the 20,001-character boundary', async () => {
  await expect(repo.updatePracticeSolution('missing', '内容')).rejects.toThrow('练习已不存在');
  await expect(repo.updatePracticeSolution('missing', 'x'.repeat(20_001))).rejects.toThrow('解题思路不能超过 20000 个字符');
});
```

For migration, create a raw Dexie database at version 1 with a Practice object that has no `solutionMarkdown`, close it, open `DashboardDatabase` with the same name, and assert the migrated object has `solutionMarkdown: ''` while every original property remains equal.

- [ ] **Step 2: Run the repository tests and verify RED**

Run: `npm test -- src/db/DexieDashboardRepository.test.ts`

Expected: FAIL because `solutionMarkdown`, the version-2 migration, and `updatePracticeSolution` do not exist.

- [ ] **Step 3: Add the domain field and exact repository contract**

```ts
// src/domain/models.ts
export const SOLUTION_MARKDOWN_MAX_LENGTH = 20_000;

export interface Practice {
  id: string;
  problemId: string;
  practicedOn: string;
  primaryAlgorithmId: string;
  secondaryAlgorithmIds: string[];
  solutionMarkdown: string;
  createdAt: string;
  updatedAt: string;
}
```

```ts
// src/db/DashboardRepository.ts
export interface RecordPracticeInput {
  metadata: ProblemMetadata;
  practicedOn: string;
  primaryAlgorithmId: string;
  secondaryAlgorithmIds: string[];
  solutionMarkdown?: string;
}

// Add to DashboardRepository:
updatePracticeSolution(practiceId: string, solutionMarkdown: string): Promise<Practice>;
```

- [ ] **Step 4: Implement Dexie version 2 and the transactional update**

```ts
// src/db/DashboardDatabase.ts, after version(1)
this.version(2).stores({
  problems: 'id, &leetcodeSlug, frontendQuestionId, titleZh, difficulty',
  practices: 'id, problemId, practicedOn, primaryAlgorithmId, *secondaryAlgorithmIds',
  algorithms: 'id, name, createdAt',
}).upgrade(async transaction => {
  await transaction.table<Practice>('practices').toCollection().modify(practice => {
    if (typeof practice.solutionMarkdown !== 'string') practice.solutionMarkdown = '';
  });
});
```

Use one shared validator in `DexieDashboardRepository.ts`:

```ts
function assertSolutionMarkdown(value: string): void {
  if (value.length > SOLUTION_MARKDOWN_MAX_LENGTH) {
    throw new Error('解题思路不能超过 20000 个字符');
  }
}
```

Call it before `recordPractice` writes. Include `solutionMarkdown: input.solutionMarkdown ?? ''` in the created Practice. Implement update as:

```ts
async updatePracticeSolution(practiceId: string, solutionMarkdown: string): Promise<Practice> {
  assertSolutionMarkdown(solutionMarkdown);
  return this.database.transaction('rw', this.database.practices, async () => {
    const practice = await this.database.practices.get(practiceId);
    if (!practice) throw new Error('练习已不存在');
    const updated = { ...practice, solutionMarkdown, updatedAt: new Date().toISOString() };
    await this.database.practices.put(updated);
    return updated;
  });
}
```

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- src/db/DexieDashboardRepository.test.ts && npm test`

Expected: repository migration/persistence tests and the full suite pass. Update every existing typed Practice fixture in `src/domain/dashboard.test.ts`, `src/features/algorithms/AlgorithmManager.test.tsx`, `src/features/problems/ProblemsPage.test.tsx`, and direct current-schema inserts in `src/db/DexieDashboardRepository.test.ts` to contain `solutionMarkdown: ''`; keep only the deliberate raw version-1 migration fixture without the field. Do not weaken their other assertions.

- [ ] **Step 6: Commit the data model**

```bash
git add src/domain/models.ts src/domain/dashboard.test.ts src/db/DashboardDatabase.ts src/db/DashboardRepository.ts src/db/DexieDashboardRepository.ts src/db/DexieDashboardRepository.test.ts src/features/algorithms/AlgorithmManager.test.tsx src/features/problems/ProblemsPage.test.tsx
git commit -m "feat: store solutions per practice"
```

---

### Task 2: Version-2 Backups with Version-1 Compatibility

**Files:**
- Modify: `src/domain/backup.ts`
- Modify: `src/domain/backup.test.ts`
- Modify: `src/db/DashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.test.ts`
- Modify: `src/features/data-management/DataManagementPage.test.tsx`

**Interfaces:**
- Consumes: `Practice.solutionMarkdown` and `SOLUTION_MARKDOWN_MAX_LENGTH` from Task 1.
- Produces: `BackupV2`; `parseBackup(input: unknown): BackupV2`; version-2 `exportBackup`, `importBackup`, and `mergeBackup` contracts.

- [ ] **Step 1: Write failing backup compatibility tests**

```ts
it('normalizes a version-1 backup solution to empty text', () => {
  const legacyPractice = { ...practice } as Record<string, unknown>;
  delete legacyPractice.solutionMarkdown;
  const parsed = parseBackup({
    schemaVersion: 1, exportedAt: timestamp,
    problems: [problem], algorithms: [algorithm], practices: [legacyPractice],
  });
  expect(parsed.schemaVersion).toBe(2);
  expect(parsed.practices[0].solutionMarkdown).toBe('');
});

it('accepts 20,000 characters and atomically rejects 20,001', () => {
  expect(parseBackup(backupV2({ practices: [{ ...practice, solutionMarkdown: 'x'.repeat(20_000) }] })))
    .toMatchObject({ schemaVersion: 2 });
  expect(() => parseBackup(backupV2({ practices: [{ ...practice, solutionMarkdown: 'x'.repeat(20_001) }] })))
    .toThrow('备份数据格式无效');
});
```

Add repository tests proving an exported backup has schema version 2 and the exact solution text, a version-1 import stores an empty solution, and a version-2 export → clear → import restores the solution.

- [ ] **Step 2: Run backup tests and verify RED**

Run: `npm test -- src/domain/backup.test.ts src/db/DexieDashboardRepository.test.ts`

Expected: FAIL because only schema version 1 exists and Practice currently requires no backup solution field.

- [ ] **Step 3: Define separate legacy/current schemas and one normalized type**

```ts
const practiceBaseSchema = z.object({
  id,
  problemId: id,
  practicedOn: localDate,
  primaryAlgorithmId: id,
  secondaryAlgorithmIds: z.array(id),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const legacyPracticeSchema = practiceBaseSchema.strict();
const practiceV2Schema = practiceBaseSchema.extend({
  solutionMarkdown: z.string().max(SOLUTION_MARKDOWN_MAX_LENGTH),
}).strict();

export const backupV1Schema = z.object({
  schemaVersion: z.literal(1), exportedAt: isoDateTime,
  problems: z.array(problemSchema), practices: z.array(legacyPracticeSchema), algorithms: z.array(algorithmSchema),
}).strict();

export const backupV2Schema = z.object({
  schemaVersion: z.literal(2), exportedAt: isoDateTime,
  problems: z.array(problemSchema), practices: z.array(practiceV2Schema), algorithms: z.array(algorithmSchema),
}).strict();

export type BackupV2 = z.infer<typeof backupV2Schema>;
export interface MergeResult extends BackupV2 {
  summary: { addedProblems: number; addedPractices: number; addedAlgorithms: number; skippedIds: string[] };
}
```

`parseBackup` first checks the literal version. Parse version 1 with `backupV1Schema`, map practices to `{ ...practice, solutionMarkdown: '' }`, then run all existing uniqueness and reference validation on the normalized `BackupV2`. Parse version 2 directly. Any other version throws `备份版本不受支持`.

- [ ] **Step 4: Move repository and merge contracts to BackupV2**

Replace `BackupV1` with `BackupV2` in `DashboardRepository`, `DexieDashboardRepository`, data-management test doubles, and merge helpers. Set `DashboardRepository.importBackup(backup: unknown): Promise<MergeResult['summary']>` and `mergeBackup(localInput: BackupV2, importedInput: BackupV2): MergeResult`. `exportBackup()` must return:

```ts
{
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  problems,
  practices,
  algorithms,
}
```

`importBackup` accepts `unknown`, calls `parseBackup` before planning the merge, and then performs the existing single IndexedDB write transaction. Preserve existing local-wins and semantic ID remapping behavior.

- [ ] **Step 5: Verify compatibility and atomicity**

Run: `npm test -- src/domain/backup.test.ts src/db/DexieDashboardRepository.test.ts src/features/data-management/DataManagementPage.test.tsx`

Expected: version-1 normalization, version-2 round trip, length boundaries, collision remapping, and atomic rejection all pass.

- [ ] **Step 6: Commit backup version 2**

```bash
git add src/domain/backup.ts src/domain/backup.test.ts src/db/DashboardRepository.ts src/db/DexieDashboardRepository.ts src/db/DexieDashboardRepository.test.ts src/features/data-management/DataManagementPage.test.tsx
git commit -m "feat: preserve solutions in versioned backups"
```

---

### Task 3: Safe Markdown Renderer and Tabbed Editor

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/shared/markdown/MarkdownContent.tsx`
- Create: `src/shared/markdown/MarkdownContent.test.tsx`
- Create: `src/shared/markdown/MarkdownEditor.tsx`
- Create: `src/shared/markdown/MarkdownEditor.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `SOLUTION_MARKDOWN_MAX_LENGTH`.
- Produces: `MarkdownContent({ value })`; `MarkdownEditor({ value, onChange, disabled?, error? })`.

- [ ] **Step 1: Install the renderer dependencies**

Run: `npm install react-markdown remark-gfm`

Expected: `package.json` and `package-lock.json` add exactly these runtime dependencies.

- [ ] **Step 2: Write failing renderer security tests**

```tsx
it('renders GFM without raw HTML and blocks unsafe links', () => {
  render(<MarkdownContent value={'| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n[bad](javascript:alert(1))'} />);
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
});

it('opens external links with safe attributes', () => {
  render(<MarkdownContent value="[OpenAI](https://openai.com/)" />);
  expect(screen.getByRole('link', { name: 'OpenAI' })).toMatchObject({
    target: '_blank', rel: 'noopener noreferrer',
  });
});
```

- [ ] **Step 3: Implement the single safe renderer entry point**

```tsx
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const safeUrlTransform = (url: string) => {
  const transformed = defaultUrlTransform(url);
  return /^(https?:|mailto:|\/|#)/i.test(transformed) ? transformed : '';
};

export function MarkdownContent({ value }: { value: string }) {
  return <div className="markdown-content">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={safeUrlTransform}
      components={{
        a: ({ href, children }) => href
          ? <a href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel={/^https?:/i.test(href) ? 'noopener noreferrer' : undefined}>{children}</a>
          : <span>{children}</span>,
      }}
    >{value}</ReactMarkdown>
  </div>;
}
```

Do not add `rehype-raw` or `dangerouslySetInnerHTML`.

- [ ] **Step 4: Write failing editor interaction tests**

```tsx
it('keeps content across edit and preview tabs and reports the exact count', async () => {
  function Harness() {
    const [value, setValue] = useState('');
    return <MarkdownEditor value={value} onChange={setValue} />;
  }
  render(<Harness />);
  await userEvent.type(screen.getByLabelText('解题思路'), '# 哈希表');
  expect(screen.getByText('5 / 20000')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: '预览' }));
  expect(screen.getByRole('heading', { name: '哈希表' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: '编辑' }));
  expect(screen.getByLabelText('解题思路')).toHaveValue('# 哈希表');
});
```

Add boundary tests for 20,000 and 20,001 characters, disabled state, empty preview text, and `role="alert"` for rendering or validation errors.

- [ ] **Step 5: Implement the controlled tabbed editor**

`MarkdownEditor` owns only the active tab. Its props are:

```ts
interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}
```

Use `role="tablist"`, two buttons with `role="tab"` and `aria-selected`, a labeled textarea with `maxLength={SOLUTION_MARKDOWN_MAX_LENGTH + 1}`, and a live character count. The component must call `onChange` even at 20,001 so the validation error is visible, but callers must prevent submission while over the limit. Preview renders `MarkdownContent` or “尚未填写解题思路”.

- [ ] **Step 6: Add focused presentation styles and verify**

Add scoped styles for the editor tabs, textarea, Markdown tables/quotes, inline code, and code-block horizontal scrolling. Do not alter global typography outside `.markdown-*` and `.solution-editor` selectors.

Run: `npm test -- src/shared/markdown/MarkdownContent.test.tsx src/shared/markdown/MarkdownEditor.test.tsx && npm run lint && npm run build`

Expected: Markdown security/editor tests, lint, and both web/API builds pass.

- [ ] **Step 7: Commit the shared Markdown UI**

```bash
git add package.json package-lock.json src/shared/markdown src/app/styles.css
git commit -m "feat: add safe markdown solution editor"
```

---

### Task 4: Record, Display, and Edit Practice Solutions

**Files:**
- Modify: `src/features/practices/PracticeForm.tsx`
- Modify: `src/features/practices/RecordPracticeDialog.tsx`
- Modify: `src/features/practices/RecordPracticeDialog.test.tsx`
- Create: `src/features/practices/EditPracticeSolutionDialog.tsx`
- Create: `src/features/practices/EditPracticeSolutionDialog.test.tsx`
- Modify: `src/features/problems/ProblemDetails.tsx`
- Modify: `src/features/problems/ProblemsPage.tsx`
- Modify: `src/features/problems/ProblemsPage.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Consumes: `MarkdownEditor`, `MarkdownContent`, repository record/update methods, and existing shared `Modal`.
- Produces: end-to-end UI for creating, viewing, and editing one Practice solution.

- [ ] **Step 1: Write failing new-practice form tests**

Extend `RecordPracticeDialog.test.tsx` to type Markdown, switch to preview, save, and assert:

```ts
expect(repo.recordPractice).toHaveBeenCalledWith(expect.objectContaining({
  solutionMarkdown: '## 思路\n- 使用哈希表',
}));
```

Add tests that empty Markdown saves as `''`, 20,001 characters disable/prevent save with `解题思路不能超过 20000 个字符`, and repository failure leaves the Markdown textarea populated.

- [ ] **Step 2: Integrate `MarkdownEditor` into `PracticeForm`**

Add `solutionMarkdown: z.string().max(SOLUTION_MARKDOWN_MAX_LENGTH, '解题思路不能超过 20000 个字符')` to `practiceFormSchema` and `solutionMarkdown: ''` to defaults/reset values. Because React Hook Form owns the value, bridge the controlled editor with `Controller`:

```tsx
<Controller
  name="solutionMarkdown"
  control={control}
  render={({ field, fieldState }) => <MarkdownEditor
    value={field.value}
    onChange={field.onChange}
    disabled={saving}
    error={fieldState.error?.message}
  />}
/>
```

Pass `values.solutionMarkdown` through `RecordPracticeDialog.save()` to `repository.recordPractice`.

- [ ] **Step 3: Write failing history display/edit tests**

In `ProblemsPage.test.tsx`, provide two practices with different Markdown values. Assert each renders under its own date, empty content shows “尚未记录解题思路”, and clicking “编辑思路” opens an editor containing only the selected practice value.

Create `EditPracticeSolutionDialog.test.tsx` with:

- successful save calls `updatePracticeSolution(id, value)`, closes, and calls `onSaved`;
- cancel performs no write;
- repository rejection `练习已不存在` stays inside the modal and preserves text;
- generic rejection shows `保存失败，请重试` and preserves text;
- double submission is disabled while saving;
- Escape and focus restoration continue through shared `Modal`.

- [ ] **Step 4: Implement the historical edit dialog**

```tsx
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

  async function save() {
    if (value.length > SOLUTION_MARKDOWN_MAX_LENGTH) {
      setError('解题思路不能超过 20000 个字符');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await repository.updatePracticeSolution(practice.id, value);
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
    <MarkdownEditor value={value} onChange={setValue} disabled={saving} error={error} />
    <button type="button" disabled={saving || value.length > SOLUTION_MARKDOWN_MAX_LENGTH} onClick={() => void save()}>
      {saving ? '保存中…' : '保存思路'}
    </button>
  </Modal>;
}
```

- [ ] **Step 5: Render and route edit ownership**

`ProblemDetails` renders `<MarkdownContent value={practice.solutionMarkdown} />` or “尚未记录解题思路”, plus an `编辑思路` button that passes the Practice object upward. `ProblemsPage` owns `editingPractice?: Practice`, renders one `EditPracticeSolutionDialog`, and calls its existing page reload after a successful update. Do not couple `ProblemDetails` to the repository.

- [ ] **Step 6: Verify component integration**

Run:

```bash
npm test -- src/features/practices/RecordPracticeDialog.test.tsx \
  src/features/practices/EditPracticeSolutionDialog.test.tsx \
  src/features/problems/ProblemsPage.test.tsx
```

Expected: create/display/edit, empty state, boundary, focus, failure retention, and reload tests pass.

- [ ] **Step 7: Commit the feature integration**

```bash
git add src/features/practices src/features/problems src/app/styles.css
git commit -m "feat: record and edit practice solutions"
```

---

### Task 5: Browser Acceptance and Release Verification

**Files:**
- Modify: `tests/e2e/dashboard.spec.ts`
- Modify: `tests/e2e/fixtures.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed UI, version-2 backup, real IndexedDB, mocked metadata route.
- Produces: release acceptance evidence and user documentation.

- [ ] **Step 1: Extend the E2E acceptance flow**

After recording a practice, type this Markdown before saving:

````md
## 核心思路

- 使用哈希表记录补数

```ts
const seen = new Map<number, number>();
```
````

The test must then:

1. open the problem history and assert the heading, list item, and code block render;
2. click “编辑思路”, replace the text with `## 新思路\n\n使用双指针`, save, and reload;
3. assert the new heading/text remain and old text is absent;
4. export JSON and assert the downloaded object has `schemaVersion: 2` and the exact Markdown on the matching Practice;
5. clear all data, import the file, and assert the edited Markdown renders again.

- [ ] **Step 2: Document the solution feature and backup compatibility**

Add to `README.md`:

- solutions are optional and stored per practice;
- Markdown supports GFM but not raw HTML;
- maximum length is 20,000 characters;
- new exports are version 2 and version-1 backups remain importable;
- browser site-data deletion removes solutions unless a JSON backup exists.

- [ ] **Step 3: Run the fresh full release gate**

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

- all unit/component tests pass with zero failures;
- lint exits 0;
- SPA and API builds exit 0;
- Chromium E2E passes the solution create/edit/refresh/export/import flow;
- diff check is clean;
- only intentional Task 5 documentation/test changes remain before commit.

- [ ] **Step 4: Commit release acceptance**

```bash
git add tests/e2e README.md
git commit -m "test: verify practice solution workflow"
```

---

## Final Verification Checklist

- [ ] Existing version-1 IndexedDB practices migrate with `solutionMarkdown: ''` and no other field changes.
- [ ] Version-1 JSON imports normalize to version 2; version-2 export/import preserves Markdown exactly.
- [ ] 20,000 characters save successfully; 20,001 are rejected by form, repository, and import.
- [ ] Raw HTML and unsafe protocols never render as executable/clickable content.
- [ ] External links use `_blank` plus `noopener noreferrer`.
- [ ] New practice save failures and historical edit failures preserve Markdown input.
- [ ] Historical edit changes no date or algorithm fields.
- [ ] Refresh and export/clear/import retain the edited solution.
- [ ] Unit/component tests, Chromium E2E, lint, SPA build, API build, and diff checks all pass.
- [ ] `1.md` remains untouched and untracked.
