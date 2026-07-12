import { describe, expect, it } from 'vitest';
import { parseLeetCodeCnUrl } from './leetcode';

describe('parseLeetCodeCnUrl', () => {
  it('normalizes a supported problem URL', () => {
    expect(parseLeetCodeCnUrl('https://leetcode.cn/problems/two-sum/description/')).toEqual({
      slug: 'two-sum',
      url: 'https://leetcode.cn/problems/two-sum/',
    });
  });

  it.each([
    'https://leetcode.com/problems/two-sum/',
    'https://leetcode.cn/contest/',
    'notaurl',
  ])('rejects %s', (value) => {
    expect(() => parseLeetCodeCnUrl(value)).toThrow('请输入 leetcode.cn 题目链接');
  });
});
