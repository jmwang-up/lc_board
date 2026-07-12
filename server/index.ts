import { createApp } from './app';
import { lookupProblemMetadata } from './leetcodeClient';

const port = 8787;

createApp({ lookup: lookupProblemMetadata }).listen(port, '127.0.0.1', () => {
  console.log(`LeetCode metadata proxy listening on http://localhost:${port}`);
});
