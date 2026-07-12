import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  auditOutcome,
  chmodBestEffort,
  health,
  main,
  parsePayload,
  publicPathSummary,
  shouldCompact,
  writeAuditRecord,
} from '../../nova-plugin/hooks/scripts/post-audit-log.mjs';

test('audit helpers cover malformed input, outcomes, paths, thresholds, and best-effort failures', () => {
  assert.deepEqual(parsePayload('{'), {});
  assert.deepEqual(parsePayload('{"ok":true}'), { ok: true });
  assert.equal(auditOutcome({ hook_event_name: 'PostToolUseFailure' }, {}), 'failed');
  assert.equal(auditOutcome({ hook_event_name: 'PermissionDenied' }, {}), 'denied');
  assert.equal(auditOutcome({}, { success: true }), 'success');
  assert.equal(auditOutcome({}, { success: false }), 'failed');
  assert.equal(auditOutcome({}, {}), 'unknown');
  assert.equal(publicPathSummary('', {}), '');
  assert.equal(publicPathSummary('src/a.js', { cwd: '/workspace' }), 'src/a.js');
  assert.match(publicPathSummary('/outside/a.js', { cwd: '/workspace' }), /^external-path:/u);
  assert.equal(shouldCompact(49, 0), false);
  assert.equal(shouldCompact(50, 0), true);
  assert.equal(shouldCompact(1, 1024 * 1024), true);
  assert.doesNotThrow(() => chmodBestEffort('/missing', 0o600, () => { throw new Error('unsupported'); }));
  assert.doesNotThrow(() => health('/missing', 'failure', () => { throw new Error('unwritable'); }));
  assert.equal(main('', { NOVA_AUDIT_DISABLED: '1' }), 0);
});

test('audit threshold launches detached compaction and records spawn degradation', (t) => {
  const root = mkdtempSync(resolve(tmpdir(), 'nova-audit-threshold-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const spool = resolve(root, 'audit-spool');
  mkdirSync(spool, { recursive: true });
  for (let index = 0; index < 49; index += 1) writeFileSync(resolve(spool, `${index}.json`), '{}\n');
  const child = new EventEmitter();
  let unrefCalled = false;
  child.unref = () => { unrefCalled = true; };
  const result = writeAuditRecord({ tool_name: 'Bash', tool_input: { command: 'git status' }, tool_response: { success: true } }, {
    env: { CLAUDE_PLUGIN_DATA: root },
    spawnProcess(command, args, options) {
      assert.equal(command, process.execPath);
      assert.match(args[0], /audit-compactor\.mjs$/u);
      assert.equal(options.shell, false);
      return child;
    },
  });
  assert.equal(result.record.outcome, 'success');
  assert.equal(unrefCalled, true);
  child.emit('error', new Error('spawn failed'));
  assert.match(readFileSync(resolve(root, 'audit-health.log'), 'utf8'), /spawn failed/u);
});
