import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { clearAllData, createAlgorithm, exportBackup, importBackup, recordProblem } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/leetcode/problems/two-sum', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }),
  }));
  await page.route('**/api/leetcode/problems/three-sum', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ slug: 'three-sum', frontendQuestionId: '15', titleZh: '三数之和', difficulty: 'medium', url: 'https://leetcode.cn/problems/three-sum/' }),
  }));
});

test('records repeated practices, filters history, and restores a backup', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await createAlgorithm(page, '双指针');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', title: '两数之和', primary: '哈希表', date: '2026-07-11' });
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', title: '两数之和', primary: '双指针', secondary: ['哈希表'], date: '2026-07-12' });
  await recordProblem(page, { url: 'https://leetcode.cn/problems/three-sum/', title: '三数之和', primary: '哈希表', secondary: ['双指针'], date: '2026-07-13' });
  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeVisible();

  await page.getByLabel('搜索').fill('两数');
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeHidden();
  await page.getByLabel('搜索').fill('');

  await page.getByLabel('主算法').selectOption({ label: '双指针' });
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeHidden();
  await page.getByLabel('主算法').selectOption('');

  await page.getByLabel('辅助算法').selectOption({ label: '哈希表' });
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeHidden();
  await page.getByLabel('辅助算法').selectOption('');

  await page.getByLabel('难度').selectOption('easy');
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeHidden();
  await page.getByLabel('难度').selectOption('');

  await page.getByLabel('开始日期').fill('2026-07-11');
  await page.getByLabel('结束日期').fill('2026-07-12');
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeHidden();
  await page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) }).getByRole('button', { name: '查看练习记录' }).click();
  await expect(page.getByTestId('practice-history').getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('开始日期').fill('');
  await page.getByLabel('结束日期').fill('');

  const download = await exportBackup(page);
  const path = await download.path();
  expect(path).toBeTruthy();
  await clearAllData(page, '清空全部数据');

  await page.getByRole('link', { name: '算法看板' }).click();
  await expect(page.getByRole('heading', { name: '开始记录第一次练习' })).toBeVisible();
  await expect(page.getByText('暂无练习。')).toBeVisible();
  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '没有匹配的题目' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeHidden();
  await page.getByRole('link', { name: '数据管理' }).click();
  await expect(page.getByRole('heading', { name: '数据管理', exact: true })).toBeVisible();
  await expect(page.getByText('还没有算法分类，请先创建一个。')).toBeVisible();
  await expect(page.getByRole('main').getByText('哈希表', { exact: true })).toBeHidden();

  await importBackup(page, path!);
  await page.getByRole('link', { name: '算法看板' }).click();
  await expect(page.getByRole('heading', { name: '算法看板', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '数据管理' }).click();
  await expect(page.getByRole('heading', { name: '数据管理', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('哈希表', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('双指针', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '三数之和' })).toBeVisible();
  await page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) }).getByRole('button', { name: '查看练习记录' }).click();
  const history = page.getByTestId('practice-history');
  await expect(history.getByRole('listitem')).toHaveCount(2);
  const firstPractice = history.getByRole('listitem').filter({ hasText: '2026-07-11' });
  await expect(firstPractice.getByText('主：哈希表', { exact: true })).toBeVisible();
  const secondPractice = history.getByRole('listitem').filter({ hasText: '2026-07-12' });
  await expect(secondPractice.getByText('主：双指针', { exact: true })).toBeVisible();
  await expect(secondPractice.getByText('辅：哈希表', { exact: true })).toBeVisible();
});

test('keeps data after a reload', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', title: '两数之和', primary: '哈希表', date: '2026-07-12' });
  await page.reload();
  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
});

test('retains an edited Markdown solution through reload and backup restore', async ({ page }) => {
  const initialMarkdown = '## 核心思路\n\n- 使用哈希表记录补数\n\n```ts\nconst seen = new Map<number, number>();\n```';
  const editedMarkdown = '## 新思路\n\n使用双指针';

  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await page.getByTestId('record-practice').click();
  const dialog = page.getByRole('dialog', { name: '记录练习' });
  await dialog.getByLabel('LeetCode 题目链接').fill('https://leetcode.cn/problems/two-sum/');
  await dialog.getByRole('button', { name: '读取题目信息' }).click();
  await expect(dialog.getByLabel('中文题名')).toHaveValue('两数之和');
  await dialog.getByLabel('练习日期').fill('2026-07-14');
  await dialog.getByLabel('主要算法').selectOption({ label: '哈希表' });
  await dialog.getByRole('textbox', { name: '解题思路' }).fill(initialMarkdown);
  await dialog.getByRole('button', { name: '保存练习' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) });
  await row.getByRole('button', { name: '查看练习记录' }).click();
  let history = row.getByTestId('practice-history');
  let practice = history.getByRole('listitem').filter({ hasText: '2026-07-14' });
  await expect(practice.getByRole('heading', { name: '核心思路' })).toBeVisible();
  await expect(practice.getByRole('listitem').filter({ hasText: '使用哈希表记录补数' })).toBeVisible();
  await expect(practice.locator('pre code')).toHaveText('const seen = new Map<number, number>();');

  await practice.getByRole('button', { name: '编辑思路' }).click();
  const editDialog = page.getByRole('dialog', { name: '编辑解题思路' });
  await editDialog.getByRole('textbox', { name: '解题思路' }).fill(editedMarkdown);
  await editDialog.getByRole('button', { name: '保存思路' }).click();
  await expect(editDialog).toBeHidden();
  await page.reload();
  const reloadedRow = page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) });
  await reloadedRow.getByRole('button', { name: '查看练习记录' }).click();
  history = reloadedRow.getByTestId('practice-history');
  practice = history.getByRole('listitem').filter({ hasText: '2026-07-14' });
  await expect(practice.getByRole('heading', { name: '新思路' })).toBeVisible();
  await expect(practice.getByText('使用双指针', { exact: true })).toBeVisible();
  await expect(practice.getByRole('heading', { name: '核心思路' })).toHaveCount(0);

  const download = await exportBackup(page);
  const path = await download.path();
  expect(path).toBeTruthy();
  const backup = JSON.parse(await readFile(path!, 'utf8')) as { schemaVersion: number; practices: Array<{ practicedOn: string; solutionMarkdown: string }> };
  expect(backup.schemaVersion).toBe(2);
  expect(backup.practices.find(entry => entry.practicedOn === '2026-07-14')?.solutionMarkdown).toBe(editedMarkdown);

  await clearAllData(page, '清空全部数据');
  await importBackup(page, path!, { problems: 1, practices: 1, algorithms: 1 });
  await page.getByRole('link', { name: '题目记录', exact: true }).click();
  const restoredRow = page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) });
  await restoredRow.getByRole('button', { name: '查看练习记录' }).click();
  practice = restoredRow.getByTestId('practice-history').getByRole('listitem').filter({ hasText: '2026-07-14' });
  await expect(practice.getByRole('heading', { name: '新思路' })).toBeVisible();
  await expect(practice.getByText('使用双指针', { exact: true })).toBeVisible();
});

test('opens exact-date history from the calendar and confirms practice and problem deletion', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', title: '两数之和', primary: '哈希表', date: '2026-07-12' });
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', title: '两数之和', primary: '哈希表', date: '2026-07-12' });
  await page.getByRole('link', { name: '算法看板' }).click();
  await page.getByRole('link', { name: '2026-07-12：2 次练习' }).click();
  await expect(page).toHaveURL(/\/problems\?from=2026-07-12&to=2026-07-12$/);
  const row = page.getByRole('row').filter({ has: page.getByRole('heading', { name: '两数之和' }) });
  await row.getByRole('button', { name: '查看练习记录' }).click();
  const history = row.getByTestId('practice-history');
  await history.getByRole('button', { name: '删除 2026-07-12 的练习' }).first().click();
  let dialog = page.getByRole('dialog', { name: '删除练习' });
  await dialog.getByRole('checkbox', { name: '我确认删除这条练习' }).check();
  await dialog.getByRole('button', { name: '确认删除练习' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(1);

  await row.getByRole('button', { name: '删除题目两数之和' }).click();
  dialog = page.getByRole('dialog', { name: '删除题目两数之和' });
  await expect(dialog.getByText('将同时永久删除 1 条练习')).toBeVisible();
  await dialog.getByRole('checkbox', { name: '我确认删除两数之和及 1 条练习' }).check();
  await dialog.getByRole('button', { name: '确认删除题目及 1 条练习' }).click();
  await expect(page.getByRole('heading', { name: '没有匹配的题目' })).toBeVisible();
});
