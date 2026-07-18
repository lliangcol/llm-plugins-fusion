import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { CURRENT_PROTOCOL_VERSIONS } from '../../framework/core/protocol-coherence.mjs';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '../../framework/migrate/v6.mjs';
import { SPEC_ERROR, SpecBundleError, validateAndLoadSpecBundle } from '../../packages/spec/validated.mjs';
import { validate } from '../../scripts/validate-schemas.mjs';

const fixtureRoot = resolve('fixtures/products/minimal-plugin');
const loadJson = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));

function v4v5v1Bundle() {
  return {
    framework: loadJson(resolve(fixtureRoot, 'framework.json')),
    product: loadJson(resolve(fixtureRoot, 'product.json')),
    workflows: loadJson(resolve(fixtureRoot, 'workflows.json')),
    behaviors: loadJson(resolve(fixtureRoot, 'behaviors.json')),
    adapters: [loadJson(resolve(fixtureRoot, 'adapters/mock.json'))],
  };
}

function upgradeFrameworkAndAdapter(bundle) {
  bundle.framework.schemaVersion = 5;
  bundle.framework.protocolVersions = structuredClone(CURRENT_PROTOCOL_VERSIONS);
  const adapter = bundle.adapters[0];
  adapter.schemaVersion = 2;
  adapter.protocolVersions = {
    workflow: CURRENT_PROTOCOL_VERSIONS.workflow,
    runtime: CURRENT_PROTOCOL_VERSIONS.runtime,
    adapter: CURRENT_PROTOCOL_VERSIONS.adapter,
  };
  // Dimensions describe separate enforcement mechanisms. They are not aliases
  // for the adapter's aggregate advisory classification.
  adapter.contractEnforcement = {
    inputs: 'native',
    approval: 'hook',
    output: 'adapter',
    effects: 'native-and-hook',
    fallback: 'fail-closed',
  };
  return bundle;
}

function v5v5v1Bundle() {
  return upgradeFrameworkAndAdapter(v4v5v1Bundle());
}

function v5v6v2Bundle() {
  const bundle = v5v5v1Bundle();
  bundle.workflows = migrateWorkflowSpec(bundle.workflows, bundle.behaviors);
  bundle.behaviors = migrateBehaviorSpec(bundle.behaviors);
  return bundle;
}

test('pure compiler accepts exactly the three governed protocol lanes', () => {
  for (const bundle of [v4v5v1Bundle(), v5v5v1Bundle(), v5v6v2Bundle()]) {
    assert.doesNotThrow(() => compileProductBundle(bundle));
  }
  const unsupported = v4v5v1Bundle();
  unsupported.framework.schemaVersion = 3;
  assert.throws(() => compileProductBundle(unsupported), /unsupported framework schema version 3/u);
});

test('validated package applies protocol coherence to every supported lane', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'product-protocol-coherence-'));
  const writeBundle = (bundle) => {
    writeFileSync(resolve(root, 'framework.json'), `${JSON.stringify(bundle.framework, null, 2)}\n`);
    writeFileSync(resolve(root, 'workflows.json'), `${JSON.stringify(bundle.workflows, null, 2)}\n`);
    writeFileSync(resolve(root, 'behaviors.json'), `${JSON.stringify(bundle.behaviors, null, 2)}\n`);
    writeFileSync(resolve(root, 'adapters/mock.json'), `${JSON.stringify(bundle.adapters[0], null, 2)}\n`);
  };
  try {
    cpSync(fixtureRoot, root, { recursive: true });
    for (const bundle of [v4v5v1Bundle(), v5v5v1Bundle(), v5v6v2Bundle()]) {
      writeBundle(bundle);
      assert.doesNotThrow(() => validateAndLoadSpecBundle(root, { validateSchema: () => true }));
    }
    const invalid = v5v6v2Bundle();
    invalid.adapters[0].protocolVersions.workflow = '6.0.1';
    writeBundle(invalid);
    assert.throws(
      () => validateAndLoadSpecBundle(root, { validateSchema: () => true }),
      (error) => error instanceof SpecBundleError
        && error.code === SPEC_ERROR.INVARIANT
        && /adapter protocolVersions\.workflow must equal framework protocolVersions\.workflow/u.test(error.details.join('\n')),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('framework generation selects adapter generation and binds protocol tuples', () => {
  const framework4Adapter2 = upgradeFrameworkAndAdapter(v4v5v1Bundle());
  framework4Adapter2.framework.schemaVersion = 4;
  delete framework4Adapter2.framework.protocolVersions;
  assert.throws(() => compileProductBundle(framework4Adapter2), /framework schema v4 requires adapter schema v1/u);

  const framework5Adapter1 = v5v5v1Bundle();
  framework5Adapter1.adapters[0] = v4v5v1Bundle().adapters[0];
  assert.throws(() => compileProductBundle(framework5Adapter1), /framework schema v5 requires adapter schema v2/u);

  const wrongProjection = v5v5v1Bundle();
  wrongProjection.workflows.contractVersions.workflow = '5.1.0';
  assert.throws(() => compileProductBundle(wrongProjection), /compatibilityProjection must equal the v5 workflow contract version/u);

  const wrongAdapterTuple = v5v5v1Bundle();
  wrongAdapterTuple.adapters[0].protocolVersions.runtime = '4.0.1';
  assert.throws(() => compileProductBundle(wrongAdapterTuple), /adapter protocolVersions\.runtime must equal framework protocolVersions\.runtime/u);

  const wrongV6Tuple = v5v6v2Bundle();
  wrongV6Tuple.workflows.contractVersions.runtime = '4.0.1';
  assert.throws(() => compileProductBundle(wrongV6Tuple), /framework protocolVersions\.runtime must equal workflow contractVersions\.runtime/u);

  const wrongBehavior = v5v6v2Bundle();
  wrongBehavior.behaviors.schemaVersion = 1;
  assert.throws(() => compileProductBundle(wrongBehavior), /workflow schema v6 requires behavior schema v2/u);
});

test('adapter contract dimensions follow their own schema values, not aggregate enforcement', () => {
  const valid = v5v5v1Bundle();
  valid.adapters[0].enforcement = 'advisory';
  assert.doesNotThrow(() => compileProductBundle(valid));

  const invalid = v5v5v1Bundle();
  invalid.adapters[0].contractEnforcement.approval = 'native-and-hook';
  assert.throws(() => compileProductBundle(invalid), /contractEnforcement\.approval has unsupported value native-and-hook/u);
});

test('framework vocabulary and adapter evidence levels are enforced by the pure compiler', () => {
  for (const scenario of [
    {
      pattern: /outside framework\.permissionStates/u,
      mutate(bundle) { bundle.framework.permissionStates = bundle.framework.permissionStates.filter((value) => value !== 'denied'); },
    },
    {
      pattern: /outside framework\.permissionPolicyKeys/u,
      mutate(bundle) { bundle.framework.permissionPolicyKeys = bundle.framework.permissionPolicyKeys.filter((value) => value !== 'workspaceRead'); },
    },
    {
      pattern: /outside framework\.riskLevels/u,
      mutate(bundle) { bundle.framework.riskLevels = bundle.framework.riskLevels.filter((value) => value !== 'none'); },
    },
    {
      pattern: /outside framework\.runtimeNeedLevels/u,
      mutate(bundle) {
        bundle.workflows.workflows[0].runtimeRequirements = {
          executables: [],
          network: { need: 'none', purpose: 'none' },
          credentials: { need: 'none', source: 'none' },
        };
        bundle.framework.runtimeNeedLevels = bundle.framework.runtimeNeedLevels.filter((value) => value !== 'none');
      },
    },
    {
      pattern: /outside framework\.credentialSources/u,
      mutate(bundle) {
        bundle.workflows.workflows[0].runtimeRequirements = {
          executables: [],
          network: { need: 'none', purpose: 'none' },
          credentials: { need: 'none', source: 'none' },
        };
        bundle.framework.credentialSources = bundle.framework.credentialSources.filter((value) => value !== 'none');
      },
    },
    {
      pattern: /outside framework\.enforcementLevels/u,
      mutate(bundle) { bundle.framework.enforcementLevels = bundle.framework.enforcementLevels.filter((value) => value !== 'advisory'); },
    },
    {
      pattern: /unknown framework capability ghostCapability/u,
      mutate(bundle) {
        bundle.behaviors.behaviors[0].decisionTable[0].when = {
          op: 'capability-state',
          capability: 'ghostCapability',
          state: 'denied',
        };
      },
    },
    {
      pattern: /unknown framework permission state ghostState/u,
      mutate(bundle) {
        bundle.behaviors.behaviors[0].decisionTable[0].when = {
          op: 'not',
          arg: { op: 'capability-state', capability: 'workspaceRead', state: 'ghostState' },
        };
      },
    },
    {
      pattern: /evidenceRequiredFor must exactly equal/u,
      mutate(bundle) { bundle.adapters[0].evidenceRequiredFor = []; },
    },
    {
      pattern: /declaredLevel must not exceed maximumSupportedLevel/u,
      mutate(bundle) { bundle.adapters[0].declaredLevel = 'L3'; },
    },
  ]) {
    const bundle = v5v6v2Bundle();
    scenario.mutate(bundle);
    assert.throws(() => compileProductBundle(bundle), scenario.pattern);
  }
});

test('framework and adapter schemas close legacy fields and bind evidence ranges', () => {
  const frameworkSchema = loadJson('schemas/workflow-framework.schema.json');
  const adapterSchema = loadJson('schemas/workflow-adapter.schema.json');
  const framework4 = v4v5v1Bundle().framework;
  const adapter1 = v4v5v1Bundle().adapters[0];
  const adapter2 = v5v5v1Bundle().adapters[0];

  assert.deepEqual(validate(frameworkSchema, framework4), []);
  const framework4WithProtocols = structuredClone(framework4);
  framework4WithProtocols.protocolVersions = structuredClone(CURRENT_PROTOCOL_VERSIONS);
  assert.notDeepEqual(validate(frameworkSchema, framework4WithProtocols), []);

  assert.deepEqual(validate(adapterSchema, adapter1), []);
  assert.deepEqual(validate(adapterSchema, adapter2), []);
  for (const mutate of [
    (adapter) => { adapter.protocolVersions = structuredClone(adapter2.protocolVersions); },
    (adapter) => { adapter.contractEnforcement = structuredClone(adapter2.contractEnforcement); },
  ]) {
    const invalid = structuredClone(adapter1);
    mutate(invalid);
    assert.notDeepEqual(validate(adapterSchema, invalid), []);
  }

  const descending = structuredClone(adapter2);
  descending.declaredLevel = 'L3';
  descending.maximumSupportedLevel = 'L2';
  descending.evidenceRequiredFor = [];
  assert.notDeepEqual(validate(adapterSchema, descending), []);
  const incomplete = structuredClone(adapter2);
  incomplete.evidenceRequiredFor = [];
  assert.notDeepEqual(validate(adapterSchema, incomplete), []);
  const reordered = structuredClone(adapter2);
  reordered.declaredLevel = 'L1';
  reordered.maximumSupportedLevel = 'L3';
  reordered.evidenceRequiredFor = ['L3', 'L2'];
  assert.notDeepEqual(validate(adapterSchema, reordered), []);
});
