import assert from 'node:assert/strict';

function assertString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function assertStringArray(value, label, { nonEmpty = false } = {}) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  if (nonEmpty) assert.ok(value.length > 0, `${label} must not be empty`);
  for (const [index, entry] of value.entries()) assertString(entry, `${label}[${index}]`);
}

export function parseDemoCommandInvocation(value, namespace) {
  assertString(value, 'command invocation');
  const pattern = new RegExp(`^/${namespace}:([a-z0-9]+(?:-[a-z0-9]+)*)(?:\\s+([A-Z][A-Z0-9_]*=[a-z0-9-]+(?:\\s+[A-Z][A-Z0-9_]*=[a-z0-9-]+)*))?$`, 'u');
  const match = pattern.exec(value);
  assert.ok(match, `command invocation must use /${namespace}:<id> with optional KEY=value selectors: ${value}`);
  return { id: match[1], selectors: match[2]?.split(/\s+/u) ?? [] };
}

function assertCommonFixture(fixture) {
  assert.ok(fixture && typeof fixture === 'object' && !Array.isArray(fixture), 'fixture must be an object');
  assert.match(fixture.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, 'fixture id is invalid');
  assert.ok(['route', 'review', 'verification'].includes(fixture.mode), `${fixture.id} has unexpected mode`);
  assertString(fixture.title, `${fixture.id}.title`);
  assertString(fixture.request, `${fixture.id}.request`);
  assert.ok(fixture.expected && typeof fixture.expected === 'object' && !Array.isArray(fixture.expected), `${fixture.id}.expected must be an object`);
  assertStringArray(fixture.expected.outputSignals, `${fixture.id}.expected.outputSignals`, { nonEmpty: true });
  assertStringArray(fixture.expected.failureSignals, `${fixture.id}.expected.failureSignals`, { nonEmpty: true });
  assertStringArray(fixture.boundaries, `${fixture.id}.boundaries`, { nonEmpty: true });
}

function assertKnownWorkflow(invocation, model, expectedStage, label) {
  const parsed = parseDemoCommandInvocation(invocation, model.namespace);
  const workflow = model.workflowsById.get(parsed.id);
  assert.ok(workflow, `${label} references unknown workflow ${parsed.id}`);
  assert.equal(workflow.stage, expectedStage, `${label} workflow stage is ${workflow.stage}, expected ${expectedStage}`);
  return parsed;
}

export function demoFixtureModel(compiledModel) {
  const workflows = compiledModel.workflows?.workflows;
  const packs = compiledModel.product?.packs;
  const namespace = compiledModel.product?.pluginNamespace;
  assert.ok(Array.isArray(workflows), 'compiled model is missing workflows');
  assert.ok(Array.isArray(packs), 'compiled model is missing product packs');
  assertString(namespace, 'compiled model plugin namespace');
  return {
    namespace,
    workflowsById: new Map(workflows.map((workflow) => [workflow.id, workflow])),
    packIds: new Set(packs),
  };
}

export function assertDemoFixtureContract(fixture, model) {
  assertCommonFixture(fixture);

  if (fixture.mode === 'route') {
    assertString(fixture.expected.nextCommand, `${fixture.id}.expected.nextCommand`);
    assertString(fixture.expected.stage, `${fixture.id}.expected.stage`);
    assert.equal(fixture.expected.stage, fixture.expected.stage.toLowerCase(), `${fixture.id}.expected.stage must use the canonical lowercase stage`);
    assertKnownWorkflow(fixture.expected.nextCommand, model, fixture.expected.stage, `${fixture.id}.expected.nextCommand`);
    assertStringArray(fixture.expected.packs, `${fixture.id}.expected.packs`);
    for (const pack of fixture.expected.packs) assert.ok(model.packIds.has(pack), `${fixture.id} references unknown capability pack ${pack}`);
    assertStringArray(fixture.expected.requiredInputs, `${fixture.id}.expected.requiredInputs`, { nonEmpty: true });
  } else if (fixture.mode === 'review') {
    assertString(fixture.expected.command, `${fixture.id}.expected.command`);
    assertKnownWorkflow(fixture.expected.command, model, 'review', `${fixture.id}.expected.command`);
    assert.ok(fixture.expected.primaryFinding && typeof fixture.expected.primaryFinding === 'object', `${fixture.id}.expected.primaryFinding must be an object`);
    for (const field of ['severity', 'signal', 'expectedFixDirection']) assertString(fixture.expected.primaryFinding[field], `${fixture.id}.expected.primaryFinding.${field}`);
    assertStringArray(fixture.expected.requiredInputs, `${fixture.id}.expected.requiredInputs`, { nonEmpty: true });
  } else {
    assertString(fixture.expected.command, `${fixture.id}.expected.command`);
    assertKnownWorkflow(fixture.expected.command, model, 'finalize', `${fixture.id}.expected.command`);
    for (const field of ['changedFiles', 'validation', 'skippedChecks', 'residualRisk']) {
      assertStringArray(fixture.expected[field], `${fixture.id}.expected.${field}`, { nonEmpty: true });
    }
  }

  return true;
}
