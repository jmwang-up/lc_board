import { expect, it } from 'vitest';
import { readServerConfig } from './config';

it('uses deployable production defaults', () => {
  expect(readServerConfig({})).toEqual({ host: '0.0.0.0', port: 8787 });
});

it('accepts configured HOST and PORT', () => {
  expect(readServerConfig({ HOST: '127.0.0.1', PORT: '9000' })).toEqual({ host: '127.0.0.1', port: 9000 });
});

it.each(['0', '-1', '65536', 'not-a-port'])('rejects invalid PORT %s', value => {
  expect(() => readServerConfig({ PORT: value })).toThrow('PORT must be an integer between 1 and 65535');
});
