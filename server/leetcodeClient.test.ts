import { afterEach, expect, it, vi } from 'vitest';
import { lookupProblemMetadata } from './leetcodeClient';

const signal = new AbortController().signal;
const question = {
  questionFrontendId: '1',
  translatedTitle: '两数之和',
  difficulty: 'Easy',
  titleSlug: 'two-sum',
};

afterEach(() => vi.restoreAllMocks());

it('posts the GraphQL contract and parses normalized metadata', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { question } }), { status: 200 }));

  await expect(lookupProblemMetadata('two-sum', signal)).resolves.toEqual({
    slug: 'two-sum', frontendQuestionId: '1', titleZh: '两数之和', difficulty: 'easy',
    url: 'https://leetcode.cn/problems/two-sum/',
  });

  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://leetcode.cn/graphql/');
  expect(init).toMatchObject({ method: 'POST', signal, headers: { 'content-type': 'application/json', referer: 'https://leetcode.cn/problems/two-sum/' } });
  expect(JSON.parse(String(init?.body))).toMatchObject({ operationName: 'questionData', variables: { titleSlug: 'two-sum' } });
  expect(JSON.parse(String(init?.body)).query).toContain('question(titleSlug: $titleSlug)');
});

it('maps a null upstream question to NOT_FOUND', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { question: null } }), { status: 200 }));
  await expect(lookupProblemMetadata('missing', signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

it('maps a returned slug mismatch to UPSTREAM_CHANGED', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { question: { ...question, titleSlug: 'other' } } }), { status: 200 }));
  await expect(lookupProblemMetadata('two-sum', signal)).rejects.toMatchObject({ code: 'UPSTREAM_CHANGED' });
});

it.each([
  ['malformed data', new Response(JSON.stringify({ data: {} }), { status: 200 })],
  ['invalid JSON', new Response('not-json', { status: 200 })],
  ['failed response', new Response('', { status: 503 })],
])('maps %s to UPSTREAM_CHANGED', async (_name, response) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  await expect(lookupProblemMetadata('two-sum', signal)).rejects.toMatchObject({ code: 'UPSTREAM_CHANGED' });
});

it('maps a network failure to UPSTREAM_CHANGED', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network failed'));
  await expect(lookupProblemMetadata('two-sum', signal)).rejects.toMatchObject({ code: 'UPSTREAM_CHANGED' });
});
