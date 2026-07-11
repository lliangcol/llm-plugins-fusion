import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSemVer, requireSemVer } from '../../scripts/lib/semver.mjs';

test('SemVer parser accepts stable, prerelease, and build versions', () => {
  assert.deepEqual(parseSemVer('2.4.0'), {
    version: '2.4.0', major: '2', minor: '4', patch: '0', prerelease: null, build: null, isPrerelease: false,
  });
  assert.equal(parseSemVer('2.4.0-rc.1')?.isPrerelease, true);
  assert.equal(parseSemVer('2.4.0-alpha.beta.1+build-7.sha')?.build, 'build-7.sha');
  assert.equal(parseSemVer('2.4.0+build-7')?.isPrerelease, false);
  assert.equal(
    parseSemVer('900719925474099312345.0.0')?.major,
    '900719925474099312345',
  );
});

test('SemVer parser rejects invalid or unsafe versions', () => {
  for (const value of [
    '01.2.3', '1.02.3', '1.2.03', '1.2', '1.2.3-', '1.2.3-01', '1.2.3+build..1',
    '1.2.3";printf${IFS}INJECTED;#', 'v1.2.3', '', null,
  ]) {
    assert.equal(parseSemVer(value), null, String(value));
  }
  assert.throws(() => requireSemVer('1.2.3-01'), /valid SemVer/);
});
