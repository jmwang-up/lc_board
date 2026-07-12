import express from 'express';
import type { ProblemMetadata } from '../src/domain/models';
import { LeetCodeLookupError } from './leetcodeClient';

type Lookup = (slug: string, signal: AbortSignal) => Promise<ProblemMetadata>;

export function createApp({ lookup }: { lookup: Lookup }) {
  const app = express();

  app.get('/api/leetcode/problems/:slug', async (req, res) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.slug)) {
      return res.status(400).json({ code: 'INVALID_SLUG' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      return res.json(await lookup(req.params.slug, controller.signal));
    } catch (error) {
      if (error instanceof LeetCodeLookupError && error.code === 'NOT_FOUND') {
        return res.status(404).json({ code: 'NOT_FOUND' });
      }
      const code = error instanceof Error && error.name === 'AbortError'
        ? 'UPSTREAM_TIMEOUT'
        : 'UPSTREAM_CHANGED';
      return res.status(502).json({ code });
    } finally {
      clearTimeout(timer);
    }
  });

  return app;
}
