import assert from 'node:assert/strict';
import fs, {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  createPhysicalReadBoundary,
  readPhysicalDirectory,
  readPhysicalFile,
} from '../../scripts/lib/physical-read-boundary.mjs';

function fixture(t, name) {
  const root = mkdtempSync(resolve(tmpdir(), name));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('physical file reads reject same-inode content changes during the read', (t) => {
  const root = fixture(t, 'nova-physical-file-change-');
  const target = resolve(root, 'target.txt');
  writeFileSync(target, 'before\n');
  const boundary = createPhysicalReadBoundary(root, 'fixture root');
  const originalReadFileSync = fs.readFileSync;
  let changed = false;
  try {
    fs.readFileSync = function injectedRead(path, ...args) {
      const result = originalReadFileSync.call(this, path, ...args);
      if (!changed && typeof path === 'number') {
        changed = true;
        writeFileSync(target, 'after!\n');
        utimesSync(target, new Date(1_000), new Date(1_000));
      }
      return result;
    };
    syncBuiltinESMExports();
    assert.throws(() => readPhysicalFile(boundary, target, 'fixture file'), /changed identity or metadata/u);
    assert.equal(changed, true);
  } finally {
    fs.readFileSync = originalReadFileSync;
    syncBuiltinESMExports();
  }
});

test('physical file reads reject a transient boundary-root replacement restored before return', (t) => {
  const base = fixture(t, 'nova-physical-root-replacement-');
  const root = resolve(base, 'root');
  const moved = resolve(base, 'root-moved');
  const replacement = resolve(base, 'root-replacement');
  mkdirSync(root);
  writeFileSync(resolve(root, 'target.txt'), 'original\n');
  const boundary = createPhysicalReadBoundary(root, 'fixture root');
  const originalLstatSync = fs.lstatSync;
  let rootReads = 0;
  try {
    fs.lstatSync = function injectedLstat(path, ...args) {
      if (resolve(String(path)) === root) {
        rootReads += 1;
        if (rootReads === 1) {
          const status = originalLstatSync.call(this, path, ...args);
          renameSync(root, moved);
          mkdirSync(root);
          writeFileSync(resolve(root, 'target.txt'), 'replacement\n');
          return status;
        }
        if (rootReads === 2) {
          renameSync(root, replacement);
          renameSync(moved, root);
        }
      }
      return originalLstatSync.call(this, path, ...args);
    };
    syncBuiltinESMExports();
    assert.throws(
      () => readPhysicalFile(boundary, resolve(root, 'target.txt'), 'fixture file'),
      /changed identity|read lease/u,
    );
    assert.equal(rootReads >= 2, true);
  } finally {
    fs.lstatSync = originalLstatSync;
    syncBuiltinESMExports();
  }
});

test('physical directory reads reject member changes during enumeration', (t) => {
  const root = fixture(t, 'nova-physical-directory-change-');
  const target = resolve(root, 'directory');
  mkdirSync(target);
  writeFileSync(resolve(target, 'before.txt'), 'before\n');
  const boundary = createPhysicalReadBoundary(root, 'fixture root');
  const originalReaddirSync = fs.readdirSync;
  let changed = false;
  try {
    fs.readdirSync = function injectedRead(path, ...args) {
      const result = originalReaddirSync.call(this, path, ...args);
      if (!changed && resolve(String(path)) === target) {
        changed = true;
        writeFileSync(resolve(target, 'appeared.txt'), 'appeared\n');
      }
      return result;
    };
    syncBuiltinESMExports();
    assert.throws(() => readPhysicalDirectory(boundary, target, 'fixture directory'), /changed identity or metadata/u);
    assert.equal(changed, true);
  } finally {
    fs.readdirSync = originalReaddirSync;
    syncBuiltinESMExports();
  }
});

test('physical directory reads reject inconsistent repeated enumerations', (t) => {
  const root = fixture(t, 'nova-physical-directory-enumeration-');
  const target = resolve(root, 'directory');
  mkdirSync(target);
  writeFileSync(resolve(target, 'present.txt'), 'present\n');
  const boundary = createPhysicalReadBoundary(root, 'fixture root');
  const originalReaddirSync = fs.readdirSync;
  let reads = 0;
  try {
    fs.readdirSync = function injectedRead(path, ...args) {
      const result = originalReaddirSync.call(this, path, ...args);
      if (resolve(String(path)) !== target) return result;
      reads += 1;
      return reads === 1 ? [] : result;
    };
    syncBuiltinESMExports();
    assert.throws(() => readPhysicalDirectory(boundary, target, 'fixture directory'), /changed identity, metadata, or contents/u);
    assert.equal(reads, 2);
  } finally {
    fs.readdirSync = originalReaddirSync;
    syncBuiltinESMExports();
  }
});
