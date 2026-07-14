import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { checkOrWrite as checkCommandDocs } from '../../scripts/generate-command-docs.mjs';
import { checkOrWrite as checkDocGovernance, outputs } from '../../scripts/generate-doc-governance.mjs';

const root = resolve(import.meta.dirname, '../..');

test('all command docs and navigation are generated from workflow documentation metadata', () => {
  assert.deepEqual(checkCommandDocs(), { documents: 63, navigation: 2 });
  const matrix = readFileSync(resolve(root, 'docs/generated/command-matrix.md'), 'utf8');
  assert.match(matrix, /Generated from workflow and documentation metadata/u);
  assert.equal((matrix.match(/^\| `[a-z]/gmu) ?? []).length, 21);
});

test('document governance resolves metadata and a migration disposition for every docs file', () => {
  checkDocGovernance();
  assert.deepEqual([...outputs().entries()], [...outputs().entries()]);
  const metadata = JSON.parse(readFileSync(resolve(root, 'docs/generated/doc-metadata-resolved.json'), 'utf8'));
  assert.ok(metadata.documents.every((entry) => entry.audience && entry.contentType && entry.status && entry.ownerSource && entry.sourceOfTruth));
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/generated/migration-manifest.json'), 'utf8'));
  assert.ok(manifest.files.length > 90);
  assert.ok(manifest.files.every((entry) => entry.target && entry.disposition));
});
