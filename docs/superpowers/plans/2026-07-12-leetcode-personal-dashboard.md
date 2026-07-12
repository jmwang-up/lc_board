# LeetCode Personal Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first personal dashboard that records repeated `leetcode.cn` practices, classifies each practice by user-defined algorithms, supports historical lookup, and safely backs up all data as JSON.

**Architecture:** A React + TypeScript + Vite SPA owns all personal data in IndexedDB through a narrow repository interface. A separate Express endpoint accepts only validated LeetCode slugs and translates upstream metadata into a stable contract; the UI falls back to manual entry when it is unavailable.

**Tech Stack:** React, TypeScript, Vite, React Router, Dexie, Zod, Express, Vitest, Testing Library, MSW, Playwright

## Global Constraints

- First release supports only `leetcode.cn/problems/<slug>/` links.
- The app is single-user, local-first, and requires no login or cloud synchronization.
- The metadata proxy never stores personal practice data and never accepts arbitrary upstream URLs.
- A practice has exactly one primary algorithm and zero or more distinct secondary algorithms.
- Algorithm categories are user-created; no built-in categories are seeded.
- All destructive operations require explicit confirmation.
- JSON import is atomic, schema-versioned, and merge-only; local conflicts win.
- Preserve the pre-existing untracked `1.md`; do not add, edit, or delete it.

---

## Planned File Structure

```text
package.json                         workspace scripts and dependency boundary
vite.config.ts                      SPA build, test config, local API proxy
playwright.config.ts                browser acceptance-test config
src/app/                            application shell and routes
src/domain/                         stable entities, schemas, pure rules
src/db/                             Dexie schema and repository implementation
src/features/algorithms/            category management UI
src/features/practices/             link lookup and practice recording UI
src/features/dashboard/             algorithm cards, recent activity, calendar
src/features/problems/              search, filters, problem history
src/features/data-management/       backup import/export and destructive reset
src/shared/                         reusable UI and date/error helpers
server/                             LeetCode-only metadata proxy
tests/                              test setup, fixtures, and end-to-end specs
```

Every feature consumes `DashboardRepository`; no React component imports Dexie directly. `server/` depends only on the metadata contract and has no access to `src/db/`.

---

### Task 1: Application Foundation and Navigable Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`
- Create: `src/app/styles.css`
- Create: `src/shared/ui/EmptyState.tsx`
- Create: `tests/setup.ts`

**Interfaces:**
- Consumes: none.
- Produces: `App(): JSX.Element`; routes `/`, `/problems`, `/data`; global `data-testid="record-practice"` action.

- [ ] **Step 1: Add the package manifest and tool configuration**

```json
{
  "name": "lc-board",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:web\" \"npm:dev:api\"",
    "dev:web": "vite",
    "dev:api": "tsx watch server/index.ts",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint ."
  },
  "dependencies": {
    "@hookform/resolvers": "latest",
    "dexie": "latest",
    "express": "latest",
    "react": "latest",
    "react-dom": "latest",
    "react-hook-form": "latest",
    "react-router-dom": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@eslint/js": "latest",
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/express": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "concurrently": "latest",
    "eslint": "latest",
    "fake-indexeddb": "latest",
    "jsdom": "latest",
    "msw": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "typescript-eslint": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

Create `vite.config.ts` with the React plugin, JSDOM tests using `tests/setup.ts`, and a development proxy from `/api` to `http://localhost:8787`. Create strict TypeScript configs for DOM and Node code. Run `npm install` to generate and commit `package-lock.json`; do not replace `latest` with guessed versions before lockfile generation.

- [ ] **Step 2: Write the failing navigation test**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';

it('navigates among the three first-release pages', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '算法看板' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '题目记录' }));
  expect(screen.getByRole('heading', { name: '题目记录' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: '数据管理' }));
  expect(screen.getByRole('heading', { name: '数据管理' })).toBeInTheDocument();
  expect(screen.getByTestId('record-practice')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the test and verify the expected failure**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `./App` does not exist.

- [ ] **Step 4: Implement the smallest navigable shell**

```tsx
// src/app/App.tsx
import { NavLink, Route, Routes } from 'react-router-dom';

const Page = ({ title }: { title: string }) => <main><h1>{title}</h1></main>;

export function App() {
  return <div className="app-shell">
    <header>
      <strong>LC Board</strong>
      <nav>
        <NavLink to="/">算法看板</NavLink>
        <NavLink to="/problems">题目记录</NavLink>
        <NavLink to="/data">数据管理</NavLink>
      </nav>
      <button data-testid="record-practice" type="button">＋ 记录练习</button>
    </header>
    <Routes>
      <Route path="/" element={<Page title="算法看板" />} />
      <Route path="/problems" element={<Page title="题目记录" />} />
      <Route path="/data" element={<Page title="数据管理" />} />
    </Routes>
  </div>;
}
```

Wire `src/main.tsx` with `BrowserRouter`, add semantic focus/empty-state styles, and make the shell responsive at 768px.

- [ ] **Step 5: Verify the shell**

Run: `npm test -- src/app/App.test.tsx && npm run build`

Expected: one passing test and a successful Vite production build.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src tests/setup.ts
git commit -m "feat: scaffold LC Board application shell"
```

---

### Task 2: Domain Contracts, URL Parsing, and Metadata Proxy

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/domain/leetcode.ts`
- Create: `src/domain/leetcode.test.ts`
- Create: `src/features/practices/metadataClient.ts`
- Create: `server/leetcodeClient.ts`
- Create: `server/app.ts`
- Create: `server/index.ts`
- Create: `server/app.test.ts`

**Interfaces:**
- Consumes: native `fetch`.
- Produces: `parseLeetCodeCnUrl(value: string): { slug: string; url: string }`; `ProblemMetadata`; `fetchProblemMetadata(slug, signal?)`; Express `GET /api/leetcode/problems/:slug`.

- [ ] **Step 1: Define stable domain models**

```ts
// src/domain/models.ts
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface Problem { id: string; leetcodeSlug: string; frontendQuestionId: string; titleZh: string; difficulty: Difficulty; url: string; createdAt: string }
export interface Practice { id: string; problemId: string; practicedOn: string; primaryAlgorithmId: string; secondaryAlgorithmIds: string[]; createdAt: string; updatedAt: string }
export interface Algorithm { id: string; name: string; color: string; createdAt: string }
export interface ProblemMetadata { slug: string; frontendQuestionId: string; titleZh: string; difficulty: Difficulty; url: string }
```

- [ ] **Step 2: Write failing URL parser tests**

```ts
// src/domain/leetcode.test.ts
import { describe, expect, it } from 'vitest';
import { parseLeetCodeCnUrl } from './leetcode';

describe('parseLeetCodeCnUrl', () => {
  it('normalizes a supported problem URL', () => {
    expect(parseLeetCodeCnUrl('https://leetcode.cn/problems/two-sum/description/')).toEqual({
      slug: 'two-sum', url: 'https://leetcode.cn/problems/two-sum/'
    });
  });
  it.each(['https://leetcode.com/problems/two-sum/', 'https://leetcode.cn/contest/', 'notaurl'])('rejects %s', value => {
    expect(() => parseLeetCodeCnUrl(value)).toThrow('请输入 leetcode.cn 题目链接');
  });
});
```

- [ ] **Step 3: Run the parser tests and verify failure**

Run: `npm test -- src/domain/leetcode.test.ts`

Expected: FAIL because `parseLeetCodeCnUrl` is missing.

- [ ] **Step 4: Implement strict URL parsing**

```ts
// src/domain/leetcode.ts
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function parseLeetCodeCnUrl(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('请输入 leetcode.cn 题目链接'); }
  const match = url.pathname.match(/^\/problems\/([^/]+)(?:\/|$)/);
  if (url.protocol !== 'https:' || url.hostname !== 'leetcode.cn' || !match || !SLUG.test(match[1])) {
    throw new Error('请输入 leetcode.cn 题目链接');
  }
  return { slug: match[1], url: `https://leetcode.cn/problems/${match[1]}/` };
}
```

- [ ] **Step 5: Write failing proxy contract tests**

```ts
// server/app.test.ts
import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

it('returns normalized metadata for a valid slug', async () => {
  const lookup = vi.fn().mockResolvedValue({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' });
  const response = await request(createApp({ lookup })).get('/api/leetcode/problems/two-sum');
  expect(response.status).toBe(200);
  expect(response.body.titleZh).toBe('两数之和');
});

it('rejects a non-slug before calling upstream', async () => {
  const lookup = vi.fn();
  const response = await request(createApp({ lookup })).get('/api/leetcode/problems/not_valid');
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('INVALID_SLUG');
  expect(lookup).not.toHaveBeenCalled();
});
```

Add `supertest` and `@types/supertest` as development dependencies.

- [ ] **Step 6: Implement the proxy boundary and upstream adapter**

```ts
// server/app.ts
import express from 'express';
import type { ProblemMetadata } from '../src/domain/models';
type Lookup = (slug: string, signal: AbortSignal) => Promise<ProblemMetadata>;
export function createApp({ lookup }: { lookup: Lookup }) {
  const app = express();
  app.get('/api/leetcode/problems/:slug', async (req, res) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.slug)) return res.status(400).json({ code: 'INVALID_SLUG' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try { return res.json(await lookup(req.params.slug, controller.signal)); }
    catch (error) {
      const code = error instanceof Error && error.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_CHANGED';
      return res.status(502).json({ code });
    } finally { clearTimeout(timer); }
  });
  return app;
}
```

Implement `server/leetcodeClient.ts` against LeetCode China's GraphQL endpoint using a fixed query and Zod response parsing. Map missing questions to `NOT_FOUND`; never accept a URL from the caller. Implement `metadataClient.ts` to map non-2xx responses to a typed `MetadataError` used by the manual-entry fallback.

- [ ] **Step 7: Verify and commit the metadata boundary**

Run: `npm test -- src/domain/leetcode.test.ts server/app.test.ts`

Expected: all parser and proxy contract tests pass without real network access.

```bash
git add package.json package-lock.json src/domain src/features/practices/metadataClient.ts server
git commit -m "feat: add LeetCode metadata lookup boundary"
```

---

### Task 3: IndexedDB Schema and Repository Rules

**Files:**
- Create: `src/db/DashboardDatabase.ts`
- Create: `src/db/DashboardRepository.ts`
- Create: `src/db/DexieDashboardRepository.ts`
- Create: `src/db/DexieDashboardRepository.test.ts`
- Create: `src/app/RepositoryContext.tsx`

**Interfaces:**
- Consumes: `Problem`, `Practice`, `Algorithm`, `ProblemMetadata`.
- Produces: `DashboardRepository` methods `createAlgorithm`, `renameAlgorithm`, `replaceAndDeleteAlgorithm`, `recordPractice`, `listAlgorithms`, `listProblems`, `listPractices`, `deletePractice`, `deleteProblem`, and `clearAll`.

- [ ] **Step 1: Define the repository interface**

```ts
// src/db/DashboardRepository.ts
import type { Algorithm, Practice, Problem, ProblemMetadata } from '../domain/models';
export interface RecordPracticeInput { metadata: ProblemMetadata; practicedOn: string; primaryAlgorithmId: string; secondaryAlgorithmIds: string[] }
export interface DashboardRepository {
  createAlgorithm(input: { name: string; color: string }): Promise<Algorithm>;
  renameAlgorithm(id: string, name: string): Promise<void>;
  replaceAndDeleteAlgorithm(id: string, replacementId: string): Promise<void>;
  recordPractice(input: RecordPracticeInput): Promise<{ problem: Problem; practice: Practice }>;
  listAlgorithms(): Promise<Algorithm[]>;
  listProblems(): Promise<Problem[]>;
  listPractices(): Promise<Practice[]>;
  deletePractice(id: string): Promise<void>;
  deleteProblem(id: string): Promise<void>;
  clearAll(): Promise<void>;
}
```

- [ ] **Step 2: Write failing repository invariant tests**

```ts
// src/db/DexieDashboardRepository.test.ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { DashboardDatabase } from './DashboardDatabase';
import { DexieDashboardRepository } from './DexieDashboardRepository';

let repo: DexieDashboardRepository;
beforeEach(() => { repo = new DexieDashboardRepository(new DashboardDatabase(crypto.randomUUID())); });

it('reuses a problem and creates a new practice every time', async () => {
  const algorithm = await repo.createAlgorithm({ name: '双指针', color: '#2563eb' });
  const input = { metadata: { slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy' as const, url: 'https://leetcode.cn/problems/two-sum/' }, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [] };
  await repo.recordPractice(input);
  await repo.recordPractice(input);
  expect(await repo.listProblems()).toHaveLength(1);
  expect(await repo.listPractices()).toHaveLength(2);
});

it('rejects a secondary algorithm equal to the primary algorithm', async () => {
  const algorithm = await repo.createAlgorithm({ name: '哈希表', color: '#16a34a' });
  await expect(repo.recordPractice({ metadata: { slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }, practicedOn: '2026-07-12', primaryAlgorithmId: algorithm.id, secondaryAlgorithmIds: [algorithm.id] })).rejects.toThrow('辅助算法不能与主要算法重复');
});
```

- [ ] **Step 3: Run repository tests and verify failure**

Run: `npm test -- src/db/DexieDashboardRepository.test.ts`

Expected: FAIL because database and repository classes do not exist.

- [ ] **Step 4: Implement schema and transactional repository**

```ts
// src/db/DashboardDatabase.ts
import Dexie, { type EntityTable } from 'dexie';
import type { Algorithm, Practice, Problem } from '../domain/models';
export class DashboardDatabase extends Dexie {
  problems!: EntityTable<Problem, 'id'>;
  practices!: EntityTable<Practice, 'id'>;
  algorithms!: EntityTable<Algorithm, 'id'>;
  constructor(name = 'lc-board') {
    super(name);
    this.version(1).stores({
      problems: 'id, &leetcodeSlug, frontendQuestionId, titleZh, difficulty',
      practices: 'id, problemId, practicedOn, primaryAlgorithmId, *secondaryAlgorithmIds',
      algorithms: 'id, name, createdAt'
    });
  }
}
```

Implement `recordPractice` in one `rw` transaction: validate the local date, algorithm existence, uniqueness of secondary IDs, and primary/secondary separation; reuse a problem by `leetcodeSlug`; then add a UUID practice. Implement case-insensitive algorithm name uniqueness in repository code. Implement delete and replacement operations as transactions so references cannot become dangling.

- [ ] **Step 5: Add replacement and cascade tests**

Test that `replaceAndDeleteAlgorithm(oldId, newId)` rewrites both primary and secondary references, removes duplicate secondary references, and deletes `oldId`. Test that deleting a problem deletes its practices while deleting one practice preserves its problem.

- [ ] **Step 6: Verify and commit the data layer**

Run: `npm test -- src/db/DexieDashboardRepository.test.ts`

Expected: repository invariants and transaction tests pass.

```bash
git add src/db src/app/RepositoryContext.tsx
git commit -m "feat: add local dashboard repository"
```

---

### Task 4: User-Defined Algorithm Management

**Files:**
- Create: `src/features/algorithms/AlgorithmManager.tsx`
- Create: `src/features/algorithms/AlgorithmManager.test.tsx`
- Create: `src/features/algorithms/useAlgorithms.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `DashboardRepository.createAlgorithm`, `renameAlgorithm`, `replaceAndDeleteAlgorithm`, `listAlgorithms`.
- Produces: `AlgorithmManager`; reusable `useAlgorithms(): { algorithms, reload, loading }`.

- [ ] **Step 1: Write the failing category lifecycle test**

```tsx
it('creates a category and rejects a duplicate normalized name', async () => {
  renderManagerWithRepository(fakeRepository());
  await userEvent.type(screen.getByLabelText('算法名称'), '动态规划');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  expect(await screen.findByText('动态规划')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('算法名称'), ' 动态规划 ');
  await userEvent.click(screen.getByRole('button', { name: '创建分类' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('算法名称已存在');
});
```

Add a second test proving that deleting an in-use category requires selecting a replacement and confirming the affected practice count.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/algorithms/AlgorithmManager.test.tsx`

Expected: FAIL because `AlgorithmManager` is missing.

- [ ] **Step 3: Implement category management**

Build an accessible form with `name` and color controls, an empty-state message, inline rename, and a replacement dialog. Convert repository errors into Chinese field messages. The delete action must remain disabled until a distinct replacement is selected and the confirmation checkbox is checked.

```tsx
export function AlgorithmManager() {
  const repository = useRepository();
  const { algorithms, reload, loading } = useAlgorithms();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await repository.createAlgorithm({ name, color: '#2563eb' });
      setName('');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建算法失败');
    }
  }
  return <section aria-labelledby="algorithm-heading">
    <h2 id="algorithm-heading">算法分类</h2>
    <form onSubmit={create}>
      <label>算法名称<input value={name} onChange={event => setName(event.target.value)} /></label>
      <button disabled={loading || !name.trim()}>创建分类</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {!loading && algorithms.length === 0 && <p>还没有算法分类，请先创建一个。</p>}
    <ul>{algorithms.map(algorithm => <li key={algorithm.id}>{algorithm.name}</li>)}</ul>
  </section>;
}
```

Extend this baseline with inline rename controls and the tested replacement dialog; use the same `try/catch`, awaited mutation, and awaited `reload()` sequence for every action.

- [ ] **Step 4: Route the data page to the manager and verify**

Replace the `/data` placeholder with `<AlgorithmManager />`. Run:

`npm test -- src/features/algorithms/AlgorithmManager.test.tsx src/app/App.test.tsx`

Expected: category lifecycle and application navigation tests pass.

- [ ] **Step 5: Commit category management**

```bash
git add src/features/algorithms src/app/App.tsx
git commit -m "feat: manage custom algorithm categories"
```

---

### Task 5: Record a Practice with Metadata Fallback

**Files:**
- Create: `src/features/practices/RecordPracticeDialog.tsx`
- Create: `src/features/practices/RecordPracticeDialog.test.tsx`
- Create: `src/features/practices/PracticeForm.tsx`
- Create: `src/shared/date.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `parseLeetCodeCnUrl`, `fetchProblemMetadata`, `DashboardRepository.recordPractice`, `useAlgorithms`.
- Produces: `RecordPracticeDialog({ open, onClose, onSaved })`; `localToday(): string`.

- [ ] **Step 1: Write failing happy-path and fallback tests**

```tsx
it('looks up a link and records a practice', async () => {
  const repository = fakeRepositoryWithAlgorithm('alg-1', '哈希表');
  server.use(http.get('/api/leetcode/problems/two-sum', () => HttpResponse.json(metadataFixture)));
  renderDialog(repository);
  await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
  await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
  expect(await screen.findByDisplayValue('两数之和')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('主要算法'), 'alg-1');
  await userEvent.click(screen.getByRole('button', { name: '保存练习' }));
  expect(repository.recordPractice).toHaveBeenCalledWith(expect.objectContaining({ practicedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), primaryAlgorithmId: 'alg-1' }));
});

it('keeps the link and opens manual fields after an upstream failure', async () => {
  server.use(http.get('/api/leetcode/problems/two-sum', () => HttpResponse.json({ code: 'UPSTREAM_TIMEOUT' }, { status: 502 })));
  renderDialog(fakeRepositoryWithAlgorithm('alg-1', '哈希表'));
  await userEvent.type(screen.getByLabelText('LeetCode 题目链接'), 'https://leetcode.cn/problems/two-sum/');
  await userEvent.click(screen.getByRole('button', { name: '读取题目信息' }));
  expect(await screen.findByText('自动读取失败，可以手动填写')).toBeInTheDocument();
  expect(screen.getByLabelText('中文题名')).toBeEnabled();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/features/practices/RecordPracticeDialog.test.tsx`

Expected: FAIL because the dialog is missing.

- [ ] **Step 3: Implement the three-stage dialog**

Use React Hook Form with a Zod schema requiring a normalized URL, metadata fields, `YYYY-MM-DD`, one primary algorithm, and distinct secondary algorithms. Keep form state when lookup or IndexedDB calls fail. Disable the submit button while saving; close only after `recordPractice` resolves.

```ts
export const practiceFormSchema = z.object({
  url: z.string().min(1), frontendQuestionId: z.string().min(1), titleZh: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']), practicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primaryAlgorithmId: z.string().min(1), secondaryAlgorithmIds: z.array(z.string())
}).superRefine((value, ctx) => {
  if (value.secondaryAlgorithmIds.includes(value.primaryAlgorithmId)) ctx.addIssue({ code: 'custom', path: ['secondaryAlgorithmIds'], message: '辅助算法不能与主要算法重复' });
});
```

If no categories exist, show a link to data management instead of a broken algorithm select.

- [ ] **Step 4: Wire the global action and verify**

Make the global “记录练习” button open the dialog. On success, dispatch a repository-change event or update an app-level revision counter so mounted pages reload.

Run: `npm test -- src/features/practices/RecordPracticeDialog.test.tsx src/app/App.test.tsx`

Expected: lookup, manual fallback, validation, save, and navigation tests pass.

- [ ] **Step 5: Commit practice recording**

```bash
git add src/features/practices src/shared/date.ts src/app/App.tsx tests/setup.ts
git commit -m "feat: record repeated LeetCode practices"
```

---

### Task 6: Algorithm Dashboard, Search, Filters, and History

**Files:**
- Create: `src/domain/dashboard.ts`
- Create: `src/domain/dashboard.test.ts`
- Create: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/dashboard/ActivityCalendar.tsx`
- Create: `src/features/problems/ProblemsPage.tsx`
- Create: `src/features/problems/ProblemDetails.tsx`
- Create: `src/features/problems/ProblemsPage.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: repository list methods and domain models.
- Produces: `buildDashboardSnapshot`; `filterProblems`; routes `/`, `/problems`, `/problems/:problemId`.

- [ ] **Step 1: Write failing pure aggregation tests**

```ts
it('counts dashboard cards by primary algorithm and calendar by practice date', () => {
  const snapshot = buildDashboardSnapshot({ algorithms, problems, practices });
  expect(snapshot.algorithmCards.find(card => card.algorithm.id === 'dp')).toMatchObject({ problemCount: 2, practiceCount: 3 });
  expect(snapshot.activityByDate['2026-07-12']).toBe(2);
});

it('matches secondary algorithms without changing primary dashboard counts', () => {
  expect(filterProblems(dataset, { secondaryAlgorithmId: 'binary-search' }).map(item => item.problem.id)).toEqual(['p2']);
  expect(buildDashboardSnapshot(dataset).algorithmCards.find(card => card.algorithm.id === 'binary-search')?.practiceCount).toBe(0);
});
```

- [ ] **Step 2: Run domain tests and verify failure**

Run: `npm test -- src/domain/dashboard.test.ts`

Expected: FAIL because aggregation functions are missing.

- [ ] **Step 3: Implement deterministic aggregation and filtering**

Define `DashboardDataset`, `ProblemListItem`, and `ProblemFilters`. Search uses trimmed, case-insensitive substring matching over title and exact/prefix matching over question ID. Multiple active filters combine with AND. Sort recent practices by `practicedOn`, then `createdAt`, descending.

```ts
export interface DashboardDataset { algorithms: Algorithm[]; problems: Problem[]; practices: Practice[] }
export interface ProblemListItem { problem: Problem; practices: Practice[] }
export interface ProblemFilters { query?: string; primaryAlgorithmId?: string; secondaryAlgorithmId?: string; difficulty?: Difficulty; from?: string; to?: string }
export interface DashboardSnapshot {
  algorithmCards: Array<{ algorithm: Algorithm; problemCount: number; practiceCount: number }>;
  activityByDate: Record<string, number>;
  recentPractices: Practice[];
}
const comparePracticeNewestFirst = (left: Practice, right: Practice) =>
  right.practicedOn.localeCompare(left.practicedOn) || right.createdAt.localeCompare(left.createdAt);

export function filterProblems(dataset: DashboardDataset, filters: ProblemFilters): ProblemListItem[] {
  const query = filters.query?.trim().toLocaleLowerCase('zh-CN');
  return dataset.problems.flatMap(problem => {
    const practices = dataset.practices.filter(practice => practice.problemId === problem.id);
    const visible = practices.filter(practice =>
      (!filters.primaryAlgorithmId || practice.primaryAlgorithmId === filters.primaryAlgorithmId) &&
      (!filters.secondaryAlgorithmId || practice.secondaryAlgorithmIds.includes(filters.secondaryAlgorithmId)) &&
      (!filters.from || practice.practicedOn >= filters.from) && (!filters.to || practice.practicedOn <= filters.to));
    const textMatch = !query || problem.titleZh.toLocaleLowerCase('zh-CN').includes(query) || problem.frontendQuestionId.startsWith(query);
    return textMatch && (!filters.difficulty || problem.difficulty === filters.difficulty) && visible.length
      ? [{ problem, practices: visible.sort(comparePracticeNewestFirst) }]
      : [];
  });
}

export function buildDashboardSnapshot(dataset: DashboardDataset): DashboardSnapshot {
  const algorithmCards = dataset.algorithms.map(algorithm => {
    const practices = dataset.practices.filter(practice => practice.primaryAlgorithmId === algorithm.id);
    return { algorithm, practiceCount: practices.length, problemCount: new Set(practices.map(practice => practice.problemId)).size };
  });
  const activityByDate = dataset.practices.reduce<Record<string, number>>((result, practice) => {
    result[practice.practicedOn] = (result[practice.practicedOn] ?? 0) + 1;
    return result;
  }, {});
  return { algorithmCards, activityByDate, recentPractices: [...dataset.practices].sort(comparePracticeNewestFirst).slice(0, 10) };
}
```

- [ ] **Step 4: Write failing page behavior test**

Test that clicking a dashboard algorithm card navigates to `/problems?primaryAlgorithmId=<id>`, that combined query/difficulty/date filters narrow the list, and that expanding a problem shows all practices newest first with primary and secondary labels.

- [ ] **Step 5: Implement the dashboard and records pages**

Load all three small local tables once per page revision, then run pure selectors in memory. Render an empty-state call to action, category cards, latest ten practices, a calendar heatmap with accessible date/count labels, URL-backed filters, and a problem detail route. Use semantic tables on wide screens and stacked cards below 768px.

- [ ] **Step 6: Verify and commit historical lookup**

Run: `npm test -- src/domain/dashboard.test.ts src/features/problems/ProblemsPage.test.tsx && npm run build`

Expected: pure selectors, navigation, combined filtering, history ordering, and production build all pass.

```bash
git add src/domain/dashboard* src/features/dashboard src/features/problems src/app/App.tsx
git commit -m "feat: browse algorithm and practice history"
```

---

### Task 7: Atomic JSON Export, Merge Import, and Data Reset

**Files:**
- Create: `src/domain/backup.ts`
- Create: `src/domain/backup.test.ts`
- Modify: `src/db/DashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.ts`
- Modify: `src/db/DexieDashboardRepository.test.ts`
- Create: `src/features/data-management/DataManagementPage.tsx`
- Create: `src/features/data-management/DataManagementPage.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: all domain entities and repository tables.
- Produces: `BackupV1`, `parseBackup`, `mergeBackup`, repository `exportBackup()` and `importBackup(backup)`; `DataManagementPage`.

- [ ] **Step 1: Write failing backup validation and remapping tests**

```ts
it('rejects a backup with a dangling practice reference', () => {
  expect(() => parseBackup({ schemaVersion: 1, exportedAt: new Date().toISOString(), problems: [], algorithms: [], practices: [{ ...practice, problemId: 'missing' }] })).toThrow('练习引用了不存在的题目');
});

it('maps imported problem and algorithm conflicts to local records', () => {
  const result = mergeBackup(localDataset, importedDatasetWithSameSlugAndAlgorithmName);
  expect(result.problems).toHaveLength(localDataset.problems.length);
  expect(result.practices.at(-1)).toMatchObject({ problemId: localProblem.id, primaryAlgorithmId: localAlgorithm.id });
});
```

- [ ] **Step 2: Run backup tests and verify failure**

Run: `npm test -- src/domain/backup.test.ts`

Expected: FAIL because backup functions are missing.

- [ ] **Step 3: Implement schema-versioned parsing and pure merge planning**

```ts
export const backupV1Schema = z.object({
  schemaVersion: z.literal(1), exportedAt: z.string().datetime(),
  problems: z.array(problemSchema), practices: z.array(practiceSchema), algorithms: z.array(algorithmSchema)
});
export type BackupV1 = z.infer<typeof backupV1Schema>;
export interface MergeResult extends BackupV1 { summary: { addedProblems: number; addedPractices: number; addedAlgorithms: number; skippedIds: string[] } }
```

After Zod parsing, validate unique IDs, unique normalized slugs/names, date strings, and every reference. `mergeBackup` preserves local IDs, maps same slugs and normalized algorithm names to local IDs, skips imported entity IDs already present locally, and throws before writing if remapping is unsafe.

- [ ] **Step 4: Implement repository export/import as one transaction**

`exportBackup` reads a consistent snapshot and returns `schemaVersion: 1`. `importBackup` computes the merge outside the transaction, then uses one `rw` transaction to bulk-add only the planned entities. `clearAll` clears practices, problems, and algorithms in one transaction in that order.

- [ ] **Step 5: Write and implement data-management UI tests**

Test browser download filename `lc-board-YYYY-MM-DD.json`, invalid-file error without repository writes, successful import summary, and clear-all requiring the exact confirmation text `清空全部数据`. Implement file size limit 10 MB and reset the file input after every attempt.

- [ ] **Step 6: Verify and commit backup safety**

Run: `npm test -- src/domain/backup.test.ts src/db/DexieDashboardRepository.test.ts src/features/data-management/DataManagementPage.test.tsx`

Expected: validation, collision remapping, atomic write, export download, import summary, and reset confirmation tests pass.

```bash
git add src/domain/backup* src/db src/features/data-management src/app/App.tsx
git commit -m "feat: add safe local data backup and reset"
```

---

### Task 8: End-to-End Acceptance, Failure States, and Release Documentation

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/dashboard.spec.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `README.md`
- Modify: `src/app/styles.css`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: complete application and proxy contracts.
- Produces: executable acceptance suite and local/deployment instructions.

- [ ] **Step 1: Write the failing end-to-end acceptance flow**

```ts
test('records repeated practices, filters history, and restores a backup', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await createAlgorithm(page, '双指针');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', primary: '哈希表', date: '2026-07-11' });
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', primary: '双指针', secondary: ['哈希表'], date: '2026-07-12' });
  await page.getByRole('link', { name: '题目记录' }).click();
  await expect(page.getByText('两数之和')).toBeVisible();
  await page.getByText('两数之和').click();
  await expect(page.getByTestId('practice-history').getByRole('listitem')).toHaveCount(2);
  const download = await exportBackup(page);
  await clearAllData(page, '清空全部数据');
  await importBackup(page, await download.path());
  await expect(page.getByText('两数之和')).toBeVisible();
});
```

Mock only `/api/leetcode/problems/two-sum` in Playwright routing; use the real browser IndexedDB.

- [ ] **Step 2: Run the E2E test and verify failure**

Run: `npx playwright install chromium && npm run test:e2e`

Expected: FAIL at the first missing or incorrectly labeled acceptance control.

- [ ] **Step 3: Close acceptance gaps and polish failure states**

Add visible loading states, focus restoration after dialogs, `role="alert"` for actionable failures, keyboard-operable dialogs, empty states, responsive tables/cards, and clear Chinese copy. Do not add new product features. Ensure upstream failure leaves manual metadata fields enabled and IndexedDB failure leaves the practice dialog populated.

- [ ] **Step 4: Document exact local and deployment operation**

Write `README.md` with:

```md
## Local development
npm install
npm run dev

## Verification
npm test
npm run test:e2e
npm run build

Personal data is stored in this browser's IndexedDB. Export a JSON backup before clearing browser site data. The Node API stores no practice data.
```

Document `PORT` for the API, the production `/api` routing requirement, metadata fallback behavior, JSON restore procedure, and the fact that `leetcode.cn`'s upstream contract may change.

- [ ] **Step 5: Run the full release gate**

Run: `npm test && npm run test:e2e && npm run build && git status --short`

Expected: all unit/component tests pass, the Chromium acceptance flow passes, Vite builds successfully, and only intentional plan/document changes are present. `1.md` remains untracked and unchanged.

- [ ] **Step 6: Commit the release-ready first version**

```bash
git add playwright.config.ts tests/e2e README.md src/app/styles.css .gitignore
git commit -m "test: verify LC Board first release"
```

---

## Final Verification Checklist

- [ ] `npm test` passes without network access.
- [ ] `npm run test:e2e` passes using a mocked metadata response and real IndexedDB.
- [ ] `npm run build` produces the SPA without TypeScript errors.
- [ ] A real manual lookup against `leetcode.cn` either succeeds or cleanly exposes manual entry.
- [ ] Refreshing and reopening the browser preserves algorithms, problems, and practices.
- [ ] Export → clear → import restores all three entity types and practice relationships.
- [ ] Combined query, algorithm, difficulty, and date filters return deterministic results.
- [ ] No server module imports the local IndexedDB repository.
- [ ] No personal data is sent to the metadata proxy.
- [ ] `1.md` is unchanged and remains outside Git.
