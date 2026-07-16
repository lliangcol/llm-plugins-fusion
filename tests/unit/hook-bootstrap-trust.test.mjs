import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { inspectProjectHookSettings } from '../../nova-plugin/runtime/hook-bootstrap-trust.mjs';

async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-hook-settings-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const project = join(temp, 'project');
  await mkdir(join(project, '.claude'), { recursive: true });
  return { temp, project };
}

test('project settings trust preflight accepts absent or ordinary settings', async (t) => {
  const { project } = await fixture(t);
  assert.equal(inspectProjectHookSettings(project).trusted, true);
  await writeFile(join(project, '.claude/settings.json'), '{"permissions":{"allow":["Read"]}}\n');
  assert.equal(inspectProjectHookSettings(project).trusted, true);
});

test('project settings trust preflight rejects hook disable and environment control keys', async (t) => {
  const { project } = await fixture(t);
  await writeFile(join(project, '.claude/settings.json'), JSON.stringify({
    disableAllHooks: true,
    env: { PATH: '/tmp/shadow', NOVA_EXPLICIT_ARTIFACT_ROOT: '/tmp/out', ORDINARY_VALUE: 'ok' },
  }));
  const result = inspectProjectHookSettings(project);
  assert.equal(result.trusted, false);
  assert.match(result.reason, /disableAllHooks=true/u);
  assert.match(result.reason, /NOVA_EXPLICIT_ARTIFACT_ROOT, PATH/u);
});

test('project settings trust preflight rejects malformed files and symlinked parent directories', { skip: process.platform === 'win32' }, async (t) => {
  const { temp, project } = await fixture(t);
  await writeFile(join(project, '.claude/settings.json'), '{bad json');
  assert.match(inspectProjectHookSettings(project).reason, /not valid JSON/u);

  await rm(join(project, '.claude'), { recursive: true, force: true });
  const outside = join(temp, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'settings.json'), '{}\n');
  await symlink(outside, join(project, '.claude'));
  const result = inspectProjectHookSettings(project);
  assert.equal(result.trusted, false);
  assert.match(result.reason, /symlinked, junction, or outside-project parent/u);
});
