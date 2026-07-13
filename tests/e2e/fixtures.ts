import { expect, type Download, type Page } from '@playwright/test';

export async function createAlgorithm(page: Page, name: string) {
  await page.getByRole('link', { name: '数据管理' }).click();
  await page.getByLabel('算法名称').fill(name);
  await page.getByRole('button', { name: '创建分类' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

export async function recordProblem(page: Page, input: { url: string; title: string; primary: string; secondary?: string[]; date: string }) {
  await page.getByTestId('record-practice').click();
  const dialog = page.getByRole('dialog', { name: '记录练习' });
  await dialog.getByLabel('LeetCode 题目链接').fill(input.url);
  await dialog.getByRole('button', { name: '读取题目信息' }).click();
  await expect(dialog.getByLabel('中文题名')).toHaveValue(input.title);
  await dialog.getByLabel('练习日期').fill(input.date);
  await dialog.getByLabel('主要算法').selectOption({ label: input.primary });
  for (const name of input.secondary ?? []) await dialog.getByRole('checkbox', { name }).check();
  await dialog.getByRole('button', { name: '保存练习' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('record-practice')).toBeFocused();
}

export async function exportBackup(page: Page): Promise<Download> {
  await page.getByRole('link', { name: '数据管理' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出数据' }).click();
  return pending;
}

export async function clearAllData(page: Page, confirmation: string) {
  await page.getByLabel('确认文字').fill(confirmation);
  await page.getByRole('button', { name: confirmation }).click();
  await expect(page.getByRole('status')).toHaveText('全部本地数据已清空');
}

export async function importBackup(page: Page, path: string) {
  await page.getByLabel('选择备份文件').setInputFiles(path);
  await expect(page.getByRole('status')).toHaveText('导入成功：新增 2 道题目、3 条练习、2 个算法');
}
