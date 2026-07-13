import { expect, test } from '@playwright/test';
import { clearAllData, createAlgorithm, exportBackup, importBackup, recordProblem } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/leetcode/problems/two-sum', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy', url: 'https://leetcode.cn/problems/two-sum/' }),
  }));
});

test('records repeated practices, filters history, and restores a backup', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await createAlgorithm(page, '双指针');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', primary: '哈希表', date: '2026-07-11' });
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', primary: '双指针', secondary: ['哈希表'], date: '2026-07-12' });
  await page.getByRole('link', { name: '题目记录' }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await page.getByLabel('搜索').fill('两数');
  await page.getByLabel('难度').selectOption('easy');
  await page.getByLabel('开始日期').fill('2026-07-11');
  await page.getByLabel('结束日期').fill('2026-07-12');
  await page.getByRole('button', { name: '查看练习记录' }).click();
  await expect(page.getByTestId('practice-history').getByRole('listitem')).toHaveCount(2);
  const download = await exportBackup(page);
  const path = await download.path();
  expect(path).toBeTruthy();
  await clearAllData(page, '清空全部数据');
  await importBackup(page, path!);
  await page.getByRole('link', { name: '题目记录' }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
  await page.getByRole('button', { name: '查看练习记录' }).click();
  await expect(page.getByTestId('practice-history').getByRole('listitem')).toHaveCount(2);
});

test('keeps data after a reload', async ({ page }) => {
  await page.goto('/');
  await createAlgorithm(page, '哈希表');
  await recordProblem(page, { url: 'https://leetcode.cn/problems/two-sum/', primary: '哈希表', date: '2026-07-12' });
  await page.reload();
  await page.getByRole('link', { name: '题目记录' }).click();
  await expect(page.getByRole('heading', { name: '两数之和' })).toBeVisible();
});
