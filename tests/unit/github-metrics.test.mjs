import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectMetrics,
  githubRequest,
  parseArgs,
  parseLinkCount,
} from '../../scripts/collect-github-metrics.mjs';

test('GitHub metrics argument and pagination parsing is deterministic', () => {
  assert.equal(parseArgs(['--owner', 'o', '--repo', 'r']).owner, 'o');
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(() => parseArgs(['--owner', '--repo']), /requires a value/);
  assert.equal(parseLinkCount('<https://api.github.com/x?page=7>; rel="last"', 1), 7);
  assert.equal(parseLinkCount('', 3), 3);
});

test('GitHub requests use the injected fetch boundary', async () => {
  const calls = [];
  const result = await githubRequest('https://api.github.com/example', {
    token: 'test-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('{"ok":true}', { status: 200 });
    },
  });
  assert.deepEqual(result.body, { ok: true });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
});

test('GitHub metrics help avoids network access', async () => {
  const result = await collectMetrics({
    argv: ['--help'],
    fetchImpl: async () => { throw new Error('must not run'); },
  });
  assert.equal(result.help, true);
});
