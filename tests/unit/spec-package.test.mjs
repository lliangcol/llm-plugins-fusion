import assert from 'node:assert/strict';
import fs, { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
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
  const uncheckedBundle = specApi.loadSpecBundleUnchecked(fixture);
  assert.deepEqual(specApi.inspectSpecBundle(uncheckedBundle), {
    namespace: 'acme-flow',
    workflowSchemaVersion: 5,
    behaviorSchemaVersion: 1,
    workflowCount: 3,
    adapterIds: ['mock'],
    stages: ['intake', 'shape', 'assure'],
  });
  const uncheckedCompiled = compilerApi.compileDirectoryUnchecked(fixture);
  assert.equal(uncheckedCompiled.runtimeContracts.length, 3);
  assert.deepEqual(compilerApi.buildArtifact(uncheckedCompiled), {
    schemaVersion: 1,
    namespace: 'acme-flow',
    workflows: uncheckedCompiled.runtimeContracts,
    adapters: [{ id: 'mock', enforcement: 'advisory' }],
  });
  assert.equal(compilerApi.compileDirectory(fixture, { validateSchema: accept }).runtimeContracts.length, 3);
});

test('validated loading preserves custom layout provenance through compilation', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-provenance-'));
  try {
    cpSync(fixture, root, { recursive: true });
    cpSync(resolve(root, 'workflows.json'), resolve(root, 'workflow-source.json'));
    cpSync(resolve(root, 'behaviors.json'), resolve(root, 'behavior-source.json'));
    const layout = {
      frameworkPath: 'framework.json',
      productPath: 'product.json',
      workflowsPath: 'workflow-source.json',
      behaviorsPath: 'behavior-source.json',
    };

    const bundle = validateAndLoadSpecBundle(root, { validateSchema: accept, layout });
    assert.deepEqual(bundle.provenance, {
      workflowSource: 'workflow-source.json',
      behaviorSource: 'behavior-source.json',
    });
    const compiled = compilerApi.compileDirectory(root, { validateSchema: accept, layout });
    assert.deepEqual(compiled.spec.sourceProvenance, bundle.provenance);
    assert.ok(compiled.runtimeContracts.every((contract) => contract.behaviorContract.source === 'behavior-source.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
  for (const validateSchema of [
    () => undefined,
    () => 'not-a-validation-result',
    async () => false,
    () => ({}),
  ]) {
    assert.throws(
      () => validateAndLoadSpecBundle(fixture, { validateSchema }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.SCHEMA
        && /validator returned/u.test(error.details.join('\n')),
    );
  }
  assert.doesNotThrow(() => validateAndLoadSpecBundle(fixture, {
    validateSchema: () => ({ valid: true, errors: [] }),
  }));
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

test('validated spec loading rejects owner agents and packs outside product inventories', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-product-inventory-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(path, 'utf8'));
    workflows.workflows[0].ownerAgents = ['ghost-agent'];
    workflows.workflows[0].recommendedPacks = ['ghost-pack'];
    writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /unknown product owner agents: ghost-agent/u.test(error.details.join('\n'))
        && /unknown product recommended packs: ghost-pack/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading rejects empty and non-portable inventory identities without schema help', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-empty-identities-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const productPath = resolve(root, 'product.json');
    const product = JSON.parse(readFileSync(productPath, 'utf8'));
    product.agents.push('.md');
    product.packs.push('.md');
    product.tools.push('');
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);

    const workflowPath = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(workflowPath, 'utf8'));
    workflows.workflows[0].ownerAgents = ['.md'];
    workflows.workflows[0].recommendedPacks = ['.md'];
    workflows.workflows[0].requiredInputs = [''];
    writeFileSync(workflowPath, `${JSON.stringify(workflows, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /product\.agents contains invalid portable identities/u.test(error.details.join('\n'))
        && /product\.packs contains invalid portable identities/u.test(error.details.join('\n'))
        && /product\.tools contains empty identities/u.test(error.details.join('\n'))
        && /ownerAgents contains invalid portable identities/u.test(error.details.join('\n'))
        && /recommendedPacks contains invalid portable identities/u.test(error.details.join('\n'))
        && /requiredInputs contains invalid input identities/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated spec loading rejects unknown and overlapping permission-profile tools', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-tool-inventory-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(path, 'utf8'));
    workflows.permissionProfiles.inspect.allowedTools.push('GhostAllowed');
    workflows.permissionProfiles.inspect.disallowedTools.push('Inspect', 'GhostDenied');
    writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /unknown allowed product tools: GhostAllowed/u.test(error.details.join('\n'))
        && /unknown disallowed product tools: GhostDenied/u.test(error.details.join('\n'))
        && /overlapping allowed and disallowed tools: Inspect/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated loading rejects empty, blank, and control-character runtime executable identities before conformance', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-runtime-executable-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const baseline = JSON.parse(readFileSync(path, 'utf8'));
    for (const name of ['', '   ', '\u0000']) {
      const workflows = structuredClone(baseline);
      workflows.workflows[0].runtimeRequirements = {
        executables: [{ name, required: true, versionEvidence: 'versioned-evidence' }],
        network: { need: 'none', purpose: 'none' },
        credentials: { need: 'none', source: 'none' },
      };
      writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);

      assert.throws(
        () => compilerApi.compileDirectory(root, { validateSchema: accept }),
        (error) => error instanceof SpecBundleError
          && error.code === SPEC_ERROR.INVARIANT
          && /runtime executable entries are invalid/u.test(error.details.join('\n')),
        JSON.stringify(name),
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated loading rejects inconsistent runtime capability needs before conformance', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-runtime-needs-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const baseline = JSON.parse(readFileSync(path, 'utf8'));
    for (const [runtimeRequirements, pattern] of [
      [
        { executables: [], network: { need: 'none', purpose: 'remote lookup' }, credentials: { need: 'none', source: 'none' } },
        /network need is none iff purpose is none/u,
      ],
      [
        { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'consumer-owned-authentication' } },
        /credential need is none iff source is none/u,
      ],
    ]) {
      const workflows = structuredClone(baseline);
      workflows.workflows[0].runtimeRequirements = runtimeRequirements;
      writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);

      assert.throws(
        () => compilerApi.compileDirectory(root, { validateSchema: accept }),
        (error) => error instanceof SpecBundleError
          && error.code === SPEC_ERROR.INVARIANT
          && pattern.test(error.details.join('\n')),
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated compilation rejects normalized variant aliases that collide with canonical defaults', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-variant-collision-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const productPath = resolve(root, 'product.json');
    const workflowPath = resolve(root, 'workflows.json');
    const behaviorPath = resolve(root, 'behaviors.json');
    const product = JSON.parse(readFileSync(productPath, 'utf8'));
    const workflows = JSON.parse(readFileSync(workflowPath, 'utf8'));
    const behaviors = JSON.parse(readFileSync(behaviorPath, 'utf8'));
    const canonicalWorkflow = workflows.workflows[0];
    const canonicalBehavior = behaviors.behaviors[0];

    canonicalBehavior.inputs.push({
      name: 'MODE',
      required: false,
      aliases: [],
      description: 'Exact routing mode.',
      default: 'safe',
      exactValues: ['safe', 'fast'],
    });
    workflows.workflows.push({
      ...structuredClone(canonicalWorkflow),
      id: 'triage-safe',
      legacyAlias: 'acme-triage-safe',
      outputContract: 'triage-safe-v1',
      variantPreset: { MODE: 'safe' },
      compatibilityAlias: true,
    });
    const aliasBehavior = structuredClone(canonicalBehavior);
    aliasBehavior.id = 'triage-safe';
    aliasBehavior.inputs.find((input) => input.name === 'MODE').exactValues = ['safe'];
    behaviors.behaviors.push(aliasBehavior);
    product.expectedWorkflowCount = workflows.workflows.length;
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
    writeFileSync(workflowPath, `${JSON.stringify(workflows, null, 2)}\n`);
    writeFileSync(behaviorPath, `${JSON.stringify(behaviors, null, 2)}\n`);

    assert.throws(
      () => compilerApi.compileDirectory(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /duplicate normalized variant contract/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated compilation rejects Contract v5 inputs that cannot migrate to typed inputs', () => {
  for (const input of [
    {
      name: 'REQUEST',
      required: true,
      aliases: ['INPUT'],
      description: 'Path request without its required policy.',
      type: 'path',
    },
    {
      name: 'REQUEST',
      required: true,
      aliases: ['INPUT'],
      description: 'Enum request without exact values.',
      type: 'enum',
    },
  ]) {
    const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-migration-readiness-'));
    try {
      cpSync(fixture, root, { recursive: true });
      const path = resolve(root, 'behaviors.json');
      const behaviors = JSON.parse(readFileSync(path, 'utf8'));
      behaviors.behaviors[0].inputs[0] = input;
      writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);

      assert.throws(
        () => compilerApi.compileDirectory(root, { validateSchema: accept }),
        (error) => error instanceof SpecBundleError
          && error.code === SPEC_ERROR.INVARIANT
          && /Contract v5 workflow migration is not ready/u.test(error.details.join('\n'))
          && (input.type === 'path'
            ? /typed path input requires pathPolicy/u.test(error.details.join('\n'))
            : /enum behavior input requires exactValues/u.test(error.details.join('\n'))),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('validated spec loading rejects Contract v6 typed input drift', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-v6-coherence-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const workflowPath = resolve(root, 'workflows.json');
    const behaviorPath = resolve(root, 'behaviors.json');
    const v5 = JSON.parse(readFileSync(workflowPath, 'utf8'));
    const v1 = JSON.parse(readFileSync(behaviorPath, 'utf8'));
    const v6 = compilerApi.migrateWorkflowSpec(v5, v1);
    const v2 = compilerApi.migrateBehaviorSpec(v1);
    v6.workflows[0].inputs[0].type = 'enum';
    v6.workflows[0].inputs[0].values = ['invented'];
    writeFileSync(workflowPath, `${JSON.stringify(v6, null, 2)}\n`);
    writeFileSync(behaviorPath, `${JSON.stringify(v2, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /typed input type differs from behavior input/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated Contract v6 loading requires one protocol tuple and coherent adapter enforcement', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-v6-protocols-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const frameworkPath = resolve(root, 'framework.json');
    const workflowPath = resolve(root, 'workflows.json');
    const behaviorPath = resolve(root, 'behaviors.json');
    const adapterPath = resolve(root, 'adapters/mock.json');
    const v5 = JSON.parse(readFileSync(workflowPath, 'utf8'));
    const v1 = JSON.parse(readFileSync(behaviorPath, 'utf8'));
    const baseline = {
      framework: JSON.parse(readFileSync(frameworkPath, 'utf8')),
      workflows: compilerApi.migrateWorkflowSpec(v5, v1),
      behaviors: compilerApi.migrateBehaviorSpec(v1),
      adapter: JSON.parse(readFileSync(adapterPath, 'utf8')),
    };
    baseline.framework.schemaVersion = 5;
    baseline.framework.protocolVersions = structuredClone(baseline.workflows.contractVersions);
    baseline.adapter.schemaVersion = 2;
    baseline.adapter.protocolVersions = {
      workflow: baseline.workflows.contractVersions.workflow,
      runtime: baseline.workflows.contractVersions.runtime,
      adapter: baseline.workflows.contractVersions.adapter,
    };
    baseline.adapter.contractEnforcement = {
      inputs: 'native',
      approval: 'hook',
      output: 'adapter',
      effects: 'native-and-hook',
      fallback: 'fail-closed',
    };

    const writeBundle = (bundle) => {
      writeFileSync(frameworkPath, `${JSON.stringify(bundle.framework, null, 2)}\n`);
      writeFileSync(workflowPath, `${JSON.stringify(bundle.workflows, null, 2)}\n`);
      writeFileSync(behaviorPath, `${JSON.stringify(bundle.behaviors, null, 2)}\n`);
      writeFileSync(adapterPath, `${JSON.stringify(bundle.adapter, null, 2)}\n`);
    };
    writeBundle(baseline);
    assert.doesNotThrow(() => validateAndLoadSpecBundle(root, { validateSchema: accept }));

    for (const scenario of [
      {
        pattern: /framework protocolVersions\.runtime must equal workflow contractVersions\.runtime/u,
        mutate(bundle) { bundle.framework.protocolVersions.runtime = '4.0.1'; },
      },
      {
        pattern: /mock: adapter protocolVersions\.workflow must equal framework protocolVersions\.workflow/u,
        mutate(bundle) { bundle.adapter.protocolVersions.workflow = '6.0.1'; },
      },
      {
        pattern: /mock: framework schema v5 requires adapter schema v2/u,
        mutate(bundle) { bundle.adapter.schemaVersion = 1; },
      },
      {
        pattern: /mock: contractEnforcement\.effects has unsupported value invented/u,
        mutate(bundle) { bundle.adapter.contractEnforcement.effects = 'invented'; },
      },
    ]) {
      const invalid = structuredClone(baseline);
      scenario.mutate(invalid);
      writeBundle(invalid);
      assert.throws(
        () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
        (error) => error instanceof SpecBundleError
          && error.code === SPEC_ERROR.INVARIANT
          && scenario.pattern.test(error.details.join('\n')),
      );
    }
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

test('validated loading conditionally requires the complete alias retirement policy', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-alias-policy-'));
  try {
    cpSync(fixture, root, { recursive: true });
    assert.doesNotThrow(() => validateAndLoadSpecBundle(root, { validateSchema: accept }));

    const productPath = resolve(root, 'product.json');
    const workflowPath = resolve(root, 'workflows.json');
    const behaviorPath = resolve(root, 'behaviors.json');
    const product = JSON.parse(readFileSync(productPath, 'utf8'));
    const workflows = JSON.parse(readFileSync(workflowPath, 'utf8'));
    const behaviors = JSON.parse(readFileSync(behaviorPath, 'utf8'));
    const canonicalWorkflow = workflows.workflows[0];
    const canonicalBehavior = behaviors.behaviors[0];
    canonicalBehavior.inputs.push({
      name: 'MODE',
      required: false,
      aliases: [],
      description: 'Exact triage compatibility mode.',
      default: 'safe',
      exactValues: ['safe', 'fast'],
    });
    workflows.workflows.push({
      ...structuredClone(canonicalWorkflow),
      id: 'triage-fast',
      legacyAlias: 'acme-triage-fast',
      outputContract: 'triage-fast-v1',
      variantPreset: { MODE: 'fast' },
      compatibilityAlias: true,
    });
    const aliasBehavior = structuredClone(canonicalBehavior);
    aliasBehavior.id = 'triage-fast';
    Object.assign(aliasBehavior.inputs.find((input) => input.name === 'MODE'), {
      default: 'fast',
      exactValues: ['fast'],
    });
    behaviors.behaviors.push(aliasBehavior);
    product.expectedWorkflowCount = workflows.workflows.length;
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
    writeFileSync(workflowPath, `${JSON.stringify(workflows, null, 2)}\n`);
    writeFileSync(behaviorPath, `${JSON.stringify(behaviors, null, 2)}\n`);

    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && /products with compatibility aliases must declare compatibilityAliasPolicy/u.test(error.details.join('\n')),
    );

    product.compatibilityAliasPolicy = {
      status: 'evidence-gated',
      removalRequires: [
        'real-benchmark-evidence',
        'native-permission-and-invocation-parity',
        'plugin-major-release',
        'governed-release-decision',
      ],
    };
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && /complete adapter-neutral retirement gates/u.test(error.details.join('\n')),
    );

    product.compatibilityAliasPolicy.removalRequires.push('migration-documentation');
    writeFileSync(productPath, `${JSON.stringify(product, null, 2)}\n`);
    assert.doesNotThrow(() => validateAndLoadSpecBundle(root, { validateSchema: accept }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated loading routes decision variants through the canonical resolver', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-decision-variant-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'behaviors.json');
    const behaviors = JSON.parse(readFileSync(path, 'utf8'));
    Object.assign(behaviors.behaviors[0].decisionTable[0], {
      route: 'triage',
      variantParameters: { REQUEST: 'not-a-selector' },
    });
    writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && /undeclared variant selector REQUEST/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated loading binds capability predicates to framework vocabulary', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-capability-predicate-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'behaviors.json');
    const behaviors = JSON.parse(readFileSync(path, 'utf8'));
    behaviors.behaviors[0].decisionTable[0].predicate = {
      op: 'all',
      args: [
        { op: 'capability-state', capability: 'ghostCapability', state: 'denied' },
        { op: 'not', arg: { op: 'capability-state', capability: 'workspaceRead', state: 'ghostState' } },
      ],
    };
    writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => {
        const details = error instanceof SpecBundleError ? error.details.join('\n') : '';
        return /unknown framework capability ghostCapability/u.test(details)
          && /unknown framework permission state ghostState/u.test(details);
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validated loading enforces path predicate input contracts', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-path-predicate-'));
  const pathPolicy = {
    root: 'workspace',
    mustExist: true,
    kind: 'file',
    readable: true,
    writable: true,
    outsideRoot: 'deny',
  };
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'behaviors.json');
    const baseline = JSON.parse(readFileSync(path, 'utf8'));

    const assertRejected = (mutate, pattern) => {
      const behaviors = structuredClone(baseline);
      mutate(behaviors.behaviors[0]);
      writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);
      assert.throws(
        () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
        (error) => error instanceof SpecBundleError && pattern.test(error.details.join('\n')),
      );
    };
    assertRejected(
      (behavior) => { behavior.decisionTable[0].predicate = { op: 'path-readable', input: 'REQUEST' }; },
      /path-readable input REQUEST must be path-like/u,
    );
    assertRejected(
      (behavior) => {
        Object.assign(behavior.inputs[0], { type: 'path', pathPolicy: { ...pathPolicy, readable: false } });
        behavior.decisionTable[0].predicate = { op: 'path-readable', input: 'REQUEST' };
      },
      /pathPolicy\.readable must be true/u,
    );
    assertRejected(
      (behavior) => {
        Object.assign(behavior.inputs[0], { type: 'path', pathPolicy: { ...pathPolicy, writable: false } });
        behavior.decisionTable[0].predicate = { op: 'path-writable', input: 'REQUEST' };
      },
      /pathPolicy\.writable must be true/u,
    );

    const workflowPath = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(workflowPath, 'utf8'));
    workflows.permissionProfiles.inspect.permissionPolicy.workspaceWrite = 'prompt';
    writeFileSync(workflowPath, `${JSON.stringify(workflows, null, 2)}\n`);
    for (const type of ['path', 'artifact-reference', 'review-reference']) {
      const behaviors = structuredClone(baseline);
      Object.assign(behaviors.behaviors[0].inputs[0], { type, pathPolicy });
      behaviors.behaviors[0].decisionTable[0].predicate = {
        op: 'all',
        args: [
          { op: 'path-readable', input: 'REQUEST' },
          { op: 'path-writable', input: 'REQUEST' },
        ],
      };
      writeFileSync(path, `${JSON.stringify(behaviors, null, 2)}\n`);
      assert.doesNotThrow(() => validateAndLoadSpecBundle(root, { validateSchema: accept }));
    }
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

test('validated spec loading rejects non-portable workflow contract paths', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-contract-path-'));
  try {
    cpSync(fixture, root, { recursive: true });
    const path = resolve(root, 'workflows.json');
    const workflows = JSON.parse(readFileSync(path, 'utf8'));
    workflows.workflows[0].contractPath = 'CON/escaped.md';
    writeFileSync(path, `${JSON.stringify(workflows, null, 2)}\n`);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: accept }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /contractPath/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

test('spec loading binds the opened file and rejects a leaf swapped after containment validation', { skip: process.platform === 'win32' }, () => {
  const root = mkdtempSync(resolve(tmpdir(), 'validated-spec-open-race-'));
  const outside = resolve(root, '..', `${basename(root)}-outside.json`);
  const target = resolve(root, 'target.json');
  const originalOpenSync = fs.openSync;
  let swapped = false;
  try {
    writeFileSync(target, '{"source":"inside"}\n');
    writeFileSync(outside, '{"source":"outside"}\n');
    const physicalTarget = fs.realpathSync(target);
    fs.openSync = function guardedOpen(path, ...args) {
      if (!swapped && path === physicalTarget) {
        swapped = true;
        unlinkSync(target);
        symlinkSync(outside, target);
      }
      return originalOpenSync.call(this, path, ...args);
    };
    syncBuiltinESMExports();
    assert.throws(() => readJson(root, 'target.json'), /symbolic link|ELOOP|changed identity/u);
    assert.equal(swapped, true);
  } finally {
    fs.openSync = originalOpenSync;
    syncBuiltinESMExports();
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { force: true });
  }
});
