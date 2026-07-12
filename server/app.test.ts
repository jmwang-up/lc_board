import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

it('returns normalized metadata for a valid slug', async () => {
  const lookup = vi.fn().mockResolvedValue({
    slug: 'two-sum',
    frontendQuestionId: '1',
    titleZh: '两数之和',
    difficulty: 'easy',
    url: 'https://leetcode.cn/problems/two-sum/',
  });
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
