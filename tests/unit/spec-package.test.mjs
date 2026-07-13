import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import test from 'node:test';
import * as compilerApi from '@llm-plugins-fusion/compiler';
import * as specApi from '@llm-plugins-fusion/spec';
import { SPEC_ERROR, SpecBundleError, readJson, validateAndLoadSpecBundle } from '@llm-plugins-fusion/spec';

const fixture = resolve(import.meta.dirname, '../../fixtures/products/minimal-plugin');
const accept = () => true;

test('filesystem package APIs validate by default and expose unchecked boundaries explicitly', () => {
  assert.equal(typeof specApi.loadSpecBundle, 'function');
  assert.equal(typeof specApi.loadSpecBundleUnchecked, 'function');
  assert.equal(typeof compilerApi.compileDirectory, 'function');
  assert.equal(typeof compilerApi.compileDirectoryUnchecked, 'function');
  assert.equal(compilerApi.compileValidatedDirectory, compilerApi.compileDirectory);
  assert.throws(
    () => compilerApi.compileDirectory(fixture),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.CONFIGURATION,
  );
  assert.equal(compilerApi.compileDirectory(fixture, { validateSchema: accept }).runtimeContracts.length, 3);
});

test('validated spec loading separates layout schema and invariant failures', () => {
  const bundle = validateAndLoadSpecBundle(fixture, { validateSchema: accept });
  assert.equal(bundle.workflows.workflows.length, 3);

  assert.throws(
    () => validateAndLoadSpecBundle(resolve(fixture, 'missing'), { validateSchema: accept }),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.LAYOUT && error.domain === 'layout',
  );
  assert.throws(
    () => validateAndLoadSpecBundle(fixture, { validateSchema: (_value, domain) => domain === 'product' ? ['invalid product'] : [] }),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.SCHEMA && error.domain === 'product' && error.details[0] === 'invalid product',
  );

  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(path, 'utf8'));
    workflows.workflows[1].id = workflows.workflows[0].id;
    writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.INVARIANT && /duplicate workflow ids/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading requires an explicit schema validator and wraps validator exceptions', () => {
  assert.throws(
    () => validateAndLoadSpecBundle(fixture),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.CONFIGURATION,
  );
  assert.throws(
    () => validateAndLoadSpecBundle(fixture, { validateSchema: () => { throw new Error('validator unavailable'); } }),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.SCHEMA && error.cause?.message === 'validator unavailable',
  );
  assert.throws(
    () => validateAndLoadSpecBundle(fixture, { validateSchema: () => ({ valid: false, errors: [] }) }),
    (error) => error instanceof SpecBundleError
      && error.code === SPEC_ERROR.SCHEMA
      && error.details[0] === 'validator returned valid=false',
  );
});

test('validated spec loading classifies malformed product schema before adapter layout', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-schema-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'product.json');
    const product = JSON.parse(readFileSync(path, 'utf8'));
    product.adapterDefinitions = 'not-an-array';
    writeFileSync(path, `${JSON.stringify(product, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, {
        validateSchema: (_value, domain) => domain === 'product' ? ['adapterDefinitions must be an array'] : [],
      }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.SCHEMA
        && error.domain === 'product'
        && error.details[0] === 'adapterDefinitions must be an array',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading rejects duplicate and orphan behavior identities', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-invariants-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'behaviors.json');
    const behaviors = JSON.parse(readFileSync(path, 'utf8'));
    behaviors.behaviors.push(behaviors.behaviors[0], { ...behaviors.behaviors[0], id: 'orphan' });
    writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /duplicate behavior ids: triage/u.test(error.details.join('\n'))
        && /behaviors without workflows: orphan/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading rejects cross-domain workflow drift', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-cross-domain-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(path, 'utf8'));
    workflows.workflows[0].requiredInputs = ['DIFFERENT_INPUT'];
    workflows.workflows[0].permissionProfile = 'missing-profile';
    writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /unknown permission profile missing-profile/u.test(error.details.join('\n'))
        && /behavior required inputs differ from workflow policy/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading rejects predicate references to undeclared inputs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-predicate-invariant-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'behaviors.json');
    const behaviors = JSON.parse(readFileSync(path, 'utf8'));
    behaviors.behaviors[0].decisionTable[0].predicate = { op: 'input-present', input: 'UNKNOWN_INPUT' };
    writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /predicates reference unknown inputs: UNKNOWN_INPUT/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('spec loading rejects lexical and absolute paths outside the product root', () => {
  assert.throws(() => readJson(fixture, '../../../package.json'), /escapes root/u);
  assert.throws(() => readJson(fixture, resolve(fixture, 'product.json')), /absolute spec path/u);
  assert.throws(
    () => validateAndLoadSpecBundle(fixture, {
      validateSchema: accept,
      layout: {
        frameworkPath: '../../../package.json',
        productPath: 'product.json',
        workflowsPath: 'workflows.json',
        behaviorsPath: 'behaviors.json',
      },
    }),
    (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.LAYOUT,
  );
});

test('validated spec loading contains adapter definitions to the product directory', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-adapter-containment-'));
  const outsideName = `${basename(root)}-outside.json`;
  const outsidePath = resolve(root, '..', outsideName);
  try {
    cpSync(fixture, root, { recursive: true });
    const productPath = resolve(root, 'product.json');
    const product = JSON.parse(readFileSync(productPath, 'utf8'));
    product.adapterDefinitions = [`../${outsideName}`];
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
    writeFileSync(outsidePath, '{}\n');
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError && error.code === SPEC_ERROR.LAYOUT,
    );
  } finally {
    rmSync(outsidePath, { force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('spec loading rejects symbolic-link path components', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-symlink-'));
  const outside = mkdtempSync(resolve(tmpdir(), 'validated-spec-outside-'));
  try {
    writeFileSync(resolve(outside, 'escaped.json'), '{}\n');
    symlinkSync(outside, resolve(root, 'linked'));
    assert.throws(() => readJson(root, 'linked/escaped.json'), /symbolic link/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
