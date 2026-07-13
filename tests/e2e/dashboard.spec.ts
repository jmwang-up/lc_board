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
