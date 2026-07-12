const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INVALID_URL_MESSAGE = '请输入 leetcode.cn 题目链接';

export function parseLeetCodeCnUrl(value: string): { slug: string; url: string } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(INVALID_URL_MESSAGE);
  }

  const match = url.pathname.match(/^\/problems\/([^/]+)(?:\/|$)/);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'leetcode.cn' ||
    !match ||
    !SLUG.test(match[1])
  ) {
    throw new Error(INVALID_URL_MESSAGE);
  }

  return {
    slug: match[1],
    url: `https://leetcode.cn/problems/${match[1]}/`,
  };
}
