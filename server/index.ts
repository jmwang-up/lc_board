import { createApp } from './app.js';
import { readServerConfig } from './config.js';
import { lookupProblemMetadata } from './leetcodeClient.js';

const { host, port } = readServerConfig(process.env);

createApp({ lookup: lookupProblemMetadata }).listen(port, host, () => {
  console.log(`LeetCode metadata proxy listening on http://${host}:${port}`);
});
